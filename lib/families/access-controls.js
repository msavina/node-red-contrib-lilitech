'use strict';

const { toBoolean } = require('../coercion');

const FAMILY_ID = 'access-controls';

// Tipi di lettori (allineati a AccessControlsTypesNames dell'app)
const TYPES = ['rfidReader', 'keypadReader', 'keypadRfidReader'];

// Eventi dello storico sugli accessi (EventName in libs/interfaces/events.interface.ts della headunit)
const ACCESS_EVENTS = {
    DEVICES_ACCESS_CONTROLS_GRANTED_ACCESS: 'granted',
    DEVICES_ACCESS_CONTROLS_DENIED_ACCESS: 'denied',
    DEVICES_ACCESS_CONTROLS_UNIDENTIFIED_USER: 'denied'
};
const UNIDENTIFIED_USER_REASON = 'Unidentified user';

// Conversione/validazione del valore in scrittura per ogni item (pin e badge non si scrivono: li manda solo il lettore)
const WRITERS = {
    exclusion: (value) => toBoolean(value)
};

// Items opzionali, abilitati da una feature del device (pin e badge non escono mai: sono le credenziali lette)
const OPTIONAL_ITEMS = [
    { flag: 'excludible', items: ['exclusion'] },
    { flag: 'tamperDetection', items: ['tamper'] }
];

// Stato del nodo per l'esito dell'ultimo accesso (accessFeedback torna a 'ready' dopo 2 secondi)
const FEEDBACK_STATUS = {
    granted: { fill: 'green', shape: 'dot', text: 'Granted' },
    denied: { fill: 'red', shape: 'dot', text: 'Denied' },
    ready: { fill: 'green', shape: 'ring', text: 'Ready' }
};

/*----------------------------------------------------------------------------------------------------------------------
    Item scrivibili: l'esclusione solo se abilitata dalla feature excludible
----------------------------------------------------------------------------------------------------------------------*/
function writableItems(device) {
    if (!TYPES.includes(device?.typeId) || !device.excludible) return [];
    return ['exclusion'];
}

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
function readableItems(device) {
    if (!TYPES.includes(device?.typeId)) return [];
    const items = [];
    for (const optional of OPTIONAL_ITEMS) {
        if (device[optional.flag]) items.push(...optional.items);
    }
    return items;
}

/*----------------------------------------------------------------------------------------------------------------------
    Nell'editor mostriamo cosa emette il nodo: l'esito degli accessi e gli items abilitati
----------------------------------------------------------------------------------------------------------------------*/
function editorItems(device) {
    return TYPES.includes(device?.typeId) ? ['access', ...readableItems(device)] : [];
}

/*----------------------------------------------------------------------------------------------------------------------
    Trasforma l'input del nodo in un oggetto { item: valore } già validato.
    Accetta: payload oggetto, topic = nome item, oppure payload semplice (= exclusion)
----------------------------------------------------------------------------------------------------------------------*/
function parseInput(msg, device) {
    const topic = typeof msg.topic === 'string' ? msg.topic.trim() : msg.topic;
    if (!TYPES.includes(device?.typeId)) throw new Error(`Unsupported access control type "${device?.typeId}"`);
    const allowed = writableItems(device);
    if (!allowed.length) throw new Error('The exclusion is not enabled on this access control (enable "excludible" in the app)');

    let requested;
    if (topic && WRITERS[topic]) {
        requested = { [topic]: msg.payload };
    } else if (msg.payload !== null && typeof msg.payload === 'object' && !Array.isArray(msg.payload)) {
        requested = msg.payload;
    } else {
        requested = { exclusion: msg.payload };
    }

    const items = {};
    for (const [name, value] of Object.entries(requested)) {
        if (!allowed.includes(name)) {
            throw new Error(`Item "${name}" is not writable on an access control (allowed: ${allowed.join(', ')})`);
        }
        try {
            items[name] = WRITERS[name](value);
        } catch (error) {
            // Un topic sconosciuto fa ricadere il payload su exclusion: lo segnaliamo, di solito è un refuso
            if (topic && !WRITERS[topic] && name === 'exclusion') {
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
    Nessun comando con un feedback separato: escono sempre tutti gli items leggibili
----------------------------------------------------------------------------------------------------------------------*/
function isOutputItem() {
    return true;
}

/*----------------------------------------------------------------------------------------------------------------------
    Esito di un tentativo di accesso, dallo storico: chi (se riconosciuto) e il motivo del rifiuto
----------------------------------------------------------------------------------------------------------------------*/
function historyMessage(event) {
    const access = ACCESS_EVENTS[event.eventName];
    if (!access) return null;
    const message = { topic: 'access', payload: access };
    if (event.authorId || event.authorName) message.user = { id: event.authorId, name: event.authorName };
    if (access === 'denied') {
        message.reason = event.eventName === 'DEVICES_ACCESS_CONTROLS_UNIDENTIFIED_USER' ? UNIDENTIFIED_USER_REASON : event.payload?.message || null;
    }
    return message;
}

/*----------------------------------------------------------------------------------------------------------------------
    Stato del nodo, es. "Ready", "Granted", "Ready · Excluded"; la manomissione si accoda in rosso
----------------------------------------------------------------------------------------------------------------------*/
function status(device) {
    if (!TYPES.includes(device.typeId)) return { fill: 'grey', shape: 'ring', text: `Unknown Type ${device.typeId}` };
    const known = FEEDBACK_STATUS[device.accessFeedback];
    const result = known ? { ...known } : { fill: 'grey', shape: 'ring', text: 'Unknown' };
    if (device.excludible && device.exclusion) {
        result.fill = 'yellow';
        result.shape = 'ring';
        result.text += ' · Excluded';
    }
    if (device.tamperDetection && device.tamper) {
        result.fill = 'red';
        result.text += ' · Tamper';
    }
    return result;
}

module.exports = { FAMILY_ID, writableItems, readableItems, editorItems, parseInput, isOutputItem, outputValue, historyMessage, status };
