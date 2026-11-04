'use strict';

const FAMILY_ID = 'energy-managements';

const GRID_CONTROL = 'gridControl';
const GREEN_CONTROL = 'greenControl';

// Alias del comando della centralina: l'headunit accetta solo "play" e "stop"
const COMMAND_ALIASES = {
    true: 'play',
    on: 'play',
    1: 'play',
    start: 'play',
    false: 'stop',
    off: 'stop',
    0: 'stop',
    pause: 'stop'
};

/*----------------------------------------------------------------------------------------------------------------------
    Accetta "play"/"stop", i booleani e "toggle" (sullo stato attuale della centralina)
----------------------------------------------------------------------------------------------------------------------*/
function toCommand(value, device) {
    const text = typeof value === 'string' ? value.trim().toLowerCase() : String(value);
    if (text === 'toggle') return device.status === 'play' ? 'stop' : 'play';
    const command = COMMAND_ALIASES[text] || text;
    if (command !== 'play' && command !== 'stop') {
        throw new Error(`Invalid command ${JSON.stringify(value)} for an energy management (allowed: play, stop, toggle)`);
    }
    return command;
}

// Conversione/validazione del valore in scrittura per ogni item
const WRITERS = {
    command: (value, device) => toCommand(value, device)
};

// Comandi con uno stato confermato a parte (status): in modalità 'feedback' non escono
const COMMAND_ITEMS = ['command'];

// Items in sola lettura per ogni typeId: le regole e le soglie si configurano solo dall'app
const READ_ONLY_ITEMS = {
    [GRID_CONTROL]: ['status', 'gridPower', 'overloadBadge', 'economyBadge', 'gridProduction', 'gridToHouse'],
    [GREEN_CONTROL]: [
        'status',
        'gridPower',
        'greenPower',
        'housePower',
        'overloadBadge',
        'economyBadge',
        'greenBadge',
        'gridProduction',
        'greenProduction',
        'houseConsumption',
        'gridToHouse',
        'greenToHouse',
        'greenToGrid'
    ]
};

// Unità di misura in msg.unit
const UNITS = {
    gridPower: 'W',
    greenPower: 'W',
    housePower: 'W'
};

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
function isKnownType(device) {
    return Boolean(READ_ONLY_ITEMS[device?.typeId]);
}

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
function writableItems(device) {
    return isKnownType(device) ? Object.keys(WRITERS) : [];
}

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
function readableItems(device) {
    return isKnownType(device) ? [...writableItems(device), ...READ_ONLY_ITEMS[device.typeId]] : [];
}

/*----------------------------------------------------------------------------------------------------------------------
    Items mostrati nell'editor
----------------------------------------------------------------------------------------------------------------------*/
function editorItems(device) {
    return writableItems(device);
}

/*----------------------------------------------------------------------------------------------------------------------
    Trasforma l'input del nodo in un oggetto { item: valore } già validato.
    Accetta: payload oggetto, topic = nome item, oppure payload semplice (command)
----------------------------------------------------------------------------------------------------------------------*/
function parseInput(msg, device) {
    const topic = typeof msg.topic === 'string' ? msg.topic.trim() : msg.topic;
    const allowed = writableItems(device);
    if (!allowed.length) throw new Error(`Unsupported energy management type "${device?.typeId}"`);

    let requested;
    let fallback;
    if (topic && WRITERS[topic]) {
        requested = { [topic]: msg.payload };
    } else if (msg.payload !== null && typeof msg.payload === 'object' && !Array.isArray(msg.payload)) {
        requested = msg.payload;
    } else {
        fallback = 'command';
        requested = { [fallback]: msg.payload };
    }

    const items = {};
    for (const [name, value] of Object.entries(requested)) {
        if (!allowed.includes(name)) {
            throw new Error(`Item "${name}" is not writable on an energy management (allowed: ${allowed.join(', ')})`);
        }
        try {
            items[name] = WRITERS[name](value, device);
        } catch (error) {
            // Un topic sconosciuto fa ricadere il payload sul comando: lo segnaliamo, di solito è un refuso
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
    'feedback' (default): tutto tranne il comando, 'all': anche il comando arrivato da app/cloud/altri nodi
----------------------------------------------------------------------------------------------------------------------*/
function isOutputItem(item, config) {
    return config.outputMode === 'all' || !COMMAND_ITEMS.includes(item);
}

/*----------------------------------------------------------------------------------------------------------------------
    Potenza in W -> "2.4 kW"
----------------------------------------------------------------------------------------------------------------------*/
function kiloWatt(value) {
    return `${(value / 1000).toFixed(1)} kW`;
}

/*----------------------------------------------------------------------------------------------------------------------
    Stato del nodo, es. "Running · Grid 2.4 kW", "Running · House 2.4 kW · Green 3.0 kW · Overload".
    Come la card dell'app: sovraccarico con overloadBadge "detach", green con greenProduction, economia con economyBadge
----------------------------------------------------------------------------------------------------------------------*/
function status(device) {
    if (!isKnownType(device)) return { fill: 'grey', shape: 'ring', text: `Unknown Type ${device.typeId}` };
    if (device.status !== 'play') {
        return { fill: 'grey', shape: 'ring', text: device.status === 'stop' ? 'Stopped' : 'Unknown' };
    }
    const result = { fill: 'green', shape: 'dot', text: 'Running' };
    if (device.typeId === GRID_CONTROL) {
        if (typeof device.gridPower === 'number') result.text += ` · Grid ${kiloWatt(device.gridPower)}`;
    } else {
        if (typeof device.housePower === 'number') result.text += ` · House ${kiloWatt(device.housePower)}`;
        if (device.greenProduction && typeof device.greenPower === 'number') result.text += ` · Green ${kiloWatt(device.greenPower)}`;
    }
    if (device.economyBadge === true) result.text += ' · Economy';
    if (device.overloadBadge === 'detach') {
        result.fill = 'red';
        result.text += ' · Overload';
    }
    return result;
}

module.exports = { FAMILY_ID, writableItems, readableItems, editorItems, parseInput, isOutputItem, outputValue, outputExtras, status };
