'use strict';

const { toBoolean } = require('../coercion');

const FAMILY_ID = 'notifiers';

// Tipi di avvisatore (allineati a NotifierTypesNames dell'app)
const TYPES = ['siren', 'buzzer', 'flash', 'statusLed'];

// Conversione/validazione del valore in scrittura per ogni item
const WRITERS = {
    switch: (value, device) => (value === 'toggle' ? !device.switchFeedback : toBoolean(value)),
    test: (value) => toBoolean(value),
    maintenance: (value) => toBoolean(value)
};

// Comandi con un ...Feedback: in modalità 'feedback' escono solo i feedback
const COMMAND_ITEMS = ['switch'];

// Items in sola lettura validi per tutti i tipi
const READ_ONLY_ITEMS = ['switchFeedback'];

// Items opzionali in sola lettura, abilitati da una feature del device
const OPTIONAL_ITEMS = [
    { flag: 'tamperInfo', items: ['tamperSignal'] },
    { flag: 'lowBatteryDetection', items: ['lowBattery'] }
];

/*----------------------------------------------------------------------------------------------------------------------
    Item scrivibili del device: il test solo se abilitato dalla feature testable
----------------------------------------------------------------------------------------------------------------------*/
function writableItems(device) {
    if (!TYPES.includes(device?.typeId)) return [];
    const items = ['switch'];
    if (device.testable) items.push('test');
    items.push('maintenance');
    return items;
}

/*----------------------------------------------------------------------------------------------------------------------
    Item leggibili: i comandi, il feedback e gli opzionali abilitati dalle features
----------------------------------------------------------------------------------------------------------------------*/
function readableItems(device) {
    const writable = writableItems(device);
    if (!writable.length) return [];
    const items = [...writable, ...READ_ONLY_ITEMS];
    for (const optional of OPTIONAL_ITEMS) {
        if (device[optional.flag]) items.push(...optional.items);
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
    Accetta: payload oggetto, topic = nome item, oppure payload semplice (= switch)
----------------------------------------------------------------------------------------------------------------------*/
function parseInput(msg, device) {
    const topic = typeof msg.topic === 'string' ? msg.topic.trim() : msg.topic;
    const allowed = writableItems(device);
    if (!allowed.length) throw new Error(`Unsupported notifier type "${device?.typeId}"`);

    let requested;
    if (topic && WRITERS[topic]) {
        requested = { [topic]: msg.payload };
    } else if (msg.payload !== null && typeof msg.payload === 'object' && !Array.isArray(msg.payload)) {
        requested = msg.payload;
    } else {
        requested = { switch: msg.payload };
    }

    const items = {};
    for (const [name, value] of Object.entries(requested)) {
        if (!allowed.includes(name)) {
            throw new Error(`Item "${name}" is not writable on this "${device?.typeId}" notifier (allowed: ${allowed.join(', ')})`);
        }
        try {
            items[name] = WRITERS[name](value, device);
        } catch (error) {
            // Un topic sconosciuto fa ricadere il payload su switch: lo segnaliamo, di solito è un refuso
            if (topic && !WRITERS[topic] && name === 'switch') {
                throw new Error(`${error.message}: msg.topic "${msg.topic}" is not a known item (allowed: ${allowed.join(', ')})`);
            }
            throw error;
        }
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
    'feedback' (default): tutto tranne switch, 'all': anche lo switch arrivato da app/cloud/altri nodi
----------------------------------------------------------------------------------------------------------------------*/
function isOutputItem(item, config) {
    return config.outputMode === 'all' || !COMMAND_ITEMS.includes(item);
}

/*----------------------------------------------------------------------------------------------------------------------
    Stato del nodo, es. "On", "Off · Maintenance", "Test"; manomissione e batteria scarica si accodano in rosso
----------------------------------------------------------------------------------------------------------------------*/
function status(device) {
    if (!TYPES.includes(device.typeId)) return { fill: 'grey', shape: 'ring', text: `Unknown Type ${device.typeId}` };
    let result;
    if (device.switchFeedback === undefined) result = { fill: 'grey', shape: 'ring', text: 'Unknown' };
    else if (device.switchFeedback) result = { fill: 'green', shape: 'dot', text: 'On' };
    else result = { fill: 'grey', shape: 'ring', text: 'Off' };

    if (device.testable && device.test) {
        result.fill = 'yellow';
        result.text += ' · Test';
    }
    if (device.maintenance) {
        result.fill = 'yellow';
        result.text += ' · Maintenance';
    }
    if (device.tamperInfo && device.tamperSignal) {
        result.fill = 'red';
        result.text += ' · Tamper';
    }
    if (device.lowBatteryDetection && device.lowBattery) {
        result.fill = 'red';
        result.text += ' · Low Battery';
    }
    return result;
}

module.exports = { FAMILY_ID, writableItems, readableItems, editorItems, parseInput, isOutputItem, outputValue, status };
