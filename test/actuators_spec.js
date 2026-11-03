'use strict';

const assert = require('assert');
const actuators = require('../lib/families/actuators');

describe('actuators family', function () {
    const pump = { typeId: 'pump' };
    const proportionalValve = { typeId: 'valve', proportional: true };
    const servoValve = { typeId: 'servoValve' };
    const thermostaticValve = { typeId: 'thermostaticValve' };

    it('treats a plain payload as the main item of the type', function () {
        assert.deepStrictEqual(actuators.parseInput({ payload: 'on' }, pump), { switch: true });
        assert.deepStrictEqual(actuators.parseInput({ payload: 'stop' }, servoValve), { drive: 'stop' });
        assert.deepStrictEqual(actuators.parseInput({ payload: '21.3' }, thermostaticValve), { setpointTemperature: 21.5 });
    });

    it('toggles from the switch feedback', function () {
        assert.deepStrictEqual(actuators.parseInput({ payload: 'toggle' }, pump, { switchFeedback: true }), { switch: false });
    });

    it('accepts true/false as open/close on a servo valve', function () {
        assert.deepStrictEqual(actuators.parseInput({ payload: true }, servoValve), { drive: 'open' });
        assert.deepStrictEqual(actuators.parseInput({ payload: 'OFF' }, servoValve), { drive: 'close' });
        assert.throws(() => actuators.parseInput({ payload: 'half' }, servoValve), /Invalid drive command/);
    });

    it('writes proportionalDrive only on proportional actuators', function () {
        assert.deepStrictEqual(actuators.parseInput({ topic: 'proportionalDrive', payload: 150 }, proportionalValve), { proportionalDrive: 100 });
        assert.throws(() => actuators.parseInput({ topic: 'proportionalDrive', payload: 50 }, pump), /not writable/);
    });

    it('clamps the setpoint to the range of the app', function () {
        assert.deepStrictEqual(actuators.parseInput({ payload: 50 }, thermostaticValve), { setpointTemperature: 30 });
        assert.deepStrictEqual(actuators.parseInput({ payload: 0 }, thermostaticValve), { setpointTemperature: 4 });
        assert.throws(() => actuators.parseInput({ payload: 'warm' }, thermostaticValve), /Invalid number/);
    });

    it('rejects items of other types and unknown types', function () {
        assert.throws(() => actuators.parseInput({ payload: { switch: true } }, servoValve), /not writable/);
        assert.throws(() => actuators.parseInput({ payload: true }, { typeId: 'other' }), /Unsupported actuator type/);
    });

    it('points out an unknown topic', function () {
        assert.throws(() => actuators.parseInput({ topic: 'proportionaldrive', payload: 50 }, pump), /msg.topic "proportionaldrive" is not a known item/);
    });

    it('exposes the optional items enabled by the features', function () {
        assert.deepStrictEqual(actuators.readableItems(pump), ['switch', 'switchFeedback', 'powerOffTimerAt']);
        assert.deepStrictEqual(actuators.readableItems({ typeId: 'thermostaticValve', faultInfo: true }), [
            'setpointTemperature',
            'setpointTemperatureFeedback',
            'roomTemperature',
            'proportionalDriveFeedback',
            'battery',
            'faultSignal'
        ]);
        assert.ok(actuators.readableItems({ typeId: 'servoValve', volumeInfo: true }).includes('volumeValue'));
    });

    it('filters the commands in feedback mode', function () {
        assert.strictEqual(actuators.isOutputItem('switch', { outputMode: 'feedback' }), false);
        assert.strictEqual(actuators.isOutputItem('roomTemperature', { outputMode: 'feedback' }), true);
        assert.strictEqual(actuators.isOutputItem('switch', { outputMode: 'all' }), true);
    });

    it('rounds values and adds the unit', function () {
        assert.strictEqual(actuators.outputValue('roomTemperature', 21.299999237060547), 21.3);
        assert.strictEqual(actuators.outputValue('volumeValue', 12.34567), 12.346);
        assert.deepStrictEqual(actuators.outputExtras('roomTemperature'), { unit: '°C' });
        assert.deepStrictEqual(actuators.outputExtras('switchFeedback'), {});
    });

    it('shows the state of each type', function () {
        assert.strictEqual(actuators.status({ ...proportionalValve, switchFeedback: true, proportionalDriveFeedback: 60 }).text, 'On · 60%');
        assert.strictEqual(actuators.status({ ...pump, switchFeedback: false }).text, 'Off');
        assert.strictEqual(actuators.status({ ...servoValve, driveFeedback: 'closing' }).text, 'Closing');
        assert.strictEqual(actuators.status({ ...thermostaticValve, setpointTemperatureFeedback: 20, proportionalDriveFeedback: 35 }).text, '20 °C · Valve 35%');
        const fault = actuators.status({ ...pump, switchFeedback: true, faultInfo: true, faultSignal: true });
        assert.deepStrictEqual([fault.fill, fault.text], ['red', 'On · Fault']);
    });
});
