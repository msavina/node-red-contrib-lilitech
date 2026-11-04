'use strict';

const accessControls = require('../lib/families/access-controls');
const { setupDeviceNode } = require('../lib/device-node');

module.exports = function (RED) {
    /*------------------------------------------------------------------------------------------------------------------
        Nodo access control: in uscita emette l'esito degli accessi ai lettori di badge/tastierini (con l'utente e il
        motivo del rifiuto), la manomissione e l'esclusione; in ingresso esclude/riabilita il lettore
    ------------------------------------------------------------------------------------------------------------------*/
    function LilitechAccessControlNode(config) {
        RED.nodes.createNode(this, config);
        setupDeviceNode(RED, this, config, accessControls);
    }

    RED.nodes.registerType('lilitech-access-control', LilitechAccessControlNode);
};
