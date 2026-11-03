# node-red-contrib-lilitech

Node-RED nodes to control and monitor the devices of a [Lilitech](https://www.lilitech.com) smart home headunit.

Every node works both ways: send a message to the node to command the device, and the node emits a message every time the device state changes (from a wall switch, the Lilitech app, a scenario, another flow...).

## Requirements

- A Lilitech headunit with Node-RED enabled (Node-RED runs on the headunit itself).
- Node-RED 3.0 or later, Node.js 18 or later.

The headunit accepts connections only from the local machine: these nodes cannot control a headunit from another computer.

## Install

From the Node-RED editor: **Menu → Manage palette → Install**, search for `node-red-contrib-lilitech`.

Or from the Node-RED user directory:

```sh
npm install node-red-contrib-lilitech
```

## Nodes

### headunit (configuration)

The connection to the headunit. The default address `http://127.0.0.1:3000` is correct when Node-RED runs on the headunit.

### light

Select the headunit and the light: the list is loaded from the headunit, and the node adapts to the light type.

**Input**

| msg | Effect |
|---|---|
| `payload: true` / `false` / `"on"` / `"off"` / `"toggle"` | switch the light |
| `payload: { "switch": true, "brightness": 80 }` | write several items at once |
| `topic: "brightness"`, `payload: 50` | write a single item |
| `payload: { "color": { "r": 255, "g": 0, "b": 0 } }`, or `topic: "color"` with `"#ff0000"`, `"255,0,0"` or `"{r:255,g:0,b:0}"` | set the color |

**Output**: one message per changed item, with `msg.topic` = item name (e.g. `switchFeedback`), `msg.payload` = value, `msg.origin` and `msg.device`.

| Light type | Writable items |
|---|---|
| onOff | switch |
| dimmer | switch, brightness |
| tunableWhite | switch, brightness, temperature |
| rgb | switch, color, brightnessColor |
| rgbWhite | switch, brightness, color, brightnessColor |
| rgbTunableWhite | switch, brightness, temperature, color, brightnessColor |

Each writable item has a `...Feedback` item with the state confirmed by the device. `brightness`, `brightnessColor` and `temperature` are percentages (0-100). DALI lights with scenes enabled also accept `scene` (0-15).

### environment sensor

Read only: the node has no input and emits a message every time a value of the sensor changes, with `msg.topic` = item name, `msg.payload` = value and `msg.unit` = unit of measure.

| Sensor type | Items | Optional (enabled in the app) |
|---|---|---|
| temperatureSensor | temperatureValue (°C) | |
| humiditySensor | humidityValue (%) | |
| lightSensor | luminosity (lx) | solarRadiation (W/m²) |
| twilightSensor | twilight (`true` = night) | |
| presenceSensor | presence | |
| airQualitySensor | coTwo (ppm) | voc (mg/m³) |
| barometerSensor | pressureValue (hPa) | |
| windSensor | windSpeed (km/h) | windDirection (°), windGusts |
| rainSensor | rainStatus | rainAmount, rainAmountRelative (mm), rainAmountRelativeTimestamp |
| soilMoistureSensor | soilMoisture (%) | evaporation |

Options:
- **Send min/max statistics**: numeric sensors also emit `...MinValue`, `...MaxValue`, `...MinTimestamp`, `...MaxTimestamp` (e.g. `temperatureMaxValue`).
- **Send diagnostics** (default on): `sensorLoss`, `lowBattery`, `faultSignal`, when the feature is enabled on the sensor.

Example flows are available in **Menu → Import → Examples → node-red-contrib-lilitech**.

## License

MIT
