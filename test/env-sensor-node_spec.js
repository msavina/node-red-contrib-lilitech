'use strict';

const assert = require('assert');
const helper = require('node-red-node-test-helper');
const headunitNode = require('../nodes/lilitech-headunit.js');
const envSensorNode = require('../nodes/lilitech-env-sensor.js');
const { startFakeTube, startFakeDevices } = require('./fake-tube');

helper.init(require.resolve('node-red'));

const FAMILY_ID = 'environment-sensors';
const SENSOR = { deviceId: 'env-1', name: 'Living room', typeId: 'temperatureSensor', roomId: 'room-1', temperatureValue: 21.5, temperatureMaxValue: 24 };

describe('lilitech-env-sensor node', function () {
    let tube;
    let devices;

    beforeEach(async function () {
        tube = await startFakeTube();
        devices = await startFakeDevices(tube.url, { [FAMILY_ID]: [{ ...SENSOR }] });
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
            { id: 's1', type: 'lilitech-env-sensor', headunit: 'hu', deviceId: 'env-1', initialState: true, wires: [['out']], ...extra },
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

    it('emits the initial value with its unit, without statistics by default', async function () {
        await helper.load([headunitNode, envSensorNode], flow());
        const msgs = collect();
        await waitFor(() => msgs.length >= 1);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.deepStrictEqual(msgs.map((m) => [m.topic, m.payload, m.unit]), [['temperatureValue', 21.5, '°C']]);
        assert.strictEqual(msgs[0].device.name, 'Living room');
    });

    it('emits statistics when enabled', async function () {
        await helper.load([headunitNode, envSensorNode], flow({ statistics: true }));
        const msgs = collect();
        await waitFor(() => msgs.length === 2);
        assert.deepStrictEqual(msgs[1].topic, 'temperatureMaxValue');
    });

    it('emits the values sent by the headunit', async function () {
        await helper.load([headunitNode, envSensorNode], flow({ initialState: false }));
        const s1 = helper.getNode('s1');
        await waitFor(() => s1.headunit.client.getDevice(FAMILY_ID, 'env-1'));
        const msgs = collect();
        devices.emitUpdate({ deviceId: 'env-1', temperatureValue: 22.1 }, FAMILY_ID);
        await waitFor(() => msgs.length === 1);
        assert.strictEqual(msgs[0].payload, 22.1);
        assert.strictEqual(msgs[0].origin, 'UNIT');
    });

    it('has no input', async function () {
        await helper.load([headunitNode, envSensorNode], flow());
        assert.strictEqual(helper.getNode('s1').listenerCount('input'), 0);
    });
});
