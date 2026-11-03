'use strict';

const assert = require('assert');
const electronics = require('../lib/families/electronics');

describe('electronics family', function () {
    it('exposes only isOnline', function () {
        assert.deepStrictEqual(electronics.readableItems({ typeId: 'laptop' }), ['isOnline']);
        assert.deepStrictEqual(electronics.editorItems({ typeId: 'iphone' }), ['isOnline']);
    });

    it('describes the state in the node status', function () {
        assert.deepStrictEqual(electronics.status({ isOnline: true }), { fill: 'green', shape: 'dot', text: 'Online' });
        assert.strictEqual(electronics.status({ isOnline: false }).text, 'Offline');
        assert.strictEqual(electronics.status({}).text, 'Unknown');
    });
});
