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
    document.getElementById('ayuda').addEventListener('click', showAyuda);
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
    if (localConfig === undefined || localConfig === null || localConfig === '') {
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
        $('#saveLogin').show();
        $('#logout').hide();
    } else if (localData === null || localData === '') {
        $('#systemConfig').html('<div class="alert alert-dismissable alert-danger"><i class="mdi-alert-error"></i> La aplicación no está configurada</div>').addClass('text-danger').removeClass('text-success').show();
        $('#saveLogin').show();
        $('#logout').hide();
    } else {
        $('#systemConfig').html('Configuración correcta <i class="mdi-action-done"></i>').addClass('text-success').removeClass('text-danger').show();
        $('#saveLogin').hide();
        $('#logout').show();
        $('#progress').hide();

        logger('Pongo valores guardados en checkConfig');

        //Pongo los valores en los campos
        document.getElementById('kUser').value = localData.user;
        document.getElementById('kPass').value = localData.password;
        document.getElementById('kAutoUpdate').checked = localConfig.autoupdate;
        document.getElementById('kAutoUpdateTime').value = localConfig.autoupdatetime;
        document.getElementById('kNotifications').checked = localConfig.notifications;
        document.getElementById('kNotificationTime').value = localConfig.notificationTime;

        logger(localData);
        logger(localConfig);
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

//Panel de ayuda
function showAyuda() {

}

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
 kconfig	eyJhdXRvdXBkYXRlIjp0cnVlLCJhdXRvdXBkYXRldGltZSI6NjAsIm5vdGlmaWNhdGlvbnMiOnRydWUsIm5vdGlmaWNhdGlvblRpbWUiOjV9
 kdata	eyJ0aGVhZCI6Ijx0aCBjbGFzcz1cImJvdG9uZXJhXCI+PGJ1dHRvbiBpZD1cInJlZnJlc2hCdXR0b25cIiBjbGFzcz1cImJ0biBidG4tZGVmYXVsdCBidG4teHMgYnRuLWZsYXQgbm9tYXJnaW5cIj48aSBjbGFzcz1cIm1kaS1hdi1sb29wXCI+PC9pPiBSZWZyZXNjYXI8L2J1dHRvbj48L3RoPjx0aD4xMy8wNC8yMDE1PC90aD48dGg+MTQvMDQvMjAxNTwvdGg+PHRoPjE1LzA0LzIwMTU8L3RoPjx0aD4xNi8wNC8yMDE1PC90aD48dGg+MTcvMDQvMjAxNTwvdGg+Iiwicm93TWFyY2FzIjoiPHRoPk1hcmNhamVzPC90aD48dGQ+PHAgY2xhc3M9XCJtYXJjYWplXCI+PGltZyB0aXRsZT1cIkVudHJhZGFcIiBzcmM9XCJpbWFnZXMvZW50ZXIucG5nXCIgLz4wODoxNjxpIHRpdGxlPVwiQ/NkaWdvIDAwMFwiIGNsYXNzPVwibWRpLWhhcmR3YXJlLWtleWJvYXJkLWNvbnRyb2xcIj48L2k+PC9wPjxwIGNsYXNzPVwibWFyY2FqZVwiPjxpbWcgdGl0bGU9XCJTYWxpZGFcIiBzcmM9XCJpbWFnZXMvZXhpdC5wbmdcIiAvPjE0OjEyPGkgdGl0bGU9XCJD82RpZ28gMDAwXCIgY2xhc3M9XCJtZGktaGFyZHdhcmUta2V5Ym9hcmQtY29udHJvbFwiPjwvaT48L3A+PHAgY2xhc3M9XCJtYXJjYWplXCI+PGltZyB0aXRsZT1cIkVudHJhZGFcIiBzcmM9XCJpbWFnZXMvZW50ZXIucG5nXCIgLz4xNTowOTxpIHRpdGxlPVwiQ/NkaWdvIDAwMFwiIGNsYXNzPVwibWRpLWhhcmR3YXJlLWtleWJvYXJkLWNvbnRyb2xcIj48L2k+PC9wPjxwIGNsYXNzPVwibWFyY2FqZVwiPjxpbWcgdGl0bGU9XCJTYWxpZGFcIiBzcmM9XCJpbWFnZXMvZXhpdC5wbmdcIiAvPjE4OjI2PGkgdGl0bGU9XCJD82RpZ28gMDAwXCIgY2xhc3M9XCJtZGktaGFyZHdhcmUta2V5Ym9hcmQtY29udHJvbFwiPjwvaT48L3A+PC90ZD48dGQ+PHAgY2xhc3M9XCJtYXJjYWplXCI+PGltZyB0aXRsZT1cIkVudHJhZGFcIiBzcmM9XCJpbWFnZXMvZW50ZXIucG5nXCIgLz4wODoyNDxpIHRpdGxlPVwiQ/NkaWdvIDAwMFwiIGNsYXNzPVwibWRpLWhhcmR3YXJlLWtleWJvYXJkLWNvbnRyb2xcIj48L2k+PC9wPjxwIGNsYXNzPVwibWFyY2FqZVwiPjxpbWcgdGl0bGU9XCJTYWxpZGFcIiBzcmM9XCJpbWFnZXMvZXhpdC5wbmdcIiAvPjE0OjE5PGkgdGl0bGU9XCJD82RpZ28gMDAwXCIgY2xhc3M9XCJtZGktaGFyZHdhcmUta2V5Ym9hcmQtY29udHJvbFwiPjwvaT48L3A+PHAgY2xhc3M9XCJtYXJjYWplXCI+PGltZyB0aXRsZT1cIkVudHJhZGFcIiBzcmM9XCJpbWFnZXMvZW50ZXIucG5nXCIgLz4xNToyMzxpIHRpdGxlPVwiQ/NkaWdvIDAwMFwiIGNsYXNzPVwibWRpLWhhcmR3YXJlLWtleWJvYXJkLWNvbnRyb2xcIj48L2k+PC9wPjxwIGNsYXNzPVwibWFyY2FqZVwiPjxpbWcgdGl0bGU9XCJTYWxpZGFcIiBzcmM9XCJpbWFnZXMvZXhpdC5wbmdcIiAvPjE4OjQzPGkgdGl0bGU9XCJD82RpZ28gMDAwXCIgY2xhc3M9XCJtZGktaGFyZHdhcmUta2V5Ym9hcmQtY29udHJvbFwiPjwvaT48L3A+PC90ZD48dGQ+PHAgY2xhc3M9XCJtYXJjYWplXCI+PGltZyB0aXRsZT1cIkVudHJhZGFcIiBzcmM9XCJpbWFnZXMvZW50ZXIucG5nXCIgLz4wODoxMDxpIHRpdGxlPVwiQ/NkaWdvIDAwMFwiIGNsYXNzPVwibWRpLWhhcmR3YXJlLWtleWJvYXJkLWNvbnRyb2xcIj48L2k+PC9wPjxwIGNsYXNzPVwibWFyY2FqZVwiPjxpbWcgdGl0bGU9XCJTYWxpZGFcIiBzcmM9XCJpbWFnZXMvZXhpdC5wbmdcIiAvPjExOjQxPGltZyBjbGFzcz1cIm1pbmlcIiB0aXRsZT1cIkPzZGlnbyAwMTZcIiBzcmM9XCJpbWFnZXMvY29mZmVlLnBuZ1wiIC8+PC9wPjxwIGNsYXNzPVwibWFyY2FqZVwiPjxpbWcgdGl0bGU9XCJFbnRyYWRhXCIgc3JjPVwiaW1hZ2VzL2VudGVyLnBuZ1wiIC8+MTI6MDc8aW1nIGNsYXNzPVwibWluaVwiIHRpdGxlPVwiQ/NkaWdvIDAxNlwiIHNyYz1cImltYWdlcy9jb2ZmZWUucG5nXCIgLz48L3A+PHAgY2xhc3M9XCJtYXJjYWplXCI+PGltZyB0aXRsZT1cIlNhbGlkYVwiIHNyYz1cImltYWdlcy9leGl0LnBuZ1wiIC8+MTU6MjQ8aSB0aXRsZT1cIkPzZGlnbyAwMDBcIiBjbGFzcz1cIm1kaS1oYXJkd2FyZS1rZXlib2FyZC1jb250cm9sXCI+PC9pPjwvcD48L3RkPjx0ZD48cCBjbGFzcz1cIm1hcmNhamVcIj48aW1nIHRpdGxlPVwiRW50cmFkYVwiIHNyYz1cImltYWdlcy9lbnRlci5wbmdcIiAvPjA4OjIyPGkgdGl0bGU9XCJD82RpZ28gMDAwXCIgY2xhc3M9XCJtZGktaGFyZHdhcmUta2V5Ym9hcmQtY29udHJvbFwiPjwvaT48L3A+PC90ZD48dGQ+PC90ZD4iLCJyb3dIZWNobyI6Ijx0aD5IZWNobzwvdGg+PHRkIGRhdGEtZGF5PVwibHVuZXNcIiBkYXRhLW1pbnV0b3M9XCI1NTNcIj4wOToxMzwvdGQ+PHRkIGRhdGEtZGF5PVwibWFydGVzXCIgZGF0YS1taW51dG9zPVwiNTU1XCI+MDk6MTU8L3RkPjx0ZCBkYXRhLWRheT1cIm1pZXJjb2xlc1wiIGRhdGEtbWludXRvcz1cIjQyM1wiPjA3OjAzIDxpIGNsYXNzPVwibWRpLWFjdGlvbi1yZXN0b3JlXCIgdGl0bGU9XCJSZXRyaWJ1aWRvIHBvciBkZXNheXVubzogMTUgbWluXCIgZGF0YS10b2dnbGU9XCJ0b29sdGlwXCI+PC9pPjwvdGQ+PHRkIGRhdGEtZGF5PVwianVldmVzXCIgZGF0YS1taW51dG9zPVwiMFwiPjAwOjAwPC90ZD48dGQgZGF0YS1kYXk9XCJ2aWVybmVzXCIgZGF0YS1taW51dG9zPVwiMFwiPi0gLTotIC08L3RkPiIsInJvd1Jlc3RhbnRlIjoiPHRoPlJlc3RhbnRlPC90aD48dGQ+PHNwYW4gY2xhc3M9XCJ2ZXJkZVwiPi0gMDA6MTM8L3NwYW4+PC90ZD48dGQ+PHNwYW4gY2xhc3M9XCJ2ZXJkZVwiPi0gMDA6MTU8L3NwYW4+PC90ZD48dGQ+PHNwYW4gY2xhc3M9XCJ2ZXJkZVwiPi0gMDA6MDM8L3NwYW4+PC90ZD48dGQ+PHNwYW4gaWQ9XCJyZXN0YW50ZVJlYWxcIiBkYXRhLXJlc3RhbnRlLXVsdGltby1tYXJjYWplPVwiNDIwXCIgZGF0YS11bHRpbW8tbWFyY2FqZT1cIjUwMlwiIGNsYXNzPVwiXCIgdGl0bGU9XCJEZXNkZSBlbCD6bHRpbW8gbWFyY2FqZSBkZSBlbnRyYWRhOiAwNzowMFwiPjwvc3Bhbj48L3RkPjx0ZD48c3BhbiBjbGFzcz1cIlwiPjA3OjAwPC9zcGFuPjwvdGQ+IiwiaG9yYVNhbGlkYSI6IjE1OjIyIiwidWx0aW1hQWN0dWFsaXphY2lvbiI6IjE2LzQvMjAxNSAxMDo0Mzo0MyJ9
 klastdataupdatetime	1429173823830

 kmarcajes	W3siZmVjaGEiOiIxMy8wNC8yMDE1IiwibWFyY2FzIjoiMDg6MTYgMDAwIEUgTE9DIEZMIDE0OjEyIDAwMCBTIExPQyBGSCAxNTowOSAwMDAgRSBMT0MgRkwgMTg6MjYgMDAwIFMgTE9DIn0seyJmZWNoYSI6IjE0LzA0LzIwMTUiLCJtYXJjYXMiOiIwODoyNCAwMDAgRSBMT0MgRkwgMTQ6MTkgMDAwIFMgTE9DIEZIIDE1OjIzIDAwMCBFIExPQyBGTCAxODo0MyAwMDAgUyBMT0MgRkgifSx7ImZlY2hhIjoiMTUvMDQvMjAxNSIsIm1hcmNhcyI6IjA4OjEwIDAwMCBFIExPQyBGTCAxMTo0MSAwMTYgaSBMT0MgICAgMTI6MDcgMDE2IGYgTE9DICAgIDE1OjI0IDAwMCBTIExPQyBGSCJ9LHsiZmVjaGEiOiIxNi8wNC8yMDE1IiwibWFyY2FzIjoiMDg6MjIgMDAwIEUgTE9DIEZNIn0seyJmZWNoYSI6IjE3LzA0LzIwMTUiLCJtYXJjYXMiOiIifV0=
 ktabledesiredtime	eyJsdW5lcyI6eyJtaW51dG9zIjo1NDAsImpvcm5hZGFDb250aW51YSI6ZmFsc2V9LCJtYXJ0ZXMiOnsibWludXRvcyI6NTQwLCJqb3JuYWRhQ29udGludWEiOmZhbHNlfSwibWllcmNvbGVzIjp7Im1pbnV0b3MiOjQyMCwiam9ybmFkYUNvbnRpbnVhIjp0cnVlfSwianVldmVzIjp7Im1pbnV0b3MiOjQyMCwiam9ybmFkYUNvbnRpbnVhIjp0cnVlfSwidmllcm5lcyI6eyJtaW51dG9zIjo0MjAsImpvcm5hZGFDb250aW51YSI6dHJ1ZX19
 ktablediscounttime	eyJsdW5lcyI6MCwibWFydGVzIjowLCJtaWVyY29sZXMiOjAsImp1ZXZlcyI6MCwidmllcm5lcyI6MH0=
 ktableretributiontime	eyJsdW5lcyI6MCwibWFydGVzIjowLCJtaWVyY29sZXMiOjAsImp1ZXZlcyI6MCwidmllcm5lcyI6MH0=

 */
