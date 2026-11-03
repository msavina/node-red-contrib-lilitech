'use strict';

const { toBoolean, toPercent } = require('../coercion');

const FAMILY_ID = 'actuators';

const SWITCH_TYPES = ['pump', 'valve', 'sprinkler', 'faucet'];
const SERVO_VALVE = 'servoValve';
const THERMOSTATIC_VALVE = 'thermostaticValve';

// Comandi del drive della servoValve e relativi alias (true/"on" apre, false/"off" chiude)
const DRIVE_COMMANDS = ['open', 'close', 'stop'];
const DRIVE_ALIASES = {
    true: 'open',
    on: 'open',
    1: 'open',
    false: 'close',
    off: 'close',
    0: 'close'
};

// Range del setpoint della valvola termostatica (allineato al controllo dell'app)
const SETPOINT_MIN = 4;
const SETPOINT_MAX = 30;
const SETPOINT_STEP = 0.5;

// Items opzionali in sola lettura, abilitati da una feature del device
const OPTIONAL_ITEMS = [
    { flag: 'volumeInfo', items: ['volumeValue', 'volumeRelative', 'volumeRelativeTimestamp'] },
    { flag: 'openInfo', items: ['openStatus'] },
    { flag: 'faultInfo', items: ['faultSignal'] }
];

// Unità di misura in msg.unit (allineate ad ActuatorDataType dell'app)
const UNITS = {
    proportionalDrive: '%',
    proportionalDriveFeedback: '%',
    setpointTemperature: '°C',
    setpointTemperatureFeedback: '°C',
    roomTemperature: '°C',
    volumeValue: 'l',
    volumeRelative: 'l',
    battery: '%'
};

// Stato del nodo per ogni driveFeedback della servoValve
const DRIVE_STATUS = {
    open: { fill: 'green', shape: 'dot', text: 'Open' },
    opening: { fill: 'yellow', shape: 'dot', text: 'Opening' },
    close: { fill: 'grey', shape: 'ring', text: 'Closed' },
    closing: { fill: 'yellow', shape: 'dot', text: 'Closing' },
    stop: { fill: 'grey', shape: 'dot', text: 'Stopped' },
    idle: { fill: 'grey', shape: 'ring', text: 'Idle' }
};

/*----------------------------------------------------------------------------------------------------------------------
    Setpoint tra 4 e 30 °C a passi di 0.5 (i valori fuori range vengono limitati)
----------------------------------------------------------------------------------------------------------------------*/
function toSetpoint(value) {
    const n = Number(value);
    if (value === null || value === '' || typeof value === 'boolean' || !Number.isFinite(n)) {
        throw new Error(`Invalid number: ${JSON.stringify(value)}`);
    }
    const rounded = Math.round(n / SETPOINT_STEP) * SETPOINT_STEP;
    return Math.max(SETPOINT_MIN, Math.min(SETPOINT_MAX, rounded));
}

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
function toDriveCommand(value) {
    const text = typeof value === 'string' ? value.trim().toLowerCase() : String(value);
    const command = DRIVE_ALIASES[text] || text;
    if (!DRIVE_COMMANDS.includes(command)) {
        throw new Error(`Invalid drive command ${JSON.stringify(value)} (allowed: ${DRIVE_COMMANDS.join(', ')})`);
    }
    return command;
}

// Conversione/validazione del valore in scrittura per ogni item
const WRITERS = {
    switch: (value, state) => (value === 'toggle' ? !state.switchFeedback : toBoolean(value)),
    proportionalDrive: (value) => toPercent(value),
    drive: (value) => toDriveCommand(value),
    setpointTemperature: (value) => toSetpoint(value)
};

/*----------------------------------------------------------------------------------------------------------------------
    Item scrivibili del device: proportionalDrive solo sugli attuatori proporzionali (come il controllo dell'app)
----------------------------------------------------------------------------------------------------------------------*/
function writableItems(device) {
    if (device?.typeId === SERVO_VALVE) return ['drive'];
    if (device?.typeId === THERMOSTATIC_VALVE) return ['setpointTemperature'];
    if (!SWITCH_TYPES.includes(device?.typeId)) return [];
    return device.proportional ? ['switch', 'proportionalDrive'] : ['switch'];
}

/*----------------------------------------------------------------------------------------------------------------------
    Items in sola lettura: quelli del tipo più gli opzionali abilitati dalle features
----------------------------------------------------------------------------------------------------------------------*/
function readOnlyItems(device) {
    const items = [];
    if (device?.typeId === THERMOSTATIC_VALVE) items.push('roomTemperature', 'proportionalDriveFeedback', 'battery');
    if (SWITCH_TYPES.includes(device?.typeId)) items.push('powerOffTimerAt');
    for (const optional of OPTIONAL_ITEMS) {
        if (device?.[optional.flag]) items.push(...optional.items);
    }
    return items;
}

/*----------------------------------------------------------------------------------------------------------------------
    Item leggibili: i comandi, i rispettivi feedback e quelli in sola lettura
----------------------------------------------------------------------------------------------------------------------*/
function readableItems(device) {
    const items = [];
    for (const item of writableItems(device)) items.push(item, `${item}Feedback`);
    for (const item of readOnlyItems(device)) {
        if (!items.includes(item)) items.push(item);
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
    Accetta: payload oggetto, topic = nome item, oppure payload semplice (= item principale del tipo)
----------------------------------------------------------------------------------------------------------------------*/
function parseInput(msg, device, state = device) {
    const topic = typeof msg.topic === 'string' ? msg.topic.trim() : msg.topic;
    const allowed = writableItems(device);
    if (!allowed.length) throw new Error(`Unsupported actuator type "${device?.typeId}"`);

    let requested;
    if (topic && WRITERS[topic]) {
        requested = { [topic]: msg.payload };
    } else if (msg.payload !== null && typeof msg.payload === 'object' && !Array.isArray(msg.payload)) {
        requested = msg.payload;
    } else {
        requested = { [allowed[0]]: msg.payload };
    }

    const items = {};
    for (const [name, value] of Object.entries(requested)) {
        if (!allowed.includes(name)) {
            throw new Error(`Item "${name}" is not writable on a "${device?.typeId}" actuator (allowed: ${allowed.join(', ')})`);
        }
        try {
            items[name] = WRITERS[name](value, state || {});
        } catch (error) {
            // Un topic sconosciuto fa ricadere il payload sull'item principale: lo segnaliamo, di solito è un refuso
            if (topic && !WRITERS[topic] && name === allowed[0]) {
                throw new Error(`${error.message}: msg.topic "${msg.topic}" is not a known item (allowed: ${allowed.join(', ')})`);
            }
            throw error;
        }
    }
    if (Object.keys(items).length === 0) throw new Error('No item to write');
    return items;
}

/*----------------------------------------------------------------------------------------------------------------------
    Le temperature arrivano con il rumore della conversione float dei driver: arrotondiamo a 1 decimale (3 per i litri)
----------------------------------------------------------------------------------------------------------------------*/
function outputValue(item, value) {
    if (typeof value !== 'number' || item.endsWith('Timestamp') || item.endsWith('At')) return value;
    const factor = item.startsWith('volume') ? 1000 : 10;
    return Math.round(value * factor) / factor;
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
    Testo e colore in base al tipo, es. "On · 60%", "Open", "20 °C · Valve 35%"
----------------------------------------------------------------------------------------------------------------------*/
function typeStatus(device) {
    if (device.typeId === SERVO_VALVE) {
        const known = DRIVE_STATUS[device.driveFeedback];
        if (known) return { ...known };
        return { fill: 'grey', shape: 'ring', text: device.driveFeedback ? `Unknown Status ${device.driveFeedback}` : 'Unknown' };
    }
    if (device.typeId === THERMOSTATIC_VALVE) {
        const setpoint = device.setpointTemperatureFeedback;
        if (typeof setpoint !== 'number') return { fill: 'grey', shape: 'ring', text: 'Unknown' };
        const opening = device.proportionalDriveFeedback;
        const open = typeof opening === 'number' && opening > 0;
        const text = `${outputValue('setpointTemperatureFeedback', setpoint)} °C` + (typeof opening === 'number' ? ` · Valve ${opening}%` : '');
        return { fill: open ? 'green' : 'grey', shape: open ? 'dot' : 'ring', text };
    }
    if (!SWITCH_TYPES.includes(device.typeId)) return { fill: 'grey', shape: 'ring', text: `Unknown Type ${device.typeId}` };
    if (typeof device.switchFeedback !== 'boolean') return { fill: 'grey', shape: 'ring', text: 'Unknown' };
    if (!device.switchFeedback) return { fill: 'grey', shape: 'ring', text: 'Off' };
    const percent = device.proportional && typeof device.proportionalDriveFeedback === 'number' ? ` · ${device.proportionalDriveFeedback}%` : '';
    return { fill: 'green', shape: 'dot', text: `On${percent}` };
}

/*----------------------------------------------------------------------------------------------------------------------
    Stato del nodo: il guasto (se la feature è abilitata) si accoda in rosso
----------------------------------------------------------------------------------------------------------------------*/
function status(device) {
    const result = typeStatus(device);
    if (device.faultInfo && device.faultSignal) {
        result.fill = 'red';
        result.text += ' · Fault';
    }
    return result;
}

module.exports = { FAMILY_ID, writableItems, readableItems, editorItems, parseInput, isOutputItem, outputValue, outputExtras, status };
