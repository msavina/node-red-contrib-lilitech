'use strict';

const securityAreas = require('../lib/families/security-areas');
const { setupDeviceNode } = require('../lib/device-node');

module.exports = function (RED) {
    /*------------------------------------------------------------------------------------------------------------------
        Nodo security area: in ingresso arma/disarma/mette in ronda l'area, in uscita emette lo stato ricevuto dal tubo
    ------------------------------------------------------------------------------------------------------------------*/
    function LilitechSecurityAreaNode(config) {
        RED.nodes.createNode(this, config);
        setupDeviceNode(RED, this, config, securityAreas);
    }

    RED.nodes.registerType('lilitech-security-area', LilitechSecurityAreaNode);
};
