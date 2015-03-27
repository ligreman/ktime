'use strict';

logger('\'Allo \'Allo! Content script');

//Cuando se ejecuta este script ya ha saltado el evento onload de la página (ya está cargada)


//Miro a ver si estoy en la página correcta antes de hacer nada
var elem = document.getElementById('ListBoxListados');

if (elem !== null) {
    init();
} else {
    logger('Esta no es');
}

function init() {
    //Miro a ver si está la tabla de marcajes
    var tabla = document.getElementById('DataGridListado');

    if (tabla === null) {
        //No está la tabla
        logger('No hay tabla');

        //Selecciono el día Desde y Hasta, que abarque toda esta semana
        var currentDate = new Date(), lunesDate = new Date(), viernesDate = new Date();
        var currentDay = currentDate.getDay();
        var diasALunes = currentDay - 1, //cuantos días retocedo hasta el lunes
            diasAViernes = currentDay - 5; //días a adelantar hasta el viernes

        lunesDate.setDate(currentDate.getDate() - diasALunes);
        viernesDate.setDate(currentDate.getDate() - diasAViernes);

        //Pongo los días de esta semana para cojer estos datos
        document.getElementById('TxtDesdeFecha').value = formatDate(lunesDate);
        document.getElementById('TxtHastaFecha').value = formatDate(viernesDate);

        //Miro a ver si la opción seleccionada es la correcta
        if (elem.selectedIndex !== 1) {
            //Selecciono la segunda opción (index 1)
            elem.selectedIndex = 1;

            //Envío cambio disparando el evento
            if ('createEvent' in document) {
                logger('Envio evento de seleccionar A');
                var evt = document.createEvent('HTMLEvents');
                evt.initEvent('change', false, true);
                elem.dispatchEvent(evt);
            }
            else {
                logger('Envio evento de seleccionar B');
                //Para IE antiguos
                elem.fireEvent('onchange');
            }
        } else {
            logger('Simulo el envío del formulario dando a Visualizar');
            //Envío el formulario simulando la pulsación del botón
            var boton = document.getElementById('ButtonFiltro');
            boton.click();
        }
    } else {
        logger('Página de resultados marcajes');
        var viewState = document.getElementById('__VIEWSTATE').value;
        var validationEvent = document.getElementById('__EVENTVALIDATION').value;

        var txt = tabla.innerHTML;
        txt = txt.replace('\n', '');

        sendMessageToExtension({
            //viewstate: viewState,
            //validation: validationEvent
            table: btoa(txt)
        }, 'marcajes');
    }
}

//Escribo a la extensión
function sendMessageToExtension(msg, accion) {
    chrome.runtime.sendMessage({who: 'csListado', data: msg, action: accion}, function (response) {
        //logger(response);
    });
}


function formatDate(date) {
    var dia = '', mes = '';

    if (date.getDate() < 10) {
        dia = '0';
    }
    dia = dia + date.getDate();

    var mesecito = date.getMonth() + 1;
    if (mesecito < 10) {
        mes = '0';
    }
    mes = mes + mesecito;

    return dia + '/' + mes + '/' + date.getFullYear();
}
