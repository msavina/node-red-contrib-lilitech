'use strict';

const FAMILY_ID = 'metering-sensors';

const SINGLE_PHASE = 'singlePhaseEnergyMeter';
const THREE_PHASE = 'threePhaseEnergyMeter';

// Sensori con una sola misura, per typeId
const SENSOR_TYPES = {
    volumeSensor: 'volumeValue',
    pressureSensor: 'pressureValue',
    levelSensor: 'levelValue',
    temperatureSensor: 'temperatureValue'
};

// Misure per fase dei contatori di energia, abilitate dalle features (come i controlli dell'app)
const PHASE_MEASURES = [
    { flag: 'activePowerInfo', prefix: 'activePower' },
    { flag: 'reactivePowerInfo', prefix: 'reactivePower' },
    { flag: 'apparentPowerInfo', prefix: 'apparentPower' },
    { flag: 'powerFactorInfo', prefix: 'powerFactor' },
    { flag: 'voltageInfo', prefix: 'voltage' },
    { flag: 'currentInfo', prefix: 'current' },
    { flag: 'frequencyInfo', prefix: 'frequency' }
];

// Items diagnostici, abilitati dalle features del device
const DIAGNOSTICS = [
    { flag: 'keepAlive', item: 'sensorLoss' },
    { flag: 'lowBatteryDetection', item: 'lowBattery' },
    { flag: 'faultInfo', item: 'faultSignal' }
];

// Unità di misura dei valori sul tubo: energie e potenze arrivano in Wh/W (l'app le divide per 1000), per prefisso
const UNITS = [
    ['activeEnergy', 'Wh'],
    ['totalActivePower', 'W'],
    ['activePower', 'W'],
    ['reactivePower', 'var'],
    ['apparentPower', 'VA'],
    ['voltage', 'V'],
    ['current', 'A'],
    ['frequency', 'Hz'],
    ['volume', 'm³'],
    ['pressure', 'bar'],
    ['level', 'm'],
    ['temperature', '°C']
];

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
function isEnergyMeter(device) {
    return device?.typeId === SINGLE_PHASE || device?.typeId === THREE_PHASE;
}

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
function isKnownType(device) {
    return isEnergyMeter(device) || !!SENSOR_TYPES[device?.typeId];
}

/*----------------------------------------------------------------------------------------------------------------------
    Fasi del contatore: La per il monofase, La/Lb/Lc per il trifase
----------------------------------------------------------------------------------------------------------------------*/
function phasesOf(device) {
    return device.typeId === THREE_PHASE ? ['La', 'Lb', 'Lc'] : ['La'];
}

/*----------------------------------------------------------------------------------------------------------------------
    Items scrivibili: gli azzeramenti dell'energia relativa, come i pulsanti dei controlli dell'app
    (il trifase ha anche quello del totale)
----------------------------------------------------------------------------------------------------------------------*/
function writableItems(device) {
    if (!isEnergyMeter(device)) return [];
    const scopes = device.typeId === THREE_PHASE ? ['Total', ...phasesOf(device)] : phasesOf(device);
    return scopes.map((scope) => `activeEnergyRelative${scope}Reset`);
}

/*----------------------------------------------------------------------------------------------------------------------
    Misure del device: energia assoluta e relativa (con l'ora dell'ultimo azzeramento) e misure per fase abilitate,
    oppure il valore del sensore
----------------------------------------------------------------------------------------------------------------------*/
function measureItems(device) {
    if (!isKnownType(device)) return [];
    if (!isEnergyMeter(device)) return [SENSOR_TYPES[device.typeId]];
    const items = [];
    const energy = (scope) => [`activeEnergyAbsolute${scope}Value`, `activeEnergyRelative${scope}Value`, `activeEnergyRelative${scope}ValueTimestamp`];
    if (device.typeId === THREE_PHASE) {
        items.push(...energy('Total'));
        if (device.activePowerInfo) items.push('totalActivePowerValue');
    }
    for (const phase of phasesOf(device)) {
        items.push(...energy(phase));
        for (const measure of PHASE_MEASURES) {
            if (device[measure.flag]) items.push(`${measure.prefix}${phase}Value`);
        }
    }
    return items;
}

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
function diagnosticItems(device) {
    return DIAGNOSTICS.filter((d) => device?.[d.flag]).map((d) => d.item);
}

/*----------------------------------------------------------------------------------------------------------------------
    Items leggibili: misure e diagnostica. Soglie e costo dell'energia si configurano nell'app, il nodo non li espone
----------------------------------------------------------------------------------------------------------------------*/
function readableItems(device) {
    return [...measureItems(device), ...diagnosticItems(device)];
}

/*----------------------------------------------------------------------------------------------------------------------
    Items mostrati nell'editor: solo quelli scrivibili, cioè gli azzeramenti dei contatori (i sensori non ne hanno)
----------------------------------------------------------------------------------------------------------------------*/
function editorItems(device) {
    return writableItems(device);
}

/*----------------------------------------------------------------------------------------------------------------------
    Trasforma l'input del nodo in un oggetto { item: valore } già validato.
    Accetta: payload oggetto oppure topic = nome dell'azzeramento con payload true
----------------------------------------------------------------------------------------------------------------------*/
function parseInput(msg, device) {
    if (!isKnownType(device)) throw new Error(`Unsupported metering sensor type "${device?.typeId}"`);
    const allowed = writableItems(device);
    if (!allowed.length) throw new Error(`A ${device.typeId} has no commands: it only emits its measure`);

    const topic = typeof msg.topic === 'string' ? msg.topic.trim() : msg.topic;
    let requested;
    if (msg.payload !== null && typeof msg.payload === 'object' && !Array.isArray(msg.payload)) {
        requested = msg.payload;
    } else if (topic) {
        requested = { [topic]: msg.payload };
    } else {
        throw new Error(`Set msg.topic to the energy to reset (allowed: ${allowed.join(', ')})`);
    }

    const items = {};
    for (const [name, value] of Object.entries(requested)) {
        if (!allowed.includes(name)) {
            throw new Error(`Item "${name}" is not writable on this metering sensor (allowed: ${allowed.join(', ')})`);
        }
        // Gli azzeramenti accettano solo true, come il pulsante dell'app
        if (value !== true && value !== 'true' && value !== 1) throw new Error(`${name} accepts only true`);
        items[name] = true;
    }
    if (Object.keys(items).length === 0) throw new Error('No item to write');
    return items;
}

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
function unitOf(item) {
    if (item.endsWith('Timestamp')) return undefined;
    return UNITS.find(([prefix]) => item.startsWith(prefix))?.[1];
}

/*----------------------------------------------------------------------------------------------------------------------
    Le misure arrivano spesso con il rumore della conversione float dei driver (es. 229.89999389648438):
    arrotondiamo a 3 decimali, tranne i timestamp
----------------------------------------------------------------------------------------------------------------------*/
function outputValue(item, value) {
    if (typeof value !== 'number' || item.endsWith('Timestamp')) return value;
    return Math.round(value * 1000) / 1000;
}

/*----------------------------------------------------------------------------------------------------------------------
    Unità di misura in msg.unit. I timestamp sono in millisecondi epoch
----------------------------------------------------------------------------------------------------------------------*/
function outputExtras(item) {
    const unit = unitOf(item);
    return unit ? { unit } : {};
}

/*----------------------------------------------------------------------------------------------------------------------
    Tutte le misure e la diagnostica escono sempre: il nodo non ha comandi da filtrare
----------------------------------------------------------------------------------------------------------------------*/
function isOutputItem() {
    return true;
}

/*----------------------------------------------------------------------------------------------------------------------
    Testo della misura principale: potenza (se abilitata) ed energia assoluta per i contatori, il valore per i sensori
----------------------------------------------------------------------------------------------------------------------*/
function measureText(device) {
    if (!isEnergyMeter(device)) {
        const item = SENSOR_TYPES[device.typeId];
        const value = device[item];
        return typeof value === 'number' ? `${Math.round(value * 100) / 100} ${unitOf(item)}` : '';
    }
    const three = device.typeId === THREE_PHASE;
    const parts = [];
    const power = three ? device.totalActivePowerValue : device.activePowerLaValue;
    if (device.activePowerInfo && typeof power === 'number') parts.push(`${(power / 1000).toFixed(2)} kW`);
    const energy = three ? device.activeEnergyAbsoluteTotalValue : device.activeEnergyAbsoluteLaValue;
    if (typeof energy === 'number') parts.push(`${(energy / 1000).toFixed(1)} kWh`);
    return parts.join(' · ');
}

/*----------------------------------------------------------------------------------------------------------------------
    Stato del nodo, es. "1.25 kW · 345.6 kWh", "21.5 °C · Sensor Lost": la diagnostica abilitata si accoda,
    come i badge della card dell'app
----------------------------------------------------------------------------------------------------------------------*/
function status(device) {
    if (!isKnownType(device)) return { fill: 'grey', shape: 'ring', text: `Unknown Type ${device.typeId}` };
    const diagnostics = diagnosticItems(device);
    const active = (item) => diagnostics.includes(item) && device[item] === true;

    const text = measureText(device);
    const result = text ? { fill: 'green', shape: 'dot', text } : { fill: 'grey', shape: 'ring', text: 'No Value' };
    if (active('sensorLoss')) {
        result.fill = 'red';
        result.shape = 'ring';
        result.text += ' · Sensor Lost';
    } else if (active('faultSignal')) {
        result.fill = 'red';
        result.shape = 'dot';
        result.text += ' · Fault';
    } else if (active('lowBattery')) {
        result.fill = 'yellow';
    }
    if (active('lowBattery')) result.text += ' · Low Battery';
    return result;
}

module.exports = { FAMILY_ID, writableItems, readableItems, editorItems, parseInput, isOutputItem, outputValue, outputExtras, status };
