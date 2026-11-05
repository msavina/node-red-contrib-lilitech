'use strict';

const { TubeClient } = require('../lib/tube-client');
const families = require('../lib/families');

const DEFAULT_URL = 'http://127.0.0.1:3000';

module.exports = function (RED) {
    /*------------------------------------------------------------------------------------------------------------------
        Config node: una sola connessione al tubo della headunit, condivisa da tutti i nodi device
    ------------------------------------------------------------------------------------------------------------------*/
    function LilitechHeadunitNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        node.url = config.url || DEFAULT_URL;
        node.client = new TubeClient(node.url);
        // Famiglie usate dai nodi registrati, di cui chiediamo l'elenco ad ogni (ri)connessione
        node.families = new Map();
        // Nodi scenario registrati: se ce n'è almeno uno chiediamo anche l'elenco degli scenari
        node.scenarioNodes = 0;

        node.client.on('connected', () => {
            node.log(`Connected to headunit tube at ${node.url}`);
            node.refreshFamilies();
        });
        node.client.on('disconnected', (reason) => node.warn(`Disconnected from headunit tube: ${reason}`));
        node.client.on('connect-error', (error) => node.debug(`Headunit tube connection error: ${error.message}`));
        node.client.connect();

        /*--------------------------------------------------------------------------------------------------------------
        --------------------------------------------------------------------------------------------------------------*/
        node.registerFamily = function (familyId) {
            node.families.set(familyId, (node.families.get(familyId) || 0) + 1);
            if (node.client.connected) node.refreshFamily(familyId);
        };

        /*--------------------------------------------------------------------------------------------------------------
        --------------------------------------------------------------------------------------------------------------*/
        node.unregisterFamily = function (familyId) {
            const count = (node.families.get(familyId) || 1) - 1;
            if (count > 0) node.families.set(familyId, count);
            else node.families.delete(familyId);
        };

        /*--------------------------------------------------------------------------------------------------------------
        --------------------------------------------------------------------------------------------------------------*/
        node.refreshFamilies = function () {
            for (const familyId of node.families.keys()) node.refreshFamily(familyId);
            if (node.scenarioNodes > 0) node.refreshScenarios();
        };

        /*--------------------------------------------------------------------------------------------------------------
            La risposta arriva ai nodi come evento 'device-list' del client
        --------------------------------------------------------------------------------------------------------------*/
        node.refreshFamily = function (familyId) {
            node.client.listDevices(familyId).catch((error) => node.warn(`Unable to load "${familyId}" devices: ${error.message}`));
        };

        /*--------------------------------------------------------------------------------------------------------------
            Scrive sul tubo e notifica in locale gli altri nodi dello stesso device (il tubo non rimanda al mittente)
        --------------------------------------------------------------------------------------------------------------*/
        node.write = function (familyId, deviceId, items, sender) {
            node.client.write(familyId, deviceId, items);
            node.client.emit('device-update', { familyId, deviceId, items, origin: 'NODE-RED', sender });
        };

        /*--------------------------------------------------------------------------------------------------------------
        --------------------------------------------------------------------------------------------------------------*/
        node.registerScenarios = function () {
            node.scenarioNodes++;
            if (node.client.connected) node.refreshScenarios();
        };

        /*--------------------------------------------------------------------------------------------------------------
        --------------------------------------------------------------------------------------------------------------*/
        node.unregisterScenarios = function () {
            node.scenarioNodes = Math.max(0, node.scenarioNodes - 1);
        };

        /*--------------------------------------------------------------------------------------------------------------
            La risposta arriva ai nodi come evento 'scenario-list' del client
        --------------------------------------------------------------------------------------------------------------*/
        node.refreshScenarios = function () {
            node.client.listScenarios().catch((error) => node.warn(`Unable to load the scenarios: ${error.message}`));
        };

        /*--------------------------------------------------------------------------------------------------------------
            Comando a uno scenario: lo notifichiamo in locale agli altri nodi dello stesso scenario (il tubo non rimanda
            al mittente); lo stato (run/stop) arriva poi dalla headunit
        --------------------------------------------------------------------------------------------------------------*/
        node.writeScenario = function (scenarioId, fields, sender) {
            node.client.writeScenario(scenarioId, fields);
            node.client.emit('scenario-update', { scenarioId, fields, previous: {}, origin: 'NODE-RED', sender });
        };

        node.on('close', function (done) {
            node.client.close();
            done();
        });
    }

    RED.nodes.registerType('lilitech-headunit', LilitechHeadunitNode);

    /*------------------------------------------------------------------------------------------------------------------
        Elenco dei device di una famiglia per l'editor. Se il config node non è ancora stato deployato
        apriamo una connessione temporanea all'URL indicato
    ------------------------------------------------------------------------------------------------------------------*/
    RED.httpAdmin.get('/lilitech/devices', RED.auth.needsPermission('lilitech-headunit.read'), async function (req, res) {
        const familyId = String(req.query.familyId || '');
        const family = families[familyId];
        if (!family) return res.status(400).json({ error: `Unknown familyId "${familyId}"` });

        await withEditorClient(req, res, async (client) => {
            const devices = await client.listDevices(familyId);
            return devices.map((d) => ({ deviceId: d.deviceId, name: d.name, typeId: d.typeId, roomId: d.roomId, items: family.editorItems(d) }));
        });
    });

    /*------------------------------------------------------------------------------------------------------------------
        Elenco degli scenari per l'editor
    ------------------------------------------------------------------------------------------------------------------*/
    RED.httpAdmin.get('/lilitech/scenarios', RED.auth.needsPermission('lilitech-headunit.read'), async function (req, res) {
        await withEditorClient(req, res, async (client) => {
            const scenarios = await client.listScenarios();
            return scenarios.map((s) => ({ scenarioId: s.scenarioId, name: s.name, roomId: s.roomId, enable: s.enable, manualControl: !!s.manualControl }));
        });
    });

    /*------------------------------------------------------------------------------------------------------------------
        Risponde all'editor con il client del config node o, se non è ancora stato deployato, con una connessione
        temporanea all'URL indicato
    ------------------------------------------------------------------------------------------------------------------*/
    async function withEditorClient(req, res, load) {
        const configNode = req.query.config ? RED.nodes.getNode(String(req.query.config)) : null;
        const url = String(req.query.url || DEFAULT_URL);
        if (!configNode && !/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'Invalid url' });

        let tempClient;
        try {
            let client = configNode?.client;
            if (!client || client.url !== url) {
                tempClient = client = new TubeClient(url, { reconnection: false });
                await new Promise((resolve, reject) => {
                    const timer = setTimeout(() => reject(new Error(`Unable to reach the headunit at ${url}`)), 5000);
                    client.once('connected', () => {
                        clearTimeout(timer);
                        resolve();
                    });
                    client.connect();
                });
            }
            res.json(await load(client));
        } catch (error) {
            res.status(503).json({ error: error.message });
        } finally {
            tempClient?.close();
        }
    }
};
