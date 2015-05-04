var debugMode = false;

function codifica(text) {
    if (text === null) {
        return null;
    } else {
        return btoa(JSON.stringify(text));
    }
}

function decodifica(textEncrypt) {
    if (textEncrypt === null) {
        return null;
    } else {
        var res = '';
        try {
            res = JSON.parse(atob(textEncrypt));
            return res;
        }
        catch (err) {
            return null;
        }
    }
}

//Convierte una cadena 02:56 a minutos
function aMinutos(horaminuto) {
    var patt = /[0-9]{1,2}:[0-9]{1,2}/i;
    if (horaminuto === null || horaminuto === '' || !patt.test(horaminuto)) {
        return 0;
    }

    horaminuto = horaminuto.split(':');

    var horas = parseInt(horaminuto[0]),
        minutos = parseInt(horaminuto[1]);

    minutos += horas * 60;
    return minutos;
}

//Convierte una cantidad de minutos en 02:45
function aHoraMinuto(minutosTotales) {
    var minutos = parseInt(minutosTotales) % 60, //resto de la division min/60
        horas = parseInt(minutosTotales / 60); //parte entera, las horas

    return formatTime(horas) + ':' + formatTime(minutos);
}

function formatTime(num) {
    num = parseInt(num);
    if (isNaN(num)) {
        return '- -';
    }

    if (num <= 9) {
        return '0' + num;
    } else {
        return '' + num;
    }
}


//Formatea un input de hora:minutos
function formatInputTime(datos) {
    if (datos === null || datos === '') {
        return '';
    }

    var splited = datos.split(':');
    if (splited.length === 1) {
        return '00:' + formatTime(parseInt(splited[0]));
    } else if (splited.length === 2) {
        return formatTime(parseInt(splited[0])) + ':' + formatTime(parseInt(splited[1]));
    } else {
        return '';
    }
}


function queDiaEs(index) {
    var dia = '';

    switch (index) {
        case 0:
            dia = 'lunes';
            break;
        case 1:
            dia = 'martes';
            break;
        case 2:
            dia = 'miercoles';
            break;
        case 3:
            dia = 'jueves';
            break;
        case 4:
            dia = 'viernes';
            break;
    }

    return dia;
}

function logger(msg, type) {
    if (!debugMode) {
        return null;
    }

    if (type === undefined || type === null) {
        type = 'log';
    }

    switch (type) {
        case 'warn':
            console.warn(msg);
            break;
        case 'error':
            console.error(msg);
            break;
        case 'info':
            console.info(msg);
            break;
        default:
            console.log(msg);
    }

}

function esVerano() {
    var fecha = new Date();
    var day = fecha.getDate(), //1-31
        month = fecha.getMonth() + 1; //1-12

    //Miro si está entre el 15 de Junio y 15 Septiembre
    if (month === 7 || month === 8) {
        return true;
    } else if ((month === 6 && day >= 15) || (month === 9 && day <= 15)) {
        return true;
    } else {
        return false;
    }
}
