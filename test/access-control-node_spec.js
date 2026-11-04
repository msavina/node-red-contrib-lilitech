'use strict';

const assert = require('assert');
const helper = require('node-red-node-test-helper');
const headunitNode = require('../nodes/lilitech-headunit.js');
const accessControlNode = require('../nodes/lilitech-access-control.js');
const { startFakeTube, startFakeDevices } = require('./fake-tube');

helper.init(require.resolve('node-red'));

const FAMILY_ID = 'access-controls';
const DEVICE = {
    deviceId: 'acc-1',
    name: 'Front door keypad',
    typeId: 'keypadReader',
    roomId: 'room-1',
    excludible: true,
    tamperDetection: true,
    accessFeedback: 'ready',
    exclusion: false,
    tamper: false
};

describe('lilitech-access-control node', function () {
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
            { id: 'a1', type: 'lilitech-access-control', headunit: 'hu', deviceId: 'acc-1', initialState: true, wires: [['out']], ...extra },
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
        await helper.load([headunitNode, accessControlNode], flow(extra));
        const a1 = helper.getNode('a1');
        await waitFor(() => a1.headunit.client.getDevice(FAMILY_ID, 'acc-1'));
        return a1;
    }

    it('emits the initial state', async function () {
        await helper.load([headunitNode, accessControlNode], flow());
        const msgs = collect();
        await waitFor(() => msgs.length >= 2);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.deepStrictEqual(msgs.map((m) => [m.topic, m.payload, m.origin]), [
            ['exclusion', false, 'INITIAL'],
            ['tamper', false, 'INITIAL']
        ]);
    });

    it('emits the access with the user and never the pin', async function () {
        await loadReady({ initialState: false });
        const msgs = collect();
        // Il lettore manda il pin sul tubo, poi la headunit l'esito e l'evento dello storico
        devices.emitUpdate({ deviceId: 'acc-1', pin: '123456' }, FAMILY_ID);
        devices.emitUpdate({ deviceId: 'acc-1', accessFeedback: 'granted' }, FAMILY_ID);
        devices.emitHistory({
            eventName: 'DEVICES_ACCESS_CONTROLS_GRANTED_ACCESS',
            sourceId: 'acc-1',
            sourceName: 'Front door keypad',
            authorId: 'u-1',
            authorName: 'Mario Rossi',
            payload: null
        });
        await waitFor(() => msgs.length === 1);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.strictEqual(msgs.length, 1);
        assert.deepStrictEqual([msgs[0].topic, msgs[0].payload, msgs[0].user, msgs[0].origin], ['access', 'granted', { id: 'u-1', name: 'Mario Rossi' }, 'UNIT']);
        assert.strictEqual(msgs[0].device.name, 'Front door keypad');
    });

    it('ignores the history events of other devices', async function () {
        await loadReady({ initialState: false });
        const msgs = collect();
        devices.emitHistory({ eventName: 'DEVICES_ACCESS_CONTROLS_DENIED_ACCESS', sourceId: 'acc-2', payload: { message: 'Not valid pin' } });
        devices.emitHistory({ eventName: 'DEVICES_ACCESS_CONTROLS_DENIED_ACCESS', sourceId: 'acc-1', payload: { message: 'Not valid pin' } });
        await waitFor(() => msgs.length === 1);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.deepStrictEqual(msgs.map((m) => [m.topic, m.payload, m.reason]), [['access', 'denied', 'Not valid pin']]);
    });

    it('writes the exclusion on the tube', async function () {
        const a1 = await loadReady({ initialState: false });
        a1.receive({ payload: true });
        await waitFor(() => devices.received.length === 1);
        assert.deepStrictEqual(devices.received[0].payload, {
            unitId: 'unit-1',
            deviceId: 'acc-1',
            familyId: 'access-controls',
            roomId: 'room-1',
            authorName: 'Node-RED',
            exclusion: true
        });
    });
});
