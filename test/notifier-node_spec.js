'use strict';

const assert = require('assert');
const helper = require('node-red-node-test-helper');
const headunitNode = require('../nodes/lilitech-headunit.js');
const notifierNode = require('../nodes/lilitech-notifier.js');
const { startFakeTube, startFakeDevices } = require('./fake-tube');

helper.init(require.resolve('node-red'));

const FAMILY_ID = 'notifiers';
const DEVICE = {
    deviceId: 'not-1',
    name: 'Outdoor siren',
    typeId: 'siren',
    roomId: 'room-1',
    tamperInfo: true,
    switch: false,
    switchFeedback: false,
    maintenance: false,
    tamperSignal: false
};

describe('lilitech-notifier node', function () {
    let tube;
    let devices;

    beforeEach(async function () {
        tube = await startFakeTube();
        devices = await startFakeDevices(tube.url, { [FAMILY_ID]: [{ ...DEVICE }] });
        await new Promise((resolve) => helper.startServer(resolve));
    });

    afterEach(async function () {
        await helper.unload();
        await new Promise((resolve) => helper.stopServer(resolve));
        devices.close();
        await tube.close();
    });

    /*------------------------------------------------------------------------------------------------------------------
    ------------------------------------------------------------------------------------------------------------------*/
    function flow(extra = {}) {
        return [
            { id: 'hu', type: 'lilitech-headunit', url: tube.url },
            { id: 'n1', type: 'lilitech-notifier', headunit: 'hu', deviceId: 'not-1', initialState: true, wires: [['out']], ...extra },
            { id: 'out', type: 'helper' }
        ];
    }

    /*------------------------------------------------------------------------------------------------------------------
    ------------------------------------------------------------------------------------------------------------------*/
    function collect() {
        const msgs = [];
        helper.getNode('out').on('input', (msg) => msgs.push(msg));
        return msgs;
    }

    /*------------------------------------------------------------------------------------------------------------------
    ------------------------------------------------------------------------------------------------------------------*/
    function waitFor(condition, timeout = 2000) {
        return new Promise((resolve, reject) => {
            const started = Date.now();
            const timer = setInterval(() => {
                if (condition()) {
                    clearInterval(timer);
                    resolve();
                } else if (Date.now() - started > timeout) {
                    clearInterval(timer);
                    reject(new Error('Timeout'));
                }
            }, 10);
        });
    }

    /*------------------------------------------------------------------------------------------------------------------
    ------------------------------------------------------------------------------------------------------------------*/
    async function loadReady(extra) {
        await helper.load([headunitNode, notifierNode], flow(extra));
        const n1 = helper.getNode('n1');
        await waitFor(() => n1.headunit.client.getDevice(FAMILY_ID, 'not-1'));
        return n1;
    }

    it('emits the feedback with the initial state', async function () {
        await helper.load([headunitNode, notifierNode], flow());
        const msgs = collect();
        await waitFor(() => msgs.length >= 3);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.deepStrictEqual(msgs.map((m) => [m.topic, m.payload, m.origin]), [
            ['switchFeedback', false, 'INITIAL'],
            ['maintenance', false, 'INITIAL'],
            ['tamperSignal', false, 'INITIAL']
        ]);
        assert.strictEqual(msgs[0].device.name, 'Outdoor siren');
    });

    it('writes the items on the tube', async function () {
        const n1 = await loadReady({ initialState: false });
        n1.receive({ payload: { switch: 'on', maintenance: false } });
        await waitFor(() => devices.received.length === 1);
        assert.deepStrictEqual(devices.received[0].payload, {
            unitId: 'unit-1',
            deviceId: 'not-1',
            familyId: 'notifiers',
            roomId: 'room-1',
            authorName: 'Node-RED',
            switch: true,
            maintenance: false
        });
    });

    it('emits the feedback sent by the headunit', async function () {
        await loadReady({ initialState: false });
        const msgs = collect();
        // Il comando (switch) viene filtrato in modalità feedback, esce solo switchFeedback
        devices.emitUpdate({ deviceId: 'not-1', switch: true, switchFeedback: true }, FAMILY_ID);
        await waitFor(() => msgs.length === 1);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.deepStrictEqual(msgs.map((m) => [m.topic, m.payload, m.origin]), [['switchFeedback', true, 'UNIT']]);
    });

    it('reports an error when the test is not enabled', async function () {
        const n1 = await loadReady({ initialState: false });
        const errored = new Promise((resolve) => n1.on('call:error', (call) => resolve(call.args[0])));
        n1.receive({ topic: 'test', payload: true });
        const error = await errored;
        assert.match(String(error), /not writable/);
        assert.strictEqual(devices.received.length, 0);
    });
});
