'use strict';

const assert = require('assert');
const helper = require('node-red-node-test-helper');
const headunitNode = require('../nodes/lilitech-headunit.js');
const securityAreaNode = require('../nodes/lilitech-security-area.js');
const { startFakeTube, startFakeDevices } = require('./fake-tube');

helper.init(require.resolve('node-red'));

const FAMILY_ID = 'security-areas';
const AREA = {
    deviceId: 'area-1',
    name: 'Ground floor',
    typeId: 'securityAreasInternalLogic',
    roomId: 'room-1',
    patrolable: true,
    areaStatus: 'disarmed',
    areaControl: 'disarm',
    memory: false
};

describe('lilitech-security-area node', function () {
    let tube;
    let devices;

    beforeEach(async function () {
        tube = await startFakeTube();
        devices = await startFakeDevices(tube.url, { [FAMILY_ID]: [{ ...AREA }] });
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
            { id: 'a1', type: 'lilitech-security-area', headunit: 'hu', deviceId: 'area-1', initialState: true, wires: [['out']], ...extra },
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

    it('emits the initial state without the command', async function () {
        await helper.load([headunitNode, securityAreaNode], flow());
        const msgs = collect();
        await waitFor(() => msgs.length >= 2);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.deepStrictEqual(
            msgs.map((m) => [m.topic, m.payload]),
            [
                ['areaStatus', 'disarmed'],
                ['memory', false]
            ]
        );
    });

    it('writes the command on the tube', async function () {
        await helper.load([headunitNode, securityAreaNode], flow({ initialState: false }));
        const a1 = helper.getNode('a1');
        await waitFor(() => a1.headunit.client.getDevice(FAMILY_ID, 'area-1'));
        a1.receive({ payload: 'arm' });
        await waitFor(() => devices.received.length === 1);
        const payload = devices.received[0].payload;
        assert.strictEqual(payload.familyId, FAMILY_ID);
        assert.strictEqual(payload.areaControl, 'arm');
        assert.strictEqual(payload.authorName, 'Node-RED');
    });

    it('reports an error for an invalid command', async function () {
        await helper.load([headunitNode, securityAreaNode], flow({ initialState: false }));
        const a1 = helper.getNode('a1');
        await waitFor(() => a1.headunit.client.getDevice(FAMILY_ID, 'area-1'));
        const errors = [];
        a1.on('call:error', (call) => errors.push(call.args[0]));
        a1.receive({ payload: 'ready' });
        await waitFor(() => errors.length === 1);
        assert.match(String(errors[0]), /Invalid command/);
        assert.strictEqual(devices.received.length, 0);
    });

    it('emits the state sent by the headunit', async function () {
        await helper.load([headunitNode, securityAreaNode], flow({ initialState: false }));
        const a1 = helper.getNode('a1');
        await waitFor(() => a1.headunit.client.getDevice(FAMILY_ID, 'area-1'));
        const msgs = collect();
        devices.emitUpdate({ deviceId: 'area-1', areaStatus: 'alarm', memory: true, history: ['Window'] }, FAMILY_ID);
        await waitFor(() => msgs.length === 3);
        assert.deepStrictEqual(msgs[2].payload, ['Window']);
        assert.strictEqual(msgs[0].origin, 'UNIT');
    });
});
