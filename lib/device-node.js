'use strict';

/*----------------------------------------------------------------------------------------------------------------------
    Logica comune ai nodi device: sottoscrizione al tubo, stato iniziale, messaggi in uscita, stato del nodo e,
    se la famiglia lo prevede (family.parseInput), scrittura degli items.

    La famiglia espone:
    - FAMILY_ID
    - readableItems(device): items che possono uscire dal nodo
    - isOutputItem(item, config): filtro sugli items in base alla configurazione del nodo
    - outputValue(item, value): valore da mandare in msg.payload
    - outputExtras(item, device): campi aggiuntivi del messaggio (opzionale)
    - status(device, config): { fill, shape, text } per lo stato del nodo
    - parseInput(msg, device): { item: valore } da scrivere (opzionale, solo per i nodi con input)
    - historyMessage(event, device): { topic, payload, ... } da emettere per un evento dello storico del device, o null (opzionale)
----------------------------------------------------------------------------------------------------------------------*/
function setupDeviceNode(RED, node, config, family) {
    node.deviceId = config.deviceId;
    node.initialState = config.initialState !== false;
    node.headunit = RED.nodes.getNode(config.headunit);

    if (!node.headunit) {
        node.status({ fill: 'red', shape: 'ring', text: 'No Headunit Configured' });
        return;
    }
    if (!node.deviceId) {
        node.status({ fill: 'red', shape: 'ring', text: 'No Device Selected' });
        return;
    }

    const client = node.headunit.client;
    const familyId = family.FAMILY_ID;

    /*------------------------------------------------------------------------------------------------------------------
    ------------------------------------------------------------------------------------------------------------------*/
    const getDevice = () => client.getDevice(familyId, node.deviceId);

    /*------------------------------------------------------------------------------------------------------------------
    ------------------------------------------------------------------------------------------------------------------*/
    const updateStatus = () => {
        const device = getDevice();
        if (!client.connected) return node.status({ fill: 'red', shape: 'ring', text: 'Disconnected' });
        if (!device) return node.status({ fill: 'yellow', shape: 'ring', text: 'Device Not Found' });
        node.status(family.status(device, config));
    };

    /*------------------------------------------------------------------------------------------------------------------
    ------------------------------------------------------------------------------------------------------------------*/
    const sendItems = (items, origin) => {
        const device = getDevice();
        const readable = family.readableItems(device);
        const messages = [];
        for (const [item, value] of Object.entries(items)) {
            if (!readable.includes(item) || !family.isOutputItem(item, config)) continue;
            messages.push({
                topic: item,
                payload: family.outputValue(item, value),
                ...(family.outputExtras ? family.outputExtras(item, device) : {}),
                origin,
                device: { deviceId: node.deviceId, name: device?.name, typeId: device?.typeId, roomId: device?.roomId }
            });
        }
        if (messages.length) node.send([messages]);
    };

    /*------------------------------------------------------------------------------------------------------------------
    ------------------------------------------------------------------------------------------------------------------*/
    const onDeviceUpdate = (event) => {
        if (event.familyId !== familyId || event.deviceId !== node.deviceId || event.sender === node) return;
        sendItems(event.items, event.origin);
        updateStatus();
    };

    /*------------------------------------------------------------------------------------------------------------------
    ------------------------------------------------------------------------------------------------------------------*/
    const onDeviceList = (listFamilyId) => {
        if (listFamilyId !== familyId) return;
        const device = getDevice();
        if (device && node.initialState) sendItems(device, 'INITIAL');
        updateStatus();
    };

    /*------------------------------------------------------------------------------------------------------------------
    ------------------------------------------------------------------------------------------------------------------*/
    const onHistoryEvent = (event) => {
        if (event.sourceId !== node.deviceId) return;
        const device = getDevice();
        const message = device && family.historyMessage(event, device);
        if (!message) return;
        node.send({ ...message, origin: 'UNIT', device: { deviceId: node.deviceId, name: device.name, typeId: device.typeId, roomId: device.roomId } });
    };

    client.on('device-update', onDeviceUpdate);
    if (family.historyMessage) client.on('history-event', onHistoryEvent);
    client.on('device-list', onDeviceList);
    client.on('device-delete', updateStatus);
    client.on('connected', updateStatus);
    client.on('disconnected', updateStatus);
    node.headunit.registerFamily(familyId);
    updateStatus();

    if (family.parseInput) {
        node.on('input', function (msg, send, done) {
            try {
                const device = getDevice();
                if (!device) throw new Error(client.connected ? `Device "${node.deviceId}" not found on the headunit` : 'Headunit not connected');
                const items = family.parseInput(msg, device);
                node.headunit.write(familyId, node.deviceId, items, node);
                updateStatus();
                done();
            } catch (error) {
                done(error);
            }
        });
    }

    node.on('close', function (done) {
        client.off('device-update', onDeviceUpdate);
        client.off('history-event', onHistoryEvent);
        client.off('device-list', onDeviceList);
        client.off('device-delete', updateStatus);
        client.off('connected', updateStatus);
        client.off('disconnected', updateStatus);
        node.headunit.unregisterFamily(familyId);
        done();
    });
}

module.exports = { setupDeviceNode };
