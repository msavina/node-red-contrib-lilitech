'use strict';

const chargers = require('../lib/families/chargers');
const { setupDeviceNode } = require('../lib/device-node');

module.exports = function (RED) {
    /*------------------------------------------------------------------------------------------------------------------
        Nodo charger: in ingresso accende/spegne i caricatori e comanda le colonnine smart (avvio/pausa, blocco,
        corrente massima), in uscita emette lo stato ricevuto dal tubo
    ------------------------------------------------------------------------------------------------------------------*/
    function LilitechChargerNode(config) {
        RED.nodes.createNode(this, config);
        setupDeviceNode(RED, this, config, chargers);
    }

    RED.nodes.registerType('lilitech-charger', LilitechChargerNode);
};
