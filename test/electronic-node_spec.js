'use strict';

const assert = require('assert');
const helper = require('node-red-node-test-helper');
const headunitNode = require('../nodes/lilitech-headunit.js');
const electronicNode = require('../nodes/lilitech-electronic.js');
const { startFakeTube, startFakeDevices } = require('./fake-tube');

helper.init(require.resolve('node-red'));

const FAMILY_ID = 'electronics';
const DEVICE = { deviceId: 'el-1', name: 'Phone', typeId: 'smartphone', roomId: 'room-1', isOnline: true };

describe('lilitech-electronic node', function () {
    let tube;
    let devices;

    beforeEach(async function () {
        tube = await startFakeTube();
        devices = await startFakeDevices(tube.url, { [FAMILY_ID]: [{ ...DEVICE }] });
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
            { id: 'e1', type: 'lilitech-electronic', headunit: 'hu', deviceId: 'el-1', initialState: true, wires: [['out']], ...extra },
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

    it('emits the initial state', async function () {
        await helper.load([headunitNode, electronicNode], flow());
        const msgs = collect();
        await waitFor(() => msgs.length >= 1);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.deepStrictEqual(msgs.map((m) => [m.topic, m.payload, m.origin]), [['isOnline', true, 'INITIAL']]);
        assert.strictEqual(msgs[0].device.name, 'Phone');
    });

    it('emits the state sent by the headunit', async function () {
        await helper.load([headunitNode, electronicNode], flow({ initialState: false }));
        const e1 = helper.getNode('e1');
        await waitFor(() => e1.headunit.client.getDevice(FAMILY_ID, 'el-1'));
        const msgs = collect();
        devices.emitUpdate({ deviceId: 'el-1', isOnline: false }, FAMILY_ID);
        await waitFor(() => msgs.length === 1);
        assert.strictEqual(msgs[0].payload, false);
        assert.strictEqual(msgs[0].origin, 'UNIT');
    });

    it('has no input', async function () {
        await helper.load([headunitNode, electronicNode], flow());
        assert.strictEqual(helper.getNode('e1').listenerCount('input'), 0);
    });
});
