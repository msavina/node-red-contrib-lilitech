'use strict';

const { toBoolean } = require('../coercion');

const FAMILY_ID = 'security-sensors';

// Tipi di sensore (allineati a SecuritySensorTypesNames dell'app): per tutti lo stato è l'item 'input'
const TYPES = [
    'magneticContact',
    'volumetricSensor',
    'barrierSensor',
    'shockSensor',
    'cableContact',
    'panicButton',
    'floodDetector',
    'smokeDetector',
    'fireDetector',
    'gasDetector',
    'lineSwitch',
    'keySwitch',
    'floatSwitch'
];

// Conversione/validazione del valore in scrittura per ogni item, come i toggle dei controlli dell'app
const WRITERS = {
    exclusion: (value) => toBoolean(value),
    testing: (value) => toBoolean(value),
    maintenance: (value) => toBoolean(value)
};

// Items in sola lettura validi per tutti i tipi: stato del sensore, allarme e area armata
const READ_ONLY_ITEMS = ['input', 'trigger', 'armed'];

// Items opzionali in sola lettura, abilitati da una feature del device
const OPTIONAL_ITEMS = [
    { flag: 'tamperDetection', item: 'tamper', label: 'Tamper' },
    { flag: 'keepAlive', item: 'sensorLoss', label: 'Sensor Lost' },
    { flag: 'lowBatteryDetection', item: 'lowBattery', label: 'Low Battery' },
    { flag: 'faultInfo', item: 'faultSignal', label: 'Fault' },
    { flag: 'maskDetection', item: 'masked', label: 'Masked' },
    { flag: 'weakCondition', item: 'weak', label: 'Weak' },
    { flag: 'petDetection', item: 'petDetected' },
    { flag: 'maxAlarmsLimit', item: 'maxAlarmsReached', label: 'Max Alarms' }
];

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
function isKnownType(device) {
    return TYPES.includes(device?.typeId);
}

/*----------------------------------------------------------------------------------------------------------------------
    Item scrivibili: l'esclusione solo se abilitata dalla feature excludible, test e manutenzione sempre.
    Il timer di esclusione si imposta dall'app: il nodo esclude/reinclude e basta
----------------------------------------------------------------------------------------------------------------------*/
function writableItems(device) {
    if (!isKnownType(device)) return [];
    const items = [];
    if (device.excludible) items.push('exclusion');
    items.push('testing', 'maintenance');
    return items;
}

/*----------------------------------------------------------------------------------------------------------------------
    Item leggibili: stato, allarme, area armata, i comandi e gli opzionali abilitati dalle features
----------------------------------------------------------------------------------------------------------------------*/
function readableItems(device) {
    if (!isKnownType(device)) return [];
    const items = [...READ_ONLY_ITEMS, ...writableItems(device)];
    for (const optional of OPTIONAL_ITEMS) {
        if (device[optional.flag]) items.push(optional.item);
    }
    return items;
}

/*----------------------------------------------------------------------------------------------------------------------
    Items mostrati nell'editor
----------------------------------------------------------------------------------------------------------------------*/
function editorItems(device) {
    return writableItems(device);
}

/*----------------------------------------------------------------------------------------------------------------------
    Trasforma l'input del nodo in un oggetto { item: valore } già validato.
    Accetta: payload oggetto oppure topic = nome item. Nessun item di default: un true da solo non deve
    escludere un sensore d'allarme per sbaglio
----------------------------------------------------------------------------------------------------------------------*/
function parseInput(msg, device) {
    const allowed = writableItems(device);
    if (!allowed.length) throw new Error(`Unsupported security sensor type "${device?.typeId}"`);

    const topic = typeof msg.topic === 'string' ? msg.topic.trim() : msg.topic;
    let requested;
    if (msg.payload !== null && typeof msg.payload === 'object' && !Array.isArray(msg.payload)) {
        requested = msg.payload;
    } else if (topic) {
        requested = { [topic]: msg.payload };
    } else {
        throw new Error(`Set msg.topic to the item to write (allowed: ${allowed.join(', ')})`);
    }

    const items = {};
    for (const [name, value] of Object.entries(requested)) {
        if (!allowed.includes(name)) {
            const hint = name === 'exclusion' ? '; enable "excludible" on the sensor in the app' : '';
            throw new Error(`Item "${name}" is not writable on this security sensor (allowed: ${allowed.join(', ')}${hint})`);
        }
        items[name] = WRITERS[name](value);
    }
    if (Object.keys(items).length === 0) throw new Error('No item to write');
    return items;
}

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
function outputValue(item, value) {
    return value;
}

/*----------------------------------------------------------------------------------------------------------------------
    Tutti gli items escono sempre: esclusione, test e manutenzione non hanno un feedback separato
----------------------------------------------------------------------------------------------------------------------*/
function isOutputItem() {
    return true;
}

/*----------------------------------------------------------------------------------------------------------------------
    Stato del nodo, es. "Open · Armed", "Closed · Excluded · Tamper": lo stato del sensore come la card dell'app,
    poi i suoi badge (test, area armata, manutenzione, esclusione) e le anomalie abilitate dalle features
----------------------------------------------------------------------------------------------------------------------*/
function status(device) {
    if (!isKnownType(device)) return { fill: 'grey', shape: 'ring', text: `Unknown Type ${device.typeId}` };
    let result;
    if (typeof device.input !== 'boolean') result = { fill: 'grey', shape: 'ring', text: 'No Data' };
    else if (device.input) result = { fill: 'green', shape: 'dot', text: 'Open' };
    else result = { fill: 'grey', shape: 'ring', text: 'Closed' };

    if (device.testing) {
        result.fill = 'yellow';
        result.text += ' · Test';
    }
    if (device.armed) result.text += ' · Armed';
    if (device.maintenance) {
        result.fill = 'yellow';
        result.text += ' · Maintenance';
    }
    if (device.excludible && device.exclusion) {
        result.fill = 'yellow';
        result.text += ' · Excluded';
    }
    for (const optional of OPTIONAL_ITEMS) {
        if (optional.label && device[optional.flag] && device[optional.item] === true) {
            result.fill = 'red';
            result.text += ` · ${optional.label}`;
        }
    }
    return result;
}

module.exports = { FAMILY_ID, writableItems, readableItems, editorItems, parseInput, isOutputItem, outputValue, status };
