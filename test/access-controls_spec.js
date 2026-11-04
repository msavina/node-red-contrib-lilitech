'use strict';

const assert = require('assert');
const accessControls = require('../lib/families/access-controls');

describe('access-controls family', function () {
    const reader = { typeId: 'keypadRfidReader', accessFeedback: 'ready' };
    const excludible = { ...reader, excludible: true };

    it('writes the exclusion only when excludible', function () {
        assert.deepStrictEqual(accessControls.parseInput({ payload: false }, excludible), { exclusion: false });
        assert.throws(() => accessControls.parseInput({ payload: true }, reader), /exclusion is not enabled/);
        assert.throws(() => accessControls.parseInput({ payload: true }, { typeId: 'other', excludible: true }), /Unsupported access control type/);
    });

    it('excludes until enabled again and does not accept a timer', function () {
        assert.deepStrictEqual(accessControls.parseInput({ payload: 'on' }, excludible), { exclusion: true });
        assert.throws(() => accessControls.parseInput({ payload: { exclusion: true, exclusionTimer: 60000 } }, excludible), /"exclusionTimer" is not writable/);
    });

    it('never writes pin or badge', function () {
        assert.throws(() => accessControls.parseInput({ payload: { pin: '123456' } }, excludible), /not writable/);
        assert.throws(() => accessControls.parseInput({ topic: 'badge', payload: 'yes' }, excludible), /msg.topic "badge" is not a known item/);
    });

    it('exposes the items enabled by the features, never pin and badge', function () {
        assert.deepStrictEqual(accessControls.readableItems(reader), []);
        assert.deepStrictEqual(accessControls.readableItems({ ...excludible, tamperDetection: true }), ['exclusion', 'tamper']);
        assert.deepStrictEqual(accessControls.editorItems({ ...reader, tamperDetection: true }), ['access', 'tamper']);
    });

    it('turns the history events into access messages', function () {
        assert.deepStrictEqual(
            accessControls.historyMessage({ eventName: 'DEVICES_ACCESS_CONTROLS_GRANTED_ACCESS', authorId: 'u-1', authorName: 'Mario Rossi', payload: null }),
            { topic: 'access', payload: 'granted', user: { id: 'u-1', name: 'Mario Rossi' } }
        );
        assert.deepStrictEqual(
            accessControls.historyMessage({ eventName: 'DEVICES_ACCESS_CONTROLS_DENIED_ACCESS', authorId: null, authorName: null, payload: { message: 'Not valid pin' } }),
            { topic: 'access', payload: 'denied', reason: 'Not valid pin' }
        );
        assert.strictEqual(accessControls.historyMessage({ eventName: 'DEVICES_ACCESS_CONTROLS_UNIDENTIFIED_USER' }).reason, 'Unidentified user');
        assert.strictEqual(accessControls.historyMessage({ eventName: 'DEVICES_ACCESS_CONTROLS_TAMPER_ON' }), null);
    });

    it('shows the last access, the exclusion and the tamper', function () {
        assert.strictEqual(accessControls.status(reader).text, 'Ready');
        assert.strictEqual(accessControls.status({ ...reader, accessFeedback: 'denied' }).fill, 'red');
        assert.strictEqual(accessControls.status({ ...excludible, exclusion: true }).text, 'Ready · Excluded');
        const tamper = accessControls.status({ ...reader, tamperDetection: true, tamper: true });
        assert.deepStrictEqual([tamper.fill, tamper.text], ['red', 'Ready · Tamper']);
    });
});
