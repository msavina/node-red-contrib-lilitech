'use strict';

const assert = require('assert');
const helper = require('node-red-node-test-helper');
const headunitNode = require('../nodes/lilitech-headunit.js');
const scenarioNode = require('../nodes/lilitech-scenario.js');
const { startFakeTube, startFakeScenarios } = require('./fake-tube');

helper.init(require.resolve('node-red'));

const SCENARIO = {
    unitId: 'unit-1',
    scenarioId: 'sc-1',
    name: 'Good night',
    roomId: 'room-1',
    status: 'stop',
    enable: true,
    manualControl: true,
    timeRun: '2026-11-04T21:30:00.000Z',
    timeEnd: '2026-11-04T21:31:00.000Z'
};

describe('lilitech-scenario node', function () {
    let tube;
    let scenarios;

    beforeEach(async function () {
        tube = await startFakeTube();
        scenarios = await startFakeScenarios(tube.url, [{ ...SCENARIO }]);
        await new Promise((resolve) => helper.startServer(resolve));
    });

    afterEach(async function () {
        await helper.unload();
        await new Promise((resolve) => helper.stopServer(resolve));
        scenarios.close();
        await tube.close();
    });

    /*------------------------------------------------------------------------------------------------------------------
    ------------------------------------------------------------------------------------------------------------------*/
    function flow(extra = {}) {
        return [
            { id: 'hu', type: 'lilitech-headunit', url: tube.url },
            { id: 's1', type: 'lilitech-scenario', headunit: 'hu', scenarioId: 'sc-1', initialState: true, wires: [['out']], ...extra },
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
        await helper.load([headunitNode, scenarioNode], flow(extra));
        const s1 = helper.getNode('s1');
        await waitFor(() => s1.headunit.client.getScenario('sc-1'));
        return s1;
    }

    it('emits the initial state with the last execution', async function () {
        await helper.load([headunitNode, scenarioNode], flow());
        const msgs = collect();
        await waitFor(() => msgs.length === 1);
        assert.deepStrictEqual(
            [msgs[0].topic, msgs[0].payload, msgs[0].running, msgs[0].lastRun, msgs[0].origin, msgs[0].scenario.name],
            ['status', 'stop', false, Date.parse(SCENARIO.timeRun), 'INITIAL', 'Good night']
        );
    });

    it('sends play and stop like the app', async function () {
        const s1 = await loadReady({ initialState: false });
        s1.receive({ payload: 'play' });
        await waitFor(() => scenarios.received.length === 1);
        assert.deepStrictEqual(scenarios.received[0].payload, {
            unitId: 'unit-1',
            scenarioId: 'sc-1',
            roomId: 'room-1',
            authorName: 'Node-RED',
            command: 'play'
        });
    });

    it('emits the state only when it changes', async function () {
        await loadReady({ initialState: false });
        const msgs = collect();
        scenarios.emitUpdate({ scenarioId: 'sc-1', roomId: 'room-1', status: 'run', timeRun: '2026-11-05T09:15:00.000Z' });
        scenarios.emitUpdate({ scenarioId: 'sc-1', name: 'Good night!' });
        scenarios.emitUpdate({ scenarioId: 'sc-1', roomId: 'room-1', status: 'stop', timeEnd: '2026-11-05T09:16:00.000Z' });
        await waitFor(() => msgs.length === 2);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.deepStrictEqual(
            msgs.map((m) => [m.payload, m.lastRun, m.origin]),
            [
                ['run', Date.parse('2026-11-05T09:15:00.000Z'), 'UNIT'],
                ['stop', Date.parse('2026-11-05T09:15:00.000Z'), 'UNIT']
            ]
        );
        assert.strictEqual(msgs[1].lastEnd, Date.parse('2026-11-05T09:16:00.000Z'));
        assert.strictEqual(msgs[1].scenario.name, 'Good night!');
    });

    it('emits the commands of the app and of other nodes only with feedback and commands', async function () {
        await helper.load(
            [headunitNode, scenarioNode],
            [
                { id: 'hu', type: 'lilitech-headunit', url: tube.url },
                { id: 's1', type: 'lilitech-scenario', headunit: 'hu', scenarioId: 'sc-1', initialState: false, outputMode: 'all', wires: [['out']] },
                { id: 's2', type: 'lilitech-scenario', headunit: 'hu', scenarioId: 'sc-1', initialState: false, wires: [['out2']] },
                { id: 'out', type: 'helper' },
                { id: 'out2', type: 'helper' }
            ]
        );
        const s2 = helper.getNode('s2');
        await waitFor(() => s2.headunit.client.getScenario('sc-1'));
        const msgs = collect();
        const feedbackOnly = [];
        helper.getNode('out2').on('input', (msg) => feedbackOnly.push(msg));
        scenarios.emitUpdate({ scenarioId: 'sc-1', roomId: 'room-1', command: 'stop' });
        await waitFor(() => msgs.length === 1);
        s2.receive({ payload: 'play' });
        await waitFor(() => msgs.length === 2);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.deepStrictEqual(
            msgs.map((m) => [m.topic, m.payload, m.origin]),
            [
                ['command', 'stop', 'UNIT'],
                ['command', 'play', 'NODE-RED']
            ]
        );
        assert.strictEqual(feedbackOnly.length, 0);
    });
});
