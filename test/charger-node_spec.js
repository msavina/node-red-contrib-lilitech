'use strict';

const assert = require('assert');
const helper = require('node-red-node-test-helper');
const headunitNode = require('../nodes/lilitech-headunit.js');
const chargerNode = require('../nodes/lilitech-charger.js');
const { startFakeTube, startFakeDevices } = require('./fake-tube');

helper.init(require.resolve('node-red'));

const FAMILY_ID = 'chargers';
const DEVICE = {
    deviceId: 'chg-1',
    name: 'Garage wallbox',
    typeId: 'smartCharger',
    roomId: 'room-1',
    command: 'pause',
    status: 'ready',
    commandLock: false,
    statusLock: false,
    maxChargingCurrent: 16
};

describe('lilitech-charger node', function () {
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
            { id: 'c1', type: 'lilitech-charger', headunit: 'hu', deviceId: 'chg-1', initialState: true, wires: [['out']], ...extra },
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
        await helper.load([headunitNode, chargerNode], flow(extra));
        const c1 = helper.getNode('c1');
        await waitFor(() => c1.headunit.client.getDevice(FAMILY_ID, 'chg-1'));
        return c1;
    }

    it('emits the feedback with the initial state', async function () {
        await helper.load([headunitNode, chargerNode], flow());
        const msgs = collect();
        await waitFor(() => msgs.length >= 3);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.deepStrictEqual(msgs.map((m) => [m.topic, m.payload, m.unit, m.origin]), [
            ['status', 'ready', undefined, 'INITIAL'],
            ['statusLock', false, undefined, 'INITIAL'],
            ['maxChargingCurrent', 16, 'A', 'INITIAL']
        ]);
        assert.strictEqual(msgs[0].device.name, 'Garage wallbox');
    });

    it('writes the command on the tube', async function () {
        const c1 = await loadReady({ initialState: false });
        c1.receive({ payload: 'play' });
        await waitFor(() => devices.received.length === 1);
        assert.deepStrictEqual(devices.received[0].payload, {
            unitId: 'unit-1',
            deviceId: 'chg-1',
            familyId: 'chargers',
            roomId: 'room-1',
            authorName: 'Node-RED',
            command: 'play'
        });
    });

    it('emits the state sent by the headunit', async function () {
        await loadReady({ initialState: false });
        const msgs = collect();
        // Il comando viene filtrato in modalità feedback, escono status e potenza
        devices.emitUpdate({ deviceId: 'chg-1', command: 'play', status: 'charging', chargingPower: 7.4 }, FAMILY_ID);
        await waitFor(() => msgs.length === 2);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.deepStrictEqual(msgs.map((m) => [m.topic, m.payload, m.unit, m.origin]), [
            ['status', 'charging', undefined, 'UNIT'],
            ['chargingPower', 7.4, 'kW', 'UNIT']
        ]);
    });

    it('reports an error for several commands in one message', async function () {
        const c1 = await loadReady({ initialState: false });
        const errored = new Promise((resolve) => c1.on('call:error', (call) => resolve(call.args[0])));
        c1.receive({ payload: { command: 'play', maxChargingCurrent: 10 } });
        const error = await errored;
        assert.match(String(error), /one item per message/);
        assert.strictEqual(devices.received.length, 0);
    });
});
