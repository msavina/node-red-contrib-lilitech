'use strict';

const { toBoolean } = require('../coercion');

// familyId con il trattino, come nell'app e nell'headunit
const FAMILY_ID = 'video-surveillances';

// I monitor non hanno ancora items: per ora il nodo gestisce solo le telecamere
const TYPES = ['videoCamera'];

// Valori del payload che avviano una registrazione manuale, come il tasto REC dell'app
const RECORD_VALUES = ['manual', 'rec', 'record', 'start', 'on'];

// Eventi dello storico emessi dal driver ONVIF quando la clip è stata caricata
const CLIP_EVENTS = {
    DEVICES_VIDEO_SURVEILLANCES_NEW_VIDEO_RECORDING: 'manual',
    DEVICES_VIDEO_SURVEILLANCES_NEW_VIDEO_VERIFICATION: 'auto'
};

// Stato del nodo per ogni triggerRecording
const RECORDING_STATUS = {
    manual: { fill: 'red', shape: 'dot', text: 'Recording' },
    auto: { fill: 'red', shape: 'dot', text: 'Recording · Alarm' }
};

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
function isKnownType(device) {
    return TYPES.includes(device?.typeId);
}

/*----------------------------------------------------------------------------------------------------------------------
    La registrazione si avvia solo con la registrazione in loop abilitata nell'app (il tasto REC compare solo allora)
----------------------------------------------------------------------------------------------------------------------*/
function writableItems(device) {
    return isKnownType(device) && device.loopRecording ? ['triggerRecording'] : [];
}

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
function readableItems(device) {
    if (!isKnownType(device)) return [];
    return device.loopRecording ? ['status', 'triggerRecording'] : ['status'];
}

/*----------------------------------------------------------------------------------------------------------------------
    Items mostrati nell'editor
----------------------------------------------------------------------------------------------------------------------*/
function editorItems(device) {
    return writableItems(device);
}

/*----------------------------------------------------------------------------------------------------------------------
    true / "manual" / "rec" -> "manual"; altri valori non sono ammessi (la clip si ferma da sola)
----------------------------------------------------------------------------------------------------------------------*/
function toRecording(value) {
    const text = typeof value === 'string' ? value.trim().toLowerCase() : value;
    if (RECORD_VALUES.includes(text)) return 'manual';
    let start;
    try {
        start = toBoolean(value);
    } catch {
        start = false;
    }
    if (!start) throw new Error(`Invalid recording command ${JSON.stringify(value)} (allowed: true, "manual"; the clip stops by itself)`);
    return 'manual';
}

/*----------------------------------------------------------------------------------------------------------------------
    Avvia la registrazione di una clip, come il tasto REC dell'app. Accetta un payload semplice o topic "triggerRecording";
    msg.source (o il nome del nodo) è il nome mostrato nello storico, come il nome dell'utente nell'app
----------------------------------------------------------------------------------------------------------------------*/
function parseInput(msg, device, config = {}) {
    if (!isKnownType(device)) throw new Error(`Unsupported video surveillance type "${device?.typeId}"`);
    if (!device.loopRecording) throw new Error('Recording is not available: enable the loop recording on the camera in the app');
    const topic = typeof msg.topic === 'string' ? msg.topic.trim() : msg.topic;
    if (topic && topic !== 'triggerRecording') throw new Error(`msg.topic "${msg.topic}" is not a known item (allowed: triggerRecording)`);
    // Durante una clip il driver ONVIF ignora i nuovi comandi: non li blocchiamo qui, lo stato ottimistico potrebbe non tornare a 'idle'
    const triggerRecording = toRecording(msg.payload);
    const source = typeof msg.source === 'string' && msg.source.trim() ? msg.source.trim() : config.name || 'Node-RED';
    return { triggerRecording, source };
}

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
function outputValue(item, value) {
    return value;
}

/*----------------------------------------------------------------------------------------------------------------------
    Tutti gli items escono sempre: il comando di registrazione e il suo stato sono lo stesso item
----------------------------------------------------------------------------------------------------------------------*/
function isOutputItem() {
    return true;
}

/*----------------------------------------------------------------------------------------------------------------------
    Clip registrata e caricata dal driver ONVIF, dallo storico: nome del file, tipo (manuale o da allarme) e chi l'ha avviata
----------------------------------------------------------------------------------------------------------------------*/
function historyMessage(event) {
    const trigger = CLIP_EVENTS[event.eventName];
    if (!trigger) return null;
    return { topic: 'clip', payload: event.payload?.fileName ?? null, trigger, source: event.payload?.source ?? null };
}

/*----------------------------------------------------------------------------------------------------------------------
    Stato del nodo, es. "Online", "Recording", "Recording · Alarm", "Offline"
----------------------------------------------------------------------------------------------------------------------*/
function status(device) {
    if (!isKnownType(device)) return { fill: 'grey', shape: 'ring', text: `Unknown Type ${device.typeId}` };
    if (device.status === 'offline') return { fill: 'red', shape: 'ring', text: 'Offline' };
    const recording = device.loopRecording && RECORDING_STATUS[device.triggerRecording];
    if (recording) return { ...recording };
    if (device.status === 'online') return { fill: 'green', shape: 'dot', text: 'Online' };
    return { fill: 'grey', shape: 'ring', text: 'Unknown' };
}

module.exports = { FAMILY_ID, writableItems, readableItems, editorItems, parseInput, isOutputItem, outputValue, historyMessage, status };
