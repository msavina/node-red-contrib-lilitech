'use strict';

const meteringSensors = require('../lib/families/metering-sensors');
const { setupDeviceNode } = require('../lib/device-node');

module.exports = function (RED) {
    /*------------------------------------------------------------------------------------------------------------------
        Nodo metering sensor: in uscita emette le misure ricevute dal tubo, in ingresso azzera l'energia dei contatori
    ------------------------------------------------------------------------------------------------------------------*/
    function LilitechMeteringSensorNode(config) {
        RED.nodes.createNode(this, config);
        setupDeviceNode(RED, this, config, meteringSensors);
    }

    RED.nodes.registerType('lilitech-metering-sensor', LilitechMeteringSensorNode);
};
