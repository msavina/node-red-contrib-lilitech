'use strict';

const thermostats = require('../lib/families/thermostats');
const { setupDeviceNode } = require('../lib/device-node');

module.exports = function (RED) {
    /*------------------------------------------------------------------------------------------------------------------
        Nodo thermostat: in ingresso accende/spegne, imposta temperatura, profilo e modalità, in uscita emette lo stato
    ------------------------------------------------------------------------------------------------------------------*/
    function LilitechThermostatNode(config) {
        RED.nodes.createNode(this, config);
        setupDeviceNode(RED, this, config, thermostats);
    }

    RED.nodes.registerType('lilitech-thermostat', LilitechThermostatNode);
};
