'use strict';

const { toBoolean } = require('../coercion');

const FAMILY_ID = 'thermostats';

const TYPES = ['heatThermostat', 'coolThermostat', 'fullThermostat', 'smartHeatThermostat', 'smartCoolThermostat', 'smartFullThermostat'];
// Solo i termostati caldo/freddo hanno il selettore della modalità nell'app
const FULL_TYPES = ['fullThermostat', 'smartFullThermostat'];

const PROFILES = ['comfort', 'economy', 'protection', 'standby', 'manual', 'chrono'];
// heat e cool sempre, le altre se abilitate dai flag modeButton* (come il selettore dell'app; l'headunit non ha "wind")
const MODES = ['heat', 'cool', 'auto', 'dry', 'fan'];
const OPTIONAL_MODES = ['auto', 'dry', 'fan'];

// Range della rotella dell'app; con blockSetpointInfo il setpoint resta a +/- 3 °C dal setpoint base
const SETPOINT_TEMPERATURE = { min: 5, max: 35, step: 0.5 };
const BLOCK_SETPOINT_DELTA = 3;

// Comandi con uno stato confermato a parte (...Feedback): in modalità 'feedback' non escono
const COMMAND_ITEMS = ['switch', 'setpointTemperature', 'thermoProfile', 'thermoMode'];

// Unità di misura in msg.unit
const UNITS = {
    setpointTemperature: '°C',
    setpointTemperatureFeedback: '°C',
    roomTemperature: '°C',
    chronoSetpoint: '°C',
    roomHumidity: '%',
    overrideTime: 'ms'
};

// Stato del nodo per ogni thermoStatus
const THERMO_STATUS_FILL = {
    heat: { fill: 'red', shape: 'dot' },
    cool: { fill: 'blue', shape: 'dot' },
    auto: { fill: 'green', shape: 'dot' },
    dry: { fill: 'blue', shape: 'ring' },
    fan: { fill: 'blue', shape: 'ring' },
    idle: { fill: 'green', shape: 'ring' },
    inhibit: { fill: 'yellow', shape: 'ring' },
    standby: { fill: 'grey', shape: 'ring' },
    off: { fill: 'grey', shape: 'ring' }
};

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
function isKnownType(device) {
    return TYPES.includes(device?.typeId);
}

/*----------------------------------------------------------------------------------------------------------------------
    Modalità selezionabili, come il selettore dell'app
----------------------------------------------------------------------------------------------------------------------*/
function enabledModes(device) {
    return MODES.filter((mode) => !OPTIONAL_MODES.includes(mode) || device[`modeButton${mode.charAt(0).toUpperCase()}${mode.slice(1)}`]);
}

/*----------------------------------------------------------------------------------------------------------------------
    Valvole del sistema primario e (se abilitato) secondario: una a 2 tubi, caldo/freddo a 4 tubi
----------------------------------------------------------------------------------------------------------------------*/
function valveItems(device) {
    const items = device.systemPrimaryFourPipes ? ['systemPrimaryValveHeat', 'systemPrimaryValveCool'] : ['systemPrimaryValve'];
    if (device.systemSecondaryHeatEnable || device.systemSecondaryCoolEnable) {
        items.push(...(device.systemSecondaryFourPipes ? ['systemSecondaryValveHeat', 'systemSecondaryValveCool'] : ['systemSecondaryValve']));
    }
    return items;
}

/*----------------------------------------------------------------------------------------------------------------------
    Coppie [comando, feedback], in base al tipo e alle features abilitate nell'app.
    Lo switch si scrive solo se 'powerable' (l'headunit lo ignora altrimenti), ma il feedback esce sempre
----------------------------------------------------------------------------------------------------------------------*/
function controlPairs(device) {
    if (!isKnownType(device)) return [];
    const pairs = [[device.powerable ? 'switch' : null, 'switchFeedback'], ['setpointTemperature', 'setpointTemperatureFeedback']];
    if (device.thermoProfilesEnable) pairs.push(['thermoProfile', 'thermoProfileFeedback']);
    if (FULL_TYPES.includes(device.typeId)) pairs.push(['thermoMode', 'thermoModeFeedback']);
    return pairs;
}

/*----------------------------------------------------------------------------------------------------------------------
    Items scrivibili: i comandi abilitati più il ripristino dell'override (la durata si imposta dall'app)
----------------------------------------------------------------------------------------------------------------------*/
function writableItems(device) {
    if (!isKnownType(device)) return [];
    return [...controlPairs(device).map(([command]) => command).filter(Boolean), 'overrideRestore'];
}

/*----------------------------------------------------------------------------------------------------------------------
    Items leggibili: comandi e feedback, stato, override, valvole e misure abilitate dalle features
----------------------------------------------------------------------------------------------------------------------*/
function readableItems(device) {
    if (!isKnownType(device)) return [];
    const items = controlPairs(device).flat().filter(Boolean);
    items.push('roomTemperature', 'thermoStatus', 'overrideFeedback', 'overrideTime', 'overrideTimeAt', ...valveItems(device));
    if (device.thermoProfilesEnable) items.push('chronoSetpoint');
    if (device.humidityInfo) items.push('roomHumidity');
    if (device.faultInfo) items.push('faultSignal');
    return items;
}

/*----------------------------------------------------------------------------------------------------------------------
    Items mostrati nell'editor
----------------------------------------------------------------------------------------------------------------------*/
function editorItems(device) {
    return writableItems(device).filter((item) => item !== 'overrideRestore');
}

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
function toChoice(value, allowed, label) {
    const text = typeof value === 'string' ? value.trim() : value;
    const choice = allowed.find((option) => option.toLowerCase() === String(text).toLowerCase());
    if (!choice) throw new Error(`Invalid ${label} ${JSON.stringify(value)} (allowed: ${allowed.join(', ') || 'none enabled in the app'})`);
    return choice;
}

/*----------------------------------------------------------------------------------------------------------------------
    Limiti del setpoint come la rotella dell'app: 5-35 °C, oppure setpoint base +/- 3 °C con blockSetpointInfo
----------------------------------------------------------------------------------------------------------------------*/
function setpointRange(device) {
    const base = Number(device.baseSetPoint);
    if (device.blockSetpointInfo && device.baseSetPoint !== null && device.baseSetPoint !== '' && Number.isFinite(base)) {
        return { min: base - BLOCK_SETPOINT_DELTA, max: base + BLOCK_SETPOINT_DELTA };
    }
    return SETPOINT_TEMPERATURE;
}

/*----------------------------------------------------------------------------------------------------------------------
    Temperatura a passi di 0.5 °C (i valori fuori range vengono limitati)
----------------------------------------------------------------------------------------------------------------------*/
function toTemperature(value, device) {
    const n = Number(value);
    if (value === null || value === '' || typeof value === 'boolean' || !Number.isFinite(n)) {
        throw new Error(`Invalid temperature: ${JSON.stringify(value)}`);
    }
    const { min, max } = setpointRange(device);
    const stepped = Math.round(n / SETPOINT_TEMPERATURE.step) * SETPOINT_TEMPERATURE.step;
    return Math.max(min, Math.min(max, stepped));
}

// Conversione/validazione del valore in scrittura per ogni item
const WRITERS = {
    switch: (value, device) => (value === 'toggle' ? !device.switchFeedback : toBoolean(value)),
    setpointTemperature: (value, device) => toTemperature(value, device),
    thermoProfile: (value) => toChoice(value, PROFILES, 'profile'),
    thermoMode: (value, device) => toChoice(value, enabledModes(device), 'mode'),
    overrideRestore: (value) => {
        if (value !== true && value !== 'true' && value !== 1) throw new Error('overrideRestore accepts only true');
        return true;
    }
};

/*----------------------------------------------------------------------------------------------------------------------
    Payload semplice: booleani/"on"/"off"/"toggle" -> switch, numero -> setpoint,
    nome di un profilo o di una modalità -> thermoProfile/thermoMode
----------------------------------------------------------------------------------------------------------------------*/
function defaultItem(payload) {
    const text = typeof payload === 'string' ? payload.trim().toLowerCase() : null;
    if (text && PROFILES.includes(text)) return 'thermoProfile';
    if (text && MODES.includes(text)) return 'thermoMode';
    const isNumber = typeof payload === 'number' || (text !== null && text !== '' && Number.isFinite(Number(text)));
    return isNumber ? 'setpointTemperature' : 'switch';
}

/*----------------------------------------------------------------------------------------------------------------------
    Trasforma l'input del nodo in un oggetto { item: valore } già validato.
    Accetta: payload oggetto, topic = nome item, oppure payload semplice (vedi defaultItem)
----------------------------------------------------------------------------------------------------------------------*/
function parseInput(msg, device) {
    const topic = typeof msg.topic === 'string' ? msg.topic.trim() : msg.topic;
    if (!isKnownType(device)) throw new Error(`Unsupported thermostat type "${device?.typeId}"`);
    const allowed = writableItems(device);

    let requested;
    let fallback;
    if (topic && WRITERS[topic]) {
        requested = { [topic]: msg.payload };
    } else if (msg.payload !== null && typeof msg.payload === 'object' && !Array.isArray(msg.payload)) {
        requested = msg.payload;
    } else {
        fallback = defaultItem(msg.payload);
        // Con un topic sconosciuto un numero finirebbe sul setpoint: ripieghiamo solo sullo switch
        if (topic && fallback !== 'switch') {
            throw new Error(`msg.topic "${msg.topic}" is not a known item (allowed: ${allowed.join(', ')})`);
        }
        requested = { [fallback]: msg.payload };
    }

    const items = {};
    for (const [name, value] of Object.entries(requested)) {
        if (!allowed.includes(name)) {
            throw new Error(
                `Item "${name}" is not writable on this "${device.typeId}" (allowed: ${allowed.join(', ') || 'none'}; check the features enabled in the app)`
            );
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
    return config.outputMode === 'all' || !COMMAND_ITEMS.includes(item);
}

/*----------------------------------------------------------------------------------------------------------------------
    "heat" -> "Heat"
----------------------------------------------------------------------------------------------------------------------*/
function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

/*----------------------------------------------------------------------------------------------------------------------
    Stato del nodo, es. "Heat · 20.5 °C → 22 °C · Comfort · Override"; il guasto (se abilitato) si accoda in rosso
----------------------------------------------------------------------------------------------------------------------*/
function status(device) {
    if (!isKnownType(device)) return { fill: 'grey', shape: 'ring', text: `Unknown Type ${device.typeId}` };
    let result;
    if (device.switchFeedback === false) {
        result = { fill: 'grey', shape: 'ring', text: 'Off' };
    } else {
        const state = device.thermoStatus || (device.switchFeedback ? 'idle' : null);
        if (!state) return { fill: 'grey', shape: 'ring', text: 'Unknown' };
        result = { ...(THERMO_STATUS_FILL[state] || { fill: 'grey', shape: 'ring' }), text: capitalize(state) };
        const room = typeof device.roomTemperature === 'number' ? `${device.roomTemperature} °C` : null;
        const setpoint = typeof device.setpointTemperatureFeedback === 'number' ? `${device.setpointTemperatureFeedback} °C` : null;
        if (room && setpoint) result.text += ` · ${room} → ${setpoint}`;
        else if (room || setpoint) result.text += ` · ${room || `Set ${setpoint}`}`;
        if (device.thermoProfilesEnable && device.thermoProfileFeedback) result.text += ` · ${capitalize(device.thermoProfileFeedback)}`;
        if (device.overrideFeedback) result.text += ' · Override';
    }
    if (device.faultInfo && device.faultSignal) {
        result.fill = 'red';
        result.text += ' · Fault';
    }
    return result;
}

module.exports = { FAMILY_ID, writableItems, readableItems, editorItems, parseInput, isOutputItem, outputValue, outputExtras, status };
