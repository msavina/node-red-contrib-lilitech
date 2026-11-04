'use strict';

const assert = require('assert');
const simulators = require('../lib/families/simulators');

describe('simulators family', function () {
    const programsRun = JSON.stringify({
        programs: [
            { programId: 1, name: 'Evening', status: 'stop' },
            { programId: 2, name: 'Night', status: 'play' }
        ]
    });
    const simulator = { typeId: 'presenceSimulator', status: 'play', programsRun };

    it('starts and stops the simulation', function () {
        assert.deepStrictEqual(simulators.parseInput({ payload: 'play' }, { ...simulator, status: 'stop' }), { command: 'play' });
        assert.deepStrictEqual(simulators.parseInput({ payload: false }, simulator), { command: 'stop' });
        assert.deepStrictEqual(simulators.parseInput({ payload: 'toggle' }, simulator), { command: 'stop' });
        assert.throws(() => simulators.parseInput({ payload: 'pause' }, simulator), /allowed: play, stop, toggle/);
        assert.throws(() => simulators.parseInput({ topic: 'comand', payload: 'x' }, simulator), /msg.topic "comand" is not a known item/);
    });

    it('commands a program by name or id like the app', function () {
        assert.deepStrictEqual(simulators.parseInput({ program: 'evening', payload: 'play' }, simulator), {
            programsCmd: '{"programId":1,"cmd":"play"}'
        });
        assert.deepStrictEqual(simulators.parseInput({ payload: { programId: 2, cmd: 'toggle' } }, simulator), {
            programsCmd: '{"programId":2,"cmd":"stop"}'
        });
        // L'headunit non gestisce la pausa dei programmi della simulazione
        assert.throws(() => simulators.parseInput({ program: 1, payload: 'pause' }, simulator), /Invalid command "pause" for a program/);
        assert.throws(() => simulators.parseInput({ program: 'Morning', payload: 'play' }, simulator), /Program "Morning" not found \(programs: 1 "Evening", 2 "Night"\)/);
        assert.throws(() => simulators.parseInput({ topic: 'programsCmd', payload: 'play' }, simulator), /Missing program/);
        assert.throws(() => simulators.parseInput({ program: 1, payload: 'play' }, { ...simulator, status: 'stop' }), /simulator is stopped/);
    });

    it('exposes and decodes the items', function () {
        assert.deepStrictEqual(simulators.readableItems(simulator), ['command', 'programsCmd', 'status', 'programRunning', 'programStartAt', 'programsRun']);
        assert.deepStrictEqual(simulators.readableItems({ typeId: 'other' }), []);
        assert.strictEqual(simulators.outputValue('programsRun', programsRun).programs[1].name, 'Night');
        assert.strictEqual(simulators.isOutputItem('command', { outputMode: 'feedback' }), false);
        assert.strictEqual(simulators.isOutputItem('status', { outputMode: 'feedback' }), true);
        assert.throws(() => simulators.parseInput({ payload: 'play' }, { typeId: 'other' }), /Unsupported simulator type/);
    });

    it('shows the running programs and the next start', function () {
        assert.deepStrictEqual(simulators.status(simulator), { fill: 'green', shape: 'dot', text: 'Simulating · Night' });
        assert.strictEqual(simulators.status({ ...simulator, status: 'stop' }).text, 'Stopped');
        const start = new Date(2026, 10, 5, 20, 0);
        const idle = { ...simulator, programsRun: JSON.stringify({ programs: [{ programId: 1, name: 'Evening', status: 'stop' }] }) };
        assert.strictEqual(simulators.status({ ...idle, programStartAt: start.toISOString() }).text, 'Ready · Next 05/11 20:00');
        assert.strictEqual(simulators.status({ typeId: 'other' }).text, 'Unknown Type other');
    });
});
