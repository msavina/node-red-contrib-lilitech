'use strict';

const notifiers = require('../lib/families/notifiers');
const { setupDeviceNode } = require('../lib/device-node');

module.exports = function (RED) {
    /*------------------------------------------------------------------------------------------------------------------
        Nodo notifier: in ingresso accende/spegne sirene, buzzer, lampeggianti e led di stato, avvia il test e
        la manutenzione, in uscita emette lo stato ricevuto dal tubo
    ------------------------------------------------------------------------------------------------------------------*/
    function LilitechNotifierNode(config) {
        RED.nodes.createNode(this, config);
        setupDeviceNode(RED, this, config, notifiers);
    }

    RED.nodes.registerType('lilitech-notifier', LilitechNotifierNode);
};
