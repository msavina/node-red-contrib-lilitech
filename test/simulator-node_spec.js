'use strict';

const assert = require('assert');
const helper = require('node-red-node-test-helper');
const headunitNode = require('../nodes/lilitech-headunit.js');
const simulatorNode = require('../nodes/lilitech-simulator.js');
const { startFakeTube, startFakeDevices } = require('./fake-tube');

helper.init(require.resolve('node-red'));

const FAMILY_ID = 'simulators';
const PROGRAMS_RUN = JSON.stringify({ programs: [{ programId: 1, name: 'Evening', status: 'stop' }] });
const DEVICE = {
    deviceId: 'sim-1',
    name: 'Holiday simulation',
    typeId: 'presenceSimulator',
    roomId: 'room-1',
    command: 'play',
    status: 'play',
    programsRun: PROGRAMS_RUN
};

describe('lilitech-simulator node', function () {
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
            { id: 's1', type: 'lilitech-simulator', headunit: 'hu', deviceId: 'sim-1', initialState: true, wires: [['out']], ...extra },
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
        await helper.load([headunitNode, simulatorNode], flow(extra));
        const s1 = helper.getNode('s1');
        await waitFor(() => s1.headunit.client.getDevice(FAMILY_ID, 'sim-1'));
        return s1;
    }

    it('emits the feedback with the initial state', async function () {
        await helper.load([headunitNode, simulatorNode], flow());
        const msgs = collect();
        await waitFor(() => msgs.length >= 2);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.deepStrictEqual(msgs.map((m) => [m.topic, m.origin]), [
            ['status', 'INITIAL'],
            ['programsRun', 'INITIAL']
        ]);
        assert.strictEqual(msgs[1].payload.programs[0].name, 'Evening');
    });

    it('writes the program command on the tube', async function () {
        const s1 = await loadReady({ initialState: false });
        s1.receive({ program: 'Evening', payload: 'play' });
        await waitFor(() => devices.received.length === 1);
        assert.deepStrictEqual(devices.received[0].payload, {
            unitId: 'unit-1',
            deviceId: 'sim-1',
            familyId: 'simulators',
            roomId: 'room-1',
            authorName: 'Node-RED',
            programsCmd: '{"programId":1,"cmd":"play"}'
        });
    });

    it('emits the programs only when they change', async function () {
        await loadReady({ initialState: false });
        const msgs = collect();
        // Il cron dell'headunit ritrasmette i programmi uguali: non devono uscire
        devices.emitUpdate({ deviceId: 'sim-1', programsRun: PROGRAMS_RUN }, FAMILY_ID);
        const changed = JSON.stringify({ programs: [{ programId: 1, name: 'Evening', status: 'play' }] });
        devices.emitUpdate({ deviceId: 'sim-1', programsRun: changed, programRunning: true }, FAMILY_ID);
        await waitFor(() => msgs.length === 2);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.deepStrictEqual(msgs.map((m) => [m.topic, m.origin]), [
            ['programsRun', 'UNIT'],
            ['programRunning', 'UNIT']
        ]);
        assert.strictEqual(msgs[0].payload.programs[0].status, 'play');
    });
});
