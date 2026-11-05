'use strict';

const assert = require('assert');
const scenarios = require('../lib/scenarios');

describe('scenarios', function () {
    const stopped = { scenarioId: 'sc-1', name: 'Good night', roomId: 'room-1', status: 'stop', enable: true, manualControl: true };

    it('parses play, stop and toggle like the app buttons', function () {
        assert.strictEqual(scenarios.parseCommand({ payload: 'play' }, stopped), 'play');
        assert.strictEqual(scenarios.parseCommand({ payload: true }, stopped), 'play');
        assert.strictEqual(scenarios.parseCommand({ payload: 'OFF' }, stopped), 'stop');
        assert.strictEqual(scenarios.parseCommand({ payload: 'toggle' }, stopped), 'play');
        assert.strictEqual(scenarios.parseCommand({ topic: 'command', payload: 'toggle' }, { ...stopped, status: 'run' }), 'stop');
    });

    it('rejects invalid commands and starting a disabled scenario', function () {
        assert.throws(() => scenarios.parseCommand({ payload: 'pause' }, stopped), /Invalid command "pause" \(allowed: play, stop, toggle\)/);
        assert.throws(() => scenarios.parseCommand({ topic: 'status', payload: 'play' }, stopped), /msg.topic "status" is not valid/);
        assert.throws(() => scenarios.parseCommand({ payload: 'play' }, { ...stopped, enable: false }), /Scenario "Good night" is disabled in the app/);
        assert.strictEqual(scenarios.parseCommand({ payload: 'stop' }, { ...stopped, enable: false }), 'stop');
    });

    it('accepts play only with the manual control enabled in the app', function () {
        assert.throws(() => scenarios.parseCommand({ payload: 'play' }, { ...stopped, manualControl: false }), /has no manual control/);
        assert.throws(() => scenarios.parseCommand({ payload: 'toggle' }, { ...stopped, manualControl: undefined }), /has no manual control/);
        assert.strictEqual(scenarios.parseCommand({ payload: 'stop' }, { ...stopped, status: 'run', manualControl: false }), 'stop');
    });

    it('builds the status message with the last execution', function () {
        const message = scenarios.statusMessage({ ...stopped, status: 'run', timeRun: '2026-11-05T09:15:00.000Z' }, 'UNIT');
        assert.deepStrictEqual(message, {
            topic: 'status',
            payload: 'run',
            running: true,
            lastRun: Date.parse('2026-11-05T09:15:00.000Z'),
            lastEnd: null,
            enable: true,
            inhibited: false,
            origin: 'UNIT',
            scenario: { scenarioId: 'sc-1', name: 'Good night', roomId: 'room-1' }
        });
        assert.strictEqual(scenarios.statusMessage({ scenarioId: 'sc-2' }, 'INITIAL').payload, 'stop');
    });

    it('shows the state and the last run in the node status', function () {
        const now = new Date(2026, 10, 5, 12, 0);
        const today = new Date(2026, 10, 5, 10, 15).toISOString();
        const before = new Date(2026, 10, 4, 22, 30).toISOString();
        assert.deepStrictEqual(scenarios.status({ ...stopped, status: 'run', timeRun: today }, now), {
            fill: 'green',
            shape: 'dot',
            text: 'Running · since 10:15'
        });
        assert.strictEqual(scenarios.status({ ...stopped, timeRun: before }, now).text, 'Stopped · Last run 04/11 22:30');
        assert.strictEqual(scenarios.status(stopped, now).text, 'Stopped · Never run');
        assert.deepStrictEqual(scenarios.status({ ...stopped, enable: false }, now), { fill: 'grey', shape: 'ring', text: 'Disabled · Never run' });
        assert.deepStrictEqual(scenarios.status({ ...stopped, inhibited: true, timeRun: before }, now), {
            fill: 'yellow',
            shape: 'dot',
            text: 'Stopped · Last run 04/11 22:30 · Inhibited'
        });
        assert.strictEqual(scenarios.status({ ...stopped, inhibited: true, status: 'run', timeRun: today }, now).text, 'Running · since 10:15 · Inhibited');
        assert.strictEqual(scenarios.statusMessage({ ...stopped, inhibited: true }, 'UNIT').inhibited, true);
    });
});
