'use strict';

const { parseCommand, statusMessage, commandMessage, status } = require('../lib/scenarios');

module.exports = function (RED) {
    /*------------------------------------------------------------------------------------------------------------------
        Nodo scenario: in ingresso avvia/ferma lo scenario (play/stop come l'app), in uscita lo stato di esecuzione
        con il timestamp dell'ultima esecuzione
    ------------------------------------------------------------------------------------------------------------------*/
    function LilitechScenarioNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        node.scenarioId = config.scenarioId;
        node.initialState = config.initialState !== false;
        node.headunit = RED.nodes.getNode(config.headunit);

        if (!node.headunit) {
            node.status({ fill: 'red', shape: 'ring', text: 'No Headunit Configured' });
            return;
        }
        if (!node.scenarioId) {
            node.status({ fill: 'red', shape: 'ring', text: 'No Scenario Selected' });
            return;
        }

        const client = node.headunit.client;

        /*--------------------------------------------------------------------------------------------------------------
        --------------------------------------------------------------------------------------------------------------*/
        const getScenario = () => client.getScenario(node.scenarioId);

        /*--------------------------------------------------------------------------------------------------------------
        --------------------------------------------------------------------------------------------------------------*/
        const updateStatus = () => {
            const scenario = getScenario();
            if (!client.connected) return node.status({ fill: 'red', shape: 'ring', text: 'Disconnected' });
            if (!scenario) return node.status({ fill: 'yellow', shape: 'ring', text: 'Scenario Not Found' });
            node.status(status(scenario));
        };

        /*--------------------------------------------------------------------------------------------------------------
            Lo stato esce solo quando cambia: gli altri aggiornamenti (nome, enable, ...) aggiornano lo stato del nodo.
            Con l'output 'all' escono anche i comandi play/stop arrivati dall'app o da altri nodi
        --------------------------------------------------------------------------------------------------------------*/
        const onScenarioUpdate = (event) => {
            if (event.scenarioId !== node.scenarioId || event.sender === node) return;
            const scenario = getScenario();
            if (scenario && config.outputMode === 'all' && 'command' in event.fields) {
                node.send(commandMessage(scenario, event.fields.command, event.origin));
            }
            if (scenario && 'status' in event.fields && event.previous?.status !== event.fields.status) {
                node.send(statusMessage(scenario, event.origin));
            }
            updateStatus();
        };

        /*--------------------------------------------------------------------------------------------------------------
        --------------------------------------------------------------------------------------------------------------*/
        const onScenarioList = () => {
            const scenario = getScenario();
            if (scenario && node.initialState) node.send(statusMessage(scenario, 'INITIAL'));
            updateStatus();
        };

        /*--------------------------------------------------------------------------------------------------------------
        --------------------------------------------------------------------------------------------------------------*/
        const onScenarioDelete = (scenarioId) => {
            if (scenarioId === node.scenarioId) updateStatus();
        };

        client.on('scenario-update', onScenarioUpdate);
        client.on('scenario-list', onScenarioList);
        client.on('scenario-delete', onScenarioDelete);
        client.on('connected', updateStatus);
        client.on('disconnected', updateStatus);
        node.headunit.registerScenarios();
        updateStatus();

        node.on('input', function (msg, send, done) {
            try {
                const scenario = getScenario();
                if (!scenario) throw new Error(client.connected ? `Scenario "${node.scenarioId}" not found on the headunit` : 'Headunit not connected');
                node.headunit.writeScenario(node.scenarioId, { command: parseCommand(msg, scenario) }, node);
                done();
            } catch (error) {
                done(error);
            }
        });

        node.on('close', function (done) {
            client.off('scenario-update', onScenarioUpdate);
            client.off('scenario-list', onScenarioList);
            client.off('scenario-delete', onScenarioDelete);
            client.off('connected', updateStatus);
            client.off('disconnected', updateStatus);
            node.headunit.unregisterScenarios();
            done();
        });
    }

    RED.nodes.registerType('lilitech-scenario', LilitechScenarioNode);
};
