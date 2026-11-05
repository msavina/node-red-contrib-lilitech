'use strict';

const FAMILY_ID = 'systems';

// Items per typeId (allineati a SystemEntity dell'app). La simulazione presenza ha il suo nodo (famiglia simulators)
const TYPES = {
    clock: {
        main: ['sunrise', 'sunset', 'night', 'sunriseTime', 'sunsetTime'],
        time: ['currentDayTime', 'currentDay', 'currentHour', 'currentMinute']
    },
    weather: {
        main: [
            'weather',
            'temperatureValue',
            'humidityValue',
            'pressureValue',
            'windSpeed',
            'windGustsValue',
            'windDirection',
            'rainAmountHour',
            'rainStatus',
            'uvIndex',
            'airPollutionIndex',
            'weatherAlerts'
        ],
        extra: ['city', 'temperatureMinValue', 'temperatureMaxValue', 'temperaturePerceived', 'weatherAlertsEvent', 'sunriseTime', 'sunsetTime'],
        forecast: ['forecastDaily', 'forecastHourly']
    }
};

// Unità di misura (allineate a SystemDataType dell'app; il driver OpenWeather converte il vento in km/h)
const UNITS = {
    temperatureValue: '°C',
    temperatureMinValue: '°C',
    temperatureMaxValue: '°C',
    temperaturePerceived: '°C',
    humidityValue: '%',
    pressureValue: 'hPa',
    windSpeed: 'km/h',
    windGustsValue: 'km/h',
    windDirection: '°',
    rainAmountHour: 'mm/h'
};

// Items in JSON stringifizzato sul tubo, emessi come oggetti
const JSON_ITEMS = ['currentDayTime', 'weatherAlertsEvent', 'forecastDaily', 'forecastHourly'];

// L'orologio ritrasmette tutto ogni minuto (alba/tramonto a false compresi) e il meteo tutto ogni minuto anche se non cambia
const changedOnly = [...TYPES.clock.main, ...TYPES.clock.time, ...TYPES.weather.main, ...TYPES.weather.extra, ...TYPES.weather.forecast];

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
function typeOf(device) {
    return TYPES[device?.typeId];
}

/*----------------------------------------------------------------------------------------------------------------------
    Il JSON stringifizzato dell'headunit (o l'oggetto, se già decodificato); null se assente o non valido
----------------------------------------------------------------------------------------------------------------------*/
function parseJson(value) {
    if (typeof value !== 'string') return value ?? null;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
function readableItems(device) {
    const type = typeOf(device);
    return type ? [...type.main, ...(type.time || []), ...(type.extra || []), ...(type.forecast || [])] : [];
}

/*----------------------------------------------------------------------------------------------------------------------
    Items mostrati nell'editor: quelli principali, gli altri hanno la loro opzione o sono di contorno
----------------------------------------------------------------------------------------------------------------------*/
function editorItems(device) {
    return typeOf(device)?.main || [];
}

/*----------------------------------------------------------------------------------------------------------------------
    Il giorno/ora corrente (ogni minuto) e le previsioni escono solo se abilitati
----------------------------------------------------------------------------------------------------------------------*/
function isOutputItem(item, config) {
    if (TYPES.clock.time.includes(item)) return !!config.currentTime;
    if (TYPES.weather.forecast.includes(item)) return !!config.forecast;
    return true;
}

/*----------------------------------------------------------------------------------------------------------------------
    JSON decodificati (weatherAlertsEvent vuoto = nessuna allerta); temperature a 1 decimale, pioggia e UV a 2
----------------------------------------------------------------------------------------------------------------------*/
function outputValue(item, value) {
    if (item === 'weatherAlertsEvent') return value ? parseJson(value) ?? [] : [];
    if (JSON_ITEMS.includes(item)) return parseJson(value);
    if (typeof value !== 'number') return value;
    const decimals = item.startsWith('temperature') ? 1 : item === 'rainAmountHour' || item === 'uvIndex' ? 2 : null;
    if (decimals === null) return value;
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
function outputExtras(item) {
    return UNITS[item] ? { unit: UNITS[item] } : {};
}

/*----------------------------------------------------------------------------------------------------------------------
    "clouds" -> "Clouds"
----------------------------------------------------------------------------------------------------------------------*/
function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

/*----------------------------------------------------------------------------------------------------------------------
    Stato dell'orologio, es. "Day · Sunset 17:12", "Night · Sunrise 07:05", "Sunrise 07:05" nel minuto dell'alba
----------------------------------------------------------------------------------------------------------------------*/
function clockStatus(device) {
    if (!device.sunriseTime || !device.sunsetTime) return { fill: 'grey', shape: 'ring', text: 'No Value' };
    if (device.sunrise) return { fill: 'yellow', shape: 'dot', text: `Sunrise ${device.sunriseTime}` };
    if (device.sunset) return { fill: 'yellow', shape: 'dot', text: `Sunset ${device.sunsetTime}` };
    if (device.night) return { fill: 'blue', shape: 'ring', text: `Night · Sunrise ${device.sunriseTime}` };
    return { fill: 'green', shape: 'dot', text: `Day · Sunset ${device.sunsetTime}` };
}

/*----------------------------------------------------------------------------------------------------------------------
    Stato del meteo, es. "12.3 °C · Clouds · Torino", con " · Alert" se ci sono allerte meteo
----------------------------------------------------------------------------------------------------------------------*/
function weatherStatus(device) {
    if (typeof device.temperatureValue !== 'number') return { fill: 'grey', shape: 'ring', text: 'No Value' };
    const parts = [`${outputValue('temperatureValue', device.temperatureValue)} °C`];
    if (device.weather) parts.push(capitalize(String(device.weather)));
    if (device.city) parts.push(device.city);
    if (device.weatherAlerts) parts.push('Alert');
    return { fill: device.weatherAlerts ? 'yellow' : 'green', shape: 'dot', text: parts.join(' · ') };
}

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
function status(device) {
    if (device.typeId === 'clock') return clockStatus(device);
    if (device.typeId === 'weather') return weatherStatus(device);
    return { fill: 'grey', shape: 'ring', text: `Unknown Type ${device.typeId}` };
}

module.exports = { FAMILY_ID, TYPES, changedOnly, readableItems, editorItems, isOutputItem, outputValue, outputExtras, status };
