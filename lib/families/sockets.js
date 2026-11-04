'use strict';

const { toBoolean } = require('../coercion');

const FAMILY_ID = 'sockets';

// Tipi di presa dell'app: le misure dipendono dalle features, non dal tipo
const SOCKET_TYPES = ['simple', 'measurable'];

// Comandi con uno stato confermato a parte (switchFeedback): in modalità 'feedback' non escono
const COMMAND_ITEMS = ['switch'];

// Stati del carico gestiti dalla gestione energia
const LOAD_ITEMS = ['overload', 'economy', 'green'];

// Misure abilitate dalle features (la tensione anche da quella stimata), con il comando che le azzera come il
// pulsante dei controlli dell'app: l'energia riparte da 0, le altre misure azzerano minimo e massimo
const MEASURES = [
    { flags: ['energyInfo'], items: ['energy', 'energyRelative'], restore: 'restoreEnergy' },
    { flags: ['powerInfo'], items: ['power', 'powerMin', 'powerMax'], restore: 'restorePower' },
    { flags: ['currentInfo'], items: ['current', 'currentMin', 'currentMax'], restore: 'restoreCurrent' },
    { flags: ['voltageInfo', 'estimatedVoltageInfoBoolean'], items: ['voltage', 'voltageMin', 'voltageMax'], restore: 'restoreVoltage' }
];

// Unità di misura in msg.unit
const UNITS = {
    energy: 'Wh',
    energyRelative: 'Wh',
    power: 'W',
    powerMin: 'W',
    powerMax: 'W',
    current: 'A',
    currentMin: 'A',
    currentMax: 'A',
    voltage: 'V',
    voltageMin: 'V',
    voltageMax: 'V'
};

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
function isKnownType(device) {
    return SOCKET_TYPES.includes(device?.typeId);
}

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
function enabledMeasures(device) {
    return MEASURES.filter((measure) => measure.flags.some((flag) => device[flag]));
}

/*----------------------------------------------------------------------------------------------------------------------
    Items scrivibili: lo switch e l'azzeramento delle misure abilitate. L'headunit azzera la tensione solo con
    'voltageInfo', non con la tensione stimata
----------------------------------------------------------------------------------------------------------------------*/
function writableItems(device) {
    if (!isKnownType(device)) return [];
    const restores = enabledMeasures(device)
        .filter((measure) => measure.restore !== 'restoreVoltage' || device.voltageInfo)
        .map((measure) => measure.restore);
    return ['switch', ...restores];
}

/*----------------------------------------------------------------------------------------------------------------------
    Items leggibili: lo switch col suo feedback, la gestione energia, il simulatore di presenza (badge della card),
    le misure e il guasto. Il timer di spegnimento si configura e si segue dall'app, il nodo non lo espone
----------------------------------------------------------------------------------------------------------------------*/
function readableItems(device) {
    if (!isKnownType(device)) return [];
    const items = ['switch', 'switchFeedback', ...LOAD_ITEMS, 'simulated'];
    for (const measure of enabledMeasures(device)) items.push(...measure.items);
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
    Gli azzeramenti accettano solo true, come il pulsante dell'app
----------------------------------------------------------------------------------------------------------------------*/
function toRestore(name) {
    return (value) => {
        if (value !== true && value !== 'true' && value !== 1) throw new Error(`${name} accepts only true`);
        return true;
    };
}

// Conversione/validazione del valore in scrittura per ogni item
const WRITERS = {
    switch: (value, device) => (value === 'toggle' ? !device.switchFeedback : toBoolean(value)),
    ...Object.fromEntries(MEASURES.map((measure) => [measure.restore, toRestore(measure.restore)]))
};

/*----------------------------------------------------------------------------------------------------------------------
    Trasforma l'input del nodo in un oggetto { item: valore } già validato.
    Accetta: payload oggetto, topic = nome item, oppure payload semplice (switch)
----------------------------------------------------------------------------------------------------------------------*/
function parseInput(msg, device) {
    const topic = typeof msg.topic === 'string' ? msg.topic.trim() : msg.topic;
    const allowed = writableItems(device);
    if (!allowed.length) throw new Error(`Unsupported socket type "${device?.typeId}"`);

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
            throw new Error(`Item "${name}" is not writable on this socket (allowed: ${allowed.join(', ')}; check the features enabled in the app)`);
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
    Stato del nodo, es. "On · 1.2 kW · Simulated"; sovraccarico e guasto (se la feature è abilitata) si accodano in rosso
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
    if (device.simulated === true) result.text += ' · Simulated';
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
