'use strict';

const FAMILY_ID = 'environment-sensors';

// Per ogni typeId: item principale, prefisso delle statistiche min/max e items opzionali abilitati da una feature del device
const TYPES = {
    temperatureSensor: { main: 'temperatureValue', stats: 'temperature' },
    humiditySensor: { main: 'humidityValue', stats: 'humidity' },
    lightSensor: { main: 'luminosity', stats: 'luminosity', optional: [{ flag: 'solarRadiationInfo', items: ['solarRadiation'], stats: 'solarRadiation' }] },
    twilightSensor: { main: 'twilight' },
    presenceSensor: { main: 'presence' },
    airQualitySensor: { main: 'coTwo', stats: 'coTwo', optional: [{ flag: 'vocInfo', items: ['voc'], stats: 'voc' }] },
    barometerSensor: { main: 'pressureValue', stats: 'pressure' },
    windSensor: {
        main: 'windSpeed',
        stats: 'windSpeed',
        optional: [
            { flag: 'windDirectionInfo', items: ['windDirection'] },
            { flag: 'windGustsInfo', items: ['windGusts'] }
        ]
    },
    rainSensor: { main: 'rainStatus', optional: [{ flag: 'rainAmountInfo', items: ['rainAmount', 'rainAmountRelative', 'rainAmountRelativeTimestamp'] }] },
    soilMoistureSensor: { main: 'soilMoisture', stats: 'soilMoisture', optional: [{ flag: 'evaporationInfo', items: ['evaporation'] }] }
};

// Items diagnostici, abilitati dalle features del device
const DIAGNOSTICS = [
    { flag: 'keepAlive', item: 'sensorLoss' },
    { flag: 'lowBatteryDetection', item: 'lowBattery' },
    { flag: 'faultInfo', item: 'faultSignal' }
];

// Unità di misura (allineate a EnvSensorDataType dell'app), anche per le statistiche tramite il prefisso
const UNITS = {
    temperatureValue: '°C',
    temperature: '°C',
    humidityValue: '%',
    humidity: '%',
    luminosity: 'lx',
    solarRadiation: 'W/m²',
    coTwo: 'ppm',
    voc: 'mg/m³',
    pressureValue: 'hPa',
    pressure: 'hPa',
    windSpeed: 'km/h',
    windDirection: '°',
    rainAmount: 'mm',
    rainAmountRelative: 'mm',
    soilMoisture: '%'
};

// Testo dello stato per i sensori booleani
const BOOLEAN_LABELS = {
    twilight: ['Night', 'Day'],
    presence: ['Presence', 'No Presence'],
    rainStatus: ['Rain', 'No Rain']
};

const STATISTIC_SUFFIXES = ['MinValue', 'MaxValue', 'MinTimestamp', 'MaxTimestamp'];

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
function typeOf(device) {
    return TYPES[device?.typeId];
}

/*----------------------------------------------------------------------------------------------------------------------
    Items di misura del device: il principale più quelli opzionali abilitati
----------------------------------------------------------------------------------------------------------------------*/
function measureItems(device) {
    const type = typeOf(device);
    if (!type) return [];
    const items = [type.main];
    for (const optional of type.optional || []) {
        if (device[optional.flag]) items.push(...optional.items);
    }
    return items;
}

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
function statisticItems(device) {
    const type = typeOf(device);
    if (!type) return [];
    const prefixes = type.stats ? [type.stats] : [];
    for (const optional of type.optional || []) {
        if (optional.stats && device[optional.flag]) prefixes.push(optional.stats);
    }
    return prefixes.flatMap((prefix) => STATISTIC_SUFFIXES.map((suffix) => prefix + suffix));
}

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
function diagnosticItems(device) {
    return DIAGNOSTICS.filter((d) => device?.[d.flag]).map((d) => d.item);
}

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
function readableItems(device) {
    return [...measureItems(device), ...statisticItems(device), ...diagnosticItems(device)];
}

/*----------------------------------------------------------------------------------------------------------------------
    Items mostrati nell'editor: solo le misure, i diagnostici hanno la loro opzione
----------------------------------------------------------------------------------------------------------------------*/
function editorItems(device) {
    return measureItems(device);
}

/*----------------------------------------------------------------------------------------------------------------------
    Le statistiche min/max escono solo se abilitate, i diagnostici a meno che non siano stati disabilitati
----------------------------------------------------------------------------------------------------------------------*/
function isOutputItem(item, config) {
    if (STATISTIC_SUFFIXES.some((suffix) => item.endsWith(suffix)) && item !== 'rainAmountRelativeTimestamp') return !!config.statistics;
    if (DIAGNOSTICS.some((d) => d.item === item)) return config.diagnostics !== false;
    return true;
}

/*----------------------------------------------------------------------------------------------------------------------
    Le misure arrivano spesso con il rumore della conversione float dei driver (es. 26.899999618530273):
    arrotondiamo a 1 decimale (2 per voc, interi per i lux), tranne i timestamp
----------------------------------------------------------------------------------------------------------------------*/
function outputValue(item, value) {
    if (typeof value !== 'number' || item.endsWith('Timestamp')) return value;
    const decimals = item.startsWith('voc') ? 2 : item.startsWith('luminosity') ? 0 : 1;
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}

/*----------------------------------------------------------------------------------------------------------------------
    Unità di misura in msg.unit (anche per le statistiche, dal prefisso). I timestamp sono in millisecondi epoch
----------------------------------------------------------------------------------------------------------------------*/
function outputExtras(item) {
    if (item.endsWith('Timestamp')) return {};
    const unit = UNITS[item] || UNITS[item.replace(/(Min|Max)Value$/, '')];
    return unit ? { unit } : {};
}

/*----------------------------------------------------------------------------------------------------------------------
    Stato del nodo, es. "21.5 °C", "Presence", "45 % · Sensor Lost": il valore si vede sempre, la diagnostica si accoda.
    La diagnostica conta solo se la feature è abilitata sul sensore e il nodo non l'ha disattivata
----------------------------------------------------------------------------------------------------------------------*/
function status(device, config = {}) {
    const diagnostics = config.diagnostics === false ? [] : diagnosticItems(device);
    const active = (item) => diagnostics.includes(item) && device[item];

    const type = typeOf(device);
    if (!type) return { fill: 'grey', shape: 'ring', text: `Unknown Type ${device.typeId}` };

    const value = device[type.main];
    let result;
    if (value === undefined || value === null) {
        result = { fill: 'grey', shape: 'ring', text: 'No Value' };
    } else if (typeof value === 'boolean') {
        const [onText, offText] = BOOLEAN_LABELS[type.main] || ['On', 'Off'];
        result = { fill: value ? 'green' : 'grey', shape: value ? 'dot' : 'ring', text: value ? onText : offText };
    } else {
        result = { fill: 'green', shape: 'dot', text: `${outputValue(type.main, value)}${UNITS[type.main] ? ' ' + UNITS[type.main] : ''}` };
    }
    if (active('sensorLoss')) {
        result.fill = 'red';
        result.shape = 'ring';
        result.text += ' · Sensor Lost';
    } else if (active('faultSignal')) {
        result.fill = 'red';
        result.shape = 'dot';
        result.text += ' · Fault';
    } else if (active('lowBattery')) {
        result.fill = 'yellow';
    }
    if (active('lowBattery')) result.text += ' · Low Battery';
    return result;
}

module.exports = { FAMILY_ID, TYPES, readableItems, editorItems, isOutputItem, outputValue, outputExtras, status };
