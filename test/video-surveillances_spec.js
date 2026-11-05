'use strict';

const assert = require('assert');
const videoSurveillances = require('../lib/families/video-surveillances');

describe('video-surveillances family', function () {
    const camera = { typeId: 'videoCamera', loopRecording: true, status: 'online', triggerRecording: 'idle' };

    it('records a clip like the REC button of the app', function () {
        assert.deepStrictEqual(videoSurveillances.parseInput({ payload: true }, camera, { name: 'Night flow' }), {
            triggerRecording: 'manual',
            source: 'Night flow'
        });
        assert.deepStrictEqual(videoSurveillances.parseInput({ topic: 'triggerRecording', payload: 'REC', source: 'Doorbell' }, camera), {
            triggerRecording: 'manual',
            source: 'Doorbell'
        });
        assert.strictEqual(videoSurveillances.parseInput({ payload: 'manual' }, camera).source, 'Node-RED');
    });

    it('rejects stop commands, unknown topics and cameras without loop recording', function () {
        assert.throws(() => videoSurveillances.parseInput({ payload: false }, camera), /the clip stops by itself/);
        assert.throws(() => videoSurveillances.parseInput({ payload: 'auto' }, camera), /Invalid recording command "auto"/);
        assert.throws(() => videoSurveillances.parseInput({ topic: 'status', payload: true }, camera), /msg.topic "status" is not a known item/);
        assert.throws(() => videoSurveillances.parseInput({ payload: true }, { ...camera, loopRecording: false }), /enable the loop recording/);
        assert.throws(() => videoSurveillances.parseInput({ payload: true }, { typeId: 'monitor' }), /Unsupported video surveillance type "monitor"/);
    });

    it('exposes the recording only with the loop recording', function () {
        assert.deepStrictEqual(videoSurveillances.readableItems(camera), ['status', 'triggerRecording']);
        assert.deepStrictEqual(videoSurveillances.readableItems({ ...camera, loopRecording: false }), ['status']);
        assert.deepStrictEqual(videoSurveillances.editorItems({ ...camera, loopRecording: false }), []);
        assert.deepStrictEqual(videoSurveillances.readableItems({ typeId: 'monitor' }), []);
    });

    it('emits the recorded clips from the history', function () {
        assert.deepStrictEqual(
            videoSurveillances.historyMessage({
                eventName: 'DEVICES_VIDEO_SURVEILLANCES_NEW_VIDEO_VERIFICATION',
                payload: { source: 'Kitchen sensor', fileName: '2026/11/05/cam-1_101500.mp4' }
            }),
            { topic: 'clip', payload: '2026/11/05/cam-1_101500.mp4', trigger: 'auto', source: 'Kitchen sensor' }
        );
        assert.strictEqual(videoSurveillances.historyMessage({ eventName: 'DEVICES_VIDEO_SURVEILLANCES_NEW_VIDEO_RECORDING', payload: {} }).trigger, 'manual');
        assert.strictEqual(videoSurveillances.historyMessage({ eventName: 'DEVICES_VIDEO_SURVEILLANCES_CAM_OFFLINE' }), null);
    });

    it('shows online, recording and offline', function () {
        assert.deepStrictEqual(videoSurveillances.status(camera), { fill: 'green', shape: 'dot', text: 'Online' });
        assert.strictEqual(videoSurveillances.status({ ...camera, triggerRecording: 'auto' }).text, 'Recording · Alarm');
        assert.strictEqual(videoSurveillances.status({ ...camera, triggerRecording: 'manual' }).text, 'Recording');
        assert.deepStrictEqual(videoSurveillances.status({ ...camera, status: 'offline', triggerRecording: 'manual' }), {
            fill: 'red',
            shape: 'ring',
            text: 'Offline'
        });
        assert.strictEqual(videoSurveillances.status({ typeId: 'monitor' }).text, 'Unknown Type monitor');
    });
});
