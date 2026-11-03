'use strict';

const { toBoolean, toPercent, toColor, toInteger } = require('../coercion');

const FAMILY_ID = 'lights';

// Item scrivibili per ogni typeId (allineati a LightTypesItems dell'app)
const TYPE_ITEMS = {
    onOff: ['switch'],
    dimmer: ['switch', 'brightness'],
    tunableWhite: ['switch', 'brightness', 'temperature'],
    rgb: ['switch', 'color', 'brightnessColor'],
    rgbWhite: ['switch', 'brightness', 'color', 'brightnessColor'],
    rgbTunableWhite: ['switch', 'brightness', 'temperature', 'color', 'brightnessColor']
};

// Conversione/validazione del valore in scrittura per ogni item
const WRITERS = {
    switch: (value, state) => (value === 'toggle' ? !state.switchFeedback : toBoolean(value)),
    brightness: (value) => toPercent(value),
    brightnessColor: (value) => toPercent(value),
    temperature: (value) => toPercent(value),
    color: (value) => JSON.stringify(toColor(value)),
    scene: (value) => toInteger(value, 0, 15)
};

// Item in sola lettura validi per tutti i typeId
const READ_ONLY_ITEMS = ['powerOffTimerAt', 'simulated'];

/*----------------------------------------------------------------------------------------------------------------------
    Item scrivibili del device: le scene solo se il binding DALI le ha abilitate
----------------------------------------------------------------------------------------------------------------------*/
function writableItems(device) {
    const items = [...(TYPE_ITEMS[device?.typeId] || TYPE_ITEMS.onOff)];
    if (device?.scenesAvailable) items.push('scene');
    return items;
}

/*----------------------------------------------------------------------------------------------------------------------
    Item leggibili: i comandi, i rispettivi feedback e quelli in sola lettura
----------------------------------------------------------------------------------------------------------------------*/
function readableItems(device) {
    const items = [];
    for (const item of writableItems(device)) {
        items.push(item);
        if (item !== 'scene') items.push(`${item}Feedback`);
    }
    return items.concat(READ_ONLY_ITEMS);
}

/*----------------------------------------------------------------------------------------------------------------------
    Trasforma l'input del nodo in un oggetto { item: valore } già validato.
    Accetta: payload oggetto, topic = nome item, oppure payload semplice (= switch)
----------------------------------------------------------------------------------------------------------------------*/
function parseInput(msg, device, state) {
    let requested;
    if (msg.payload !== null && typeof msg.payload === 'object' && !Array.isArray(msg.payload)) {
        requested = msg.payload;
    } else if (msg.topic && WRITERS[msg.topic]) {
        requested = { [msg.topic]: msg.payload };
    } else {
        requested = { switch: msg.payload };
    }

    const allowed = writableItems(device);
    const items = {};
    for (const [name, value] of Object.entries(requested)) {
        if (!allowed.includes(name)) {
            throw new Error(`Item "${name}" is not writable on a "${device?.typeId}" light (allowed: ${allowed.join(', ')})`);
        }
        items[name] = WRITERS[name](value, state || {});
    }
    if (Object.keys(items).length === 0) throw new Error('No item to write');
    return items;
}

/*----------------------------------------------------------------------------------------------------------------------
    Valore da mandare in uscita: il colore viaggia sul tubo come stringa JSON
----------------------------------------------------------------------------------------------------------------------*/
function outputValue(item, value) {
    if ((item === 'color' || item === 'colorFeedback') && typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch (error) {
            return value;
        }
    }
    return value;
}

/*----------------------------------------------------------------------------------------------------------------------
    Testo dello stato del nodo, es. "on · 80%"
----------------------------------------------------------------------------------------------------------------------*/
function statusText(device, state) {
    if (state.switchFeedback === undefined) return 'unknown';
    if (!state.switchFeedback) return 'off';
    const items = writableItems(device);
    if (items.includes('brightness') && state.brightnessFeedback !== undefined) return `on · ${state.brightnessFeedback}%`;
    if (items.includes('brightnessColor') && state.brightnessColorFeedback !== undefined) return `on · ${state.brightnessColorFeedback}%`;
    return 'on';
}

module.exports = { FAMILY_ID, TYPE_ITEMS, writableItems, readableItems, parseInput, outputValue, statusText };
