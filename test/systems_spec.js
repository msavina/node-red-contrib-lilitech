'use strict';

const assert = require('assert');
const systems = require('../lib/families/systems');

describe('systems family', function () {
    const clock = { typeId: 'clock', sunrise: false, sunset: false, night: false, sunriseTime: '07:05', sunsetTime: '17:12' };
    const weather = { typeId: 'weather', weather: 'clouds', city: 'Torino', temperatureValue: 12.34000015258789, weatherAlerts: false };

    it('exposes the items of each type', function () {
        assert.deepStrictEqual(systems.editorItems(clock), ['sunrise', 'sunset', 'night', 'sunriseTime', 'sunsetTime']);
        assert.ok(systems.readableItems(clock).includes('currentDayTime'));
        assert.ok(!systems.readableItems(clock).includes('currentDateTime'));
        assert.ok(!systems.readableItems(clock).includes('knxDateTime'));
        assert.ok(systems.readableItems(weather).includes('forecastDaily'));
        assert.ok(!systems.readableItems(weather).includes('sunrise'));
        assert.deepStrictEqual(systems.readableItems({ typeId: 'presenceSimulator' }), []);
    });

    it('emits the current time and the forecast only when enabled', function () {
        assert.strictEqual(systems.isOutputItem('currentMinute', {}), false);
        assert.strictEqual(systems.isOutputItem('currentMinute', { currentTime: true }), true);
        assert.strictEqual(systems.isOutputItem('forecastHourly', {}), false);
        assert.strictEqual(systems.isOutputItem('forecastHourly', { forecast: true }), true);
        assert.strictEqual(systems.isOutputItem('sunset', {}), true);
    });

    it('decodes the JSON items and rounds the measures', function () {
        assert.deepStrictEqual(systems.outputValue('currentDayTime', '{"day":0,"time":"09:16"}'), { day: 0, time: '09:16' });
        assert.deepStrictEqual(systems.outputValue('weatherAlertsEvent', ''), []);
        assert.deepStrictEqual(systems.outputValue('weatherAlertsEvent', '["Yellow Wind Warning"]'), ['Yellow Wind Warning']);
        assert.strictEqual(systems.outputValue('forecastDaily', '[{"weather":"rain","pop":0.2}]')[0].weather, 'rain');
        assert.strictEqual(systems.outputValue('temperatureValue', 12.34000015258789), 12.3);
        assert.strictEqual(systems.outputValue('uvIndex', 0.8512), 0.85);
        assert.strictEqual(systems.outputValue('windSpeed', 7), 7);
        assert.deepStrictEqual(systems.outputExtras('windGustsValue'), { unit: 'km/h' });
        assert.deepStrictEqual(systems.outputExtras('weather'), {});
    });

    it('shows day, night, sunrise and sunset on the clock', function () {
        assert.deepStrictEqual(systems.status(clock), { fill: 'green', shape: 'dot', text: 'Day · Sunset 17:12' });
        assert.strictEqual(systems.status({ ...clock, night: true }).text, 'Night · Sunrise 07:05');
        assert.strictEqual(systems.status({ ...clock, sunset: true, night: true }).text, 'Sunset 17:12');
        assert.strictEqual(systems.status({ typeId: 'clock' }).text, 'No Value');
    });

    it('shows temperature, weather, city and alerts', function () {
        assert.deepStrictEqual(systems.status(weather), { fill: 'green', shape: 'dot', text: '12.3 °C · Clouds · Torino' });
        assert.deepStrictEqual(systems.status({ ...weather, weatherAlerts: true }), {
            fill: 'yellow',
            shape: 'dot',
            text: '12.3 °C · Clouds · Torino · Alert'
        });
        assert.strictEqual(systems.status({ typeId: 'weather' }).text, 'No Value');
        assert.strictEqual(systems.status({ typeId: 'other' }).text, 'Unknown Type other');
    });
});
