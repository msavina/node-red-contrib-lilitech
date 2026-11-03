'use strict';

const assert = require('assert');
const envSensors = require('../lib/families/env-sensors');

describe('environment-sensors family', function () {
    it('exposes the main item of each type', function () {
        assert.deepStrictEqual(envSensors.readableItems({ typeId: 'presenceSensor' }), ['presence']);
        assert.deepStrictEqual(envSensors.editorItems({ typeId: 'temperatureSensor' }), ['temperatureValue']);
    });

    it('adds optional items only when the feature is enabled', function () {
        assert.deepStrictEqual(envSensors.editorItems({ typeId: 'windSensor' }), ['windSpeed']);
        assert.deepStrictEqual(envSensors.editorItems({ typeId: 'windSensor', windDirectionInfo: true, windGustsInfo: true }), [
            'windSpeed',
            'windDirection',
            'windGusts'
        ]);
        assert.deepStrictEqual(envSensors.editorItems({ typeId: 'airQualitySensor', vocInfo: true, lowBatteryDetection: true }), ['coTwo', 'voc']);
    });

    it('includes min/max statistics of the enabled measures', function () {
        const items = envSensors.readableItems({ typeId: 'lightSensor', solarRadiationInfo: true });
        assert.ok(items.includes('luminosityMaxValue'));
        assert.ok(items.includes('solarRadiationMinTimestamp'));
        assert.ok(!envSensors.readableItems({ typeId: 'lightSensor' }).includes('solarRadiationMaxValue'));
    });

    it('filters statistics and diagnostics by node configuration', function () {
        assert.strictEqual(envSensors.isOutputItem('temperatureMaxValue', {}), false);
        assert.strictEqual(envSensors.isOutputItem('temperatureMaxValue', { statistics: true }), true);
        assert.strictEqual(envSensors.isOutputItem('rainAmountRelativeTimestamp', {}), true);
        assert.strictEqual(envSensors.isOutputItem('lowBattery', {}), true);
        assert.strictEqual(envSensors.isOutputItem('lowBattery', { diagnostics: false }), false);
    });

    it('rounds the measures but not the timestamps', function () {
        assert.strictEqual(envSensors.outputValue('temperatureValue', 26.899999618530273), 26.9);
        assert.strictEqual(envSensors.outputValue('temperatureMaxValue', 24.04), 24);
        assert.strictEqual(envSensors.outputValue('voc', 0.123456), 0.12);
        assert.strictEqual(envSensors.outputValue('luminosity', 258.7), 259);
        assert.strictEqual(envSensors.outputValue('luminosityMaxValue', 1203.4), 1203);
        assert.strictEqual(envSensors.outputValue('temperatureMaxTimestamp', 1762167000123), 1762167000123);
        assert.strictEqual(envSensors.outputValue('presence', true), true);
    });

    it('adds the unit of measure', function () {
        assert.deepStrictEqual(envSensors.outputExtras('temperatureValue'), { unit: '°C' });
        assert.deepStrictEqual(envSensors.outputExtras('temperatureMaxValue'), { unit: '°C' });
        assert.deepStrictEqual(envSensors.outputExtras('temperatureMaxTimestamp'), {});
        assert.deepStrictEqual(envSensors.outputExtras('presence'), {});
    });

    it('describes the state in the node status', function () {
        assert.strictEqual(envSensors.status({ typeId: 'temperatureSensor', temperatureValue: 21.46 }).text, '21.5 °C');
        assert.strictEqual(envSensors.status({ typeId: 'twilightSensor', twilight: true }).text, 'Night');
        assert.strictEqual(
            envSensors.status({ typeId: 'presenceSensor', presence: true, lowBatteryDetection: true, lowBattery: true }).text,
            'Presence · Low Battery'
        );
        const lost = envSensors.status({ typeId: 'soilMoistureSensor', soilMoisture: 45.2, keepAlive: true, sensorLoss: true });
        assert.strictEqual(lost.text, '45.2 % · Sensor Lost');
        assert.strictEqual(lost.fill, 'red');
    });

    it('ignores diagnostics disabled on the sensor or on the node', function () {
        // faultSignal rimasto salvato ma feature faultInfo non abilitata
        assert.strictEqual(envSensors.status({ typeId: 'presenceSensor', presence: true, faultSignal: true }).text, 'Presence');
        const faulty = { typeId: 'presenceSensor', presence: false, faultInfo: true, faultSignal: true };
        assert.strictEqual(envSensors.status(faulty).text, 'No Presence · Fault');
        assert.strictEqual(envSensors.status(faulty, { diagnostics: false }).text, 'No Presence');
    });
});
