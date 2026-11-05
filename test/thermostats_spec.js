'use strict';

const assert = require('assert');
const thermostats = require('../lib/families/thermostats');

describe('thermostats family', function () {
    const heat = { typeId: 'smartHeatThermostat', powerable: true, switchFeedback: true, setpointTemperatureFeedback: 21, roomTemperature: 19.5 };
    const full = { typeId: 'fullThermostat', powerable: true, thermoProfilesEnable: true, modeButtonAuto: true, switchFeedback: true };

    it('maps a plain payload to switch, setpoint, profile or mode', function () {
        assert.deepStrictEqual(thermostats.parseInput({ payload: 'off' }, heat), { switch: false });
        assert.deepStrictEqual(thermostats.parseInput({ payload: 'toggle' }, heat), { switch: false });
        assert.deepStrictEqual(thermostats.parseInput({ payload: 21.3 }, heat), { setpointTemperature: 21.5 });
        assert.deepStrictEqual(thermostats.parseInput({ payload: '40' }, heat), { setpointTemperature: 35 });
        assert.deepStrictEqual(thermostats.parseInput({ payload: 'Comfort' }, full), { thermoProfile: 'comfort' });
        assert.deepStrictEqual(thermostats.parseInput({ payload: 'auto' }, full), { thermoMode: 'auto' });
        assert.deepStrictEqual(thermostats.parseInput({ topic: 'overrideRestore', payload: true }, heat), { overrideRestore: true });
    });

    it('offers only the items enabled in the app', function () {
        assert.throws(() => thermostats.parseInput({ payload: true }, { ...heat, powerable: false }), /Item "switch" is not writable/);
        assert.throws(() => thermostats.parseInput({ payload: 'comfort' }, heat), /Item "thermoProfile" is not writable/);
        assert.throws(() => thermostats.parseInput({ payload: 'cool' }, heat), /Item "thermoMode" is not writable/);
        assert.throws(() => thermostats.parseInput({ payload: 'dry' }, full), /Invalid mode "dry" \(allowed: heat, cool, auto\)/);
        assert.throws(() => thermostats.parseInput({ topic: 'overrideTime', payload: 60000 }, heat), /msg.topic "overrideTime" is not a known item/);
        assert.throws(() => thermostats.parseInput({ payload: true }, { typeId: 'other' }), /Unsupported thermostat type/);
    });

    it('limits the setpoint around the base setpoint like the app', function () {
        const blocked = { ...heat, blockSetpointInfo: true, baseSetPoint: 20 };
        assert.deepStrictEqual(thermostats.parseInput({ payload: 25 }, blocked), { setpointTemperature: 23 });
        assert.deepStrictEqual(thermostats.parseInput({ payload: 10 }, blocked), { setpointTemperature: 17 });
        assert.deepStrictEqual(thermostats.parseInput({ payload: 25 }, { ...heat, blockSetpointInfo: true }), { setpointTemperature: 25 });
    });

    it('exposes the valves, the profiles and the measures by feature', function () {
        assert.deepStrictEqual(thermostats.editorItems({ ...heat, powerable: false }), ['setpointTemperature']);
        assert.deepStrictEqual(thermostats.readableItems({ ...heat, powerable: false }), [
            'switchFeedback',
            'setpointTemperature',
            'setpointTemperatureFeedback',
            'roomTemperature',
            'thermoStatus',
            'overrideFeedback',
            'overrideTime',
            'overrideTimeAt',
            'systemPrimaryValve'
        ]);
        const readable = thermostats.readableItems({
            ...full,
            systemPrimaryFourPipes: true,
            systemSecondaryHeatEnable: true,
            humidityInfo: true,
            faultInfo: true
        });
        for (const item of ['thermoModeFeedback', 'thermoProfileFeedback', 'chronoSetpoint', 'systemPrimaryValveHeat', 'systemSecondaryValve', 'roomHumidity', 'faultSignal']) {
            assert.ok(readable.includes(item), item);
        }
        assert.ok(!readable.includes('systemPrimaryValve'));
        assert.strictEqual(thermostats.isOutputItem('setpointTemperature', { outputMode: 'feedback' }), false);
        assert.strictEqual(thermostats.isOutputItem('setpointTemperatureFeedback', { outputMode: 'feedback' }), true);
        assert.deepStrictEqual(thermostats.outputExtras('roomHumidity'), { unit: '%' });
    });

    it('shows the state, the temperatures, the profile and the fault', function () {
        assert.deepStrictEqual(thermostats.status({ ...heat, thermoStatus: 'heat' }), { fill: 'red', shape: 'dot', text: 'Heat · 19.5 °C → 21 °C' });
        assert.strictEqual(
            thermostats.status({ ...full, thermoStatus: 'idle', thermoProfileFeedback: 'comfort', overrideFeedback: true }).text,
            'Idle · Comfort · Override'
        );
        assert.deepStrictEqual(thermostats.status({ ...heat, switchFeedback: false, faultInfo: true, faultSignal: true }), {
            fill: 'red',
            shape: 'ring',
            text: 'Off · Fault'
        });
        assert.strictEqual(thermostats.status({ typeId: 'other' }).text, 'Unknown Type other');
    });
});
