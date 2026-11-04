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
        assert.deepStrictEqual(lights.parseInput({ topic: 'brightness ', payload: 50 }, dimmer, {}), { brightness: 50 });
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

    it('accepts the common color formats', function () {
        const red = '{"r":255,"g":0,"b":0}';
        for (const color of [{ r: 255, g: 0, b: 0 }, '#ff0000', red, '{r:255, g:0,b:0}', '255,0,0', 'rgb(255, 0, 0)']) {
            assert.deepStrictEqual(lights.parseInput({ topic: 'color', payload: color }, rgb, {}), { color: red });
        }
        assert.throws(() => lights.parseInput({ topic: 'color', payload: 'red' }, rgb, {}), /Invalid color/);
        assert.throws(() => lights.parseInput({ topic: 'color', payload: '{r:255}' }, rgb, {}), /Invalid color/);
    });

    it('accepts scenes only when enabled', function () {
        assert.deepStrictEqual(lights.parseInput({ topic: 'scene', payload: 3 }, { typeId: 'dimmer', scenesAvailable: true }, {}), { scene: 3 });
    });

    it('rejects invalid values', function () {
        assert.throws(() => lights.parseInput({ payload: 'maybe' }, dimmer, {}), /Invalid boolean/);
        assert.throws(() => lights.parseInput({ topic: 'brightness', payload: 'abc' }, dimmer, {}), /Invalid number/);
    });

    it('points out an unknown topic', function () {
        assert.throws(() => lights.parseInput({ topic: 'brigthness', payload: 50 }, dimmer, {}), /msg.topic "brigthness" is not a known item/);
        // Un topic qualsiasi con un payload booleano resta un comando switch
        assert.deepStrictEqual(lights.parseInput({ topic: 'kitchen', payload: true }, dimmer, {}), { switch: true });
    });

    it('shows the presence simulator in the status', function () {
        assert.deepStrictEqual(lights.status({ ...dimmer, switchFeedback: true, brightnessFeedback: 80, simulated: true }), {
            fill: 'green',
            shape: 'dot',
            text: 'On · 80% · Simulated'
        });
        assert.strictEqual(lights.status({ ...dimmer, switchFeedback: false, simulated: true }).text, 'Off · Simulated');
        assert.strictEqual(lights.status({ ...dimmer, switchFeedback: false, simulated: false }).text, 'Off');
    });
});
