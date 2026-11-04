'use strict';

const assert = require('assert');
const irrigations = require('../lib/families/irrigations');

describe('irrigations family', function () {
    const programsRun = JSON.stringify({
        windy: false,
        rainy: false,
        override: 100,
        programs: [
            { programId: 1, name: 'Garden', status: 'stop' },
            { programId: 2, name: 'Hedge', status: 'play' }
        ]
    });
    const stopped = { typeId: 'smartIrrigation', status: 'stop', programsRun };
    const running = { ...stopped, status: 'play' };

    it('parses the controller command', function () {
        assert.deepStrictEqual(irrigations.parseInput({ payload: 'Play' }, stopped), { command: 'play' });
        assert.deepStrictEqual(irrigations.parseInput({ payload: false }, running), { command: 'stop' });
        assert.deepStrictEqual(irrigations.parseInput({ payload: 'toggle' }, running), { command: 'stop' });
        assert.throws(() => irrigations.parseInput({ payload: 'pause' }, running), /cannot be paused/);
        assert.throws(() => irrigations.parseInput({ payload: 'go' }, running), /Invalid command/);
    });

    it('commands a program by id or name', function () {
        assert.deepStrictEqual(irrigations.parseInput({ program: 1, payload: 'play' }, running), {
            programsCmd: '{"programId":1,"cmd":"play"}'
        });
        assert.deepStrictEqual(irrigations.parseInput({ program: 'hedge', payload: 'toggle' }, running), {
            programsCmd: '{"programId":2,"cmd":"pause"}'
        });
        assert.deepStrictEqual(irrigations.parseInput({ payload: { name: 'Garden', cmd: 'stop' } }, running), {
            programsCmd: '{"programId":1,"cmd":"stop"}'
        });
        assert.deepStrictEqual(irrigations.parseInput({ topic: 'programsCmd', payload: { programId: '2', cmd: false } }, running), {
            programsCmd: '{"programId":2,"cmd":"stop"}'
        });
    });

    it('rejects program commands that the headunit would ignore', function () {
        assert.throws(() => irrigations.parseInput({ program: 1, payload: 'play' }, stopped), /irrigation is stopped/);
        assert.throws(() => irrigations.parseInput({ program: 7, payload: 'play' }, running), /Program 7 not found/);
        assert.throws(() => irrigations.parseInput({ program: 'Lawn', payload: 'play' }, running), /Program "Lawn" not found/);
        assert.throws(() => irrigations.parseInput({ program: 1, payload: 'skip' }, running), /Invalid program command/);
        assert.throws(() => irrigations.parseInput({ topic: 'programsCmd', payload: 'play' }, running), /Missing program/);
    });

    it('rejects unknown types, read only items and points out an unknown topic', function () {
        assert.throws(() => irrigations.parseInput({ payload: 'play' }, { typeId: 'other' }), /Unsupported irrigation type/);
        assert.throws(() => irrigations.parseInput({ payload: { rainy: true } }, running), /not writable/);
        assert.throws(() => irrigations.parseInput({ topic: 'comand', payload: 'go' }, running), /msg.topic "comand" is not a known item/);
    });

    it('exposes the items, decodes the programs and filters the commands', function () {
        assert.deepStrictEqual(irrigations.readableItems(running), [
            'command',
            'programsCmd',
            'status',
            'programRunning',
            'programStartAt',
            'programsRun',
            'windy',
            'rainy',
            'override'
        ]);
        assert.deepStrictEqual(irrigations.editorItems(running), ['command', 'programsCmd']);
        assert.strictEqual(irrigations.outputValue('programsRun', programsRun).programs[1].name, 'Hedge');
        assert.deepStrictEqual(irrigations.outputValue('programsCmd', '{"programId":1,"cmd":"play"}'), { programId: 1, cmd: 'play' });
        assert.strictEqual(irrigations.isOutputItem('programsCmd', { outputMode: 'feedback' }), false);
        assert.strictEqual(irrigations.isOutputItem('programsRun', { outputMode: 'feedback' }), true);
        assert.deepStrictEqual(irrigations.outputExtras('override'), { unit: '%' });
        assert.deepStrictEqual(irrigations.changedOnly, ['programsRun', 'programRunning', 'programStartAt']);
    });

    it('shows the controller, the programs and the inhibitions', function () {
        assert.strictEqual(irrigations.status(stopped).text, 'Stopped');
        assert.strictEqual(irrigations.status({ ...running, windy: true }).text, 'Watering · Hedge · Windy');
        const paused = { ...running, programsRun: JSON.stringify({ programs: [{ programId: 1, name: 'Garden', status: 'pause' }] }) };
        assert.strictEqual(irrigations.status(paused).text, 'Paused · Garden');
        const ready = { ...running, programsRun: null, programStartAt: new Date(2026, 10, 5, 6, 0).toISOString(), rainy: true };
        assert.deepStrictEqual(irrigations.status(ready), { fill: 'blue', shape: 'ring', text: 'Ready · Next 05/11 06:00 · Rainy' });
        assert.strictEqual(irrigations.status({ typeId: 'other' }).text, 'Unknown Type other');
    });
});
