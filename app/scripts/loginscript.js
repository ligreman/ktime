'use strict';

logger('\'Allo \'Allo! login script');

//Recojo los valores de inputs y los enviaría a la extensión
/*var viewState = document.getElementById('__VIEWSTATE').value,
 validationEvent = document.getElementById('__EVENTVALIDATION').value;
 */

//Miro a ver si me indica que los datos son incorrectos
var datosIncorrectos = document.getElementById('LabelMensaje').textContent,
    accion = 'errorLogin';

if (datosIncorrectos === 'Datos Incorrectos' || datosIncorrectos === 'Especifique un Usuario') {
    accion = 'errorLogin';
} else {
    accion = 'instruction';
}

//Pido instrucciones a la extensión
chrome.runtime.sendMessage(
    {
        who: 'csLogin',
        /*data: {
         viewstate: viewState,
         validation: validationEvent
         },*/
        action: accion
    },
    function (response) {
        logger(response);

        if (response.respuesta === 'doLogin') {
            //Pongo los datos en el formulario
            document.getElementById('TxtUsuario').value = response.usuario;
            document.getElementById('TxtPassword').value = response.pass;

            //Hago submit
            var enlace = document.getElementById('LinkButtonEntrar');
            if (enlace !== null) {
                enlace.click();
            }
        }
    });

/*
 //Listener de eventos
 chrome.runtime.onMessage.addListener(
 function (request, sender, sendResponse) {
 if (request.action === 'doLogin') {
 //sendResponse({farewell: 'goodbye'});
 //Hago submit
 var enlace = document.getElementById('LinkButtonEntrar');

 if (enlace !== null) {
 enlace.click();
 }
 }
 });
 */
