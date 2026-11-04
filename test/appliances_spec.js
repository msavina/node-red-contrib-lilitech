'use strict';

const assert = require('assert');
const appliances = require('../lib/families/appliances');

describe('appliances family', function () {
    const appliance = { typeId: 'washingMachine', switchFeedback: false };

    it('treats a plain payload as switch', function () {
        assert.deepStrictEqual(appliances.parseInput({ payload: 'on' }, appliance), { switch: true });
        assert.deepStrictEqual(appliances.parseInput({ payload: 'toggle' }, { ...appliance, switchFeedback: true }), { switch: false });
        assert.deepStrictEqual(appliances.parseInput({ payload: { switch: 0 } }, appliance), { switch: false });
        assert.throws(() => appliances.parseInput({ payload: 'start' }, appliance), /Invalid boolean/);
    });

    it('rejects unknown types, read only items and points out an unknown topic', function () {
        assert.throws(() => appliances.parseInput({ payload: true }, { typeId: 'other' }), /Unsupported appliance type/);
        assert.throws(() => appliances.parseInput({ payload: { power: 100 } }, appliance), /not writable/);
        assert.throws(() => appliances.parseInput({ topic: 'swich', payload: 'x' }, appliance), /msg.topic "swich" is not a known item/);
    });

    it('exposes the switch and the measures enabled by the features', function () {
        assert.deepStrictEqual(appliances.readableItems(appliance), ['switch', 'switchFeedback', 'overload', 'economy', 'green']);
        assert.deepStrictEqual(appliances.readableItems({ ...appliance, energyInfo: true, estimatedVoltageInfoBoolean: true, faultInfo: true }), [
            'switch',
            'switchFeedback',
            'overload',
            'economy',
            'green',
            'energy',
            'energyRelative',
            'voltage',
            'faultSignal'
        ]);
        assert.deepStrictEqual(appliances.editorItems(appliance), ['switch']);
        assert.deepStrictEqual(appliances.readableItems({ typeId: 'other' }), []);
    });

    it('filters the switch in feedback mode and adds the unit', function () {
        assert.strictEqual(appliances.isOutputItem('switch', { outputMode: 'feedback' }), false);
        assert.strictEqual(appliances.isOutputItem('switchFeedback', { outputMode: 'feedback' }), true);
        assert.strictEqual(appliances.isOutputItem('switch', { outputMode: 'all' }), true);
        assert.deepStrictEqual(appliances.outputExtras('power'), { unit: 'W' });
        assert.deepStrictEqual(appliances.outputExtras('energyRelative'), { unit: 'Wh' });
        assert.deepStrictEqual(appliances.outputExtras('switchFeedback'), {});
    });

    it('shows the switch and the anomalies', function () {
        assert.strictEqual(appliances.status({ typeId: 'oven' }).text, 'Unknown');
        assert.strictEqual(appliances.status(appliance).text, 'Off');
        assert.strictEqual(appliances.status({ ...appliance, switchFeedback: true, powerInfo: true, power: 1200 }).text, 'On · 1.2 kW');
        assert.strictEqual(appliances.status({ ...appliance, switchFeedback: true, power: 1200 }).text, 'On');
        assert.strictEqual(appliances.status({ typeId: 'other' }).text, 'Unknown Type other');
        const overload = appliances.status({ ...appliance, overload: true, faultInfo: true, faultSignal: true });
        assert.deepStrictEqual([overload.fill, overload.text], ['red', 'Off · Overload · Fault']);
    });
});
