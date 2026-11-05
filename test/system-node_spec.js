'use strict';

const assert = require('assert');
const helper = require('node-red-node-test-helper');
const headunitNode = require('../nodes/lilitech-headunit.js');
const systemNode = require('../nodes/lilitech-system.js');
const { startFakeTube, startFakeDevices } = require('./fake-tube');

helper.init(require.resolve('node-red'));

const FAMILY_ID = 'systems';
const CLOCK = {
    deviceId: 'clock-1',
    name: 'Clock',
    typeId: 'clock',
    roomId: 'room-1',
    sunrise: false,
    sunset: false,
    night: false,
    sunriseTime: '07:05',
    sunsetTime: '17:12',
    currentMinute: 15
};

describe('lilitech-system node', function () {
    let tube;
    let devices;

    beforeEach(async function () {
        tube = await startFakeTube();
        devices = await startFakeDevices(tube.url, { [FAMILY_ID]: [{ ...CLOCK }] });
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
            { id: 's1', type: 'lilitech-system', headunit: 'hu', deviceId: 'clock-1', initialState: true, wires: [['out']], ...extra },
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
        Nodo caricato senza stato iniziale, una volta ricevuto l'elenco dei device
    ------------------------------------------------------------------------------------------------------------------*/
    async function loadWithoutInitial(extra = {}) {
        await helper.load([headunitNode, systemNode], flow({ initialState: false, ...extra }));
        const s1 = helper.getNode('s1');
        await waitFor(() => s1.headunit.client.getDevice(FAMILY_ID, 'clock-1'));
        return collect();
    }

    it('emits the initial state without the current time by default', async function () {
        await helper.load([headunitNode, systemNode], flow());
        const msgs = collect();
        await waitFor(() => msgs.length >= 5);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.deepStrictEqual(
            msgs.map((m) => m.topic),
            ['sunrise', 'sunset', 'night', 'sunriseTime', 'sunsetTime']
        );
        assert.strictEqual(msgs[0].device.name, 'Clock');
    });

    it('emits only the items that change on the minute tick', async function () {
        const msgs = await loadWithoutInitial();
        devices.emitUpdate({ deviceId: 'clock-1', sunrise: false, sunset: true, night: true, sunriseTime: '07:05', sunsetTime: '17:12', currentMinute: 16 }, FAMILY_ID);
        await waitFor(() => msgs.length === 2);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.deepStrictEqual(
            msgs.map((m) => [m.topic, m.payload]),
            [
                ['sunset', true],
                ['night', true]
            ]
        );
        assert.strictEqual(msgs[0].origin, 'UNIT');
    });

    it('emits the current time when enabled', async function () {
        const msgs = await loadWithoutInitial({ currentTime: true });
        devices.emitUpdate({ deviceId: 'clock-1', currentMinute: 16, currentDayTime: '{"day":3,"time":"09:16"}' }, FAMILY_ID);
        await waitFor(() => msgs.length === 2);
        assert.deepStrictEqual(msgs[1].payload, { day: 3, time: '09:16' });
    });

    it('has no input', async function () {
        await helper.load([headunitNode, systemNode], flow());
        assert.strictEqual(helper.getNode('s1').listenerCount('input'), 0);
    });
});
