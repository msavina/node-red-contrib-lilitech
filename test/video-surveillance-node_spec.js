'use strict';

const assert = require('assert');
const helper = require('node-red-node-test-helper');
const headunitNode = require('../nodes/lilitech-headunit.js');
const videoSurveillanceNode = require('../nodes/lilitech-video-surveillance.js');
const { startFakeTube, startFakeDevices } = require('./fake-tube');

helper.init(require.resolve('node-red'));

const FAMILY_ID = 'video-surveillances';
const CAMERA = {
    deviceId: 'cam-1',
    name: 'Garden camera',
    typeId: 'videoCamera',
    roomId: 'room-1',
    loopRecording: true,
    status: 'online',
    triggerRecording: 'idle'
};

describe('lilitech-video-surveillance node', function () {
    let tube;
    let devices;

    beforeEach(async function () {
        tube = await startFakeTube();
        devices = await startFakeDevices(tube.url, { [FAMILY_ID]: [{ ...CAMERA }] });
        await new Promise((resolve) => helper.startServer(resolve));
    });

    afterEach(async function () {
        await helper.unload();
        await new Promise((resolve) => helper.stopServer(resolve));
        devices.close();
        await tube.close();
    });

    /*------------------------------------------------------------------------------------------------------------------
    ------------------------------------------------------------------------------------------------------------------*/
    function flow(extra = {}) {
        return [
            { id: 'hu', type: 'lilitech-headunit', url: tube.url },
            { id: 'v1', type: 'lilitech-video-surveillance', headunit: 'hu', deviceId: 'cam-1', initialState: true, wires: [['out']], ...extra },
            { id: 'out', type: 'helper' }
        ];
    }

    /*------------------------------------------------------------------------------------------------------------------
    ------------------------------------------------------------------------------------------------------------------*/
    function collect() {
        const msgs = [];
        helper.getNode('out').on('input', (msg) => msgs.push(msg));
        return msgs;
    }

    /*------------------------------------------------------------------------------------------------------------------
    ------------------------------------------------------------------------------------------------------------------*/
    function waitFor(condition, timeout = 2000) {
        return new Promise((resolve, reject) => {
            const started = Date.now();
            const timer = setInterval(() => {
                if (condition()) {
                    clearInterval(timer);
                    resolve();
                } else if (Date.now() - started > timeout) {
                    clearInterval(timer);
                    reject(new Error('Timeout'));
                }
            }, 10);
        });
    }

    /*------------------------------------------------------------------------------------------------------------------
    ------------------------------------------------------------------------------------------------------------------*/
    async function loadReady(extra) {
        await helper.load([headunitNode, videoSurveillanceNode], flow(extra));
        const v1 = helper.getNode('v1');
        await waitFor(() => v1.headunit.client.getDevice(FAMILY_ID, 'cam-1'));
        return v1;
    }

    it('emits the initial state', async function () {
        await helper.load([headunitNode, videoSurveillanceNode], flow());
        const msgs = collect();
        await waitFor(() => msgs.length >= 2);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.deepStrictEqual(
            msgs.map((m) => [m.topic, m.payload, m.origin]),
            [
                ['status', 'online', 'INITIAL'],
                ['triggerRecording', 'idle', 'INITIAL']
            ]
        );
    });

    it('starts a recording with the node name as source', async function () {
        const v1 = await loadReady({ initialState: false, name: 'Night flow' });
        v1.receive({ payload: true });
        await waitFor(() => devices.received.length === 1);
        assert.deepStrictEqual(devices.received[0].payload, {
            unitId: 'unit-1',
            deviceId: 'cam-1',
            familyId: 'video-surveillances',
            roomId: 'room-1',
            authorName: 'Node-RED',
            triggerRecording: 'manual',
            source: 'Night flow'
        });
    });

    it('emits the recording state and the uploaded clip', async function () {
        await loadReady({ initialState: false });
        const msgs = collect();
        devices.emitUpdate({ deviceId: 'cam-1', triggerRecording: 'auto', source: 'Kitchen sensor' }, FAMILY_ID);
        devices.emitUpdate({ deviceId: 'cam-1', triggerRecording: 'idle' }, FAMILY_ID);
        devices.emitHistory({
            eventName: 'DEVICES_VIDEO_SURVEILLANCES_NEW_VIDEO_VERIFICATION',
            sourceId: 'cam-1',
            payload: { source: 'Kitchen sensor', fileName: '2026/11/05/cam-1_101500.mp4' }
        });
        await waitFor(() => msgs.length === 3);
        assert.deepStrictEqual(
            msgs.map((m) => [m.topic, m.payload]),
            [
                ['triggerRecording', 'auto'],
                ['triggerRecording', 'idle'],
                ['clip', '2026/11/05/cam-1_101500.mp4']
            ]
        );
        assert.deepStrictEqual([msgs[2].trigger, msgs[2].source, msgs[2].device.name], ['auto', 'Kitchen sensor', 'Garden camera']);
    });
});
