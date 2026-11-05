'use strict';

const videoSurveillances = require('../lib/families/video-surveillances');
const { setupDeviceNode } = require('../lib/device-node');

module.exports = function (RED) {
    /*------------------------------------------------------------------------------------------------------------------
        Nodo video surveillance (per ora solo telecamere): in ingresso avvia la registrazione di una clip, in uscita emette stato e clip registrate
    ------------------------------------------------------------------------------------------------------------------*/
    function LilitechVideoSurveillanceNode(config) {
        RED.nodes.createNode(this, config);
        setupDeviceNode(RED, this, config, videoSurveillances);
    }

    RED.nodes.registerType('lilitech-video-surveillance', LilitechVideoSurveillanceNode);
};
