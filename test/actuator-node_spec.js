'use strict';

const assert = require('assert');
const helper = require('node-red-node-test-helper');
const headunitNode = require('../nodes/lilitech-headunit.js');
const actuatorNode = require('../nodes/lilitech-actuator.js');
const { startFakeTube, startFakeDevices } = require('./fake-tube');

helper.init(require.resolve('node-red'));

const FAMILY_ID = 'actuators';
const DEVICE = {
    deviceId: 'act-1',
    name: 'Garden valve',
    typeId: 'valve',
    roomId: 'room-1',
    proportional: true,
    switch: false,
    switchFeedback: false,
    proportionalDrive: 0,
    proportionalDriveFeedback: 0
};

describe('lilitech-actuator node', function () {
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
            { id: 'a1', type: 'lilitech-actuator', headunit: 'hu', deviceId: 'act-1', initialState: true, wires: [['out']], ...extra },
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
        await helper.load([headunitNode, actuatorNode], flow(extra));
        const a1 = helper.getNode('a1');
        await waitFor(() => a1.headunit.client.getDevice(FAMILY_ID, 'act-1'));
        return a1;
    }

    it('emits the feedback with the initial state', async function () {
        await helper.load([headunitNode, actuatorNode], flow());
        const msgs = collect();
        await waitFor(() => msgs.length >= 2);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.deepStrictEqual(msgs.map((m) => [m.topic, m.payload, m.unit, m.origin]), [
            ['switchFeedback', false, undefined, 'INITIAL'],
            ['proportionalDriveFeedback', 0, '%', 'INITIAL']
        ]);
        assert.strictEqual(msgs[0].device.name, 'Garden valve');
    });

    it('writes the items on the tube', async function () {
        const a1 = await loadReady({ initialState: false });
        a1.receive({ payload: { switch: true, proportionalDrive: 60 } });
        await waitFor(() => devices.received.length === 1);
        assert.deepStrictEqual(devices.received[0].payload, {
            unitId: 'unit-1',
            deviceId: 'act-1',
            familyId: 'actuators',
            roomId: 'room-1',
            authorName: 'Node-RED',
            switch: true,
            proportionalDrive: 60
        });
    });

    it('emits the feedback sent by the headunit', async function () {
        await loadReady({ initialState: false });
        const msgs = collect();
        // Il comando (switch) viene filtrato in modalità feedback, esce solo switchFeedback
        devices.emitUpdate({ deviceId: 'act-1', switch: true, switchFeedback: true }, FAMILY_ID);
        await waitFor(() => msgs.length === 1);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.deepStrictEqual(msgs.map((m) => [m.topic, m.payload, m.origin]), [['switchFeedback', true, 'UNIT']]);
    });

    it('reports an error for unsupported items', async function () {
        const a1 = await loadReady({ initialState: false });
        const errored = new Promise((resolve) => a1.on('call:error', (call) => resolve(call.args[0])));
        a1.receive({ payload: { drive: 'open' } });
        const error = await errored;
        assert.match(String(error), /not writable/);
        assert.strictEqual(devices.received.length, 0);
    });
});
