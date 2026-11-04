'use strict';

const appliances = require('../lib/families/appliances');
const { setupDeviceNode } = require('../lib/device-node');

module.exports = function (RED) {
    /*------------------------------------------------------------------------------------------------------------------
        Nodo appliance: in ingresso accende/spegne gli elettrodomestici, in uscita emette lo stato ricevuto dal tubo
    ------------------------------------------------------------------------------------------------------------------*/
    function LilitechApplianceNode(config) {
        RED.nodes.createNode(this, config);
        setupDeviceNode(RED, this, config, appliances);
    }

    RED.nodes.registerType('lilitech-appliance', LilitechApplianceNode);
};
