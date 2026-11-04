'use strict';

const assert = require('assert');
const automations = require('../lib/families/automations');

describe('automations family', function () {
    const shutter = { typeId: 'shutter', positionable: true, stoppable: true };
    const gate = { typeId: 'gate' };
    const frontDoor = { typeId: 'frontDoor', closeable: true, lockable: true };
    const awning = { typeId: 'sunshadeAwning', inclinable: true };

    it('treats a plain payload as a drive command', function () {
        assert.deepStrictEqual(automations.parseInput({ payload: 'Stop' }, shutter), { drive: 'stop' });
        assert.deepStrictEqual(automations.parseInput({ payload: true }, shutter), { drive: 'open' });
        assert.deepStrictEqual(automations.parseInput({ payload: 'off' }, shutter), { drive: 'close' });
    });

    it('offers the commands enabled by the features', function () {
        assert.deepStrictEqual(automations.driveCommands(shutter), ['open', 'close', 'stop']);
        assert.deepStrictEqual(automations.driveCommands(gate), ['open']);
        assert.deepStrictEqual(automations.driveCommands(frontDoor), ['open', 'close', 'lock', 'unlock']);
        assert.deepStrictEqual(automations.driveCommands({ typeId: 'window', lockable: true }), ['open']);
        assert.throws(() => automations.parseInput({ payload: 'close' }, gate), /Invalid drive command/);
        assert.throws(() => automations.parseInput({ payload: 'stop' }, awning), /Invalid drive command/);
        assert.deepStrictEqual(automations.parseInput({ payload: 'lock' }, frontDoor), { drive: 'lock' });
    });

    it('writes the position only when positionable', function () {
        assert.deepStrictEqual(automations.parseInput({ topic: 'absolutePosition', payload: '40.4' }, shutter), { absolutePosition: 40 });
        assert.deepStrictEqual(automations.parseInput({ payload: { absolutePosition: 150 } }, shutter), { absolutePosition: 100 });
        assert.throws(() => automations.parseInput({ topic: 'absolutePosition', payload: 40 }, gate), /not writable/);
        assert.deepStrictEqual(automations.parseInput({ topic: 'absolutePositionFoil', payload: 30 }, awning), { absolutePositionFoil: 30 });
    });

    it('rejects unknown types and points out an unknown topic', function () {
        assert.throws(() => automations.parseInput({ payload: 'open' }, { typeId: 'other' }), /Unsupported automation type/);
        assert.throws(() => automations.parseInput({ topic: 'position', payload: 40 }, shutter), /msg.topic "position" is not a known item/);
    });

    it('exposes the items enabled by the features', function () {
        assert.deepStrictEqual(automations.readableItems(shutter), ['drive', 'driveFeedback', 'absolutePosition', 'absolutePositionFeedback', 'simulated']);
        assert.deepStrictEqual(automations.readableItems({ ...frontDoor, openInfo: true, faultInfo: true }), [
            'drive',
            'driveFeedback',
            'simulated',
            'openStatus',
            'faultSignal',
            'status',
            'battery'
        ]);
        assert.deepStrictEqual(automations.editorItems(shutter), ['open', 'close', 'stop', 'absolutePosition']);
    });

    it('filters the commands in feedback mode and adds the unit', function () {
        assert.strictEqual(automations.isOutputItem('drive', { outputMode: 'feedback' }), false);
        assert.strictEqual(automations.isOutputItem('driveFeedback', { outputMode: 'feedback' }), true);
        assert.strictEqual(automations.isOutputItem('absolutePosition', { outputMode: 'all' }), true);
        assert.deepStrictEqual(automations.outputExtras('absolutePositionFeedback'), { unit: '%' });
        assert.deepStrictEqual(automations.outputExtras('driveFeedback'), {});
    });

    it('shows the drive feedback, the position and the fault', function () {
        assert.strictEqual(automations.status({ ...shutter, driveFeedback: 'closing', absolutePositionFeedback: 40 }).text, 'Closing · 40%');
        assert.strictEqual(automations.status({ ...gate, driveFeedback: 'open' }).text, 'Open');
        assert.strictEqual(automations.status({ ...frontDoor, driveFeedback: 'locked' }).text, 'Locked');
        assert.strictEqual(automations.status(gate).text, 'Unknown');
        assert.strictEqual(automations.status({ ...shutter, driveFeedback: 'open', simulated: true }).text, 'Open · Simulated');
        const fault = automations.status({ ...gate, driveFeedback: 'close', faultInfo: true, faultSignal: true });
        assert.deepStrictEqual([fault.fill, fault.text], ['red', 'Closed · Fault']);
    });
});
