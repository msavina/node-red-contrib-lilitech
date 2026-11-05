'use strict';

// Alias del comando: l'headunit accetta "play" e "stop", come i tasti dell'app
const COMMAND_ALIASES = {
    true: 'play',
    on: 'play',
    1: 'play',
    start: 'play',
    run: 'play',
    false: 'stop',
    off: 'stop',
    0: 'stop'
};

/*----------------------------------------------------------------------------------------------------------------------
    Data della headunit (ISO, Date o millisecondi) in millisecondi epoch; null se assente o non valida
----------------------------------------------------------------------------------------------------------------------*/
function toTimestamp(value) {
    if (value === undefined || value === null || value === '') return null;
    const time = typeof value === 'number' ? value : new Date(value).getTime();
    return Number.isFinite(time) ? time : null;
}

/*----------------------------------------------------------------------------------------------------------------------
    Comando "play"/"stop" dal payload; "toggle" inverte lo stato attuale. Il play vale solo con il controllo manuale
    abilitato nell'app (come il tasto della card) e su uno scenario abilitato (l'headunit lo ignorerebbe in silenzio)
----------------------------------------------------------------------------------------------------------------------*/
function parseCommand(msg, scenario) {
    const topic = typeof msg.topic === 'string' ? msg.topic.trim() : msg.topic;
    if (topic && topic !== 'command') throw new Error(`msg.topic "${msg.topic}" is not valid (use "command" or leave it empty)`);
    const text = typeof msg.payload === 'string' ? msg.payload.trim().toLowerCase() : String(msg.payload);
    const command = text === 'toggle' ? (scenario.status === 'run' ? 'stop' : 'play') : COMMAND_ALIASES[text] || text;
    if (command !== 'play' && command !== 'stop') {
        throw new Error(`Invalid command ${JSON.stringify(msg.payload)} (allowed: play, stop, toggle)`);
    }
    if (command === 'play') {
        if (!scenario.manualControl) throw new Error(`Scenario "${scenario.name}" has no manual control: enable it in the app to start it`);
        if (scenario.enable === false) throw new Error(`Scenario "${scenario.name}" is disabled in the app`);
    }
    return command;
}

/*----------------------------------------------------------------------------------------------------------------------
    Messaggio di stato: payload "run"/"stop" come l'headunit, con il timestamp dell'ultima esecuzione
----------------------------------------------------------------------------------------------------------------------*/
function statusMessage(scenario, origin) {
    return {
        topic: 'status',
        payload: scenario.status === 'run' ? 'run' : 'stop',
        running: scenario.status === 'run',
        lastRun: toTimestamp(scenario.timeRun),
        lastEnd: toTimestamp(scenario.timeEnd),
        enable: scenario.enable !== false,
        inhibited: scenario.inhibited === true,
        origin,
        scenario: { scenarioId: scenario.scenarioId, name: scenario.name, roomId: scenario.roomId }
    };
}

/*----------------------------------------------------------------------------------------------------------------------
    Comando play/stop inviato allo scenario dall'app o da altri nodi (solo con l'output 'all')
----------------------------------------------------------------------------------------------------------------------*/
function commandMessage(scenario, command, origin) {
    return {
        topic: 'command',
        payload: command,
        origin,
        scenario: { scenarioId: scenario.scenarioId, name: scenario.name, roomId: scenario.roomId }
    };
}

/*----------------------------------------------------------------------------------------------------------------------
    1762336500000 ->"10:15" se è oggi, altrimenti "05/11 10:15" (ora locale di Node-RED, che gira sull'headunit)
----------------------------------------------------------------------------------------------------------------------*/
function formatTime(timestamp, now = new Date()) {
    const date = new Date(timestamp);
    const pad = (n) => String(n).padStart(2, '0');
    const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    return date.toDateString() === now.toDateString() ? time : `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${time}`;
}

/*----------------------------------------------------------------------------------------------------------------------
    Stato del nodo, es. "Running · since 10:15", "Stopped · Last run 05/11 10:15", "Disabled · Never run";
    l'inibizione (condizioni non soddisfatte) si accoda in giallo
----------------------------------------------------------------------------------------------------------------------*/
function status(scenario, now) {
    const lastRun = toTimestamp(scenario.timeRun);
    let result;
    if (scenario.status === 'run') {
        result = { fill: 'green', shape: 'dot', text: lastRun ? `Running · since ${formatTime(lastRun, now)}` : 'Running' };
    } else {
        const last = lastRun ? `Last run ${formatTime(lastRun, now)}` : 'Never run';
        result = scenario.enable === false ? { fill: 'grey', shape: 'ring', text: `Disabled · ${last}` } : { fill: 'grey', shape: 'dot', text: `Stopped · ${last}` };
    }
    if (scenario.inhibited === true) {
        result.fill = 'yellow';
        result.text += ' · Inhibited';
    }
    return result;
}

module.exports = { toTimestamp, parseCommand, statusMessage, commandMessage, formatTime, status };
