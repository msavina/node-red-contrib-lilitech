'use strict';

const assert = require('assert');
const meteringSensors = require('../lib/families/metering-sensors');

describe('metering-sensors family', function () {
    const single = { typeId: 'singlePhaseEnergyMeter' };
    const three = { typeId: 'threePhaseEnergyMeter' };

    it('resets the relative energy like the app', function () {
        assert.deepStrictEqual(meteringSensors.parseInput({ topic: 'activeEnergyRelativeLaReset', payload: true }, single), {
            activeEnergyRelativeLaReset: true
        });
        assert.deepStrictEqual(meteringSensors.parseInput({ payload: { activeEnergyRelativeTotalReset: 'true' } }, three), {
            activeEnergyRelativeTotalReset: true
        });
        assert.deepStrictEqual(meteringSensors.writableItems(three), [
            'activeEnergyRelativeTotalReset',
            'activeEnergyRelativeLaReset',
            'activeEnergyRelativeLbReset',
            'activeEnergyRelativeLcReset'
        ]);
    });

    it('rejects invalid commands', function () {
        assert.throws(() => meteringSensors.parseInput({ topic: 'activeEnergyRelativeLaReset', payload: false }, single), /accepts only true/);
        assert.throws(() => meteringSensors.parseInput({ topic: 'activeEnergyRelativeTotalReset', payload: true }, single), /not writable/);
        assert.throws(() => meteringSensors.parseInput({ payload: true }, single), /Set msg.topic/);
        assert.throws(() => meteringSensors.parseInput({ topic: 'x', payload: true }, { typeId: 'levelSensor' }), /has no commands/);
        assert.throws(() => meteringSensors.parseInput({ payload: true }, { typeId: 'humiditySensor' }), /Unsupported metering sensor type/);
    });

    it('exposes the measures enabled by the features', function () {
        assert.deepStrictEqual(meteringSensors.readableItems({ ...single, activePowerInfo: true, voltageInfo: true, keepAlive: true }), [
            'activeEnergyAbsoluteLaValue',
            'activeEnergyRelativeLaValue',
            'activeEnergyRelativeLaValueTimestamp',
            'activePowerLaValue',
            'voltageLaValue',
            'sensorLoss'
        ]);
        const items = meteringSensors.readableItems({ ...three, activePowerInfo: true });
        assert.deepStrictEqual(items.slice(0, 4), [
            'activeEnergyAbsoluteTotalValue',
            'activeEnergyRelativeTotalValue',
            'activeEnergyRelativeTotalValueTimestamp',
            'totalActivePowerValue'
        ]);
        assert.ok(['activePowerLaValue', 'activePowerLbValue', 'activePowerLcValue'].every((item) => items.includes(item)));
        assert.deepStrictEqual(meteringSensors.readableItems({ typeId: 'pressureSensor', faultInfo: true }), ['pressureValue', 'faultSignal']);
        assert.deepStrictEqual(meteringSensors.readableItems({ typeId: 'other' }), []);
        // L'editor elenca solo gli items scrivibili: la misura dei sensori è solo in uscita
        assert.deepStrictEqual(meteringSensors.editorItems({ typeId: 'pressureSensor' }), []);
        assert.deepStrictEqual(meteringSensors.editorItems(single), ['activeEnergyRelativeLaReset']);
    });

    it('adds the unit and rounds the float noise', function () {
        assert.deepStrictEqual(meteringSensors.outputExtras('activeEnergyRelativeLbValue'), { unit: 'Wh' });
        assert.deepStrictEqual(meteringSensors.outputExtras('totalActivePowerValue'), { unit: 'W' });
        assert.deepStrictEqual(meteringSensors.outputExtras('reactivePowerLaValue'), { unit: 'var' });
        assert.deepStrictEqual(meteringSensors.outputExtras('activeEnergyRelativeLaValueTimestamp'), {});
        assert.deepStrictEqual(meteringSensors.outputExtras('powerFactorLaValue'), {});
        assert.deepStrictEqual(meteringSensors.outputExtras('levelValue'), { unit: 'm' });
        assert.strictEqual(meteringSensors.outputValue('voltageLaValue', 229.89999389648438), 229.9);
        assert.strictEqual(meteringSensors.outputValue('activeEnergyRelativeLaValueTimestamp', 1700000000123), 1700000000123);
    });

    it('shows the power, the energy and the diagnostics', function () {
        assert.strictEqual(meteringSensors.status(single).text, 'No Value');
        assert.strictEqual(
            meteringSensors.status({ ...single, activePowerInfo: true, activePowerLaValue: 1250, activeEnergyAbsoluteLaValue: 345600 }).text,
            '1.25 kW · 345.6 kWh'
        );
        // Senza activePowerInfo la potenza non si mostra
        assert.strictEqual(meteringSensors.status({ ...three, totalActivePowerValue: 900, activeEnergyAbsoluteTotalValue: 1000 }).text, '1.0 kWh');
        assert.strictEqual(meteringSensors.status({ typeId: 'temperatureSensor', temperatureValue: 21.456 }).text, '21.46 °C');
        const lost = meteringSensors.status({ typeId: 'levelSensor', levelValue: 1.2, keepAlive: true, sensorLoss: true });
        assert.deepStrictEqual([lost.fill, lost.text], ['red', '1.2 m · Sensor Lost']);
        const battery = meteringSensors.status({ typeId: 'levelSensor', levelValue: 1.2, lowBatteryDetection: true, lowBattery: true });
        assert.deepStrictEqual([battery.fill, battery.text], ['yellow', '1.2 m · Low Battery']);
        // Senza la feature abilitata la diagnostica non conta
        assert.strictEqual(meteringSensors.status({ typeId: 'levelSensor', levelValue: 1.2, faultSignal: true }).text, '1.2 m');
        assert.strictEqual(meteringSensors.status({ typeId: 'other' }).text, 'Unknown Type other');
    });
});
