'use strict';

logger('\'Allo \'Allo! Popup');

var iAm = 'popup';

//Inicio
$(document).ready(function () {
    $.material.init();

    $('#marcajes-data').find('tr.config').hide();
    $('#configSaveButton').hide();
    $('[data-toggle="tooltip"]').tooltip();
    $('#kIFrame').hide();

    //Por defecto
    valoresPorDefecto();

    //Listeners
    $('input.iVD')
        .on('change', function () {
            horasSemanaDeseado();

            $('#configSaveButton').show();
        })
        .on('blur', function () {
            //Formateo los datos del input
            var datos = $(this).val();

            if (datos === '') {
                datos = '00:00';
                $(this).val(datos).keydown();
            }

            $(this).val(formatInputTime(datos));
        });
    $('input.ipVD')
        .on('change', function () {
            $('#configSaveButton').show();
        });

    $('#configSaveButton').on('click', function () {
        //Guardo los días deseados en localStorage
        var data = {};

        $('input.iVD').each(function () {
            var dia = $(this).attr('data-day'),
                jornada = $(this).parent('div').parent('th').find('input.ipVD').is(':checked');
            data[dia] = {
                minutos: aMinutos($(this).val()),
                jornadaContinua: jornada
            };
        });

        localStorage.setItem('ktabledesiredtime', codifica(data));

        desiredTimeConfig();

        //Le digo al background que he cambiado los datos para que actualize el localStorage
        chrome.runtime.sendMessage(
            {
                who: 'csPopup',
                action: 'changedPreferences',
                iam: iAm
            },
            function (response) {
                //si response OK entonces muestro la barra de progreso
                if (response.respuesta === 'ok') {
                    refreshTable();
                }
            });
    });

    $('input.iTD, input.iTR').on('blur', function () {
        var newVal = $(this).val();

        //A ver si el nuevo valor es correcto o no
        if (newVal !== '' && !isNaN(newVal)) {
            newVal = parseInt(newVal);
        } else {
            $(this).val(0);
            newVal = 0;
        }

        var campo = '';
        if ($(this).hasClass('iTD')) {
            campo = 'ktablediscounttime';
        } else {
            campo = 'ktableretributiontime';
        }

        var data = decodifica(localStorage.getItem(campo)),
            dia = $(this).attr('data-day');

        data[dia] = newVal;

        localStorage.setItem(campo, codifica(data));

        //Le digo al background que he cambiado los datos para que actualize el localStorage
        chrome.runtime.sendMessage(
            {
                who: 'csPopup',
                action: 'changedPreferences',
                iam: iAm
            },
            function (response) {
                //si response OK entonces muestro la barra de progreso
                if (response.respuesta === 'ok') {
                    refreshTable();
                }
            });
    });

    $('#goToMarcajes, #goToKiosko, #goToConfig').on('click', function (e) {
        e.preventDefault();
        $('#goToMarcajes, #goToKiosko, #goToConfig').removeClass('active');
        $('#kMarcajes, #kIFrame').hide();
        $(this).addClass('active');

        var destDiv = $(this).attr('data-div');
        if (destDiv === 'kMarcajes') {
            $('div#' + destDiv).show();
        } else if (destDiv === 'kKiosko') {
            $('#iframe').attr('src', 'http://srv-tornos/EVALOSNET/SuiteKiosko/Kiosco.htm');
            $('div#kIFrame').show();
        } else if (destDiv === 'kConfig') {
            $('#iframe').attr('src', chrome.extension.getURL('config.html'));
            $('div#kIFrame').show();
        }
    });

    //Compruebo si es verano, para cambiar estilos
    if (esVerano()) {
        //Logo kTime
        var logo = $('span.navbar-brand');
        logo.append('<span class="veranito">Veranito</span>');
        logo.find('i').removeClass().addClass('mdi-image-wb-sunny');

        $('nav.navbar').addClass('navbar-material-amber-700');
        $('#desiredTableButton').removeClass('btn-info').addClass('btn-material-amber-400');
        var trConfig = $('#marcajes-data').find('tr.config');
        trConfig.removeClass('info').addClass('btn-material-amber-100');
        trConfig.find('th.has-info').removeClass('has-info').addClass('has-warning');
        $('#estaWeek').removeClass('text-info').addClass('text-warning');
    }

    checkStatus();
});

//Listeners de botones
document.addEventListener('DOMContentLoaded', function () {
    //document.getElementById('refreshButton').addEventListener('click', refreshMarcajes);
    $('#refreshButton, #refreshButton2').on('click', refreshMarcajes);
    //document.getElementById('configButton').addEventListener('click', configuration);
    document.getElementById('desiredTableButton').addEventListener('click', desiredTimeConfig);
    //document.getElementById('prueba').addEventListener('click', prueba);
});


//Muestro la página de configuración
var configuration = function configuration() {
    chrome.tabs.create({'url': chrome.extension.getURL('config.html')});
};

//Compruebo si los datos están actualizados o no y si estamos entre lunes y viernes
//para pintar los mensajes de error correspondientes
function checkStatus() {
    $('#refreshButton').show();
    $('#progress').hide();

    var configData = decodifica(localStorage.getItem('klogin'));

    //Oculto mensaje de login fallido
    document.getElementById('loginFailed').classList.add('hidden');

    //¿Está configurado?
    if (configData === null) {
        //Sistema no configurado
        document.getElementById('configStatus').classList.remove('hidden');
        document.getElementById('marcajes-data').classList.add('hidden');
        document.getElementById('cartel-data-outdated').classList.add('hidden');
        return true;
    }
    //Oculto el mensaje de no configurado
    document.getElementById('configStatus').classList.add('hidden');

    var marcajesData = decodifica(localStorage.getItem('kmarcajes'));

    //Está actualizado?
    var updated = parseInt(localStorage.getItem('klastdataupdatetime'));
    var currentDate = new Date(), lunesDate = new Date(), viernesDate = new Date();
    var currentDay = currentDate.getDay();
    var diasALunes = currentDay - 1, //cuantos días retocedo hasta el lunes
        diasAViernes = currentDay - 5; //días a adelantar hasta el viernes

    lunesDate.setDate(currentDate.getDate() - diasALunes);
    viernesDate.setDate(currentDate.getDate() - diasAViernes);
    lunesDate.setHours(7, 0);
    viernesDate.setHours(22, 0);

    //Miro a ver si los datos se actualizaron entre lunes y viernes de esta semana
    if (marcajesData === null || updated === null || lunesDate.getTime() > updated || updated > viernesDate.getTime()) {
        //No está actualizado
        document.getElementById('cartel-data-outdated').classList.remove('hidden');
        document.getElementById('marcajes-data').classList.add('hidden');
        //refreshMarcajes();
        logger('No actualizado, refresco');
    } else {
        document.getElementById('marcajes-data').classList.remove('hidden');
        document.getElementById('cartel-data-outdated').classList.add('hidden');
        refreshTable();
    }

    //Limpio variables
    configData = updated = currentDate = lunesDate = viernesDate = currentDay = diasALunes = diasAViernes = null;
}

function refreshMarcajes() {
    //Oculto mensaje de datos desactualizados
    document.getElementById('cartel-data-outdated').classList.add('hidden');

    //Inicio el update de marcajes
    chrome.runtime.sendMessage(
        {
            who: 'csPopup',
            action: 'updateMarcajes',
            iam: iAm
        },
        function (response) {
            //si response OK entonces muestro la barra de progreso
            if (response.respuesta === 'ok') {
                progreso(0);
                $('#refreshButton').hide();
                $('#progress').show();
            }
        });
}

function refreshTable() {
    var data = decodifica(localStorage.getItem('kdata')),
        deseado = decodifica(localStorage.getItem('ktabledesiredtime'));

    if (data !== null && data !== '') {
        //Pinto los datos en las diferentes zonas
        var tabla = $('#marcajes-data').find('table');
        tabla.find('thead tr.dates').html(data.thead);
        tabla.find('tbody .row-marcas').html(data.rowMarcas);
        tabla.find('tbody .row-hecho').html(data.rowHecho);
        tabla.find('tfoot .row-restante').html(data.rowRestante);

        $('#actualizado').text(data.ultimaActualizacion);
        $('#horaSalida').text(data.horaSalida);

        //Pongo el valor del input de tiempo restante real
        var objeto = $('#restanteReal');
        var restanteDesdeUltimoMarcaje = parseInt(objeto.attr('data-restante-ultimo-marcaje')),
            minutosUltimoMarcaje = parseInt(objeto.attr('data-ultimo-marcaje')),
            ahora = new Date();

        var minutosActualesHoy = aMinutos(ahora.getHours() + ':' + ahora.getMinutes());
        var minutosRestantesRealesHoy = restanteDesdeUltimoMarcaje - (minutosActualesHoy - minutosUltimoMarcaje);
        logger('Restante real: ' + minutosRestantesRealesHoy);
        logger('Restante desde ultimo marcaje: ' + restanteDesdeUltimoMarcaje);
        logger('Minutos actuales: ' + minutosActualesHoy);
        logger('Minutos ultimo marcaje: ' + minutosUltimoMarcaje);

        var textoReal = '';
        if (minutosRestantesRealesHoy <= 0) {
            textoReal += '- ';
            objeto.addClass('verde');
        }

        objeto.text(textoReal + aHoraMinuto(Math.abs(minutosRestantesRealesHoy)));

        //Lo hecho a lo largo de toda la semana
        var minutosSemana = 0, minutosHoy = 0,
            diasNames = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];

        diasNames.forEach(function (diaName) {
            //Lo Deseado hoy
            var deseadoHoy = deseado[diaName];

            //Lo Hecho hoy
            var hechoHoy = parseInt($('tr.row-hecho td[data-day="' + diaName + '"]').attr('data-minutos'));

            //Lo Descontado hoy
            var descontadoHoy = parseInt($('tr.row-descontar input[data-day="' + diaName + '"]').val());

            //Lo Retribuido hoy
            var retribuidoHoy = parseInt($('tr.row-retribuido input[data-day="' + diaName + '"]').val());

            //Calculo
            minutosHoy = hechoHoy + retribuidoHoy - descontadoHoy;
            logger('Minutos de ' + diaName + ' antes: ' + minutosHoy);

            //Si es jornada continua max 7 horas, partida 9
            if (deseadoHoy.jornadaContinua) {
                minutosHoy = Math.min(minutosHoy, 420);
            } else {
                minutosHoy = Math.min(minutosHoy, 540);
            }

            logger('Minutos de ' + diaName + ' despues: ' + minutosHoy);
            //Si los minutos de hoy salen negativos es que he entrado antes de tiempo y no hay más fichajes, así que no los tengo en cuenta
            if (minutosHoy > 0) {
                minutosSemana += minutosHoy;
            }
            logger('Van estos minutos a la semana: ' + minutosSemana + '(' + aHoraMinuto(minutosSemana) + ')');
        });

        //Sumo y resto a lo hecho en la semana los minutos retribuidos/descontados
        $('#weekTime').text(aHoraMinuto(minutosSemana));

        //Relanzo el material
        $.material.init();

        minutosActualesHoy = minutosRestantesRealesHoy = ahora = objeto = minutosHoy = minutosSemana = diasNames = null;
    }
}


//Gestiono los mensajes desde la página de contenido
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
        //Listener de progreso
        if (msg.who && (msg.who === 'csBackground') && msg.to === iAm) {
            if (msg.action === 'updateProgreso') {
                logger('Actualiza: ' + msg.value, 'info');
                //El mensaje viene para mí
                progreso(msg.value);
            }

            //Listener de fin de update
            if (msg.action === 'finishUpdate') {
                //Finalizo correctamente. Oculto barra de progreso y muestro botón
                $('#progress').hide();
                //$('#refreshButton').show();

                //Lanzo el proceso de chequeo de config al segundo
                setTimeout(checkStatus, 1000);
            }

            if (msg.action === 'errorLogin') {
                //Muestro mensaje de error
                document.getElementById('marcajes-data').classList.add('hidden');
                document.getElementById('loginFailed').classList.remove('hidden');
            }
        }

    }
);

function desiredTimeConfig() {
    $('#configSaveButton').hide();
    $('#marcajes-data').find('tr.config').toggle(500);
    horasSemanaDeseado();
}

//Modificar la barra de progreso
function progreso(valor) {
    valor = parseInt(valor);
    $('#progress').find('.progress-bar').css('width', valor + '%');
}

function horasSemanaDeseado() {
    //Hago la suma de los tiempos deseados. No compruebo si es correcta o no.
    var minutos = 0, minutosHoy = 0;
    $('input.iVD').each(function () {
        logger($(this).val());
        minutos += aMinutos($(this).val());
    });
    logger('minutejos: ' + minutos);
    //var horas = minutos / 60;
    //$('#horas-semana').text(horas.toFixed(1));
    $('#horas-semana').text(aHoraMinuto(minutos));
}

function valoresPorDefecto() {
    logger('Valores por defecto');
    var dataDesired = decodifica(localStorage.getItem('ktabledesiredtime')),
        dataDiscount = decodifica(localStorage.getItem('ktablediscounttime')),
        dataRetribution = decodifica(localStorage.getItem('ktableretributiontime')),
        plantilla = {
            lunes: {minutos: 0, jornadaContinua: false},
            martes: {minutos: 0, jornadaContinua: false},
            miercoles: {minutos: 0, jornadaContinua: false},
            jueves: {minutos: 0, jornadaContinua: false},
            viernes: {minutos: 0, jornadaContinua: false}
        },
        plantilla2 = {
            lunes: 0, martes: 0, miercoles: 0, jueves: 0, viernes: 0
        };

    if (dataDesired === null || dataDesired === '') {
        dataDesired = plantilla;
        localStorage.setItem('ktabledesiredtime', codifica(plantilla));
    }
    if (dataDiscount === null || dataDiscount === '') {
        dataDiscount = plantilla;
        localStorage.setItem('ktablediscounttime', codifica(plantilla2));
    }
    if (dataRetribution === null || dataRetribution === '') {
        dataRetribution = plantilla;
        localStorage.setItem('ktableretributiontime', codifica(plantilla2));
    }

    logger(dataDesired);
    //Inputs de tiempo deseado
    $('input.iVD[data-day="lunes"]').val(aHoraMinuto(dataDesired.lunes.minutos));
    $('input.iVD[data-day="martes"]').val(aHoraMinuto(dataDesired.martes.minutos));
    $('input.iVD[data-day="miercoles"]').val(aHoraMinuto(dataDesired.miercoles.minutos));
    $('input.iVD[data-day="jueves"]').val(aHoraMinuto(dataDesired.jueves.minutos));
    $('input.iVD[data-day="viernes"]').val(aHoraMinuto(dataDesired.viernes.minutos));
    if (dataDesired.lunes.jornadaContinua) {
        $('input.ipVD[data-day="lunes"]').attr('checked', 'checked');
    }
    if (dataDesired.martes.jornadaContinua) {
        $('input.ipVD[data-day="martes"]').attr('checked', 'checked');
    }
    if (dataDesired.miercoles.jornadaContinua) {
        $('input.ipVD[data-day="miercoles"]').attr('checked', 'checked');
    }
    if (dataDesired.jueves.jornadaContinua) {
        $('input.ipVD[data-day="jueves"]').attr('checked', 'checked');
    }
    if (dataDesired.viernes.jornadaContinua) {
        $('input.ipVD[data-day="viernes"]').attr('checked', 'checked');
    }

    $('input.iTD[data-day="lunes"]').val(dataDiscount.lunes);
    $('input.iTD[data-day="martes"]').val(dataDiscount.martes);
    $('input.iTD[data-day="miercoles"]').val(dataDiscount.miercoles);
    $('input.iTD[data-day="jueves"]').val(dataDiscount.jueves);
    $('input.iTD[data-day="viernes"]').val(dataDiscount.viernes);

    $('input.iTR[data-day="lunes"]').val(dataRetribution.lunes);
    $('input.iTR[data-day="martes"]').val(dataRetribution.martes);
    $('input.iTR[data-day="miercoles"]').val(dataRetribution.miercoles);
    $('input.iTR[data-day="jueves"]').val(dataRetribution.jueves);
    $('input.iTR[data-day="viernes"]').val(dataRetribution.viernes);

    //Les pongo el efecto del placeholder simulando una pulsación sobre ellos
    $('input[data-day]').keydown().on('click', function () {
        $(this).select();
    });
}

