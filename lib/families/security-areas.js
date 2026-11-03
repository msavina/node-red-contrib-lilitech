'use strict';

const FAMILY_ID = 'security-areas';

const INTERNAL_LOGIC = 'securityAreasInternalLogic';

// Comandi accettati in ingresso: unready/forceable/ready/armed arrivano dal bridge o dall'app e non li esponiamo
const CONTROLS = ['arm', 'disarm', 'patrol'];

// Alias accettati per i comandi, es. payload true/false o "on"/"off"
const CONTROL_ALIASES = {
    true: 'arm',
    on: 'arm',
    1: 'arm',
    false: 'disarm',
    off: 'disarm',
    0: 'disarm'
};

// Items in uscita: il comando, lo stato e la memoria di allarme con i sensori che l'hanno generato.
// Le scadenze dei tempi (timerExitAt, timerEnterAt, ...) non escono mai
const READABLE_ITEMS = ['areaControl', 'areaStatus', 'memory', 'history'];

// Stato del nodo per ogni areaStatus
const STATUS = {
    disarmed: { fill: 'grey', shape: 'ring', text: 'Disarmed' },
    unready: { fill: 'yellow', shape: 'ring', text: 'Not Ready' },
    forceable: { fill: 'yellow', shape: 'ring', text: 'Forceable' },
    exiting: { fill: 'yellow', shape: 'dot', text: 'Exiting' },
    armed: { fill: 'green', shape: 'dot', text: 'Armed' },
    forced: { fill: 'green', shape: 'dot', text: 'Forced' },
    patrol: { fill: 'blue', shape: 'dot', text: 'Patrol' },
    entering: { fill: 'yellow', shape: 'dot', text: 'Entering' },
    alarm: { fill: 'red', shape: 'dot', text: 'Alarm' },
    tamper: { fill: 'red', shape: 'ring', text: 'Tamper' }
};

/*----------------------------------------------------------------------------------------------------------------------
    Comandi del device: patrol solo sulle aree a logica interna con la ronda abilitata
----------------------------------------------------------------------------------------------------------------------*/
function writableControls(device) {
    const internal = device?.typeId === INTERNAL_LOGIC;
    return CONTROLS.filter((control) => control !== 'patrol' || (internal && device.patrolable));
}

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
function readableItems() {
    return READABLE_ITEMS;
}

/*----------------------------------------------------------------------------------------------------------------------
    Nell'editor mostriamo i comandi disponibili
----------------------------------------------------------------------------------------------------------------------*/
function editorItems(device) {
    return writableControls(device);
}

/*----------------------------------------------------------------------------------------------------------------------
    Trasforma l'input del nodo in { areaControl: comando }.
    Accetta: payload "arm"/"disarm"/"patrol" (o true/false), topic "areaControl", payload { areaControl }
----------------------------------------------------------------------------------------------------------------------*/
function parseInput(msg, device) {
    const topic = typeof msg.topic === 'string' ? msg.topic.trim() : msg.topic;
    let value = msg.payload;
    if (topic !== 'areaControl' && value !== null && typeof value === 'object' && !Array.isArray(value)) {
        const unknown = Object.keys(value).filter((key) => key !== 'areaControl');
        if (unknown.length) throw new Error(`Item "${unknown[0]}" is not writable on a security area (allowed: areaControl)`);
        value = value.areaControl;
    }

    const text = typeof value === 'string' ? value.trim().toLowerCase() : String(value);
    const control = CONTROL_ALIASES[text] || text;
    const allowed = writableControls(device);
    if (!allowed.includes(control)) {
        throw new Error(`Invalid command ${JSON.stringify(value)} for the security area (allowed: ${allowed.join(', ')})`);
    }
    return { areaControl: control };
}

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
function outputValue(item, value) {
    return value;
}

/*----------------------------------------------------------------------------------------------------------------------
    'state' (default): solo lo stato dell'area, 'all': anche il comando areaControl arrivato da app/cloud/altri nodi
----------------------------------------------------------------------------------------------------------------------*/
function isOutputItem(item, config) {
    return config.outputMode === 'all' || item !== 'areaControl';
}

/*----------------------------------------------------------------------------------------------------------------------
    Stato del nodo, es. "Armed", "Disarmed · Alarm Memory"
----------------------------------------------------------------------------------------------------------------------*/
function status(device) {
    const known = STATUS[device.areaStatus];
    if (!known) return { fill: 'grey', shape: 'ring', text: device.areaStatus ? `Unknown Status ${device.areaStatus}` : 'Unknown' };
    const result = { ...known };
    if (device.memory && device.areaStatus !== 'alarm') {
        result.fill = 'red';
        result.text += ' · Alarm Memory';
    }
    return result;
}

module.exports = { FAMILY_ID, CONTROLS, writableControls, readableItems, editorItems, parseInput, isOutputItem, outputValue, status };
