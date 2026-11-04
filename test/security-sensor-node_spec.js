'use strict';

const assert = require('assert');
const helper = require('node-red-node-test-helper');
const headunitNode = require('../nodes/lilitech-headunit.js');
const securitySensorNode = require('../nodes/lilitech-security-sensor.js');
const { startFakeTube, startFakeDevices } = require('./fake-tube');

helper.init(require.resolve('node-red'));

const FAMILY_ID = 'security-sensors';
const DEVICE = {
    deviceId: 'sens-1',
    name: 'Front door contact',
    typeId: 'magneticContact',
    roomId: 'room-1',
    input: false,
    armed: true,
    testing: false,
    maintenance: false
};

describe('lilitech-security-sensor node', function () {
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
            { id: 's1', type: 'lilitech-security-sensor', headunit: 'hu', deviceId: 'sens-1', initialState: true, wires: [['out']], ...extra },
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
        await helper.load([headunitNode, securitySensorNode], flow(extra));
        const s1 = helper.getNode('s1');
        await waitFor(() => s1.headunit.client.getDevice(FAMILY_ID, 'sens-1'));
        return s1;
    }

    it('emits the state with the initial state', async function () {
        await helper.load([headunitNode, securitySensorNode], flow());
        const msgs = collect();
        await waitFor(() => msgs.length >= 4);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.deepStrictEqual(msgs.map((m) => [m.topic, m.payload, m.origin]), [
            ['input', false, 'INITIAL'],
            ['armed', true, 'INITIAL'],
            ['testing', false, 'INITIAL'],
            ['maintenance', false, 'INITIAL']
        ]);
        assert.strictEqual(msgs[0].device.name, 'Front door contact');
    });

    it('writes the maintenance on the tube', async function () {
        const s1 = await loadReady({ initialState: false });
        s1.receive({ topic: 'maintenance', payload: true });
        await waitFor(() => devices.received.length === 1);
        assert.deepStrictEqual(devices.received[0].payload, {
            unitId: 'unit-1',
            deviceId: 'sens-1',
            familyId: 'security-sensors',
            roomId: 'room-1',
            authorName: 'Node-RED',
            maintenance: true
        });
    });

    it('emits every alarm sent by the headunit', async function () {
        await loadReady({ initialState: false });
        const msgs = collect();
        // 'trigger' resta true: ogni nuovo allarme deve comunque uscire
        devices.emitUpdate({ deviceId: 'sens-1', input: true, trigger: true }, FAMILY_ID);
        devices.emitUpdate({ deviceId: 'sens-1', trigger: true }, FAMILY_ID);
        await waitFor(() => msgs.length === 3);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.deepStrictEqual(msgs.map((m) => [m.topic, m.payload, m.origin]), [
            ['input', true, 'UNIT'],
            ['trigger', true, 'UNIT'],
            ['trigger', true, 'UNIT']
        ]);
    });
});
