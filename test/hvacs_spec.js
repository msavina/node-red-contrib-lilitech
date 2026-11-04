'use strict';

const assert = require('assert');
const hvacs = require('../lib/families/hvacs');

describe('hvacs family', function () {
    const conditioner = {
        typeId: 'conditioner',
        switch: true,
        switchFeedback: true,
        thermoProfilesEnable: true,
        thermoModesEnable: true,
        modeButtonHeat: true,
        modeButtonCool: true,
        fanManagement: true,
        fanSpeedsCount: 4,
        fanDirectionInfo: true
    };
    const boiler = { typeId: 'boiler', powerable: true, switchFeedback: false, deliveryTemperatureInfo: true, pressureInfo: true };
    const fan = { typeId: 'fan', powerable: true, switchFeedback: true, fanManagement: true, fanDirectionInfo: true };

    it('parses the plain payloads by type', function () {
        assert.deepStrictEqual(hvacs.parseInput({ payload: 'toggle' }, conditioner), { switch: false });
        assert.deepStrictEqual(hvacs.parseInput({ payload: 21.7 }, conditioner), { setpointTemperature: 21.5 });
        assert.deepStrictEqual(hvacs.parseInput({ payload: '40' }, conditioner), { setpointTemperature: 35 });
        assert.deepStrictEqual(hvacs.parseInput({ payload: 'Comfort' }, conditioner), { thermoProfile: 'comfort' });
        assert.deepStrictEqual(hvacs.parseInput({ payload: 'cool' }, conditioner), { thermoMode: 'cool' });
        assert.deepStrictEqual(hvacs.parseInput({ payload: 'on' }, boiler), { switch: true });
        const dehumidifier = { typeId: 'dehumidifier', powerable: true, switch: true, humidityControl: true };
        assert.deepStrictEqual(hvacs.parseInput({ payload: 55 }, dehumidifier), { setpointHumidity: 55 });
    });

    it('writes only the items enabled in the app', function () {
        assert.throws(() => hvacs.parseInput({ payload: 'dry' }, conditioner), /Invalid mode "dry" \(allowed: heat, cool\)/);
        assert.throws(() => hvacs.parseInput({ payload: 'on' }, { ...boiler, powerable: false }), /not writable.*allowed: none/);
        assert.throws(() => hvacs.parseInput({ topic: 'fanAuto', payload: true }, fan), /not writable/);
        assert.throws(() => hvacs.parseInput({ topic: 'fanDirection', payload: 'all' }, fan), /not writable/);
        assert.throws(() => hvacs.parseInput({ topic: 'setpointHumidity', payload: 50 }, conditioner), /not writable/);
        assert.throws(() => hvacs.parseInput({ payload: true }, { typeId: 'other' }), /Unsupported hvac type/);
    });

    it('validates fan and override', function () {
        assert.deepStrictEqual(hvacs.parseInput({ payload: { fanSpeed: 9, fanAuto: 'toggle', fanDirection: 'Vertical' } }, conditioner), {
            fanSpeed: 4,
            fanAuto: true,
            fanDirection: 'vertical'
        });
        assert.deepStrictEqual(hvacs.parseInput({ topic: 'fanSpeed', payload: 7 }, fan), { fanSpeed: 3 });
        assert.throws(() => hvacs.parseInput({ topic: 'overrideTime', payload: 3600000 }, conditioner), /not a known item/);
        assert.throws(() => hvacs.parseInput({ payload: { overrideTime: 3600000 } }, conditioner), /not writable/);
        assert.deepStrictEqual(hvacs.parseInput({ topic: 'overrideRestore', payload: true }, conditioner), { overrideRestore: true });
        // Con l'hvac spento il setpoint parte comunque: l'headunit lo applica solo da acceso
        assert.deepStrictEqual(hvacs.parseInput({ payload: 22 }, { ...conditioner, switch: false }), { setpointTemperature: 22 });
        assert.throws(() => hvacs.parseInput({ topic: 'fanSpeeed', payload: 2 }, conditioner), /msg.topic "fanSpeeed" is not a known item/);
    });

    it('exposes the items of the type and of the features', function () {
        assert.deepStrictEqual(hvacs.readableItems(boiler), ['switch', 'switchFeedback', 'deliveryTemperature', 'pressureValue']);
        assert.deepStrictEqual(hvacs.readableItems(fan), ['switch', 'switchFeedback', 'fanSpeed', 'fanSpeedFeedback']);
        const items = hvacs.readableItems(conditioner);
        for (const item of ['thermoModeFeedback', 'fanDirectionFeedback', 'roomTemperature', 'thermoStatus', 'overrideTimeAt', 'chronoSetpoint']) {
            assert.ok(items.includes(item), item);
        }
        assert.ok(!items.includes('roomHumidity'));
        assert.ok(items.includes('overrideTime'));
        assert.ok(!hvacs.writableItems(conditioner).includes('overrideTime'));
        assert.ok(!hvacs.editorItems(conditioner).includes('overrideRestore'));
        const vmc = { typeId: 'vmc', supplyFanManagement: true, returnFanManagement: true };
        assert.deepStrictEqual(hvacs.writableItems(vmc), ['supplyFanSpeed', 'returnFanSpeed']);
    });

    it('filters the commands in feedback mode and adds the unit', function () {
        assert.strictEqual(hvacs.isOutputItem('setpointTemperature', { outputMode: 'feedback' }), false);
        assert.strictEqual(hvacs.isOutputItem('setpointTemperatureFeedback', { outputMode: 'feedback' }), true);
        assert.strictEqual(hvacs.isOutputItem('overrideTime', { outputMode: 'feedback' }), true);
        assert.strictEqual(hvacs.isOutputItem('fanSpeed', { outputMode: 'all' }), true);
        assert.deepStrictEqual(hvacs.outputExtras('roomTemperature'), { unit: '°C' });
        assert.deepStrictEqual(hvacs.outputExtras('supplyFanSpeedFeedback'), { unit: '%' });
        assert.deepStrictEqual(hvacs.outputExtras('thermoStatus'), {});
    });

    it('shows the thermostat and the other types', function () {
        const heating = { ...conditioner, thermoStatus: 'heat', roomTemperature: 20.5, setpointTemperatureFeedback: 22, thermoProfileFeedback: 'comfort' };
        assert.deepStrictEqual(hvacs.status(heating), { fill: 'red', shape: 'dot', text: 'Heat · 20.5 °C → 22 °C · Comfort' });
        assert.strictEqual(hvacs.status({ ...heating, overrideFeedback: true }).text, 'Heat · 20.5 °C → 22 °C · Comfort · Override');
        assert.strictEqual(hvacs.status({ ...conditioner, switchFeedback: false }).text, 'Off');
        assert.strictEqual(hvacs.status({ ...boiler, switchFeedback: true, deliveryTemperature: 60 }).text, 'On · 60 °C');
        assert.strictEqual(hvacs.status({ ...fan, fanSpeedFeedback: 2 }).text, 'On · Fan 2/3');
        assert.strictEqual(hvacs.status({ typeId: 'airPurifier', powerable: false }).text, 'Always On');
        const fault = hvacs.status({ ...boiler, faultInfo: true, faultSignal: true });
        assert.deepStrictEqual([fault.fill, fault.text], ['red', 'Off · Fault']);
        assert.strictEqual(hvacs.status({ typeId: 'other' }).text, 'Unknown Type other');
    });
});
