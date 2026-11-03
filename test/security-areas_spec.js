'use strict';

const assert = require('assert');
const securityAreas = require('../lib/families/security-areas');

const INTERNAL = { typeId: 'securityAreasInternalLogic', patrolable: true };
const EXTERNAL = { typeId: 'securityAreasExternalLogic' };

describe('security-areas family', function () {
    it('allows patrol only on internal logic areas with patrol enabled', function () {
        assert.deepStrictEqual(securityAreas.editorItems(INTERNAL), ['arm', 'disarm', 'patrol']);
        assert.deepStrictEqual(securityAreas.editorItems({ ...INTERNAL, patrolable: false }), ['arm', 'disarm']);
        assert.deepStrictEqual(securityAreas.editorItems({ ...EXTERNAL, patrolable: true }), ['arm', 'disarm']);
    });

    it('never emits the timers', function () {
        assert.deepStrictEqual(securityAreas.readableItems(INTERNAL), ['areaControl', 'areaStatus', 'memory', 'history']);
    });

    it('parses the commands', function () {
        assert.deepStrictEqual(securityAreas.parseInput({ payload: 'arm' }, INTERNAL), { areaControl: 'arm' });
        assert.deepStrictEqual(securityAreas.parseInput({ payload: ' Disarm ' }, INTERNAL), { areaControl: 'disarm' });
        assert.deepStrictEqual(securityAreas.parseInput({ payload: true }, EXTERNAL), { areaControl: 'arm' });
        assert.deepStrictEqual(securityAreas.parseInput({ payload: 'off' }, EXTERNAL), { areaControl: 'disarm' });
        assert.deepStrictEqual(securityAreas.parseInput({ payload: { areaControl: 'patrol' } }, INTERNAL), { areaControl: 'patrol' });
        assert.deepStrictEqual(securityAreas.parseInput({ topic: 'areaControl', payload: 'arm' }, INTERNAL), { areaControl: 'arm' });
    });

    it('rejects the commands not allowed', function () {
        assert.throws(() => securityAreas.parseInput({ payload: 'patrol' }, EXTERNAL), /allowed: arm, disarm/);
        assert.throws(() => securityAreas.parseInput({ payload: 'ready' }, INTERNAL), /Invalid command/);
        assert.throws(() => securityAreas.parseInput({ payload: { areaStatus: 'armed' } }, INTERNAL), /not writable/);
    });

    it('emits the commands only in "all" output mode', function () {
        assert.strictEqual(securityAreas.isOutputItem('areaStatus', {}), true);
        assert.strictEqual(securityAreas.isOutputItem('areaControl', {}), false);
        assert.strictEqual(securityAreas.isOutputItem('areaControl', { outputMode: 'all' }), true);
        assert.strictEqual(securityAreas.isOutputItem('areaControl', { outputMode: 'state' }), false);
        assert.strictEqual(securityAreas.isOutputItem('areaStatus', { outputMode: 'state' }), true);
    });

    it('describes the state in the node status', function () {
        assert.strictEqual(securityAreas.status({ areaStatus: 'armed' }).text, 'Armed');
        assert.strictEqual(securityAreas.status({ areaStatus: 'alarm', memory: true }).text, 'Alarm');
        const memory = securityAreas.status({ areaStatus: 'disarmed', memory: true });
        assert.strictEqual(memory.text, 'Disarmed · Alarm Memory');
        assert.strictEqual(memory.fill, 'red');
        assert.strictEqual(securityAreas.status({}).text, 'Unknown');
    });
});
