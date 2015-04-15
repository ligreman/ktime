'use strict';

logger('Script de config');

//Inicio material
$(document).ready(function () {
    $.material.init();

    //Les pongo el efecto del placeholder simulando una pulsación sobre ellos
    $('input').keydown();

    //Localstorage check
    checkConfigStatus();
});

//Listeners de botones
document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('saveLogin').addEventListener('click', saveConfiguration);
    document.getElementById('logout').addEventListener('click', logOut);
    document.getElementById('kAutoUpdate').addEventListener('click', configChange);
    document.getElementById('kAutoUpdateTime').addEventListener('click', configChange);
    document.getElementById('kNotifications').addEventListener('click', configChange);
    document.getElementById('kNotificationTime').addEventListener('click', configChange);
});

var thisUser, thisPassword, iAm = 'login';

var saveConfiguration = function saveConfiguration() {
    //Cojo del formulario el usuario y pass
    thisUser = document.getElementById('kUser').value;
    thisPassword = document.getElementById('kPass').value;
    //Pongo valores por defecto
    initializeLocalStorage();

    $('#progress').hide();

    if (thisUser === '' || thisPassword === '') {
        $('#systemConfig').html('<div class="alert alert-dismissable alert-danger"><i class="mdi-alert-error"></i> Introduce el usuario y la contraseña</div>').addClass('text-danger').removeClass('text-success').show();
    } else {
        //Digo a background que inicie la petición de datos
        chrome.runtime.sendMessage(
            {
                who: 'csConfig',
                action: 'updateMarcajes',
                user: thisUser,
                password: thisPassword,
                iam: iAm
            },
            function (response) {
                //si response OK entonces muestro la barra de progreso
                if (response.respuesta === 'ok') {
                    progreso(0);
                    $('#progress').show();
                }
            });
    }
};


//Gestiono los mensajes desde la página de contenido
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
        //Listener de progreso
        if (msg.who && (msg.who === 'csBackground') && msg.to === iAm) {
            if (msg.action === 'updateProgreso') {
                //El mensaje viene para mí
                progreso(msg.value);
            }

            //Listener de fin de update
            if (msg.action === 'finishUpdate') {
                //Finalizo correctamente. Oculto barra de progreso
                $('#progress').hide();

                //Guardo en localStorage la configuración
                localStorage.setItem('klogin', codifica({
                    user: thisUser,
                    password: thisPassword
                }));

                //Lanzo el proceso de chequeo de config al segundo
                setTimeout(checkConfigStatus, 1000);
            }

            if (msg.action === 'errorLogin') {
                logger('Error de login');
                errorLogin();
            }
        }

    }
);


/********************** FUNCIONES ************************************/

//Comprobar si ya está configurada la extensión
function checkConfigStatus(error) {
    var localData = decodifica(localStorage.getItem('klogin')),
        localConfig = decodifica(localStorage.getItem('kconfig'));

    //Si no hay config local creo uno por defecto
    if (localConfig === null || localConfig === '') {
        localConfig = {
            autoupdate: false,
            autoupdatetime: 60,
            notifications: true,
            notitifactionTime: 5
        };
        localStorage.setItem('kconfig', codifica(localConfig));
    }

    $('#progress').hide();

    //Muestro el mensaje según tenga o no ya la aplicación configurada
    if (error != undefined && error !== null) {
        $('#systemConfig').html(error).addClass('text-danger').removeClass('text-success').show();
        $('#logout').hide();
    } else if (localData === null || localData === '') {
        $('#systemConfig').html('<div class="alert alert-dismissable alert-danger"><i class="mdi-alert-error"></i> La aplicación no está configurada</div>').addClass('text-danger').removeClass('text-success').show();
        $('#logout').hide();
    } else {
        $('#systemConfig').html('Configuración correcta <i class="mdi-action-done"></i>').addClass('text-success').removeClass('text-danger').show();
        $('#logout').show();
        $('#progress').hide();

        //Pongo los valores en los campos
        document.getElementById('kUser').value = localData.user;
        document.getElementById('kPass').value = localData.password;
        document.getElementById('kAutoUpdate').checked = localConfig.autoupdate;
        document.getElementById('kAutoUpdateTime').value = localConfig.autoupdatetime;
        document.getElementById('kNotifications').checked = localConfig.notifications;
        document.getElementById('kNotificationTime').value = localConfig.notificationTime;

        logger(localData);
    }
}

//Modificar la barra de progreso
function progreso(valor) {
    valor = parseInt(valor);
    $('#progress').find('.progress-bar').css('width', valor + '%');
}

function errorLogin() {
    var err = '<div class="alert alert-dismissable alert-danger"><i class="mdi-alert-error"></i> Error al realizar el login, inténtalo de nuevo</div>';
    logOut(err);
}

//Logout de configuración
var logOut = function (error) {
    //Elimino el local storage
    localStorage.removeItem('klogin');
    localStorage.removeItem('kmarcajes');
    localStorage.removeItem('klastdataupdatetime');

    checkConfigStatus(error);
};

//Actualiza el localStorage de la configuración cuando cambian los parámetros
function configChange() {
    var autoupdate = document.getElementById('kAutoUpdate').checked,
        autotime = parseInt(document.getElementById('kAutoUpdateTime').value),
        notifications = document.getElementById('kNotifications').checked,
        notificationTime = parseInt(document.getElementById('kNotificationTime').value),
        newConfig = {};

    //Actualizo la configuración
    if (autoupdate === true || autoupdate === false) {
        newConfig.autoupdate = autoupdate;
    } else {
        newConfig.autoupdate = false;
    }

    if (autotime === 15 || autotime === 30 || autotime === 60) {
        newConfig.autoupdatetime = autotime;
    } else {
        newConfig.autoupdatetime = 60;
    }

    if (notifications === true || notifications === false) {
        newConfig.notifications = notifications;
    } else {
        newConfig.notifications = false;
    }

    if (!isNaN(notificationTime)) {
        newConfig.notificationTime = notificationTime;
    } else {
        newConfig.notificationTime = 5;
    }

    //Aviso del cambio al background para los timer
    chrome.runtime.sendMessage(
        {
            who: 'csConfig',
            action: 'checkTimer'
        },
        function (response) {
        });

    localStorage.setItem('kconfig', codifica(newConfig));
}

function initializeLocalStorage() {
    var ktabledesiredtime = localStorage.getItem('ktabledesiredtime'),
        ktablediscounttime = localStorage.getItem('ktablediscounttime'),
        ktableretributiontime = localStorage.getItem('ktableretributiontime');

    if (ktabledesiredtime === null) {
        localStorage.setItem('ktabledesiredtime', {
            lunes: {minutos: 480, jornadaContinua: false},
            martes: {minutos: 480, jornadaContinua: false},
            miercoles: {minutos: 480, jornadaContinua: false},
            jueves: {minutos: 480, jornadaContinua: false},
            viernes: {minutos: 420, jornadaContinua: true}
        });
    }
    if (ktablediscounttime === null) {
        localStorage.setItem('ktablediscounttime', {
            lunes: 0, martes: 0, miercoles: 0, jueves: 0, viernes: 0
        });
    }
    if (ktableretributiontime === null) {
        localStorage.setItem('ktableretributiontime', {
            lunes: 0, martes: 0, miercoles: 0, jueves: 0, viernes: 0
        });
    }
}

/*
 kconfig - eyJhdXRvdXBkYXRlIjp0cnVlLCJhdXRvdXBkYXRldGltZSI6NjB9
 klastupdatetime - 1427354658228
 kmarcajes - W3siZmVjaGEiOiIyMy8wMy8yMDE1IiwibWFyY2FzIjoiMDg6MTYgMDAwIEUgTE9DIEZMIDE0OjMzIDAwMCBTIExPQyBGSCAxNToyOSAwMDAgRSBMT0MgRkwgMTg6MjggMDAwIFMgTE9DIn0seyJmZWNoYSI6IjI0LzAzLzIwMTUiLCJtYXJjYXMiOiIwODoxNiAwMDAgRSBMT0MgRkwgMTE6MzYgMDAwIFMgTE9DICAgIDExOjQ2IDAwMCBFIExPQyAgICAxNDoxNSAwMDAgUyBMT0MgRkggMTU6MTYgMDAwIEUgTE9DIEZMIDE4OjMwIDAwMCBTIExPQyJ9LHsiZmVjaGEiOiIyNS8wMy8yMDE1IiwibWFyY2FzIjoiMDg6MTUgMDAwIEUgTE9DIEZMIDExOjM4IDAxNiBpIExPQyAgICAxMTo0OCAwMTYgZiBMT0MgICAgMTU6MjAgMDAwIFMgTE9DIEZIIn0seyJmZWNoYSI6IjI2LzAzLzIwMTUiLCJtYXJjYXMiOiIwODoxNyAwMDAgRSBMT0MgRk0ifSx7ImZlY2hhIjoiMjcvMDMvMjAxNSIsIm1hcmNhcyI6IiJ9XQ==
 kdata - eyJ0aGVhZCI6Ijx0aCBjbGFzcz1cImJvdG9uZXJhXCI+PGJ1dHRvbiBpZD1cInJlZnJlc2hCdXR0b25cIiBjbGFzcz1cImJ0biBidG4tZGVmYXVsdCBidG4teHMgYnRuLWZsYXQgbm9tYXJnaW5cIj48aSBjbGFzcz1cIm1kaS1hdi1sb29wXCI+PC9pPiBSZWZyZXNjYXI8L2J1dHRvbj48L3RoPjx0aD4yMy8wMy8yMDE1PC90aD48dGg+MjQvMDMvMjAxNTwvdGg+PHRoPjI1LzAzLzIwMTU8L3RoPjx0aD4yNi8wMy8yMDE1PC90aD48dGg+MjcvMDMvMjAxNTwvdGg+Iiwicm93TWFyY2FzIjoiPHRoPk1hcmNhamVzPC90aD48dGQ+PHAgY2xhc3M9XCJtYXJjYWplXCI+PGltZyB0aXRsZT1cIkVudHJhZGFcIiBzcmM9XCJpbWFnZXMvZW50ZXIucG5nXCIgLz4wODoxNjxpIHRpdGxlPVwiQ/NkaWdvIDAwMFwiIGNsYXNzPVwibWRpLWhhcmR3YXJlLWtleWJvYXJkLWNvbnRyb2xcIj48L2k+PC9wPjxwIGNsYXNzPVwibWFyY2FqZVwiPjxpbWcgdGl0bGU9XCJTYWxpZGFcIiBzcmM9XCJpbWFnZXMvZXhpdC5wbmdcIiAvPjE0OjMzPGkgdGl0bGU9XCJD82RpZ28gMDAwXCIgY2xhc3M9XCJtZGktaGFyZHdhcmUta2V5Ym9hcmQtY29udHJvbFwiPjwvaT48L3A+PHAgY2xhc3M9XCJtYXJjYWplXCI+PGltZyB0aXRsZT1cIkVudHJhZGFcIiBzcmM9XCJpbWFnZXMvZW50ZXIucG5nXCIgLz4xNToyOTxpIHRpdGxlPVwiQ/NkaWdvIDAwMFwiIGNsYXNzPVwibWRpLWhhcmR3YXJlLWtleWJvYXJkLWNvbnRyb2xcIj48L2k+PC9wPjxwIGNsYXNzPVwibWFyY2FqZVwiPjxpbWcgdGl0bGU9XCJTYWxpZGFcIiBzcmM9XCJpbWFnZXMvZXhpdC5wbmdcIiAvPjE4OjI4PGkgdGl0bGU9XCJD82RpZ28gMDAwXCIgY2xhc3M9XCJtZGktaGFyZHdhcmUta2V5Ym9hcmQtY29udHJvbFwiPjwvaT48L3A+PC90ZD48dGQ+PHAgY2xhc3M9XCJtYXJjYWplXCI+PGltZyB0aXRsZT1cIkVudHJhZGFcIiBzcmM9XCJpbWFnZXMvZW50ZXIucG5nXCIgLz4wODoxNjxpIHRpdGxlPVwiQ/NkaWdvIDAwMFwiIGNsYXNzPVwibWRpLWhhcmR3YXJlLWtleWJvYXJkLWNvbnRyb2xcIj48L2k+PC9wPjxwIGNsYXNzPVwibWFyY2FqZVwiPjxpbWcgdGl0bGU9XCJTYWxpZGFcIiBzcmM9XCJpbWFnZXMvZXhpdC5wbmdcIiAvPjExOjM2PGkgdGl0bGU9XCJD82RpZ28gMDAwXCIgY2xhc3M9XCJtZGktaGFyZHdhcmUta2V5Ym9hcmQtY29udHJvbFwiPjwvaT48L3A+PHAgY2xhc3M9XCJtYXJjYWplXCI+PGltZyB0aXRsZT1cIkVudHJhZGFcIiBzcmM9XCJpbWFnZXMvZW50ZXIucG5nXCIgLz4xMTo0NjxpIHRpdGxlPVwiQ/NkaWdvIDAwMFwiIGNsYXNzPVwibWRpLWhhcmR3YXJlLWtleWJvYXJkLWNvbnRyb2xcIj48L2k+PC9wPjxwIGNsYXNzPVwibWFyY2FqZVwiPjxpbWcgdGl0bGU9XCJTYWxpZGFcIiBzcmM9XCJpbWFnZXMvZXhpdC5wbmdcIiAvPjE0OjE1PGkgdGl0bGU9XCJD82RpZ28gMDAwXCIgY2xhc3M9XCJtZGktaGFyZHdhcmUta2V5Ym9hcmQtY29udHJvbFwiPjwvaT48L3A+PHAgY2xhc3M9XCJtYXJjYWplXCI+PGltZyB0aXRsZT1cIkVudHJhZGFcIiBzcmM9XCJpbWFnZXMvZW50ZXIucG5nXCIgLz4xNToxNjxpIHRpdGxlPVwiQ/NkaWdvIDAwMFwiIGNsYXNzPVwibWRpLWhhcmR3YXJlLWtleWJvYXJkLWNvbnRyb2xcIj48L2k+PC9wPjxwIGNsYXNzPVwibWFyY2FqZVwiPjxpbWcgdGl0bGU9XCJTYWxpZGFcIiBzcmM9XCJpbWFnZXMvZXhpdC5wbmdcIiAvPjE4OjMwPGkgdGl0bGU9XCJD82RpZ28gMDAwXCIgY2xhc3M9XCJtZGktaGFyZHdhcmUta2V5Ym9hcmQtY29udHJvbFwiPjwvaT48L3A+PC90ZD48dGQ+PHAgY2xhc3M9XCJtYXJjYWplXCI+PGltZyB0aXRsZT1cIkVudHJhZGFcIiBzcmM9XCJpbWFnZXMvZW50ZXIucG5nXCIgLz4wODoxNTxpIHRpdGxlPVwiQ/NkaWdvIDAwMFwiIGNsYXNzPVwibWRpLWhhcmR3YXJlLWtleWJvYXJkLWNvbnRyb2xcIj48L2k+PC9wPjxwIGNsYXNzPVwibWFyY2FqZVwiPjxpbWcgdGl0bGU9XCJTYWxpZGFcIiBzcmM9XCJpbWFnZXMvZXhpdC5wbmdcIiAvPjExOjM4PGltZyBjbGFzcz1cIm1pbmlcIiB0aXRsZT1cIkPzZGlnbyAwMTZcIiBzcmM9XCJpbWFnZXMvY29mZmVlLnBuZ1wiIC8+PC9wPjxwIGNsYXNzPVwibWFyY2FqZVwiPjxpbWcgdGl0bGU9XCJFbnRyYWRhXCIgc3JjPVwiaW1hZ2VzL2VudGVyLnBuZ1wiIC8+MTE6NDg8aW1nIGNsYXNzPVwibWluaVwiIHRpdGxlPVwiQ/NkaWdvIDAxNlwiIHNyYz1cImltYWdlcy9jb2ZmZWUucG5nXCIgLz48L3A+PHAgY2xhc3M9XCJtYXJjYWplXCI+PGltZyB0aXRsZT1cIlNhbGlkYVwiIHNyYz1cImltYWdlcy9leGl0LnBuZ1wiIC8+MTU6MjA8aSB0aXRsZT1cIkPzZGlnbyAwMDBcIiBjbGFzcz1cIm1kaS1oYXJkd2FyZS1rZXlib2FyZC1jb250cm9sXCI+PC9pPjwvcD48L3RkPjx0ZD48cCBjbGFzcz1cIm1hcmNhamVcIj48aW1nIHRpdGxlPVwiRW50cmFkYVwiIHNyYz1cImltYWdlcy9lbnRlci5wbmdcIiAvPjA4OjE3PGkgdGl0bGU9XCJD82RpZ28gMDAwXCIgY2xhc3M9XCJtZGktaGFyZHdhcmUta2V5Ym9hcmQtY29udHJvbFwiPjwvaT48L3A+PC90ZD48dGQ+PC90ZD4iLCJyb3dIZWNobyI6Ijx0aD5IZWNobzwvdGg+PHRkIGRhdGEtbWludXRvcz1cIjU1NlwiPjA5OjE2PC90ZD48dGQgZGF0YS1taW51dG9zPVwiNTQzXCI+MDk6MDM8L3RkPjx0ZCBkYXRhLW1pbnV0b3M9XCI0MjVcIj4wNzowNSA8aSBjbGFzcz1cIm1kaS1hY3Rpb24tcmVzdG9yZVwiIHRpdGxlPVwiUmV0cmlidWlkbyBwb3IgZGVzYXl1bm86IDEwIG1pblwiIGRhdGEtdG9nZ2xlPVwidG9vbHRpcFwiPjwvaT48L3RkPjx0ZCBkYXRhLW1pbnV0b3M9XCIwXCI+MDA6MDA8L3RkPjx0ZCBkYXRhLW1pbnV0b3M9XCIwXCI+LSAtOi0gLTwvdGQ+Iiwicm93UmVzdGFudGUiOiI8dGg+UmVzdGFudGU8L3RoPjx0ZD48c3BhbiBjbGFzcz1cInZlcmRlXCIgZGF0YS1yZXN0YW50ZT1cIi0xNlwiPi0gMDA6MTY8L3NwYW4+PC90ZD48dGQ+PHNwYW4gY2xhc3M9XCJ2ZXJkZVwiIGRhdGEtcmVzdGFudGU9XCItM1wiPi0gMDA6MDM8L3NwYW4+PC90ZD48dGQ+PHNwYW4gY2xhc3M9XCJ2ZXJkZVwiIGRhdGEtcmVzdGFudGU9XCItNVwiPi0gMDA6MDU8L3NwYW4+PC90ZD48dGQ+PHNwYW4gY2xhc3M9XCJcIiBkYXRhLXJlc3RhbnRlPVwiNDIwXCI+MDc6MDA8L3NwYW4+PC90ZD48dGQ+PHNwYW4gY2xhc3M9XCJcIiBkYXRhLXJlc3RhbnRlPVwiNDIwXCI+MDc6MDA8L3NwYW4+PC90ZD4iLCJob3JhU2FsaWRhIjoiMTU6MTciLCJ1bHRpbWFBY3R1YWxpemFjaW9uIjoiMjYvMy8yMDE1IDg6MjQ6MTgifQ==
 */
