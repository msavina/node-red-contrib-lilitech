'use strict';

const assert = require('assert');
const helper = require('node-red-node-test-helper');
const headunitNode = require('../nodes/lilitech-headunit.js');
const meteringSensorNode = require('../nodes/lilitech-metering-sensor.js');
const { startFakeTube, startFakeDevices } = require('./fake-tube');

helper.init(require.resolve('node-red'));

const FAMILY_ID = 'metering-sensors';
const DEVICE = {
    deviceId: 'meter-1',
    name: 'House meter',
    typeId: 'singlePhaseEnergyMeter',
    roomId: 'room-1',
    activePowerInfo: true,
    activeEnergyAbsoluteLaValue: 345600,
    activeEnergyRelativeLaValue: 1200,
    activePowerLaValue: 1250
};

describe('lilitech-metering-sensor node', function () {
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
            { id: 'm1', type: 'lilitech-metering-sensor', headunit: 'hu', deviceId: 'meter-1', initialState: true, wires: [['out']], ...extra },
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
        await helper.load([headunitNode, meteringSensorNode], flow(extra));
        const m1 = helper.getNode('m1');
        await waitFor(() => m1.headunit.client.getDevice(FAMILY_ID, 'meter-1'));
        return m1;
    }

    it('emits the measures with the initial state', async function () {
        await helper.load([headunitNode, meteringSensorNode], flow());
        const msgs = collect();
        await waitFor(() => msgs.length >= 3);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.deepStrictEqual(msgs.map((m) => [m.topic, m.payload, m.unit, m.origin]), [
            ['activeEnergyAbsoluteLaValue', 345600, 'Wh', 'INITIAL'],
            ['activeEnergyRelativeLaValue', 1200, 'Wh', 'INITIAL'],
            ['activePowerLaValue', 1250, 'W', 'INITIAL']
        ]);
        assert.strictEqual(msgs[0].device.name, 'House meter');
    });

    it('writes the energy reset on the tube', async function () {
        const m1 = await loadReady({ initialState: false });
        m1.receive({ topic: 'activeEnergyRelativeLaReset', payload: true });
        await waitFor(() => devices.received.length === 1);
        assert.deepStrictEqual(devices.received[0].payload, {
            unitId: 'unit-1',
            deviceId: 'meter-1',
            familyId: 'metering-sensors',
            roomId: 'room-1',
            authorName: 'Node-RED',
            activeEnergyRelativeLaReset: true
        });
    });

    it('emits the measures sent by the headunit', async function () {
        await loadReady({ initialState: false });
        const msgs = collect();
        devices.emitUpdate({ deviceId: 'meter-1', activePowerLaValue: 980.0000305175781, activeEnergyRelativeLaValue: 0 }, FAMILY_ID);
        await waitFor(() => msgs.length === 2);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.deepStrictEqual(msgs.map((m) => [m.topic, m.payload, m.origin]), [
            ['activePowerLaValue', 980, 'UNIT'],
            ['activeEnergyRelativeLaValue', 0, 'UNIT']
        ]);
    });
});
