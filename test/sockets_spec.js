'use strict';

const assert = require('assert');
const sockets = require('../lib/families/sockets');

describe('sockets family', function () {
    const socket = { typeId: 'measurable', switchFeedback: false };

    it('treats a plain payload as switch', function () {
        assert.deepStrictEqual(sockets.parseInput({ payload: 'on' }, socket), { switch: true });
        assert.deepStrictEqual(sockets.parseInput({ payload: 'toggle' }, { ...socket, switchFeedback: true }), { switch: false });
        assert.throws(() => sockets.parseInput({ payload: 'start' }, socket), /Invalid boolean/);
    });

    it('resets only the measures enabled in the app', function () {
        const measured = { ...socket, energyInfo: true, powerInfo: true };
        assert.deepStrictEqual(sockets.parseInput({ topic: 'restoreEnergy', payload: true }, measured), { restoreEnergy: true });
        assert.deepStrictEqual(sockets.parseInput({ payload: { restorePower: 'true' } }, measured), { restorePower: true });
        assert.throws(() => sockets.parseInput({ topic: 'restoreEnergy', payload: false }, measured), /accepts only true/);
        assert.throws(() => sockets.parseInput({ topic: 'restoreCurrent', payload: true }, measured), /not writable/);
        // La tensione stimata si legge ma l'headunit la azzera solo con 'voltageInfo'
        assert.deepStrictEqual(sockets.writableItems({ ...socket, estimatedVoltageInfoBoolean: true }), ['switch']);
        assert.deepStrictEqual(sockets.writableItems({ ...socket, voltageInfo: true }), ['switch', 'restoreVoltage']);
    });

    it('rejects unknown types and read only items', function () {
        assert.throws(() => sockets.parseInput({ payload: true }, { typeId: 'other' }), /Unsupported socket type/);
        assert.throws(() => sockets.parseInput({ payload: { power: 100 } }, socket), /not writable/);
        assert.throws(() => sockets.parseInput({ topic: 'swich', payload: 'x' }, socket), /msg.topic "swich" is not a known item/);
    });

    it('exposes the measures and the fault enabled by the features', function () {
        assert.deepStrictEqual(sockets.readableItems({ typeId: 'simple' }), ['switch', 'switchFeedback', 'overload', 'economy', 'green', 'simulated']);
        assert.deepStrictEqual(sockets.readableItems({ ...socket, currentInfo: true, powerOffTimer: true, faultInfo: true }), [
            'switch',
            'switchFeedback',
            'overload',
            'economy',
            'green',
            'simulated',
            'current',
            'currentMin',
            'currentMax',
            'faultSignal'
        ]);
        assert.deepStrictEqual(sockets.readableItems({ typeId: 'other' }), []);
    });

    it('filters the switch in feedback mode and adds the unit', function () {
        assert.strictEqual(sockets.isOutputItem('switch', { outputMode: 'feedback' }), false);
        assert.strictEqual(sockets.isOutputItem('switchFeedback', { outputMode: 'feedback' }), true);
        assert.deepStrictEqual(sockets.outputExtras('powerMax'), { unit: 'W' });
        assert.deepStrictEqual(sockets.outputExtras('energyRelative'), { unit: 'Wh' });
        assert.deepStrictEqual(sockets.outputExtras('faultSignal'), {});
    });

    it('shows the switch and the anomalies', function () {
        assert.strictEqual(sockets.status({ typeId: 'simple' }).text, 'Unknown');
        assert.strictEqual(sockets.status(socket).text, 'Off');
        assert.strictEqual(sockets.status({ ...socket, switchFeedback: true, powerInfo: true, power: 1200 }).text, 'On · 1.2 kW');
        assert.strictEqual(sockets.status({ ...socket, switchFeedback: true, powerOffTimer: true, powerOffTimerAt: Date.now() + 3600000 }).text, 'On');
        assert.strictEqual(sockets.status({ ...socket, switchFeedback: true, simulated: true }).text, 'On · Simulated');
        const overload = sockets.status({ ...socket, overload: true, faultInfo: true, faultSignal: true });
        assert.deepStrictEqual([overload.fill, overload.text], ['red', 'Off · Overload · Fault']);
        assert.strictEqual(sockets.status({ typeId: 'other' }).text, 'Unknown Type other');
    });
});
