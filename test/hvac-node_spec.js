'use strict';

const assert = require('assert');
const helper = require('node-red-node-test-helper');
const headunitNode = require('../nodes/lilitech-headunit.js');
const hvacNode = require('../nodes/lilitech-hvac.js');
const { startFakeTube, startFakeDevices } = require('./fake-tube');

helper.init(require.resolve('node-red'));

const FAMILY_ID = 'hvac';
const DEVICE = {
    deviceId: 'hvac-1',
    name: 'Living conditioner',
    typeId: 'conditioner',
    roomId: 'room-1',
    switch: true,
    switchFeedback: true,
    setpointTemperature: 21,
    setpointTemperatureFeedback: 21,
    roomTemperature: 19.5
};

describe('lilitech-hvac node', function () {
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
            { id: 'h1', type: 'lilitech-hvac', headunit: 'hu', deviceId: 'hvac-1', initialState: true, wires: [['out']], ...extra },
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
        await helper.load([headunitNode, hvacNode], flow(extra));
        const h1 = helper.getNode('h1');
        await waitFor(() => h1.headunit.client.getDevice(FAMILY_ID, 'hvac-1'));
        return h1;
    }

    it('emits the feedback with the initial state', async function () {
        await helper.load([headunitNode, hvacNode], flow());
        const msgs = collect();
        await waitFor(() => msgs.length >= 3);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.deepStrictEqual(msgs.map((m) => [m.topic, m.payload, m.unit, m.origin]), [
            ['switchFeedback', true, undefined, 'INITIAL'],
            ['setpointTemperatureFeedback', 21, '°C', 'INITIAL'],
            ['roomTemperature', 19.5, '°C', 'INITIAL']
        ]);
        assert.strictEqual(msgs[0].device.name, 'Living conditioner');
    });

    it('writes the setpoint on the tube', async function () {
        const h1 = await loadReady({ initialState: false });
        h1.receive({ payload: 22.5 });
        await waitFor(() => devices.received.length === 1);
        assert.deepStrictEqual(devices.received[0].payload, {
            unitId: 'unit-1',
            deviceId: 'hvac-1',
            familyId: 'hvac',
            roomId: 'room-1',
            authorName: 'Node-RED',
            setpointTemperature: 22.5
        });
    });

    it('emits the state sent by the headunit', async function () {
        await loadReady({ initialState: false });
        const msgs = collect();
        // Il comando viene filtrato in modalità feedback, escono feedback e stato del termostato
        devices.emitUpdate({ deviceId: 'hvac-1', setpointTemperature: 23, setpointTemperatureFeedback: 23, thermoStatus: 'heat' }, FAMILY_ID);
        await waitFor(() => msgs.length === 2);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.deepStrictEqual(msgs.map((m) => [m.topic, m.payload, m.origin]), [
            ['setpointTemperatureFeedback', 23, 'UNIT'],
            ['thermoStatus', 'heat', 'UNIT']
        ]);
    });
});
