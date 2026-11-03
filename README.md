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

### security area

Arms and disarms a security area and emits its state.

**Input**

| msg | Effect |
|---|---|
| `payload: "arm"` / `true` / `"on"` | arm the area (with the exit time, if delayed arming is enabled) |
| `payload: "disarm"` / `false` / `"off"` | disarm the area |
| `payload: "patrol"` | start the patrol (internal logic areas with patrol enabled, area armed) |
| `payload: { "areaControl": "arm" }` | same as above |

> Commands sent from Node-RED do not ask for the PIN, even when the area requires it in the app.

**Output**: one message per changed item, with `msg.topic` = item name, `msg.payload` = value, `msg.origin` and `msg.device`.

| Item | Value |
|---|---|
| areaStatus | `disarmed`, `unready`, `forceable`, `exiting`, `armed`, `forced`, `patrol`, `entering`, `alarm`, `tamper` |
| memory | `true` when the area went in alarm since it was last armed |
| history | names of the sensors that triggered the last alarm |
| areaControl | last command (`arm`, `disarm`, `patrol`...) sent by the app, by other nodes or by the headunit |

The **Output** option controls `areaControl`: not emitted with **Area state only** (default), emitted with **Area state and commands**.

### electronic

Read only: emits the status of an electronic device (smartphone, laptop, tablet, watch, printer, scanner...) every time it changes, with `msg.topic` = `isOnline` and `msg.payload` = `true` (online) or `false` (offline).

### actuator

Controls pumps, valves, sprinklers, faucets, servo valves and thermostatic valves, and emits their state.

**Input**

| msg | Effect |
|---|---|
| `payload: true` / `false` / `"on"` / `"off"` / `"toggle"` | switch a pump, valve, sprinkler or faucet |
| `topic: "proportionalDrive"`, `payload: 60` | set the opening of a proportional actuator (0-100 %) |
| `payload: "open"` / `"close"` / `"stop"` (or `true` / `false`) | drive a servo valve |
| `payload: 21.5` | set the setpoint of a thermostatic valve (4-30 °C, steps of 0.5) |
| `payload: { "switch": true, "proportionalDrive": 60 }` | write several items at once |

**Output**: one message per changed item, with `msg.topic` = item name, `msg.payload` = value, `msg.unit` (when it has one), `msg.origin` and `msg.device`.

| Actuator type | Writable items | Read only |
|---|---|---|
| pump, valve, sprinkler, faucet | switch, proportionalDrive (proportional actuators only) | powerOffTimerAt |
| servoValve | drive (`open`, `close`, `stop`) | driveFeedback (`open`, `opening`, `close`, `closing`, `stop`, `idle`) |
| thermostaticValve | setpointTemperature (°C) | roomTemperature (°C), proportionalDriveFeedback (valve opening, %), battery (%) |

Each writable item has a `...Feedback` item with the state confirmed by the device. When enabled on the actuator in the app, every type also emits `volumeValue` / `volumeRelative` (l) with `volumeRelativeTimestamp`, `openStatus` and `faultSignal`.

Example flows are available in **Menu → Import → Examples → node-red-contrib-lilitech**.

## License

MIT
