'use strict';

const actuators = require('../lib/families/actuators');
const { setupDeviceNode } = require('../lib/device-node');

module.exports = function (RED) {
    /*------------------------------------------------------------------------------------------------------------------
        Nodo actuator: in ingresso comanda pompe, valvole, irrigatori, rubinetti, servovalvole e valvole termostatiche,
        in uscita emette lo stato ricevuto dal tubo
    ------------------------------------------------------------------------------------------------------------------*/
    function LilitechActuatorNode(config) {
        RED.nodes.createNode(this, config);
        setupDeviceNode(RED, this, config, actuators);
    }

    RED.nodes.registerType('lilitech-actuator', LilitechActuatorNode);
};
