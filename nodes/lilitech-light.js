'use strict';

const lights = require('../lib/families/lights');

module.exports = function (RED) {
    /*------------------------------------------------------------------------------------------------------------------
        Nodo light: in ingresso scrive gli items sul device, in uscita emette gli items ricevuti dal tubo
    ------------------------------------------------------------------------------------------------------------------*/
    function LilitechLightNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        node.deviceId = config.deviceId;
        // 'feedback': solo i feedback dei driver, 'all': anche i comandi arrivati da app/cloud/altri nodi
        node.outputMode = config.outputMode || 'feedback';
        node.initialState = config.initialState !== false;
        node.headunit = RED.nodes.getNode(config.headunit);

        if (!node.headunit) {
            node.status({ fill: 'red', shape: 'ring', text: 'no headunit configured' });
            return;
        }
        if (!node.deviceId) {
            node.status({ fill: 'red', shape: 'ring', text: 'no device selected' });
            return;
        }

        const client = node.headunit.client;

        /*--------------------------------------------------------------------------------------------------------------
        --------------------------------------------------------------------------------------------------------------*/
        const getDevice = () => client.getDevice(lights.FAMILY_ID, node.deviceId);

        /*--------------------------------------------------------------------------------------------------------------
        --------------------------------------------------------------------------------------------------------------*/
        const updateStatus = () => {
            const device = getDevice();
            if (!client.connected) return node.status({ fill: 'red', shape: 'ring', text: 'disconnected' });
            if (!device) return node.status({ fill: 'yellow', shape: 'ring', text: 'device not found' });
            const text = lights.statusText(device, device);
            node.status({ fill: text.startsWith('on') ? 'green' : 'grey', shape: text.startsWith('on') ? 'dot' : 'ring', text });
        };

        /*--------------------------------------------------------------------------------------------------------------
        --------------------------------------------------------------------------------------------------------------*/
        const sendItems = (items, origin) => {
            const device = getDevice();
            const readable = lights.readableItems(device);
            const messages = [];
            for (const [item, value] of Object.entries(items)) {
                if (!readable.includes(item)) continue;
                if (node.outputMode === 'feedback' && !item.endsWith('Feedback')) continue;
                messages.push({
                    topic: item,
                    payload: lights.outputValue(item, value),
                    origin,
                    device: { deviceId: node.deviceId, name: device?.name, typeId: device?.typeId, roomId: device?.roomId }
                });
            }
            if (messages.length) node.send([messages]);
        };

        /*--------------------------------------------------------------------------------------------------------------
        --------------------------------------------------------------------------------------------------------------*/
        const onDeviceUpdate = (event) => {
            if (event.familyId !== lights.FAMILY_ID || event.deviceId !== node.deviceId || event.sender === node) return;
            sendItems(event.items, event.origin);
            updateStatus();
        };

        /*--------------------------------------------------------------------------------------------------------------
        --------------------------------------------------------------------------------------------------------------*/
        const onDeviceList = (familyId) => {
            if (familyId !== lights.FAMILY_ID) return;
            const device = getDevice();
            if (device && node.initialState) sendItems(device, 'INITIAL');
            updateStatus();
        };

        client.on('device-update', onDeviceUpdate);
        client.on('device-list', onDeviceList);
        client.on('device-delete', updateStatus);
        client.on('connected', updateStatus);
        client.on('disconnected', updateStatus);
        node.headunit.registerFamily(lights.FAMILY_ID);
        updateStatus();

        node.on('input', function (msg, send, done) {
            try {
                const device = getDevice();
                if (!device) throw new Error(client.connected ? `Light "${node.deviceId}" not found on the headunit` : 'Headunit not connected');
                const items = lights.parseInput(msg, device, device);
                node.headunit.write(lights.FAMILY_ID, node.deviceId, items, node);
                updateStatus();
                done();
            } catch (error) {
                done(error);
            }
        });

        node.on('close', function (done) {
            client.off('device-update', onDeviceUpdate);
            client.off('device-list', onDeviceList);
            client.off('device-delete', updateStatus);
            client.off('connected', updateStatus);
            client.off('disconnected', updateStatus);
            node.headunit.unregisterFamily(lights.FAMILY_ID);
            done();
        });
    }

    RED.nodes.registerType('lilitech-light', LilitechLightNode);
};
