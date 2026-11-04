'use strict';

const { toBoolean, toInteger } = require('../coercion');

const FAMILY_ID = 'chargers';

const CHARGER = 'charger';
const SMART_CHARGER = 'smartCharger';

// Corrente massima di ricarica impostabile, come nei controlli dell'app
const MAX_CHARGING_CURRENT = { min: 1, max: 16 };

// Alias dei comandi della colonnina smart (true/"on" avvia, false/"off" mette in pausa)
const COMMAND_ALIASES = {
    true: 'play',
    on: 'play',
    1: 'play',
    start: 'play',
    false: 'pause',
    off: 'pause',
    0: 'pause',
    stop: 'pause'
};

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
function toCommand(value, device) {
    const text = typeof value === 'string' ? value.trim().toLowerCase() : String(value);
    if (text === 'toggle') return device.command === 'play' ? 'pause' : 'play';
    const command = COMMAND_ALIASES[text] || text;
    if (command !== 'play' && command !== 'pause') {
        throw new Error(`Invalid command ${JSON.stringify(value)} for a smart charger (allowed: play, pause, toggle)`);
    }
    return command;
}

/*----------------------------------------------------------------------------------------------------------------------
    Accetta i booleani e "lock"/"unlock"/"toggle"
----------------------------------------------------------------------------------------------------------------------*/
function toLock(value, device) {
    const text = typeof value === 'string' ? value.trim().toLowerCase() : value;
    if (text === 'lock') return true;
    if (text === 'unlock') return false;
    if (text === 'toggle') return !device.statusLock;
    return toBoolean(value);
}

// Conversione/validazione del valore in scrittura per ogni item
const WRITERS = {
    switch: (value, device) => (value === 'toggle' ? !device.switchFeedback : toBoolean(value)),
    command: (value, device) => toCommand(value, device),
    commandLock: (value, device) => toLock(value, device),
    maxChargingCurrent: (value) => toInteger(value, MAX_CHARGING_CURRENT.min, MAX_CHARGING_CURRENT.max)
};

// Item scrivibili per ogni typeId: il driver Wallbox esegue un solo comando per messaggio
const TYPE_ITEMS = {
    [CHARGER]: ['switch'],
    [SMART_CHARGER]: ['command', 'commandLock', 'maxChargingCurrent']
};

// Comandi con uno stato confermato a parte (switchFeedback, statusLock, status): in modalità 'feedback' non escono
const COMMAND_ITEMS = ['switch', 'command', 'commandLock'];

// Items in sola lettura per ogni typeId
const READ_ONLY_ITEMS = {
    [CHARGER]: ['switchFeedback'],
    [SMART_CHARGER]: ['status', 'statusLock', 'chargingPower', 'addedEnergy', 'chargingTime', 'sessionTime']
};

// Stati del carico gestiti dalla gestione energia, validi per tutti i tipi
const LOAD_ITEMS = ['overload', 'economy', 'green'];

// Misure del caricatore semplice abilitate dalle features (la tensione anche da quella stimata)
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
    voltage: 'V',
    maxChargingCurrent: 'A',
    chargingPower: 'kW',
    addedEnergy: 'kWh',
    chargingTime: 's',
    sessionTime: 's'
};

// Stato del nodo per ogni status della colonnina smart
const STATUS_FILL = {
    charging: { fill: 'green', shape: 'dot' },
    discharging: { fill: 'green', shape: 'ring' },
    ready: { fill: 'blue', shape: 'ring' },
    paused: { fill: 'yellow', shape: 'ring' },
    scheduled: { fill: 'yellow', shape: 'ring' },
    updating: { fill: 'yellow', shape: 'ring' },
    error: { fill: 'red', shape: 'dot' },
    waitingMidFailed: { fill: 'red', shape: 'ring' }
};

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
function isKnownType(device) {
    return Boolean(TYPE_ITEMS[device?.typeId]);
}

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
function writableItems(device) {
    return isKnownType(device) ? [...TYPE_ITEMS[device.typeId]] : [];
}

/*----------------------------------------------------------------------------------------------------------------------
    Item leggibili: i comandi, gli stati del tipo, quelli della gestione energia e le misure abilitate dalle features
----------------------------------------------------------------------------------------------------------------------*/
function readableItems(device) {
    if (!isKnownType(device)) return [];
    const items = [...writableItems(device), ...READ_ONLY_ITEMS[device.typeId], ...LOAD_ITEMS];
    if (device.typeId === CHARGER) {
        for (const optional of OPTIONAL_ITEMS) {
            if (optional.flags.some((flag) => device[flag])) items.push(...optional.items);
        }
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
    Payload semplice: switch sul caricatore, comando sulla colonnina smart ("lock"/"unlock" bloccano la colonnina)
----------------------------------------------------------------------------------------------------------------------*/
function defaultItem(payload, device) {
    if (device.typeId === CHARGER) return 'switch';
    const text = typeof payload === 'string' ? payload.trim().toLowerCase() : payload;
    return text === 'lock' || text === 'unlock' ? 'commandLock' : 'command';
}

/*----------------------------------------------------------------------------------------------------------------------
    Trasforma l'input del nodo in un oggetto { item: valore } già validato.
    Accetta: payload oggetto, topic = nome item, oppure payload semplice (vedi defaultItem)
----------------------------------------------------------------------------------------------------------------------*/
function parseInput(msg, device) {
    const topic = typeof msg.topic === 'string' ? msg.topic.trim() : msg.topic;
    const allowed = writableItems(device);
    if (!allowed.length) throw new Error(`Unsupported charger type "${device?.typeId}"`);

    let requested;
    let fallback;
    if (topic && WRITERS[topic]) {
        requested = { [topic]: msg.payload };
    } else if (msg.payload !== null && typeof msg.payload === 'object' && !Array.isArray(msg.payload)) {
        requested = msg.payload;
    } else {
        fallback = defaultItem(msg.payload, device);
        requested = { [fallback]: msg.payload };
    }

    const items = {};
    for (const [name, value] of Object.entries(requested)) {
        if (!allowed.includes(name)) {
            throw new Error(`Item "${name}" is not writable on a "${device.typeId}" charger (allowed: ${allowed.join(', ')})`);
        }
        try {
            items[name] = WRITERS[name](value, device);
        } catch (error) {
            // Un topic sconosciuto fa ricadere il payload sull'item di default: lo segnaliamo, di solito è un refuso
            if (topic && fallback) {
                throw new Error(`${error.message}: msg.topic "${msg.topic}" is not a known item (allowed: ${allowed.join(', ')})`);
            }
            throw error;
        }
    }
    const names = Object.keys(items);
    if (names.length === 0) throw new Error('No item to write');
    if (device.typeId === SMART_CHARGER && names.length > 1) {
        throw new Error(`A smart charger accepts one item per message (received: ${names.join(', ')})`);
    }
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
    return config.outputMode === 'all' || !COMMAND_ITEMS.includes(item);
}

/*----------------------------------------------------------------------------------------------------------------------
    "waitingForCarDemand" -> "Waiting For Car Demand"
----------------------------------------------------------------------------------------------------------------------*/
function statusLabel(status) {
    const words = String(status).replace(/([a-z])([A-Z])/g, '$1 $2');
    return words.charAt(0).toUpperCase() + words.slice(1);
}

/*----------------------------------------------------------------------------------------------------------------------
    Stato del caricatore semplice, es. "On · 3.2 kW"
----------------------------------------------------------------------------------------------------------------------*/
function chargerStatus(device) {
    if (device.switchFeedback === undefined) return { fill: 'grey', shape: 'ring', text: 'Unknown' };
    if (!device.switchFeedback) return { fill: 'grey', shape: 'ring', text: 'Off' };
    const result = { fill: 'green', shape: 'dot', text: 'On' };
    if (device.powerInfo && typeof device.power === 'number') result.text += ` · ${(device.power / 1000).toFixed(1)} kW`;
    return result;
}

/*----------------------------------------------------------------------------------------------------------------------
    Stato della colonnina smart, es. "Charging · 7.4 kW", "Ready · Locked"
----------------------------------------------------------------------------------------------------------------------*/
function smartChargerStatus(device) {
    if (!device.status) return { fill: 'grey', shape: 'ring', text: 'Unknown' };
    const result = { ...(STATUS_FILL[device.status] || { fill: 'grey', shape: 'ring' }), text: statusLabel(device.status) };
    if (device.status === 'charging' && typeof device.chargingPower === 'number') result.text += ` · ${device.chargingPower} kW`;
    if (device.statusLock && !String(device.status).startsWith('locked')) result.text += ' · Locked';
    return result;
}

/*----------------------------------------------------------------------------------------------------------------------
    Stato del nodo; sovraccarico e guasto (se la feature è abilitata) si accodano in rosso
----------------------------------------------------------------------------------------------------------------------*/
function status(device) {
    if (!isKnownType(device)) return { fill: 'grey', shape: 'ring', text: `Unknown Type ${device.typeId}` };
    const result = device.typeId === CHARGER ? chargerStatus(device) : smartChargerStatus(device);
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
