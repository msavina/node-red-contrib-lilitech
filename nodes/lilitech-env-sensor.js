'use strict';

const envSensors = require('../lib/families/env-sensors');
const { setupDeviceNode } = require('../lib/device-node');

module.exports = function (RED) {
    /*------------------------------------------------------------------------------------------------------------------
        Nodo environment sensor: solo uscita, emette gli items del sensore ricevuti dal tubo
    ------------------------------------------------------------------------------------------------------------------*/
    function LilitechEnvSensorNode(config) {
        RED.nodes.createNode(this, config);
        setupDeviceNode(RED, this, config, envSensors);
    }

    RED.nodes.registerType('lilitech-env-sensor', LilitechEnvSensorNode);
};
