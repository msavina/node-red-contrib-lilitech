'use strict';

const assert = require('assert');
const securitySensors = require('../lib/families/security-sensors');

describe('security-sensors family', function () {
    const contact = { typeId: 'magneticContact', input: false };

    it('writes exclusion, testing and maintenance like the app', function () {
        assert.deepStrictEqual(securitySensors.parseInput({ topic: 'maintenance', payload: 'on' }, contact), { maintenance: true });
        assert.deepStrictEqual(securitySensors.parseInput({ payload: { testing: false } }, contact), { testing: false });
        assert.deepStrictEqual(securitySensors.parseInput({ topic: 'exclusion', payload: true }, { ...contact, excludible: true }), {
            exclusion: true
        });
        assert.deepStrictEqual(securitySensors.writableItems({ ...contact, excludible: true }), ['exclusion', 'testing', 'maintenance']);
    });

    it('rejects invalid commands', function () {
        assert.throws(() => securitySensors.parseInput({ topic: 'exclusion', payload: true }, contact), /enable "excludible"/);
        assert.throws(() => securitySensors.parseInput({ topic: 'exclusionTimer', payload: 60000 }, contact), /not writable/);
        assert.throws(() => securitySensors.parseInput({ topic: 'input', payload: true }, contact), /not writable/);
        assert.throws(() => securitySensors.parseInput({ payload: true }, contact), /Set msg.topic/);
        assert.throws(() => securitySensors.parseInput({ topic: 'testing', payload: 'maybe' }, contact), /Invalid boolean/);
        assert.throws(() => securitySensors.parseInput({ topic: 'testing', payload: true }, { typeId: 'other' }), /Unsupported security sensor type/);
    });

    it('exposes the items enabled by the features', function () {
        assert.deepStrictEqual(securitySensors.readableItems(contact), ['input', 'trigger', 'armed', 'testing', 'maintenance']);
        assert.deepStrictEqual(securitySensors.readableItems({ ...contact, excludible: true, tamperDetection: true, petDetection: true }), [
            'input',
            'trigger',
            'armed',
            'exclusion',
            'testing',
            'maintenance',
            'tamper',
            'petDetected'
        ]);
        assert.deepStrictEqual(securitySensors.readableItems({ typeId: 'other' }), []);
        assert.strictEqual(securitySensors.isOutputItem('maintenance', {}), true);
    });

    it('shows the state, the badges and the anomalies', function () {
        assert.strictEqual(securitySensors.status({ typeId: 'smokeDetector' }).text, 'No Data');
        assert.strictEqual(securitySensors.status(contact).text, 'Closed');
        assert.deepStrictEqual(securitySensors.status({ ...contact, input: true, armed: true }), { fill: 'green', shape: 'dot', text: 'Open · Armed' });
        const excluded = securitySensors.status({ ...contact, excludible: true, exclusion: true, maintenance: true });
        assert.deepStrictEqual([excluded.fill, excluded.text], ['yellow', 'Closed · Maintenance · Excluded']);
        const tamper = securitySensors.status({ ...contact, testing: true, tamperDetection: true, tamper: true, keepAlive: true, sensorLoss: true });
        assert.deepStrictEqual([tamper.fill, tamper.text], ['red', 'Closed · Test · Tamper · Sensor Lost']);
        // Senza la feature abilitata l'anomalia non conta
        assert.strictEqual(securitySensors.status({ ...contact, faultSignal: true }).text, 'Closed');
        assert.strictEqual(securitySensors.status({ typeId: 'other' }).text, 'Unknown Type other');
    });
});
