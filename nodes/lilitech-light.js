'use strict';

const lights = require('../lib/families/lights');
const { setupDeviceNode } = require('../lib/device-node');

module.exports = function (RED) {
    /*------------------------------------------------------------------------------------------------------------------
        Nodo light: in ingresso scrive gli items sul device, in uscita emette gli items ricevuti dal tubo
    ------------------------------------------------------------------------------------------------------------------*/
    function LilitechLightNode(config) {
        RED.nodes.createNode(this, config);
        setupDeviceNode(RED, this, config, lights);
    }

    RED.nodes.registerType('lilitech-light', LilitechLightNode);
};
