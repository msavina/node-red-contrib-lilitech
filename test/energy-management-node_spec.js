'use strict';

const assert = require('assert');
const helper = require('node-red-node-test-helper');
const headunitNode = require('../nodes/lilitech-headunit.js');
const energyManagementNode = require('../nodes/lilitech-energy-management.js');
const { startFakeTube, startFakeDevices } = require('./fake-tube');

helper.init(require.resolve('node-red'));

const FAMILY_ID = 'energy-managements';
const DEVICE = {
    deviceId: 'em-1',
    name: 'Load control',
    typeId: 'gridControl',
    roomId: 'room-1',
    command: 'play',
    status: 'play',
    gridPower: 1500,
    overloadBadge: 'idle',
    gridContractedPower: 3000
};

describe('lilitech-energy-management node', function () {
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
            { id: 'e1', type: 'lilitech-energy-management', headunit: 'hu', deviceId: 'em-1', initialState: true, wires: [['out']], ...extra },
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
        await helper.load([headunitNode, energyManagementNode], flow(extra));
        const e1 = helper.getNode('e1');
        await waitFor(() => e1.headunit.client.getDevice(FAMILY_ID, 'em-1'));
        return e1;
    }

    it('emits the feedback with the initial state', async function () {
        await helper.load([headunitNode, energyManagementNode], flow());
        const msgs = collect();
        await waitFor(() => msgs.length >= 3);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.deepStrictEqual(msgs.map((m) => [m.topic, m.payload, m.unit, m.origin]), [
            ['status', 'play', undefined, 'INITIAL'],
            ['gridPower', 1500, 'W', 'INITIAL'],
            ['overloadBadge', 'idle', undefined, 'INITIAL']
        ]);
        assert.strictEqual(msgs[0].device.name, 'Load control');
    });

    it('writes the command on the tube', async function () {
        const e1 = await loadReady({ initialState: false });
        e1.receive({ payload: 'toggle' });
        await waitFor(() => devices.received.length === 1);
        assert.deepStrictEqual(devices.received[0].payload, {
            unitId: 'unit-1',
            deviceId: 'em-1',
            familyId: 'energy-managements',
            roomId: 'room-1',
            authorName: 'Node-RED',
            command: 'stop'
        });
    });

    it('emits the state sent by the headunit', async function () {
        await loadReady({ initialState: false });
        const msgs = collect();
        // Il comando viene filtrato in modalità feedback, escono stato e badge
        devices.emitUpdate({ deviceId: 'em-1', command: 'stop', status: 'stop', overloadBadge: null }, FAMILY_ID);
        await waitFor(() => msgs.length === 2);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.deepStrictEqual(msgs.map((m) => [m.topic, m.payload, m.origin]), [
            ['status', 'stop', 'UNIT'],
            ['overloadBadge', null, 'UNIT']
        ]);
    });
});
