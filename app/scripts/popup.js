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

    $('#configSaveButton').on('click', function () {
        //Guardo los días deseados en localStorage
        var data = {};

        $('input.iVD').each(function () {
            var dia = $(this).attr('data-day');
            data[dia] = aMinutos($(this).val());
        });

        localStorage.setItem('ktabledesiredtime', codifica(data));

        configTable();

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

    checkStatus();
});

//Listeners de botones
document.addEventListener('DOMContentLoaded', function () {
    //document.getElementById('refreshButton').addEventListener('click', refreshMarcajes);
    $('#refreshButton, #refreshButton2').on('click', refreshMarcajes);
    //document.getElementById('configButton').addEventListener('click', configuration);
    document.getElementById('configTableButton').addEventListener('click', configTable);
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
    var data = decodifica(localStorage.getItem('kdata'));

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
        //objeto.val(aHoraMinuto(Math.abs(minutosRestantesRealesHoy)));
        objeto.text(aHoraMinuto(Math.abs(minutosRestantesRealesHoy)));

        //Lo hecho a lo largo de toda la semana
        var minutosSemana = 0, minutosHoy = 0;
        $('tbody .row-hecho td').each(function () {
            minutosHoy += parseInt($(this).attr('data-minutos'));

            //Dependiendo de lo que esté en tiempo deseado hoy...
            var hoyEs = $(this).attr('data-day');
            var deseadoHoy = aMinutos($('.iVD[data-day="' + hoyEs + '"]').val());

            //7 horas son 420min, 9 horas son 540min
            //Como mucho 9 horas sea cual sea el motivo
            minutosHoy = Math.min(minutosHoy, 540);

            //Si quiero hacer 7 horas hoy (jornada de mañana)
            if (deseadoHoy <= 420) {
                //TODO cartelito al pie del input que ponga continua/partida según sea la jornada
                minutosHoy = Math.max(minutosHoy, 420); //En j.mañana máximo de 7 horas
            }

            minutosSemana += minutosHoy;
        });
        $('#weekTime').text(aHoraMinuto(minutosSemana));

        //Relanzo el material
        $.material.init();

        minutosActualesHoy = minutosRestantesRealesHoy = ahora = objeto = null;
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

function configTable() {
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
        minutosHoy = aMinutos($(this).val());
        minutos += minutosHoy;

        //Cartelicos de jornada continua o partida
        var elem = $(this).parent('div').parent('th');
        if (minutosHoy <= 420) {
            elem.find('p.continua').show();
            elem.find('p.partida').hide();
        } else {
            elem.find('p.partida').show();
            elem.find('p.continua').hide();
        }
    });
    logger('minutejos: ' + minutos);
    //var horas = minutos / 60;
    //$('#horas-semana').text(horas.toFixed(1));
    $('#horas-semana').text(aHoraMinuto(minutos));
}

function valoresPorDefecto() {
    var dataDesired = decodifica(localStorage.getItem('ktabledesiredtime')),
        dataDiscount = decodifica(localStorage.getItem('ktablediscounttime')),
        dataRetribution = decodifica(localStorage.getItem('ktableretributiontime')),
        plantilla = {lunes: 0, martes: 0, miercoles: 0, jueves: 0, viernes: 0};

    if (dataDesired === null || dataDesired === '') {
        dataDesired = plantilla;
        localStorage.setItem('ktabledesiredtime', codifica(plantilla));
    }
    if (dataDiscount === null || dataDiscount === '') {
        dataDiscount = plantilla;
        localStorage.setItem('ktablediscounttime', codifica(plantilla));
    }
    if (dataRetribution === null || dataRetribution === '') {
        dataRetribution = plantilla;
        localStorage.setItem('ktableretributiontime', codifica(plantilla));
    }

    //Inputs de tiempo deseado
    $('input.iVD[data-day="lunes"]').val(aHoraMinuto(dataDesired.lunes));
    $('input.iVD[data-day="martes"]').val(aHoraMinuto(dataDesired.martes));
    $('input.iVD[data-day="miercoles"]').val(aHoraMinuto(dataDesired.miercoles));
    $('input.iVD[data-day="jueves"]').val(aHoraMinuto(dataDesired.jueves));
    $('input.iVD[data-day="viernes"]').val(aHoraMinuto(dataDesired.viernes));

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

