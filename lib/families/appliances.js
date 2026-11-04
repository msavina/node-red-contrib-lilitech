'use strict';

const { toBoolean } = require('../coercion');

const FAMILY_ID = 'appliances';

// Tipi di elettrodomestico dell'app: hanno tutti gli stessi items
const APPLIANCE_TYPES = [
    'dishwasher',
    'washingMachine',
    'dryer',
    'phon',
    'oven',
    'waterHeater',
    'fridge',
    'microwave',
    'inductionHob',
    'kitchenHood',
    'kitchenRobot',
    'fryer',
    'toaster',
    'coffeeMachine',
    'lawnMowerRobot'
];

// Conversione/validazione del valore in scrittura per ogni item
const WRITERS = {
    switch: (value, device) => (value === 'toggle' ? !device.switchFeedback : toBoolean(value))
};

// Comandi con uno stato confermato a parte (switchFeedback): in modalità 'feedback' non escono
const COMMAND_ITEMS = ['switch'];

// Stati del carico gestiti dalla gestione energia
const LOAD_ITEMS = ['overload', 'economy', 'green'];

// Misure abilitate dalle features (la tensione anche da quella stimata)
const OPTIONAL_ITEMS = [
    { flags: ['energyInfo'], items: ['energy', 'energyRelative'] },
    { flags: ['powerInfo'], items: ['power'] },
    { flags: ['currentInfo'], items: ['current'] },
    { flags: ['voltageInfo', 'estimatedVoltageInfoBoolean'], items: ['voltage'] }
];

// Unità di misura in msg.unit
const UNITS = {
    energy: 'Wh',
    energyRelative: 'Wh',
    power: 'W',
    current: 'A',
    voltage: 'V'
};

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
function isKnownType(device) {
    return APPLIANCE_TYPES.includes(device?.typeId);
}

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
function writableItems(device) {
    return isKnownType(device) ? Object.keys(WRITERS) : [];
}

/*----------------------------------------------------------------------------------------------------------------------
    Item leggibili: lo switch col suo feedback, quelli della gestione energia e le misure abilitate dalle features
----------------------------------------------------------------------------------------------------------------------*/
function readableItems(device) {
    if (!isKnownType(device)) return [];
    const items = [...writableItems(device), 'switchFeedback', ...LOAD_ITEMS];
    for (const optional of OPTIONAL_ITEMS) {
        if (optional.flags.some((flag) => device[flag])) items.push(...optional.items);
    }
    if (device.faultInfo) items.push('faultSignal');
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
    Accetta: payload oggetto, topic = nome item, oppure payload semplice (switch)
----------------------------------------------------------------------------------------------------------------------*/
function parseInput(msg, device) {
    const topic = typeof msg.topic === 'string' ? msg.topic.trim() : msg.topic;
    const allowed = writableItems(device);
    if (!allowed.length) throw new Error(`Unsupported appliance type "${device?.typeId}"`);

    let requested;
    let fallback;
    if (topic && WRITERS[topic]) {
        requested = { [topic]: msg.payload };
    } else if (msg.payload !== null && typeof msg.payload === 'object' && !Array.isArray(msg.payload)) {
        requested = msg.payload;
    } else {
        fallback = 'switch';
        requested = { [fallback]: msg.payload };
    }

    const items = {};
    for (const [name, value] of Object.entries(requested)) {
        if (!allowed.includes(name)) {
            throw new Error(`Item "${name}" is not writable on an appliance (allowed: ${allowed.join(', ')})`);
        }
        try {
            items[name] = WRITERS[name](value, device);
        } catch (error) {
            // Un topic sconosciuto fa ricadere il payload sullo switch: lo segnaliamo, di solito è un refuso
            if (topic && fallback) {
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
----------------------------------------------------------------------------------------------------------------------*/
function outputExtras(item) {
    return UNITS[item] ? { unit: UNITS[item] } : {};
}

/*----------------------------------------------------------------------------------------------------------------------
    'feedback' (default): tutto tranne lo switch, 'all': anche lo switch arrivato da app/cloud/altri nodi
----------------------------------------------------------------------------------------------------------------------*/
function isOutputItem(item, config) {
    return config.outputMode === 'all' || !COMMAND_ITEMS.includes(item);
}

/*----------------------------------------------------------------------------------------------------------------------
    Stato del nodo, es. "On · 1.2 kW"; sovraccarico e guasto (se la feature è abilitata) si accodano in rosso
----------------------------------------------------------------------------------------------------------------------*/
function status(device) {
    if (!isKnownType(device)) return { fill: 'grey', shape: 'ring', text: `Unknown Type ${device.typeId}` };
    let result;
    if (device.switchFeedback === undefined) {
        result = { fill: 'grey', shape: 'ring', text: 'Unknown' };
    } else if (!device.switchFeedback) {
        result = { fill: 'grey', shape: 'ring', text: 'Off' };
    } else {
        result = { fill: 'green', shape: 'dot', text: 'On' };
        if (device.powerInfo && typeof device.power === 'number') result.text += ` · ${(device.power / 1000).toFixed(1)} kW`;
    }
    if (device.overload) {
        result.fill = 'red';
        result.text += ' · Overload';
    }
    if (device.faultInfo && device.faultSignal) {
        result.fill = 'red';
        result.text += ' · Fault';
    }
    return result;
}

module.exports = { FAMILY_ID, writableItems, readableItems, editorItems, parseInput, isOutputItem, outputValue, outputExtras, status };
