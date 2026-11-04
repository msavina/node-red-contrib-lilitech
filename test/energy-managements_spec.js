'use strict';

const assert = require('assert');
const energyManagements = require('../lib/families/energy-managements');

describe('energy-managements family', function () {
    const grid = { typeId: 'gridControl', status: 'stop' };
    const green = { typeId: 'greenControl', status: 'play' };

    it('parses the command', function () {
        assert.deepStrictEqual(energyManagements.parseInput({ payload: 'Play' }, grid), { command: 'play' });
        assert.deepStrictEqual(energyManagements.parseInput({ payload: false }, grid), { command: 'stop' });
        assert.deepStrictEqual(energyManagements.parseInput({ payload: 'pause' }, grid), { command: 'stop' });
        assert.deepStrictEqual(energyManagements.parseInput({ payload: 'toggle' }, grid), { command: 'play' });
        assert.deepStrictEqual(energyManagements.parseInput({ topic: 'command', payload: 'toggle' }, green), { command: 'stop' });
        assert.throws(() => energyManagements.parseInput({ payload: 'idle' }, grid), /Invalid command/);
    });

    it('rejects unknown types, read only items and points out an unknown topic', function () {
        assert.throws(() => energyManagements.parseInput({ payload: 'play' }, { typeId: 'other' }), /Unsupported energy management type/);
        assert.throws(() => energyManagements.parseInput({ payload: { gridContractedPower: 6000 } }, grid), /not writable/);
        assert.throws(() => energyManagements.parseInput({ topic: 'comand', payload: 'go' }, grid), /msg.topic "comand" is not a known item/);
    });

    it('exposes the items of the type', function () {
        assert.deepStrictEqual(energyManagements.readableItems(grid), [
            'command',
            'status',
            'gridPower',
            'overloadBadge',
            'economyBadge',
            'gridProduction',
            'gridToHouse'
        ]);
        assert.ok(energyManagements.readableItems(green).includes('greenToGrid'));
        assert.ok(energyManagements.readableItems(green).includes('houseConsumption'));
        assert.ok(!energyManagements.readableItems(green).includes('greenRule'));
        assert.deepStrictEqual(energyManagements.editorItems(green), ['command']);
    });

    it('filters the command in feedback mode and adds the unit', function () {
        assert.strictEqual(energyManagements.isOutputItem('command', { outputMode: 'feedback' }), false);
        assert.strictEqual(energyManagements.isOutputItem('status', { outputMode: 'feedback' }), true);
        assert.strictEqual(energyManagements.isOutputItem('command', { outputMode: 'all' }), true);
        assert.deepStrictEqual(energyManagements.outputExtras('housePower'), { unit: 'W' });
        assert.deepStrictEqual(energyManagements.outputExtras('overloadBadge'), {});
    });

    it('shows the state, the powers and the badges', function () {
        assert.strictEqual(energyManagements.status(grid).text, 'Stopped');
        assert.strictEqual(energyManagements.status({ typeId: 'gridControl' }).text, 'Unknown');
        assert.strictEqual(energyManagements.status({ ...grid, status: 'play', gridPower: 2400 }).text, 'Running · Grid 2.4 kW');
        assert.strictEqual(
            energyManagements.status({ ...green, housePower: 2400, greenPower: 3000, greenProduction: true, economyBadge: true }).text,
            'Running · House 2.4 kW · Green 3.0 kW · Economy'
        );
        const overload = energyManagements.status({ ...grid, status: 'play', overloadBadge: 'detach' });
        assert.deepStrictEqual([overload.fill, overload.text], ['red', 'Running · Overload']);
        assert.strictEqual(energyManagements.status({ typeId: 'other' }).text, 'Unknown Type other');
    });
});
