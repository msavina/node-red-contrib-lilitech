'use strict';

const assert = require('assert');
const helper = require('node-red-node-test-helper');
const headunitNode = require('../nodes/lilitech-headunit.js');
const automationNode = require('../nodes/lilitech-automation.js');
const { startFakeTube, startFakeDevices } = require('./fake-tube');

helper.init(require.resolve('node-red'));

const FAMILY_ID = 'automations';
const DEVICE = {
    deviceId: 'aut-1',
    name: 'Living shutter',
    typeId: 'shutter',
    roomId: 'room-1',
    positionable: true,
    stoppable: true,
    drive: 'stop',
    driveFeedback: 'idle',
    absolutePosition: 0,
    absolutePositionFeedback: 0
};

describe('lilitech-automation node', function () {
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
            { id: 'a1', type: 'lilitech-automation', headunit: 'hu', deviceId: 'aut-1', initialState: true, wires: [['out']], ...extra },
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
        await helper.load([headunitNode, automationNode], flow(extra));
        const a1 = helper.getNode('a1');
        await waitFor(() => a1.headunit.client.getDevice(FAMILY_ID, 'aut-1'));
        return a1;
    }

    it('emits the feedback with the initial state', async function () {
        await helper.load([headunitNode, automationNode], flow());
        const msgs = collect();
        await waitFor(() => msgs.length >= 2);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.deepStrictEqual(msgs.map((m) => [m.topic, m.payload, m.unit, m.origin]), [
            ['driveFeedback', 'idle', undefined, 'INITIAL'],
            ['absolutePositionFeedback', 0, '%', 'INITIAL']
        ]);
        assert.strictEqual(msgs[0].device.name, 'Living shutter');
    });

    it('writes the items on the tube', async function () {
        const a1 = await loadReady({ initialState: false });
        a1.receive({ payload: { drive: 'close', absolutePosition: 60 } });
        await waitFor(() => devices.received.length === 1);
        assert.deepStrictEqual(devices.received[0].payload, {
            unitId: 'unit-1',
            deviceId: 'aut-1',
            familyId: 'automations',
            roomId: 'room-1',
            authorName: 'Node-RED',
            drive: 'close',
            absolutePosition: 60
        });
    });

    it('emits the feedback sent by the headunit', async function () {
        await loadReady({ initialState: false });
        const msgs = collect();
        // Il comando (drive) viene filtrato in modalità feedback, esce solo driveFeedback
        devices.emitUpdate({ deviceId: 'aut-1', drive: 'open', driveFeedback: 'opening' }, FAMILY_ID);
        await waitFor(() => msgs.length === 1);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.deepStrictEqual(msgs.map((m) => [m.topic, m.payload, m.origin]), [['driveFeedback', 'opening', 'UNIT']]);
    });

    it('reports an error for unsupported items', async function () {
        const a1 = await loadReady({ initialState: false });
        const errored = new Promise((resolve) => a1.on('call:error', (call) => resolve(call.args[0])));
        a1.receive({ payload: { absolutePositionFoil: 30 } });
        const error = await errored;
        assert.match(String(error), /not writable/);
        assert.strictEqual(devices.received.length, 0);
    });
});
