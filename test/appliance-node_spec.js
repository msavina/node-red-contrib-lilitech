'use strict';

const assert = require('assert');
const helper = require('node-red-node-test-helper');
const headunitNode = require('../nodes/lilitech-headunit.js');
const applianceNode = require('../nodes/lilitech-appliance.js');
const { startFakeTube, startFakeDevices } = require('./fake-tube');

helper.init(require.resolve('node-red'));

const FAMILY_ID = 'appliances';
const DEVICE = {
    deviceId: 'app-1',
    name: 'Dishwasher',
    typeId: 'dishwasher',
    roomId: 'room-1',
    switch: false,
    switchFeedback: false,
    overload: false,
    powerInfo: true,
    power: 0
};

describe('lilitech-appliance node', function () {
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
            { id: 'a1', type: 'lilitech-appliance', headunit: 'hu', deviceId: 'app-1', initialState: true, wires: [['out']], ...extra },
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
        await helper.load([headunitNode, applianceNode], flow(extra));
        const a1 = helper.getNode('a1');
        await waitFor(() => a1.headunit.client.getDevice(FAMILY_ID, 'app-1'));
        return a1;
    }

    it('emits the feedback with the initial state', async function () {
        await helper.load([headunitNode, applianceNode], flow());
        const msgs = collect();
        await waitFor(() => msgs.length >= 3);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.deepStrictEqual(msgs.map((m) => [m.topic, m.payload, m.unit, m.origin]), [
            ['switchFeedback', false, undefined, 'INITIAL'],
            ['overload', false, undefined, 'INITIAL'],
            ['power', 0, 'W', 'INITIAL']
        ]);
        assert.strictEqual(msgs[0].device.name, 'Dishwasher');
    });

    it('writes the switch on the tube', async function () {
        const a1 = await loadReady({ initialState: false });
        a1.receive({ payload: 'toggle' });
        await waitFor(() => devices.received.length === 1);
        assert.deepStrictEqual(devices.received[0].payload, {
            unitId: 'unit-1',
            deviceId: 'app-1',
            familyId: 'appliances',
            roomId: 'room-1',
            authorName: 'Node-RED',
            switch: true
        });
    });

    it('emits the state sent by the headunit', async function () {
        await loadReady({ initialState: false });
        const msgs = collect();
        // Lo switch viene filtrato in modalità feedback, escono feedback e potenza
        devices.emitUpdate({ deviceId: 'app-1', switch: true, switchFeedback: true, power: 1850 }, FAMILY_ID);
        await waitFor(() => msgs.length === 2);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.deepStrictEqual(msgs.map((m) => [m.topic, m.payload, m.unit, m.origin]), [
            ['switchFeedback', true, undefined, 'UNIT'],
            ['power', 1850, 'W', 'UNIT']
        ]);
    });
});
