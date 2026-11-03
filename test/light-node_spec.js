'use strict';

const assert = require('assert');
const helper = require('node-red-node-test-helper');
const headunitNode = require('../nodes/lilitech-headunit.js');
const lightNode = require('../nodes/lilitech-light.js');
const { startFakeTube, startFakeDevices } = require('./fake-tube');

helper.init(require.resolve('node-red'));

const LIGHT = { deviceId: 'light-1', name: 'Kitchen', typeId: 'dimmer', roomId: 'room-1', switchFeedback: false, brightnessFeedback: 40 };

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
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

describe('lilitech-light node', function () {
    let tube;
    let devices;

    beforeEach(async function () {
        tube = await startFakeTube();
        devices = await startFakeDevices(tube.url, [{ ...LIGHT }]);
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
            { id: 'l1', type: 'lilitech-light', headunit: 'hu', deviceId: 'light-1', outputMode: 'feedback', initialState: true, wires: [['out']], ...extra },
            { id: 'out', type: 'helper' }
        ];
    }

    it('emits the initial state on deploy', async function () {
        await helper.load([headunitNode, lightNode], flow());
        const out = helper.getNode('out');
        const msgs = [];
        out.on('input', (msg) => msgs.push(msg));
        await waitFor(() => msgs.length === 2);
        assert.deepStrictEqual(msgs.map((m) => [m.topic, m.payload]), [
            ['switchFeedback', false],
            ['brightnessFeedback', 40]
        ]);
        assert.strictEqual(msgs[0].origin, 'INITIAL');
        assert.strictEqual(msgs[0].device.name, 'Kitchen');
    });

    it('writes the switch on the tube', async function () {
        await helper.load([headunitNode, lightNode], flow({ initialState: false }));
        const l1 = helper.getNode('l1');
        await waitFor(() => l1.headunit.client.getDevice('lights', 'light-1'));
        l1.receive({ payload: { switch: true, brightness: 70 } });
        await waitFor(() => devices.received.length === 1);
        assert.deepStrictEqual(devices.received[0].payload, {
            unitId: 'unit-1',
            deviceId: 'light-1',
            familyId: 'lights',
            roomId: 'room-1',
            authorName: 'Node-RED',
            switch: true,
            brightness: 70
        });
    });

    it('emits the feedback sent by the headunit', async function () {
        await helper.load([headunitNode, lightNode], flow({ initialState: false }));
        const l1 = helper.getNode('l1');
        const out = helper.getNode('out');
        await waitFor(() => l1.headunit.client.getDevice('lights', 'light-1'));
        const received = new Promise((resolve) => out.on('input', resolve));
        // Il comando (switch) viene filtrato in modalità feedback, esce solo switchFeedback
        devices.emitUpdate({ deviceId: 'light-1', switch: true, switchFeedback: true });
        const msg = await received;
        assert.strictEqual(msg.topic, 'switchFeedback');
        assert.strictEqual(msg.payload, true);
        assert.strictEqual(msg.origin, 'UNIT');
    });

    it('ignores updates of other lights', async function () {
        await helper.load([headunitNode, lightNode], flow({ initialState: false }));
        const l1 = helper.getNode('l1');
        const out = helper.getNode('out');
        await waitFor(() => l1.headunit.client.getDevice('lights', 'light-1'));
        let count = 0;
        out.on('input', () => count++);
        devices.emitUpdate({ deviceId: 'light-2', switchFeedback: true });
        await new Promise((resolve) => setTimeout(resolve, 200));
        assert.strictEqual(count, 0);
    });

    it('reports an error for unsupported items', async function () {
        await helper.load([headunitNode, lightNode], flow({ initialState: false }));
        const l1 = helper.getNode('l1');
        await waitFor(() => l1.headunit.client.getDevice('lights', 'light-1'));
        const errored = new Promise((resolve) => l1.on('call:error', (call) => resolve(call.args[0])));
        l1.receive({ payload: { color: '#ff0000' } });
        const error = await errored;
        assert.match(String(error), /not writable/);
        assert.strictEqual(devices.received.length, 0);
    });
});
