'use strict';

const automations = require('../lib/families/automations');
const { setupDeviceNode } = require('../lib/device-node');

module.exports = function (RED) {
    /*------------------------------------------------------------------------------------------------------------------
        Nodo automation: in ingresso comanda tapparelle, tende, frangisole, cancelli, porte e finestre,
        in uscita emette lo stato ricevuto dal tubo
    ------------------------------------------------------------------------------------------------------------------*/
    function LilitechAutomationNode(config) {
        RED.nodes.createNode(this, config);
        setupDeviceNode(RED, this, config, automations);
    }

    RED.nodes.registerType('lilitech-automation', LilitechAutomationNode);
};
