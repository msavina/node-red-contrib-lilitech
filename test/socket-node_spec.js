'use strict';

const assert = require('assert');
const helper = require('node-red-node-test-helper');
const headunitNode = require('../nodes/lilitech-headunit.js');
const socketNode = require('../nodes/lilitech-socket.js');
const { startFakeTube, startFakeDevices } = require('./fake-tube');

helper.init(require.resolve('node-red'));

const FAMILY_ID = 'sockets';
const DEVICE = {
    deviceId: 'sock-1',
    name: 'Kitchen socket',
    typeId: 'measurable',
    roomId: 'room-1',
    switch: false,
    switchFeedback: false,
    overload: false,
    energyInfo: true,
    energyRelative: 1500
};

describe('lilitech-socket node', function () {
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
            { id: 's1', type: 'lilitech-socket', headunit: 'hu', deviceId: 'sock-1', initialState: true, wires: [['out']], ...extra },
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
        await helper.load([headunitNode, socketNode], flow(extra));
        const s1 = helper.getNode('s1');
        await waitFor(() => s1.headunit.client.getDevice(FAMILY_ID, 'sock-1'));
        return s1;
    }

    it('emits the feedback with the initial state', async function () {
        await helper.load([headunitNode, socketNode], flow());
        const msgs = collect();
        await waitFor(() => msgs.length >= 3);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.deepStrictEqual(msgs.map((m) => [m.topic, m.payload, m.unit, m.origin]), [
            ['switchFeedback', false, undefined, 'INITIAL'],
            ['overload', false, undefined, 'INITIAL'],
            ['energyRelative', 1500, 'Wh', 'INITIAL']
        ]);
        assert.strictEqual(msgs[0].device.name, 'Kitchen socket');
    });

    it('writes the energy reset on the tube', async function () {
        const s1 = await loadReady({ initialState: false });
        s1.receive({ topic: 'restoreEnergy', payload: true });
        await waitFor(() => devices.received.length === 1);
        assert.deepStrictEqual(devices.received[0].payload, {
            unitId: 'unit-1',
            deviceId: 'sock-1',
            familyId: 'sockets',
            roomId: 'room-1',
            authorName: 'Node-RED',
            restoreEnergy: true
        });
    });

    it('emits the state sent by the headunit', async function () {
        await loadReady({ initialState: false });
        const msgs = collect();
        // Lo switch viene filtrato in modalità feedback, escono feedback ed energia azzerata
        devices.emitUpdate({ deviceId: 'sock-1', switch: true, switchFeedback: true, energyRelative: 0 }, FAMILY_ID);
        await waitFor(() => msgs.length === 2);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.deepStrictEqual(msgs.map((m) => [m.topic, m.payload, m.origin]), [
            ['switchFeedback', true, 'UNIT'],
            ['energyRelative', 0, 'UNIT']
        ]);
    });
});
