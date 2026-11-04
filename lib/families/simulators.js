'use strict';

const FAMILY_ID = 'simulators';

// Tipi di simulatore dell'app
const SIMULATOR_TYPES = ['presenceSimulator'];

// Alias dei comandi (simulatore e programmi): l'headunit accetta solo "play" e "stop"
const COMMAND_ALIASES = {
    true: 'play',
    on: 'play',
    1: 'play',
    start: 'play',
    false: 'stop',
    off: 'stop',
    0: 'stop'
};

// Comandi con uno stato confermato a parte (status, programsRun): in modalità 'feedback' non escono
const COMMAND_ITEMS = ['command', 'programsCmd'];

// Items in sola lettura: stato del simulatore e dei programmi
const READ_ONLY_ITEMS = ['status', 'programRunning', 'programStartAt', 'programsRun'];

// Items in JSON stringifizzato sul tubo, emessi come oggetti
const JSON_ITEMS = ['programsRun', 'programsCmd'];

// L'headunit ritrasmette i programmi ogni minuto anche se non cambiano
const changedOnly = ['programsRun', 'programRunning', 'programStartAt'];

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
function isKnownType(device) {
    return SIMULATOR_TYPES.includes(device?.typeId);
}

/*----------------------------------------------------------------------------------------------------------------------
    Il JSON stringifizzato dell'headunit (o l'oggetto, se già decodificato); null se assente o non valido
----------------------------------------------------------------------------------------------------------------------*/
function parseJson(value) {
    if (typeof value !== 'string') return value ?? null;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

/*----------------------------------------------------------------------------------------------------------------------
    Programmi conosciuti: quelli in esecuzione (con lo stato) o, in mancanza, quelli configurati
----------------------------------------------------------------------------------------------------------------------*/
function programsOf(device) {
    const run = parseJson(device.programsRun);
    if (Array.isArray(run?.programs) && run.programs.length) return run.programs;
    const cfg = parseJson(device.programsCfg);
    return Array.isArray(cfg) ? cfg : [];
}

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
function writableItems(device) {
    return isKnownType(device) ? ['command', 'programsCmd'] : [];
}

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
function readableItems(device) {
    return isKnownType(device) ? [...writableItems(device), ...READ_ONLY_ITEMS] : [];
}

/*----------------------------------------------------------------------------------------------------------------------
    Items mostrati nell'editor
----------------------------------------------------------------------------------------------------------------------*/
function editorItems(device) {
    return writableItems(device);
}

/*----------------------------------------------------------------------------------------------------------------------
    "play"/"stop" con i loro alias; "toggle" inverte lo stato attuale (current). what serve per i messaggi di errore
----------------------------------------------------------------------------------------------------------------------*/
function toPlayStop(value, current, what) {
    const text = typeof value === 'string' ? value.trim().toLowerCase() : String(value);
    if (text === 'toggle') return current === 'play' ? 'stop' : 'play';
    const command = COMMAND_ALIASES[text] || text;
    if (command !== 'play' && command !== 'stop') {
        throw new Error(`Invalid command ${JSON.stringify(value)} for ${what} (allowed: play, stop, toggle)`);
    }
    return command;
}

/*----------------------------------------------------------------------------------------------------------------------
    Elenco dei programmi per i messaggi di errore, es. 1 "Evening", 2 "Night"
----------------------------------------------------------------------------------------------------------------------*/
function programList(programs) {
    return programs.map((p) => `${p.programId} "${p.name}"`).join(', ') || 'none';
}

/*----------------------------------------------------------------------------------------------------------------------
    Programma per id (numero o stringa numerica) o per nome (senza distinzione di maiuscole).
    Senza riferimento va bene solo se il simulatore ha un programma
----------------------------------------------------------------------------------------------------------------------*/
function findProgram(ref, device) {
    const programs = programsOf(device);
    if (ref === undefined || ref === null || ref === '') {
        if (programs.length === 1) return programs[0];
        throw new Error(`Missing program: add msg.program with its id or name (programs: ${programList(programs)})`);
    }
    const id = typeof ref === 'number' ? ref : /^\d+$/.test(String(ref).trim()) ? Number(ref) : null;
    if (id !== null) {
        const program = programs.find((p) => p.programId === id);
        if (!program && programs.length) throw new Error(`Program ${id} not found (programs: ${programList(programs)})`);
        return program || { programId: id };
    }
    const name = String(ref).trim().toLowerCase();
    const found = programs.filter((p) => String(p.name ?? '').trim().toLowerCase() === name);
    if (found.length === 0) throw new Error(`Program "${ref}" not found (programs: ${programList(programs)})`);
    if (found.length > 1) throw new Error(`Several programs are named "${ref}": use the program id`);
    return found[0];
}

/*----------------------------------------------------------------------------------------------------------------------
    Comando di un programma: { programId|name, cmd } oppure cmd con il programma indicato a parte (msg.program).
    Restituisce il JSON stringifizzato atteso dall'headunit, come lo manda l'app
----------------------------------------------------------------------------------------------------------------------*/
function toProgramCmd(value, device, programRef) {
    if (typeof value === 'string' && value.trim().startsWith('{')) value = parseJson(value) ?? value;
    let ref = programRef;
    let cmd = value;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        ref = value.programId ?? value.name ?? value.program ?? programRef;
        cmd = value.cmd;
    }
    const program = findProgram(ref, device);
    if (device.status !== 'play') throw new Error('The simulator is stopped: start it before commanding a program');
    return JSON.stringify({ programId: program.programId, cmd: toPlayStop(cmd, program.status, 'a program') });
}

/*----------------------------------------------------------------------------------------------------------------------
    Trasforma l'input del nodo in un oggetto { item: valore } già validato.
    Accetta: payload oggetto, topic = nome item, msg.program (comando del programma) oppure payload semplice (command)
----------------------------------------------------------------------------------------------------------------------*/
function parseInput(msg, device) {
    const topic = typeof msg.topic === 'string' ? msg.topic.trim() : msg.topic;
    const allowed = writableItems(device);
    if (!allowed.length) throw new Error(`Unsupported simulator type "${device?.typeId}"`);

    const writers = {
        command: (value) => toPlayStop(value, device.status, 'a simulator'),
        programsCmd: (value) => toProgramCmd(value, device, msg.program)
    };

    let requested;
    let fallback;
    const isObject = msg.payload !== null && typeof msg.payload === 'object' && !Array.isArray(msg.payload);
    if (topic && writers[topic]) {
        requested = { [topic]: msg.payload };
    } else if (msg.program !== undefined) {
        requested = { programsCmd: msg.payload };
    } else if (isObject && 'cmd' in msg.payload) {
        requested = { programsCmd: msg.payload };
    } else if (isObject) {
        requested = msg.payload;
    } else {
        fallback = 'command';
        requested = { [fallback]: msg.payload };
    }

    const items = {};
    for (const [name, value] of Object.entries(requested)) {
        if (!allowed.includes(name)) {
            throw new Error(`Item "${name}" is not writable on a simulator (allowed: ${allowed.join(', ')})`);
        }
        try {
            items[name] = writers[name](value);
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
    return JSON_ITEMS.includes(item) ? parseJson(value) : value;
}

/*----------------------------------------------------------------------------------------------------------------------
    'feedback' (default): tutto tranne i comandi, 'all': anche i comandi arrivati da app/cloud/altri nodi
----------------------------------------------------------------------------------------------------------------------*/
function isOutputItem(item, config) {
    return config.outputMode === 'all' || !COMMAND_ITEMS.includes(item);
}

/*----------------------------------------------------------------------------------------------------------------------
    "2026-11-05T19:00:00.000Z" -> "05/11 20:00" (ora locale di Node-RED, che gira sull'headunit)
----------------------------------------------------------------------------------------------------------------------*/
function formatStart(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/*----------------------------------------------------------------------------------------------------------------------
    Stato del nodo, es. "Simulating · Evening", "Ready · Next 05/11 20:00", "Stopped"
----------------------------------------------------------------------------------------------------------------------*/
function status(device) {
    if (!isKnownType(device)) return { fill: 'grey', shape: 'ring', text: `Unknown Type ${device.typeId}` };
    if (device.status !== 'play') {
        return { fill: 'grey', shape: 'ring', text: device.status === 'stop' ? 'Stopped' : 'Unknown' };
    }
    const playing = programsOf(device)
        .filter((p) => p.status === 'play')
        .map((p) => p.name);
    if (playing.length) return { fill: 'green', shape: 'dot', text: `Simulating · ${playing.join(', ')}` };
    const result = { fill: 'blue', shape: 'ring', text: 'Ready' };
    const next = device.programStartAt && formatStart(device.programStartAt);
    if (next) result.text += ` · Next ${next}`;
    return result;
}

module.exports = {
    FAMILY_ID,
    changedOnly,
    writableItems,
    readableItems,
    editorItems,
    parseInput,
    isOutputItem,
    outputValue,
    status
};
