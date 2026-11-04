'use strict';

const securitySensors = require('../lib/families/security-sensors');
const { setupDeviceNode } = require('../lib/device-node');

module.exports = function (RED) {
    /*------------------------------------------------------------------------------------------------------------------
        Nodo security sensor: in uscita emette stato e allarmi ricevuti dal tubo, in ingresso esclusione, test e manutenzione
    ------------------------------------------------------------------------------------------------------------------*/
    function LilitechSecuritySensorNode(config) {
        RED.nodes.createNode(this, config);
        setupDeviceNode(RED, this, config, securitySensors);
    }

    RED.nodes.registerType('lilitech-security-sensor', LilitechSecuritySensorNode);
};
