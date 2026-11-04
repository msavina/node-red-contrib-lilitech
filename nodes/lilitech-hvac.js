'use strict';

const hvacs = require('../lib/families/hvacs');
const { setupDeviceNode } = require('../lib/device-node');

module.exports = function (RED) {
    /*------------------------------------------------------------------------------------------------------------------
        Nodo hvac: in ingresso accende/spegne e regola climatizzatori, fancoil, caldaie, ventole e VMC (setpoint,
        profili, modalità, ventola), in uscita emette lo stato ricevuto dal tubo
    ------------------------------------------------------------------------------------------------------------------*/
    function LilitechHvacNode(config) {
        RED.nodes.createNode(this, config);
        setupDeviceNode(RED, this, config, hvacs);
    }

    RED.nodes.registerType('lilitech-hvac', LilitechHvacNode);
};
