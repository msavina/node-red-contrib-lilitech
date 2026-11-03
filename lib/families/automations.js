'use strict';

const { toPercent } = require('../coercion');

const FAMILY_ID = 'automations';

// Tapparelle, tende e frangisole: chiusura sempre disponibile, posizione e lamelle abilitate dalle features
const BLIND_TYPES = ['shutter', 'sunBlind', 'sunshadeAwning', 'curtain'];
// Cancelli, porte e finestre: la chiusura è abilitata dalla feature closeable
const DOOR_TYPES = ['barrier', 'frontDoor', 'gate', 'pedestrianGate', 'tilting', 'window'];
const FRONT_DOOR = 'frontDoor';

// Alias dei comandi del drive (true/"on" apre, false/"off" chiude)
const DRIVE_ALIASES = {
    true: 'open',
    on: 'open',
    1: 'open',
    false: 'close',
    off: 'close',
    0: 'close'
};

// Items opzionali in sola lettura, abilitati da una feature del device (battery e status solo sulle serrature Nuki)
const OPTIONAL_ITEMS = [
    { flag: 'openInfo', items: ['openStatus'] },
    { flag: 'faultInfo', items: ['faultSignal'] },
    { flag: 'lockable', items: ['status', 'battery'] }
];

// Unità di misura in msg.unit
const UNITS = {
    absolutePosition: '%',
    absolutePositionFeedback: '%',
    absolutePositionFoil: '%',
    absolutePositionFoilFeedback: '%',
    battery: '%'
};

// Stato del nodo per ogni driveFeedback
const DRIVE_STATUS = {
    open: { fill: 'green', shape: 'dot', text: 'Open' },
    opening: { fill: 'yellow', shape: 'dot', text: 'Opening' },
    close: { fill: 'grey', shape: 'ring', text: 'Closed' },
    closing: { fill: 'yellow', shape: 'dot', text: 'Closing' },
    stop: { fill: 'grey', shape: 'dot', text: 'Stopped' },
    idle: { fill: 'grey', shape: 'ring', text: 'Idle' },
    locked: { fill: 'green', shape: 'ring', text: 'Locked' },
    locking: { fill: 'yellow', shape: 'ring', text: 'Locking' },
    unlocked: { fill: 'green', shape: 'dot', text: 'Unlocked' },
    unlocking: { fill: 'yellow', shape: 'dot', text: 'Unlocking' },
    block: { fill: 'red', shape: 'ring', text: 'Blocked' },
    alarm: { fill: 'red', shape: 'dot', text: 'Alarm' }
};

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
function isKnownType(device) {
    return BLIND_TYPES.includes(device?.typeId) || DOOR_TYPES.includes(device?.typeId);
}

/*----------------------------------------------------------------------------------------------------------------------
    Comandi del drive disponibili, come i pulsanti dell'app
----------------------------------------------------------------------------------------------------------------------*/
function driveCommands(device) {
    if (!isKnownType(device)) return [];
    const commands = ['open'];
    if (BLIND_TYPES.includes(device.typeId) || device.closeable) commands.push('close');
    if (device.stoppable) commands.push('stop');
    if (device.typeId === FRONT_DOOR && device.lockable) commands.push('lock', 'unlock');
    return commands;
}

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
function toDriveCommand(value, device) {
    const text = typeof value === 'string' ? value.trim().toLowerCase() : String(value);
    const command = DRIVE_ALIASES[text] || text;
    const allowed = driveCommands(device);
    if (!allowed.includes(command)) {
        throw new Error(`Invalid drive command ${JSON.stringify(value)} for this automation (allowed: ${allowed.join(', ')})`);
    }
    return command;
}

// Conversione/validazione del valore in scrittura per ogni item
const WRITERS = {
    drive: (value, device) => toDriveCommand(value, device),
    absolutePosition: (value) => toPercent(value),
    absolutePositionFoil: (value) => toPercent(value)
};

/*----------------------------------------------------------------------------------------------------------------------
    Item scrivibili del device: posizione e lamelle solo se abilitate dalle features
----------------------------------------------------------------------------------------------------------------------*/
function writableItems(device) {
    if (!isKnownType(device)) return [];
    const items = ['drive'];
    if (device.positionable) items.push('absolutePosition');
    if (device.inclinable) items.push('absolutePositionFoil');
    return items;
}

/*----------------------------------------------------------------------------------------------------------------------
    Item leggibili: i comandi, i rispettivi feedback e gli opzionali abilitati dalle features
----------------------------------------------------------------------------------------------------------------------*/
function readableItems(device) {
    const items = [];
    for (const item of writableItems(device)) items.push(item, `${item}Feedback`);
    for (const optional of OPTIONAL_ITEMS) {
        if (device?.[optional.flag]) items.push(...optional.items);
    }
    return items;
}

/*----------------------------------------------------------------------------------------------------------------------
    Nell'editor mostriamo i comandi del drive e gli altri item scrivibili
----------------------------------------------------------------------------------------------------------------------*/
function editorItems(device) {
    return [...driveCommands(device), ...writableItems(device).filter((item) => item !== 'drive')];
}

/*----------------------------------------------------------------------------------------------------------------------
    Trasforma l'input del nodo in un oggetto { item: valore } già validato.
    Accetta: payload oggetto, topic = nome item, oppure payload semplice (= comando del drive)
----------------------------------------------------------------------------------------------------------------------*/
function parseInput(msg, device) {
    const topic = typeof msg.topic === 'string' ? msg.topic.trim() : msg.topic;
    const allowed = writableItems(device);
    if (!allowed.length) throw new Error(`Unsupported automation type "${device?.typeId}"`);

    let requested;
    if (topic && WRITERS[topic]) {
        requested = { [topic]: msg.payload };
    } else if (msg.payload !== null && typeof msg.payload === 'object' && !Array.isArray(msg.payload)) {
        requested = msg.payload;
    } else {
        requested = { drive: msg.payload };
    }

    const items = {};
    for (const [name, value] of Object.entries(requested)) {
        if (!allowed.includes(name)) {
            throw new Error(`Item "${name}" is not writable on this "${device?.typeId}" automation (allowed: ${allowed.join(', ')})`);
        }
        try {
            items[name] = WRITERS[name](value, device);
        } catch (error) {
            // Un topic sconosciuto fa ricadere il payload sul drive: lo segnaliamo, di solito è un refuso
            if (topic && !WRITERS[topic] && name === 'drive') {
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
    'feedback' (default): tutto tranne i comandi, 'all': anche i comandi arrivati da app/cloud/altri nodi
----------------------------------------------------------------------------------------------------------------------*/
function isOutputItem(item, config) {
    return config.outputMode === 'all' || !WRITERS[item];
}

/*----------------------------------------------------------------------------------------------------------------------
    Stato del nodo, es. "Open", "Closing · 40%", "Locked"; il guasto (se la feature è abilitata) si accoda in rosso
----------------------------------------------------------------------------------------------------------------------*/
function status(device) {
    if (!isKnownType(device)) return { fill: 'grey', shape: 'ring', text: `Unknown Type ${device.typeId}` };
    const known = DRIVE_STATUS[device.driveFeedback];
    const result = known
        ? { ...known }
        : { fill: 'grey', shape: 'ring', text: device.driveFeedback ? `Unknown Status ${device.driveFeedback}` : 'Unknown' };
    if (device.positionable && typeof device.absolutePositionFeedback === 'number') result.text += ` · ${device.absolutePositionFeedback}%`;
    if (device.faultInfo && device.faultSignal) {
        result.fill = 'red';
        result.text += ' · Fault';
    }
    return result;
}

module.exports = { FAMILY_ID, driveCommands, writableItems, readableItems, editorItems, parseInput, isOutputItem, outputValue, outputExtras, status };
