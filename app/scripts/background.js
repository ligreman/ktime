'use strict';

logger('segundo plano');

/* When the browser-action button is clicked... si no hay popup */
//chrome.browserAction.onClicked.addListener(function (tab) {});

var kioskTab, marcajesCounter = 0, hasMarcajes = false,
    thisTokens = {}, hasLogged = false, hasNavigated = false,
    thisUser = null, thisPassword = null, whoAsked;

//Compruebo si necesito actualizar
needUpdate();

chrome.alarms.onAlarm.addListener(function (alarm) {
        switch (alarm.name) {
            case 'autoUpdateMarcajes':
            case 'autoUpdateMarcajesOnce':
                logger('Auto updateo');
                updateMarcajes(null, null, null);
                break;
            case 'finishUpdate':
                //Lanzo el procesado de los datos para guardar un json
                marcajesToJSON(function () {
                    if (whoAsked === 'login' || whoAsked === 'popup') {
                        chrome.runtime.sendMessage(
                            {
                                who: 'csBackground',
                                action: 'finishUpdate',
                                to: whoAsked
                            },
                            function (response) {
                            });
                    }
                });
                break;
            case 'readyToGo':
                chrome.browserAction.setBadgeText({text: '¡Go!'});
                chrome.browserAction.setBadgeBackgroundColor({color: '#5DA715'});
                //Notificaciones
                notifica('Ale, pa casa', '¡Ya has cumplido con tu horario de hoy!', 'images/icon-128.png');
                break;
        }
    }
);

//Gestiono los mensajes desde la página de contenido
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    //Listener de forzar getMarcajes
    if (msg.who && (msg.who === 'csPopup')) {
        if (msg.action === 'updateMarcajes') {
            //Respondo con OK voy a actualizar
            sendResponse({
                respuesta: 'ok'
            });

            updateMarcajes(null, null, msg.iam);
        } else if (msg.action === 'changedPreferences') {
            marcajesToJSON(function () {
                sendResponse({
                    respuesta: 'ok'
                });
            });
        }
    }

    //Listener de config
    if (msg.who && (msg.who === 'csConfig')) {
        if (msg.action === 'updateMarcajes') {
            //Respondo con OK voy a actualizar
            sendResponse({
                respuesta: 'ok'
            });

            //Actualizo información
            updateMarcajes(msg.user, msg.password, msg.iam);
        } else if (msg.action === 'checkTimer') {
            needUpdate();
        }
    }

    //La página de login me pide los datos
    if (msg.who && (msg.who === 'csLogin')) {
        if (msg.action === 'instruction') {
            //Si no tengo los datos de login los busco
            if (thisUser === null) {
                var loginData = decodifica(localStorage.getItem('klogin'));
                if (loginData !== null) {
                    thisUser = loginData.user;
                    thisPassword = loginData.password;
                    whoAsked = 'background';
                } else {
                    return null;
                }
            }

            //Hago login si no lo he hecho ya
            if (!hasLogged) {
                //Le digo que haga login
                sendResponse({
                    respuesta: 'doLogin',
                    usuario: thisUser,
                    pass: thisPassword
                });
                hasLogged = true;
                sendProgreso(20, whoAsked);
            } else {
                sendProgreso(45, whoAsked);
            }
        } else if (msg.action === 'errorLogin') {
            sendErrorLogin(whoAsked);
        }
    }

    //La página de menú
    if (msg.who && (msg.who === 'csMenu')) {
        if (msg.action === 'instruction') {
            if (!hasNavigated) {
                logger('Le digo que navegue');
                //Le digo que haga login
                sendResponse({respuesta: 'doNavigate'});
                hasNavigated = true;
                sendProgreso(65, whoAsked);
            }
        }
    }

    //Página de listados
    if (msg.who && (msg.who === 'csListado')) {
        logger(msg);

        if (msg.action === 'marcajes') {
            logger('Ha dado a marcajes Visualizar');
            var tabi = getKioskTab();

            if (!hasMarcajes && tabi !== null && tabi !== undefined) {
                chrome.tabs.remove(tabi.id);
                setKioskTab(null);
                sendProgreso(85, whoAsked);

                var dat = new Date();
                //Proceso la tabla de marcajes
                var table = atob(msg.data.table);
                var marcajes = processMarkTable(table);

                if (marcajes.length > 0) {
                    hasMarcajes = true;
                }

                localStorage.setItem('klastdataupdatetime', dat.getTime());
                localStorage.setItem('kmarcajes', codifica(marcajes));

                //Lanzo una alarma para decir que finalizo
                chrome.alarms.create('finishUpdate', {
                    when: 1000
                });
            }
        }
    }
});

function setKioskTab(tab) {
    kioskTab = tab;
}

function getKioskTab() {
    return kioskTab;
}

//Comprueba si se requiere o no una actualización de datos
function needUpdate() {
    logger('needeo update?');
    var ultimoUpdate = parseInt(localStorage.getItem('klastdataupdatetime')),
        config = decodifica(localStorage.getItem('kconfig')),
        ahora = new Date();

    if (isNaN(ultimoUpdate)) {
        logger('necesito actualizar por no tener datos de lasttime');
        //Actualizo en 1 minuto
        chrome.alarms.create('autoUpdateMarcajesOnce', {
            delayInMinutes: 1
        });
        //updateMarcajes(null, null, null);
    }

    //Verifico si los datos están ya obsoletos (más de 1 hora sin actualizar)
    //y miro si el autoupdate está activado y en ese caso actualizo
    if ((ahora.getTime() > (ultimoUpdate + 60 * 60 * 1000)) && config.autoupdate === true) {
        logger('necesito actualizar por datos caducados');
        //Actualizo en 1 minuto
        chrome.alarms.create('autoUpdateMarcajesOnce', {
            delayInMinutes: 1
        });
        //updateMarcajes(null, null, null);
    }

    chrome.alarms.clear('autoUpdateMarcajes');

    //Independientemente de que se haya actualizado, compruebo si esta el autoupdate activo
    if (config.autoupdate) {
        var periodo = parseInt(config.autoupdatetime);
        //Creo uno
        chrome.alarms.create('autoUpdateMarcajes', {
            delayInMinutes: periodo,
            periodInMinutes: periodo
        });
    }

    return null;
}

//Inicia el proceso de actualización de marcajes
function updateMarcajes(user, pass, who) {
    //Inicio el proceso de actualización
    thisTokens = {};
    hasLogged = false;
    hasNavigated = false;
    hasMarcajes = false;
    marcajesCounter = 0;

    //Si no me pasan los datos intento sacarlos del storage
    if (user === null) {
        var loginData = decodifica(localStorage.getItem('klogin'));
        if (loginData === null || loginData === '') {
            return null;
        } else {
            thisUser = loginData.user;
            thisPassword = loginData.password;
            whoAsked = (who === null) ? 'background' : who;
        }
    } else {
        thisUser = user;
        thisPassword = pass;
        whoAsked = who;
    }

    //Abro la página de login y comienzo el proceso
    chrome.tabs.create(
        {
            url: 'http://srv-tornos/EVALOSNET/SuiteKiosko/DEFECTO/LOGIN.ASPX',
            active: false
        },
        function (tab) {
            //kioskTab = tab;
            setKioskTab(tab);
        });
}

//Envio el progreso a quien esté escuchando
function sendProgreso(num, destino) {
    chrome.runtime.sendMessage(
        {
            who: 'csBackground',
            action: 'updateProgreso',
            to: destino,
            value: num
        },
        function (response) {
        });
}

//Envío un aviso de que el login ha fallado
function sendErrorLogin(destino) {
    chrome.runtime.sendMessage(
        {
            who: 'csBackground',
            action: 'errorLogin',
            to: destino
        },
        function (response) {
        });
}

//Parsea la tabla de marcajes
function processMarkTable(stringHtml) {
    var obj = $.parseHTML(stringHtml),
        kmarcajes = [];

    //Recorro las filas de la tabla
    $(obj).find('tr').each(function (index) {
        //Salto la primera línea que son los encabezados
        if (index > 0) {
            var fecha = $(this).find('td:eq(2)').text();
            var marcas = $(this).find('td:eq(3)').text();
            kmarcajes.push({
                fecha: fecha,
                marcas: marcas.trim()
            });
        }
    });

    return kmarcajes;
}

function notifica(titulo, mensaje, icono) {
    chrome.notifications.create('kt', {
        type: 'basic',
        title: titulo,
        message: mensaje,
        iconUrl: icono
    }, function (notificationId) {
    });
}


function marcajesToJSON(callback) {
    var marcajesData = decodifica(localStorage.getItem('kmarcajes'));
    logger('Todos los marcajes');
    /* Array
     fecha: "09/03/2015"
     marcas: "08:06 000 E LOC FL 14:54 000 S LOC FH 15:51 000 E LOC    18:12 000 S LOC"
     */
    //"08:15 000 E LOC FM 11:38 016 i LOC    11:48 016 f LOC"
    logger(marcajesData);

    var informacion = getMarcajesInfo(marcajesData),
        thead = '<th class="botonera"><button id="refreshButton" class="btn btn-default btn-xs btn-flat nomargin"><i class="mdi-av-loop"></i> Refrescar</button></th>',
        rowMarcas = '<th>Marcajes</th>',
        rowHecho = '<th>Hecho</th>',
        rowRestante = '<th>Restante</th>',
        horaSalida, dataHechos = [], hoyEs = new Date(), ultimoMarcajeDelDia = '';

    var numHoyEs = hoyEs.getDay() - 1; //Lo convierto a mi forma de contar días

    //Recorro los días
    $.each(informacion, function (index, dia) {
        thead += '<th>' + dia.fecha + '</th>';

        //Si es hoy guardo el ultimo marcaje
        if (numHoyEs === index) {
            ultimoMarcajeDelDia = dia.ultimoMarcaje;
        }

        //Si los datos son null pondré celdas en blanco
        if (dia.marcas === null) {
            rowMarcas += '<td></td>'; //vacío
        } else {
            var marcasDelDia = '';

            //E, S, i (~S), f (~E)
            $.each(dia.marcas, function (index2, marca) {
                marcasDelDia += '<p class="marcaje">';
                if (marca.type === 'E' || marca.type === 'f') {
                    marcasDelDia += '<img title="Entrada" src="images/enter.png" />';
                } else if (marca.type === 'S' || marca.type === 'i') {
                    marcasDelDia += '<img title="Salida" src="images/exit.png" />';
                }
                marcasDelDia += marca.time;
                switch (marca.code) {
                    case '016':
                        marcasDelDia += '<img class="mini" title="Código ' + marca.code + '" src="images/coffee.png" />';
                        break;
                    default:
                        marcasDelDia += '<i title="Código ' + marca.code + '" class="mdi-hardware-keyboard-control"></i>';
                }
                marcasDelDia += '</p>';
            });
            rowMarcas += '<td>' + marcasDelDia + '</td>';
        }

        var minsHechos = (dia.minutosTotales === null) ? 0 : parseInt(dia.minutosTotales),
            minsRetribuidosDes = (dia.retribuidoDesayuno === null) ? 0 : parseInt(dia.retribuidoDesayuno),
            htmlRestris = '';

        if (minsRetribuidosDes > 0) {
            htmlRestris += ' <i class="mdi-action-restore" title="Retribuido por desayuno: ' + minsRetribuidosDes + ' min" data-toggle="tooltip"></i>';
        }

        rowHecho += '<td data-minutos="' + minsHechos + '">' + formatTime(dia.horas) + ':' + formatTime(dia.minutos) + htmlRestris + '</td>';
        dataHechos.push({
            dia: queDiaEs(index),
            minutos: minsHechos,
            retribuidoDesayuno: minsRetribuidosDes
        });
    });
    sendProgreso(90, whoAsked);

    //Pongo los valores restantes
    var loDeseado = decodifica(localStorage.getItem('ktabledesiredtime')),
        loDescontado = decodifica(localStorage.getItem('ktablediscounttime')),
        loRetribuido = decodifica(localStorage.getItem('ktableretributiontime')),
        minutosRestantesDesdeUltimoMarcajeHoy = 0, minutosUltimoMarcaje = 0,
        minutosRestantesRealesHoy = 0, minutosActualesHoy = 0;

    minutosActualesHoy = aMinutos(hoyEs.getHours() + ':' + hoyEs.getMinutes());
    minutosUltimoMarcaje = aMinutos(ultimoMarcajeDelDia);

    //Restante
    $(dataHechos).each(function (index, loHecho) {
        var eldia = loHecho.dia;

        logger(loHecho);

        //El restante = hecho - descontado + retribuido
        var restante = loDeseado[eldia] - loHecho.minutos + parseInt(loDescontado[eldia]) - parseInt(loRetribuido[eldia]),
            style = '', minus = '';

        if (restante <= 0) {
            style = 'verde';
            minus = '- ';
        }

        //Cojo lo restante del día de hoy
        if (numHoyEs === index) {
            minutosRestantesDesdeUltimoMarcajeHoy = restante;

            //Calculo los minutos que realmente faltan por hoy
            minutosRestantesRealesHoy = minutosRestantesDesdeUltimoMarcajeHoy - (minutosActualesHoy - minutosUltimoMarcaje);

            rowRestante += '<td class="form-group has-info padTop15"><input type="text" data-restante="' + restante + '" class="form-control text-center floating-label ' + style + '" placeholder="' + minus + aHoraMinuto(Math.abs(restante)) + '" value="' + minus + aHoraMinuto(Math.abs(minutosRestantesRealesHoy)) + '" disabled="disabled"></td>';
        } else {
            rowRestante += '<td><span class="' + style + '" data-restante="' + restante + '">' + minus + aHoraMinuto(Math.abs(restante)) + '</span></td>';
        }
    });

    sendProgreso(95, whoAsked);

    //Estimar hora de salida. Cojo lo que queda por hacer hoy. Solo miro de lunes a viernes
    if (numHoyEs >= 0 && numHoyEs <= 4) {
        if (minutosRestantesDesdeUltimoMarcajeHoy <= 0) {
            chrome.browserAction.setBadgeText({text: '¡Go!'});
            chrome.browserAction.setBadgeBackgroundColor({color: '#5DA715'});
        } else {
            logger('Hora salida. ' + minutosUltimoMarcaje + ' - ' + minutosRestantesDesdeUltimoMarcajeHoy);
            horaSalida = aHoraMinuto(minutosUltimoMarcaje + minutosRestantesDesdeUltimoMarcajeHoy);

            //Cambio 1 por eles que cabe en la badge
            var horaSalidaBadge = horaSalida.replace(/[1]{1}/g, 'l');
            chrome.browserAction.setBadgeText({text: horaSalidaBadge});
            chrome.browserAction.setBadgeBackgroundColor({color: '#111111'});

            //Alarma de hora de salida
            var trozos = horaSalida.split(':'),
                salidaEs = new Date();
            salidaEs.setHours(trozos[0]);
            salidaEs.setMinutes(trozos[1]);
            logger('Hora salida ' + horaSalida);
            logger(salidaEs);
            chrome.alarms.create('readyToGo', {
                when: salidaEs.getTime()
            });

            //Limpio
            horaSalidaBadge = minutosUltimoMarcaje = trozos = salidaEs = null;
        }
    }

    //Actualizar texto ultima actualizacion
    var ultimaActu = new Date(parseInt(localStorage.getItem('klastdataupdatetime')));

    //JSON que voy a guardar
    var finalJson = {
        "thead": thead,
        "rowMarcas": rowMarcas,
        "rowHecho": rowHecho,
        "rowRestante": rowRestante,
        "horaSalida": horaSalida,
        "ultimaActualizacion": ultimaActu.toLocaleString()
    };
    localStorage.setItem('kdata', codifica(finalJson));
    sendProgreso(100, whoAsked);

    //Limpieza
    marcajesData = informacion = thead = rowMarcas = rowHecho = rowRestante = dataHechos = hoyEs = ultimoMarcajeDelDia = numHoyEs = loDescontado = loRetribuido = minutosRestantesDesdeUltimoMarcajeHoy = loDeseado = minutosUltimoMarcaje = ultimaActu = horaSalida = null;

    callback();
}

function getMarcajesInfo(datos) {
    var dias = [];

    //Por cada día (fila)
    $.each(datos, function (index, value) {
        var information = extractFichajes(value.marcas);
        //{minutosTotales: 0, minutos: 0, horas: 0, pendienteSalida: "08:06", code16: false}
        logger('Datos de información de la fila extraída', 'info');
        logger(information);

        if (information === null) {
            dias.push({
                fecha: value.fecha,
                minutosTotales: null,
                minutos: null,
                horas: null,
                pendienteSalida: null,
                retribuidoDesayuno: null,
                code16: null,
                marcas: null,
                ultimoMarcaje: null
            })
        } else {
            dias.push({
                fecha: value.fecha,
                minutosTotales: information.minutosTotales,
                minutos: information.minutos,
                horas: information.horas,
                pendienteSalida: information.pendienteSalida,
                retribuidoDesayuno: information.retribuidoDesayuno,
                code16: information.code16,
                marcas: information.marcas,
                ultimoMarcaje: information.ultimoMarcaje
            });
        }
    });

    logger('Datos finales', 'warn');
    logger(dias);
    return dias;
}

function extractFichajes(row) {
    var aux = row.match(/[0-9]{2}:[0-9]{2} [0-9]{3} [ESif]{1}/g),
        result = [];

    if (aux === null) {
        return null;
    }
    //logger(aux);
    for (var i = 0, ii = aux.length; i < ii; i++) {
        var data = aux[i].split(' ');
        result.push({
            time: data[0],
            code: data[1],
            type: data[2]
        });
    }
    logger('Una fila de marcajes parseada', 'warn');
    /* Array
     code: "000"
     time: "08:06"
     type: "E"
     */
    logger(result);
    return processFichajes(result);
}

//Procesa los fichajes de un dia para extraer información de horas
function processFichajes(fichajes) {
    var minutosHechos = 0, code016 = false, pendiente = null,
        tiempoRetribuidoDesayuno = 0, entrada016 = null, salida016 = null,
        entrada = null, salida = null, lastMarcaje = null;

    //Sacar las horas hechas
    $.each(fichajes, function (index, value) {
        //Busco pares entrada (E) salida (S)
        if (value.type === 'E' || value.type === 'f') {
            entrada = value;
            if (value.code === '016') {
                entrada016 = value;
            }
        } else if (value.type === 'S' || value.type === 'i') {
            salida = value;
            if (value.code === '016') {
                salida016 = value;
            }
        }

        //Si tengo ambos pares puedo calcular
        if (entrada !== null && salida !== null) {
            minutosHechos += tiempoEntreMarcajes(entrada, salida);
            logger('    Minutos: ' + minutosHechos);

            entrada = null;
            salida = null;
        }

        lastMarcaje = value;
    });

    //Compruebo si el código de desayuno está presente
    if (entrada016 !== null && salida016 !== null) {
        code016 = true;

        //Calculo el tiempo entre estos dos marcajes
        var minDesayunos = tiempoEntreMarcajes(entrada016, salida016);
        //El máximo retribuido por desayuno son 15 minutos
        tiempoRetribuidoDesayuno = Math.min(minDesayunos, 15);
    }

    //Miro a ver si me quedó entrada!=null y salida=null
    //que quiere decir que estoy dentro aún
    if (entrada !== null && salida === null) {
        pendiente = entrada.time;
    } else if (entrada !== null || salida !== null) {
        //Si no, ha pasado algo raro
        logger('-- Error --', 'error');
        logger(entrada);
        logger(salida);
        logger('-----------', 'error');
    }

    //Tiempos entre códigos 16 -> añado el tiempo
    if (code016) {
        minutosHechos += tiempoRetribuidoDesayuno;
    }

    return {
        minutosTotales: minutosHechos,
        minutos: minutosHechos % 60, //resto de la division min/60
        horas: parseInt(minutosHechos / 60), //parte entera, las horas
        pendienteSalida: pendiente,
        retribuidoDesayuno: tiempoRetribuidoDesayuno,
        code16: code016,
        marcas: fichajes,
        ultimoMarcaje: lastMarcaje.time
    };
}

//Calcula los minutos entre una entrada y una salida, o viceversa (para desayunos etc...)
function tiempoEntreMarcajes(entrada, salida) {
    var eTime = entrada.time.split(':');
    var sTime = salida.time.split(':');

    //Diferencia entre ambas
    var dateEntrada = new Date(2000, 0, 1, eTime[0], eTime[1]);
    var dateSalida = new Date(2000, 0, 1, sTime[0], sTime[1]);
    logger('    Entrada: ' + dateEntrada + ' (' + dateEntrada.getTime() + ')');
    logger('    Salida: ' + dateSalida + ' (' + dateSalida.getTime() + ')');
    var minutos = Math.round((dateSalida.getTime() - dateEntrada.getTime()) / (1000 * 60));

    return Math.abs(minutos);
}
