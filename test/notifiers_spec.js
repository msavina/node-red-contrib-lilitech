'use strict';

const assert = require('assert');
const notifiers = require('../lib/families/notifiers');

describe('notifiers family', function () {
    const siren = { typeId: 'siren', switchFeedback: false };
    const testableSiren = { ...siren, testable: true };

    it('treats a plain payload as switch', function () {
        assert.deepStrictEqual(notifiers.parseInput({ payload: 'on' }, siren), { switch: true });
        assert.deepStrictEqual(notifiers.parseInput({ payload: 0 }, siren), { switch: false });
        assert.deepStrictEqual(notifiers.parseInput({ payload: 'toggle' }, { ...siren, switchFeedback: true }), { switch: false });
    });

    it('writes test only when testable and maintenance always', function () {
        assert.deepStrictEqual(notifiers.parseInput({ topic: 'test', payload: true }, testableSiren), { test: true });
        assert.throws(() => notifiers.parseInput({ topic: 'test', payload: true }, siren), /not writable/);
        assert.deepStrictEqual(notifiers.parseInput({ payload: { switch: false, maintenance: 'true' } }, siren), { switch: false, maintenance: true });
    });

    it('rejects unknown types and points out an unknown topic', function () {
        assert.throws(() => notifiers.parseInput({ payload: true }, { typeId: 'other' }), /Unsupported notifier type/);
        assert.throws(() => notifiers.parseInput({ topic: 'tset', payload: 'yes' }, siren), /msg.topic "tset" is not a known item/);
    });

    it('exposes the items enabled by the features', function () {
        assert.deepStrictEqual(notifiers.readableItems(siren), ['switch', 'maintenance', 'switchFeedback']);
        assert.deepStrictEqual(notifiers.readableItems({ ...testableSiren, tamperInfo: true, lowBatteryDetection: true }), [
            'switch',
            'test',
            'maintenance',
            'switchFeedback',
            'tamperSignal',
            'lowBattery'
        ]);
        assert.deepStrictEqual(notifiers.editorItems(testableSiren), ['switch', 'test', 'maintenance']);
    });

    it('filters switch in feedback mode', function () {
        assert.strictEqual(notifiers.isOutputItem('switch', { outputMode: 'feedback' }), false);
        assert.strictEqual(notifiers.isOutputItem('switchFeedback', { outputMode: 'feedback' }), true);
        assert.strictEqual(notifiers.isOutputItem('maintenance', { outputMode: 'feedback' }), true);
        assert.strictEqual(notifiers.isOutputItem('switch', { outputMode: 'all' }), true);
    });

    it('shows the switch, the maintenance and the anomalies', function () {
        assert.strictEqual(notifiers.status({ typeId: 'buzzer' }).text, 'Unknown');
        assert.strictEqual(notifiers.status({ ...siren, switchFeedback: true }).text, 'On');
        assert.strictEqual(notifiers.status({ ...testableSiren, switchFeedback: true, test: true }).text, 'On · Test');
        assert.strictEqual(notifiers.status({ ...siren, maintenance: true }).text, 'Off · Maintenance');
        const tamper = notifiers.status({ ...siren, tamperInfo: true, tamperSignal: true, lowBatteryDetection: true, lowBattery: true });
        assert.deepStrictEqual([tamper.fill, tamper.text], ['red', 'Off · Tamper · Low Battery']);
        assert.strictEqual(notifiers.status({ ...siren, tamperSignal: true }).text, 'Off');
    });
});
