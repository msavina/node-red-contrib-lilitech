'use strict';

const assert = require('assert');
const chargers = require('../lib/families/chargers');

describe('chargers family', function () {
    const charger = { typeId: 'charger', switchFeedback: false };
    const smart = { typeId: 'smartCharger', command: 'pause', statusLock: false };

    it('treats a plain payload as switch on a simple charger', function () {
        assert.deepStrictEqual(chargers.parseInput({ payload: 'on' }, charger), { switch: true });
        assert.deepStrictEqual(chargers.parseInput({ payload: 'toggle' }, { ...charger, switchFeedback: true }), { switch: false });
        assert.throws(() => chargers.parseInput({ payload: 'play' }, charger), /Invalid boolean/);
    });

    it('treats a plain payload as command or lock on a smart charger', function () {
        assert.deepStrictEqual(chargers.parseInput({ payload: 'Play' }, smart), { command: 'play' });
        assert.deepStrictEqual(chargers.parseInput({ payload: false }, smart), { command: 'pause' });
        assert.deepStrictEqual(chargers.parseInput({ payload: 'toggle' }, smart), { command: 'play' });
        assert.deepStrictEqual(chargers.parseInput({ payload: 'lock' }, smart), { commandLock: true });
        assert.deepStrictEqual(chargers.parseInput({ topic: 'commandLock', payload: 'toggle' }, { ...smart, statusLock: true }), { commandLock: false });
        assert.throws(() => chargers.parseInput({ payload: 'resume' }, smart), /Invalid command/);
    });

    it('clamps the maximum charging current', function () {
        assert.deepStrictEqual(chargers.parseInput({ topic: 'maxChargingCurrent', payload: '10' }, smart), { maxChargingCurrent: 10 });
        assert.deepStrictEqual(chargers.parseInput({ payload: { maxChargingCurrent: 32 } }, smart), { maxChargingCurrent: 16 });
        assert.throws(() => chargers.parseInput({ topic: 'maxChargingCurrent', payload: 10 }, charger), /not writable/);
    });

    it('accepts one item per message on a smart charger', function () {
        assert.throws(() => chargers.parseInput({ payload: { command: 'play', commandLock: false } }, smart), /one item per message/);
    });

    it('rejects unknown types and points out an unknown topic', function () {
        assert.throws(() => chargers.parseInput({ payload: true }, { typeId: 'other' }), /Unsupported charger type/);
        assert.throws(() => chargers.parseInput({ topic: 'maxCurrent', payload: 10 }, smart), /msg.topic "maxCurrent" is not a known item/);
    });

    it('exposes the items of the type and the measures enabled by the features', function () {
        assert.deepStrictEqual(chargers.readableItems(charger), ['switch', 'switchFeedback', 'overload', 'economy', 'green']);
        assert.deepStrictEqual(chargers.readableItems({ ...charger, powerInfo: true, estimatedVoltageInfoBoolean: true, faultInfo: true }), [
            'switch',
            'switchFeedback',
            'overload',
            'economy',
            'green',
            'power',
            'voltage',
            'faultSignal'
        ]);
        assert.deepStrictEqual(chargers.readableItems({ ...smart, powerInfo: true }), [
            'command',
            'commandLock',
            'maxChargingCurrent',
            'status',
            'statusLock',
            'chargingPower',
            'addedEnergy',
            'chargingTime',
            'sessionTime',
            'overload',
            'economy',
            'green'
        ]);
        assert.deepStrictEqual(chargers.editorItems(smart), ['command', 'commandLock', 'maxChargingCurrent']);
    });

    it('filters the commands in feedback mode and adds the unit', function () {
        assert.strictEqual(chargers.isOutputItem('command', { outputMode: 'feedback' }), false);
        assert.strictEqual(chargers.isOutputItem('commandLock', { outputMode: 'feedback' }), false);
        assert.strictEqual(chargers.isOutputItem('maxChargingCurrent', { outputMode: 'feedback' }), true);
        assert.strictEqual(chargers.isOutputItem('switch', { outputMode: 'all' }), true);
        assert.deepStrictEqual(chargers.outputExtras('power'), { unit: 'W' });
        assert.deepStrictEqual(chargers.outputExtras('chargingPower'), { unit: 'kW' });
        assert.deepStrictEqual(chargers.outputExtras('status'), {});
    });

    it('shows the switch, the smart charger status and the anomalies', function () {
        assert.strictEqual(chargers.status(charger).text, 'Off');
        assert.strictEqual(chargers.status({ ...charger, switchFeedback: true, powerInfo: true, power: 3200 }).text, 'On · 3.2 kW');
        assert.strictEqual(chargers.status({ ...smart, status: 'charging', chargingPower: 7.4 }).text, 'Charging · 7.4 kW');
        assert.strictEqual(chargers.status({ ...smart, status: 'waitingForCarDemand' }).text, 'Waiting For Car Demand');
        assert.strictEqual(chargers.status({ ...smart, status: 'ready', statusLock: true }).text, 'Ready · Locked');
        assert.strictEqual(chargers.status({ ...smart, status: 'lockedCarConnected', statusLock: true }).text, 'Locked Car Connected');
        assert.strictEqual(chargers.status(smart).text, 'Unknown');
        const overload = chargers.status({ ...charger, overload: true, faultInfo: true, faultSignal: true });
        assert.deepStrictEqual([overload.fill, overload.text], ['red', 'Off · Overload · Fault']);
    });
});
