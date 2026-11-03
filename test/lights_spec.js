'use strict';

const assert = require('assert');
const lights = require('../lib/families/lights');

describe('lights family', function () {
    const dimmer = { typeId: 'dimmer' };
    const rgb = { typeId: 'rgb' };

    it('treats a plain payload as switch', function () {
        assert.deepStrictEqual(lights.parseInput({ payload: true }, dimmer, {}), { switch: true });
        assert.deepStrictEqual(lights.parseInput({ payload: 'off' }, dimmer, {}), { switch: false });
    });

    it('toggles from the switch feedback', function () {
        assert.deepStrictEqual(lights.parseInput({ payload: 'toggle' }, dimmer, { switchFeedback: true }), { switch: false });
    });

    it('writes the item named by the topic and clamps percentages', function () {
        assert.deepStrictEqual(lights.parseInput({ topic: 'brightness', payload: 150 }, dimmer, {}), { brightness: 100 });
    });

    it('rejects items not supported by the light type', function () {
        assert.throws(() => lights.parseInput({ payload: { color: '#ff0000' } }, dimmer, {}), /not writable/);
        assert.throws(() => lights.parseInput({ payload: { scene: 1 } }, rgb, {}), /not writable/);
    });

    it('serializes colors and parses them back on output', function () {
        const items = lights.parseInput({ payload: { color: '#ff8000' } }, rgb, {});
        assert.strictEqual(items.color, '{"r":255,"g":128,"b":0}');
        assert.deepStrictEqual(lights.outputValue('colorFeedback', items.color), { r: 255, g: 128, b: 0 });
    });

    it('accepts scenes only when enabled', function () {
        assert.deepStrictEqual(lights.parseInput({ topic: 'scene', payload: 3 }, { typeId: 'dimmer', scenesAvailable: true }, {}), { scene: 3 });
    });

    it('rejects invalid values', function () {
        assert.throws(() => lights.parseInput({ payload: 'maybe' }, dimmer, {}), /Invalid boolean/);
        assert.throws(() => lights.parseInput({ topic: 'brightness', payload: 'abc' }, dimmer, {}), /Invalid number/);
    });
});
