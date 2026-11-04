'use strict';

const { toBoolean, toInteger } = require('../coercion');

// familyId al singolare, come nell'app e nell'headunit
const FAMILY_ID = 'hvac';

// Condizionatori e fancoil hanno la logica termostato (setpoint, profili, modalità, override)
const THERMO_TYPES = ['conditioner', 'fancoil'];
// Tipi con il solo comando di accensione (se 'powerable')
const POWER_TYPES = ['boiler', 'chiller', 'heatPump', 'dehumidifier', 'airPurifier', 'fan', 'vmc'];
// Tipi che mostrano il selettore della ventola nell'app (se 'fanManagement')
const FAN_TYPES = ['conditioner', 'fancoil', 'dehumidifier', 'airPurifier', 'fan', 'vmc'];
// Tipi con le misure dell'impianto (mandata, ritorno, acqua calda sanitaria, pressione)
const PLANT_TYPES = ['boiler', 'chiller', 'heatPump'];

const PROFILES = ['comfort', 'economy', 'protection', 'standby', 'manual', 'chrono'];
const MODES = ['heat', 'cool', 'dry', 'fan', 'wind', 'auto'];
const FAN_DIRECTIONS = ['fixed', 'all', 'vertical', 'horizontal'];

// Range dei controlli dell'app (lo 0 del setpoint viene ignorato dall'headunit)
const SETPOINT_TEMPERATURE = { min: 5, max: 35, step: 0.5 };
const PERCENT = { min: 0, max: 100 };

// Comandi con uno stato confermato a parte (...Feedback): in modalità 'feedback' non escono
const COMMAND_ITEMS = [
    'switch',
    'setpointTemperature',
    'setpointHumidity',
    'thermoProfile',
    'thermoMode',
    'fanSpeed',
    'fanAuto',
    'fanEco',
    'fanStrong',
    'fanDirection',
    'supplyFanSpeed',
    'returnFanSpeed'
];

// Unità di misura in msg.unit
const UNITS = {
    setpointTemperature: '°C',
    setpointTemperatureFeedback: '°C',
    roomTemperature: '°C',
    chronoSetpoint: '°C',
    deliveryTemperature: '°C',
    returnTemperature: '°C',
    acsTemperature: '°C',
    roomHumidity: '%',
    setpointHumidity: '%',
    setpointHumidityFeedback: '%',
    supplyFanSpeed: '%',
    supplyFanSpeedFeedback: '%',
    returnFanSpeed: '%',
    returnFanSpeedFeedback: '%',
    overrideTime: 'ms'
};

// Stato del nodo per ogni thermoStatus
const THERMO_STATUS_FILL = {
    heat: { fill: 'red', shape: 'dot' },
    cool: { fill: 'blue', shape: 'dot' },
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
    return THERMO_TYPES.includes(device?.typeId) || POWER_TYPES.includes(device?.typeId);
}

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
function isThermo(device) {
    return THERMO_TYPES.includes(device?.typeId);
}

/*----------------------------------------------------------------------------------------------------------------------
    Numero di velocità della ventola, come il selettore dell'app (2-5, default 3)
----------------------------------------------------------------------------------------------------------------------*/
function fanSpeedsCount(device) {
    const count = device.fanSpeedsCount;
    return count >= 2 && count <= 5 ? count : 3;
}

/*----------------------------------------------------------------------------------------------------------------------
    Modalità abilitate dai flag modeButton* (come il selettore dell'app)
----------------------------------------------------------------------------------------------------------------------*/
function enabledModes(device) {
    return MODES.filter((mode) => device[`modeButton${mode.charAt(0).toUpperCase()}${mode.slice(1)}`]);
}

/*----------------------------------------------------------------------------------------------------------------------
    Coppie [comando, feedback] scrivibili, in base al tipo e alle features abilitate nell'app
----------------------------------------------------------------------------------------------------------------------*/
function controlPairs(device) {
    if (!isKnownType(device)) return [];
    const pairs = [];
    if (isThermo(device) || device.powerable) pairs.push(['switch', 'switchFeedback']);
    if (isThermo(device)) {
        pairs.push(['setpointTemperature', 'setpointTemperatureFeedback']);
        if (device.thermoProfilesEnable) pairs.push(['thermoProfile', 'thermoProfileFeedback']);
        if (device.thermoModesEnable) pairs.push(['thermoMode', 'thermoModeFeedback']);
    }
    if (device.humidityControl) pairs.push(['setpointHumidity', 'setpointHumidityFeedback']);
    if (FAN_TYPES.includes(device.typeId) && device.fanManagement) {
        pairs.push(['fanSpeed', 'fanSpeedFeedback']);
        if (device.typeId !== 'fan') pairs.push(['fanAuto', 'fanAutoFeedback']);
        if (device.fanEcoInfo) pairs.push(['fanEco', 'fanEcoFeedback']);
        if (device.fanStrongInfo) pairs.push(['fanStrong', 'fanStrongFeedback']);
        if (device.typeId !== 'fan' && device.fanDirectionInfo) pairs.push(['fanDirection', 'fanDirectionFeedback']);
    }
    if (device.supplyFanManagement) pairs.push(['supplyFanSpeed', 'supplyFanSpeedFeedback']);
    if (device.returnFanManagement) pairs.push(['returnFanSpeed', 'returnFanSpeedFeedback']);
    return pairs;
}

/*----------------------------------------------------------------------------------------------------------------------
    Items scrivibili: i comandi abilitati più, sui termostati, il ripristino dell'override (la durata si imposta dall'app)
----------------------------------------------------------------------------------------------------------------------*/
function writableItems(device) {
    const items = controlPairs(device).map(([command]) => command);
    if (isThermo(device)) items.push('overrideRestore');
    return items;
}

/*----------------------------------------------------------------------------------------------------------------------
    Items leggibili: comandi e feedback, stati del termostato e misure abilitate dalle features
----------------------------------------------------------------------------------------------------------------------*/
function readableItems(device) {
    if (!isKnownType(device)) return [];
    const items = controlPairs(device).flat();
    if (isThermo(device)) {
        items.push('roomTemperature', 'thermoStatus', 'overrideFeedback', 'overrideTime', 'overrideTimeAt');
        if (device.thermoProfilesEnable) items.push('chronoSetpoint');
    }
    if (device.humidityInfo) items.push('roomHumidity');
    if (device.humidityControl) items.push('humidityStatus');
    if (PLANT_TYPES.includes(device.typeId)) {
        if (device.deliveryTemperatureInfo) items.push('deliveryTemperature');
        if (device.returnTemperatureInfo) items.push('returnTemperature');
        if (device.acsTemperatureInfo) items.push('acsTemperature');
        if (device.pressureInfo) items.push('pressureValue');
    }
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
    Temperatura a passi di 0.5 °C (i valori fuori range vengono limitati)
----------------------------------------------------------------------------------------------------------------------*/
function toTemperature(value) {
    const n = Number(value);
    if (value === null || value === '' || typeof value === 'boolean' || !Number.isFinite(n)) {
        throw new Error(`Invalid temperature: ${JSON.stringify(value)}`);
    }
    const stepped = Math.round(n / SETPOINT_TEMPERATURE.step) * SETPOINT_TEMPERATURE.step;
    return Math.max(SETPOINT_TEMPERATURE.min, Math.min(SETPOINT_TEMPERATURE.max, stepped));
}

/*----------------------------------------------------------------------------------------------------------------------
    Booleano con "toggle" sul feedback dell'item
----------------------------------------------------------------------------------------------------------------------*/
function toToggle(feedback) {
    return (value, device) => (value === 'toggle' ? !device[feedback] : toBoolean(value));
}

// Conversione/validazione del valore in scrittura per ogni item
const WRITERS = {
    switch: toToggle('switchFeedback'),
    setpointTemperature: (value) => toTemperature(value),
    setpointHumidity: (value) => toInteger(value, PERCENT.min, PERCENT.max),
    thermoProfile: (value) => toChoice(value, PROFILES, 'profile'),
    thermoMode: (value, device) => toChoice(value, enabledModes(device), 'mode'),
    fanSpeed: (value, device) => toInteger(value, 1, fanSpeedsCount(device)),
    fanAuto: toToggle('fanAutoFeedback'),
    fanEco: toToggle('fanEcoFeedback'),
    fanStrong: toToggle('fanStrongFeedback'),
    fanDirection: (value) => toChoice(value, FAN_DIRECTIONS, 'fan direction'),
    supplyFanSpeed: (value) => toInteger(value, PERCENT.min, PERCENT.max),
    returnFanSpeed: (value) => toInteger(value, PERCENT.min, PERCENT.max),
    overrideRestore: (value) => {
        if (value !== true && value !== 'true' && value !== 1) throw new Error('overrideRestore accepts only true');
        return true;
    }
};

/*----------------------------------------------------------------------------------------------------------------------
    Payload semplice: booleani/"on"/"off"/"toggle" -> switch, numero -> setpoint (temperatura sui termostati,
    umidità sul deumidificatore), nome di un profilo o di una modalità -> thermoProfile/thermoMode
----------------------------------------------------------------------------------------------------------------------*/
function defaultItem(payload, device) {
    const text = typeof payload === 'string' ? payload.trim().toLowerCase() : null;
    if (text && isThermo(device)) {
        if (PROFILES.includes(text)) return 'thermoProfile';
        if (MODES.includes(text)) return 'thermoMode';
    }
    const isNumber = typeof payload === 'number' || (text !== null && text !== '' && Number.isFinite(Number(text)));
    if (isNumber && isThermo(device)) return 'setpointTemperature';
    if (isNumber && device.typeId === 'dehumidifier') return 'setpointHumidity';
    return 'switch';
}

/*----------------------------------------------------------------------------------------------------------------------
    Trasforma l'input del nodo in un oggetto { item: valore } già validato.
    Accetta: payload oggetto, topic = nome item, oppure payload semplice (vedi defaultItem)
----------------------------------------------------------------------------------------------------------------------*/
function parseInput(msg, device) {
    const topic = typeof msg.topic === 'string' ? msg.topic.trim() : msg.topic;
    if (!isKnownType(device)) throw new Error(`Unsupported hvac type "${device?.typeId}"`);
    const allowed = writableItems(device);

    let requested;
    let fallback;
    if (topic && WRITERS[topic]) {
        requested = { [topic]: msg.payload };
    } else if (msg.payload !== null && typeof msg.payload === 'object' && !Array.isArray(msg.payload)) {
        requested = msg.payload;
    } else {
        fallback = defaultItem(msg.payload, device);
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
    Stato del termostato, es. "Heat · 20.5 °C → 22 °C · Comfort · Override"
----------------------------------------------------------------------------------------------------------------------*/
function thermoStatus(device) {
    if (device.switchFeedback === false) return { fill: 'grey', shape: 'ring', text: 'Off' };
    const state = device.thermoStatus || (device.switchFeedback ? 'idle' : null);
    if (!state) return { fill: 'grey', shape: 'ring', text: 'Unknown' };
    const result = { ...(THERMO_STATUS_FILL[state] || { fill: 'grey', shape: 'ring' }), text: capitalize(state) };
    const room = typeof device.roomTemperature === 'number' ? `${device.roomTemperature} °C` : null;
    const setpoint = typeof device.setpointTemperatureFeedback === 'number' ? `${device.setpointTemperatureFeedback} °C` : null;
    if (room && setpoint) result.text += ` · ${room} → ${setpoint}`;
    else if (room || setpoint) result.text += ` · ${room || `Set ${setpoint}`}`;
    if (device.thermoProfilesEnable && device.thermoProfileFeedback) result.text += ` · ${capitalize(device.thermoProfileFeedback)}`;
    if (device.overrideFeedback) result.text += ' · Override';
    return result;
}

/*----------------------------------------------------------------------------------------------------------------------
    Stato degli altri tipi, es. "On · Fan 2/3", "On · 55 %", "On · 60 °C"
----------------------------------------------------------------------------------------------------------------------*/
function powerStatus(device) {
    let result;
    if (!device.powerable) result = { fill: 'grey', shape: 'dot', text: 'Always On' };
    else if (device.switchFeedback === undefined) result = { fill: 'grey', shape: 'ring', text: 'Unknown' };
    else if (!device.switchFeedback) result = { fill: 'grey', shape: 'ring', text: 'Off' };
    else result = { fill: 'green', shape: 'dot', text: 'On' };
    if (device.switchFeedback !== false) {
        if (FAN_TYPES.includes(device.typeId) && device.fanManagement && typeof device.fanSpeedFeedback === 'number') {
            result.text += device.fanAutoFeedback && device.typeId !== 'fan' ? ' · Fan Auto' : ` · Fan ${device.fanSpeedFeedback}/${fanSpeedsCount(device)}`;
        }
        if (device.humidityInfo && typeof device.roomHumidity === 'number') result.text += ` · ${device.roomHumidity} %`;
        if (PLANT_TYPES.includes(device.typeId) && device.deliveryTemperatureInfo && typeof device.deliveryTemperature === 'number') {
            result.text += ` · ${device.deliveryTemperature} °C`;
        }
    }
    return result;
}

/*----------------------------------------------------------------------------------------------------------------------
    Stato del nodo; il guasto (se la feature è abilitata) si accoda in rosso
----------------------------------------------------------------------------------------------------------------------*/
function status(device) {
    if (!isKnownType(device)) return { fill: 'grey', shape: 'ring', text: `Unknown Type ${device.typeId}` };
    const result = isThermo(device) ? thermoStatus(device) : powerStatus(device);
    if (device.faultInfo && device.faultSignal) {
        result.fill = 'red';
        result.text += ' · Fault';
    }
    return result;
}

module.exports = { FAMILY_ID, writableItems, readableItems, editorItems, parseInput, isOutputItem, outputValue, outputExtras, status };
