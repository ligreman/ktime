'use strict';

logger('\'Allo \'Allo! menu script');

//Miro a ver si estoy en el frame correcto, ha de existir el menú
var menu = document.getElementById('DivMenu');

if (menu !== null) {
    //Pido instrucciones a la extensión
    chrome.runtime.sendMessage({who: 'csMenu', data: {}, action: 'instruction'},
        function (response) {
            if (response.respuesta === 'doNavigate') {
                //Hago submit
                var enlace = document.getElementById('LinkListados');

                if (enlace !== null) {
                    enlace.click();
                }
            }
        });
}
