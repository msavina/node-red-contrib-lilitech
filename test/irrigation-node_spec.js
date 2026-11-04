'use strict';

const assert = require('assert');
const helper = require('node-red-node-test-helper');
const headunitNode = require('../nodes/lilitech-headunit.js');
const irrigationNode = require('../nodes/lilitech-irrigation.js');
const { startFakeTube, startFakeDevices } = require('./fake-tube');

helper.init(require.resolve('node-red'));

const FAMILY_ID = 'irrigations';
const PROGRAMS_RUN = JSON.stringify({ windy: false, rainy: false, override: 100, programs: [{ programId: 1, name: 'Garden', status: 'stop' }] });
const DEVICE = {
    deviceId: 'irr-1',
    name: 'Garden irrigation',
    typeId: 'simpleIrrigation',
    roomId: 'room-1',
    command: 'play',
    status: 'play',
    programsRun: PROGRAMS_RUN
};

describe('lilitech-irrigation node', function () {
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
            { id: 'i1', type: 'lilitech-irrigation', headunit: 'hu', deviceId: 'irr-1', initialState: true, wires: [['out']], ...extra },
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
        await helper.load([headunitNode, irrigationNode], flow(extra));
        const i1 = helper.getNode('i1');
        await waitFor(() => i1.headunit.client.getDevice(FAMILY_ID, 'irr-1'));
        return i1;
    }

    it('emits the feedback with the initial state', async function () {
        await helper.load([headunitNode, irrigationNode], flow());
        const msgs = collect();
        await waitFor(() => msgs.length >= 2);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.deepStrictEqual(msgs.map((m) => [m.topic, m.origin]), [
            ['status', 'INITIAL'],
            ['programsRun', 'INITIAL']
        ]);
        assert.strictEqual(msgs[1].payload.programs[0].name, 'Garden');
    });

    it('writes the program command on the tube', async function () {
        const i1 = await loadReady({ initialState: false });
        i1.receive({ program: 'Garden', payload: 'play' });
        await waitFor(() => devices.received.length === 1);
        assert.deepStrictEqual(devices.received[0].payload, {
            unitId: 'unit-1',
            deviceId: 'irr-1',
            familyId: 'irrigations',
            roomId: 'room-1',
            authorName: 'Node-RED',
            programsCmd: '{"programId":1,"cmd":"play"}'
        });
    });

    it('emits the programs only when they change', async function () {
        await loadReady({ initialState: false });
        const msgs = collect();
        // Il cron dell'headunit ritrasmette i programmi uguali: non devono uscire
        devices.emitUpdate({ deviceId: 'irr-1', programsRun: PROGRAMS_RUN }, FAMILY_ID);
        const changed = JSON.stringify({ windy: false, rainy: false, override: 100, programs: [{ programId: 1, name: 'Garden', status: 'play' }] });
        devices.emitUpdate({ deviceId: 'irr-1', programsRun: changed, programRunning: true }, FAMILY_ID);
        await waitFor(() => msgs.length === 2);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.deepStrictEqual(msgs.map((m) => [m.topic, m.origin]), [
            ['programsRun', 'UNIT'],
            ['programRunning', 'UNIT']
        ]);
        assert.strictEqual(msgs[0].payload.programs[0].status, 'play');
    });
});
