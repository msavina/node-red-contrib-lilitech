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

### automation

Controls shutters, sun blinds, awnings, curtains, gates, pedestrian gates, barriers, tilting doors, front doors and windows, and emits their state.

**Input**

| msg | Effect |
|---|---|
| `payload: "open"` / `"close"` / `"stop"` (or `true` / `false`) | drive the automation |
| `payload: "lock"` / `"unlock"` | lock or unlock a front door with a smart lock |
| `topic: "absolutePosition"`, `payload: 40` | move to a position (0-100 %) |
| `topic: "absolutePositionFoil"`, `payload: 30` | tilt the slats (0-100 %) |
| `payload: { "absolutePosition": 40 }` | write one or more items at once |

The commands follow the features enabled on the automation in the app:

| Command | Available on |
|---|---|
| drive `open` | all |
| drive `close` | shutter, sunBlind, sunshadeAwning, curtain; the other types when *closeable* |
| drive `stop` | when *stoppable* |
| drive `lock` / `unlock` | frontDoor when *lockable* |
| absolutePosition | when *positionable* |
| absolutePositionFoil | when *inclinable* |

**Output**: one message per changed item, with `msg.topic` = item name, `msg.payload` = value, `msg.unit` (when it has one), `msg.origin` and `msg.device`. `driveFeedback` is one of `open`, `opening`, `close`, `closing`, `stop`, `idle`, `locked`, `locking`, `unlocked`, `unlocking`, `block`, `alarm`; positions come as `absolutePositionFeedback` / `absolutePositionFoilFeedback`. When enabled in the app the node also emits `openStatus` and `faultSignal`, and a lockable front door emits `status` (`online` / `offline`) and `battery` (%).

Commands sent from Node-RED do not ask for the PIN, even when the automation is secured in the app.

### notifier

Controls sirens, buzzers, flashes and status leds, and emits their state.

**Input**

| msg | Effect |
|---|---|
| `payload: true` / `false` / `"on"` / `"off"` / `"toggle"` | switch the notifier on or off |
| `topic: "test"`, `payload: true` | turn the notifier on for 5 seconds (only when *testable*) |
| `topic: "maintenance"`, `payload: true` / `false` | exclude the notifier from the security areas (the alarms no longer turn it on) |
| `payload: { "switch": false, "maintenance": true }` | write several items at once |

**Output**: one message per changed item, with `msg.topic` = item name, `msg.payload` = value, `msg.origin` and `msg.device`: `switchFeedback`, `test`, `maintenance` and, when enabled on the notifier in the app, `tamperSignal` and `lowBattery`. `switch` is emitted only with **Feedback and commands**.

### charger

Controls EV chargers and emits their state.

**Input**

| msg | Effect |
|---|---|
| `payload: true` / `false` / `"on"` / `"off"` / `"toggle"` | switch a simple charger |
| `payload: "play"` / `"pause"` (or `true` / `false`, `"toggle"`) | start or pause the charge of a smart charger |
| `payload: "lock"` / `"unlock"` | lock or unlock a smart charger |
| `topic: "maxChargingCurrent"`, `payload: 10` | set the maximum charging current of a smart charger (1-16 A) |

A smart charger accepts one item per message.

| Charger type | Writable items | Read only |
|---|---|---|
| charger | switch | switchFeedback; when enabled in the app: power (W), energy and energyRelative (Wh), current (A), voltage (V) |
| smartCharger | command (`play`, `pause`), commandLock, maxChargingCurrent (A) | status, statusLock, chargingPower (kW), addedEnergy (kWh), chargingTime and sessionTime (s) |

**Output**: one message per changed item, with `msg.topic` = item name, `msg.payload` = value, `msg.unit` (when it has one), `msg.origin` and `msg.device`. Both types also emit `overload`, `economy` and `green` (energy management) and, when enabled in the app, `faultSignal`. `status` is one of `disconnected`, `ready`, `charging`, `paused`, `scheduled`, `locked`, `lockedCarConnected`, `waitingForCarDemand`, `error`... `switch`, `command` and `commandLock` are emitted only with **Feedback and commands**.

### access control

Emits the access attempts on badge readers and keypads. The headunit checks the PIN or the badge and runs the action configured in the app; the node reports the result:

| msg.topic | msg.payload | Also |
|---|---|---|
| `access` | `granted` / `denied` | `msg.user` (`id`, `name`) when the user is recognized, `msg.reason` for a denial (e.g. `Pin blocked`, `User outside the allowed time window`, `Unidentified user`) |
| `exclusion` | `true` / `false` | when *excludible* is enabled in the app |
| `tamper` | `true` / `false` | when *tamperDetection* is enabled in the app |

The PIN and the badge read by the reader are never emitted.

**Input** (only when *excludible* is enabled): `payload: true` excludes the reader until it is enabled again and `false` enables it.

### appliance

Controls dishwashers, washing machines, dryers, ovens, water heaters, fridges and the other appliances, and emits their state.

**Input**: `payload: true` / `false` / `"on"` / `"off"` / `"toggle"` switches the appliance (or `{ "switch": true }`).

**Output**: one message per changed item, with `msg.topic` = item name, `msg.payload` = value, `msg.unit` (when it has one), `msg.origin` and `msg.device`: `switchFeedback`, `overload`, `economy` and `green` (energy management) and, when enabled in the app, power (W), energy and energyRelative (Wh), current (A), voltage (V) and `faultSignal`. `switch` is emitted only with **Feedback and commands**.

### energy management

Starts and stops the load control and emits its powers, energy flows and badges.

**Input**: `payload: "play"` / `"stop"` (or `true` / `false`, `"toggle"`) starts or stops the controller. The rules (contracted power, margin, off-peak bands, green threshold) are configured in the app.

| Controller type | Writable items | Read only |
|---|---|---|
| gridControl | command (`play`, `stop`) | status, gridPower (W), overloadBadge, economyBadge, gridProduction, gridToHouse |
| greenControl | command (`play`, `stop`) | status, gridPower, greenPower and housePower (W), overloadBadge, economyBadge, greenBadge, gridProduction, greenProduction, houseConsumption, gridToHouse, greenToHouse, greenToGrid |

**Output**: one message per changed item, with `msg.topic` = item name, `msg.payload` = value, `msg.unit` (powers), `msg.origin` and `msg.device`. `overloadBadge` is `detach` while the loads are detached, `attach` while they are reattached, `idle` otherwise; `houseConsumption` is 0 (none), 1 (grid), 2 (green) or 3 (both); the badges are `null` when the controller is stopped or the rule is disabled. `command` is emitted only with **Feedback and commands**.

### irrigation

Starts and stops the irrigation controller and its programs, and emits their state.

**Input**

| msg | Effect |
|---|---|
| `payload: "play"` / `"stop"` (or `true` / `false`, `"toggle"`) | start or stop the controller: when stopped no program runs, not even the scheduled ones |
| `program: "Garden"` (or the id), `payload: "play"` / `"pause"` / `"stop"` / `"toggle"` | command a program |
| `payload: { "programId": 1, "cmd": "play" }` | the same, as an object (`name` instead of `programId` works too) |
| `topic: "programsCmd"`, `payload: "play"` | command the program of an irrigation that has only one |

A program can be commanded only while the controller is started. Programs, zones and durations are configured in the app.

**Output**: one message per changed item, with `msg.topic` = item name, `msg.payload` = value, `msg.origin` and `msg.device`: `status` (`play` / `stop`), `programRunning`, `programStartAt` (next scheduled start, ISO date), `programsRun` (object with `windy`, `rainy`, `override` and `programs`: `programId`, `name`, `status` `play`/`pause`/`stop`, `lastRun`, `totalDuration` in ms, `zones`...), `windy`, `rainy` and `override` (seasonal adjustment, %, with `msg.unit`). `programsRun` is emitted only when it changes. `command` and `programsCmd` are emitted only with **Feedback and commands**.

### hvac

Controls conditioners, fancoils, boilers, chillers, heat pumps, dehumidifiers, air purifiers, fans and vmc, and emits their state. The node offers only the items enabled on the hvac in the app.

**Input**

| msg | Effect |
|---|---|
| `payload: true` / `false` / `"on"` / `"off"` / `"toggle"` | switch the hvac |
| `payload: 22` | set the temperature of a conditioner or fancoil (5-35 °C, step 0.5) or the humidity of a dehumidifier (%) |
| `payload: "comfort"` / `"heat"` | select a profile (comfort, economy, protection, standby, manual, chrono) or a mode (heat, cool, dry, fan, wind, auto) of a conditioner or fancoil |
| `payload: { "switch": true, "setpointTemperature": 22, "fanSpeed": 2 }` | write several items at once |
| `topic: "fanSpeed"`, `payload: 2` | write a single item |

| Writable (feedback) | When |
|---|---|
| switch (switchFeedback) | conditioner and fancoil; the other types when *powerable* |
| setpointTemperature, thermoProfile, thermoMode (and their feedback), overrideRestore (`true`) | conditioner and fancoil, profiles and modes when enabled |
| setpointHumidity (setpointHumidityFeedback), 0-100 % | humidity control enabled |
| fanSpeed (1 to the number of speeds), fanAuto, fanEco, fanStrong, fanDirection (`fixed`, `all`, `vertical`, `horizontal`), with feedback | fan management enabled (no auto and direction on fans) |
| supplyFanSpeed, returnFanSpeed (and feedback), 0-100 % | supply / return fan management enabled |

The headunit applies temperature and humidity only while the hvac is on. Changing the temperature outside the *manual* profile starts an override, restored after `overrideTime` or with `overrideRestore`. Override time, profile temperatures and the chrono schedule are configured in the app.

**Output**: one message per changed item, with `msg.topic` = item name, `msg.payload` = value, `msg.unit` (`°C`, `%`, `ms`), `msg.origin` and `msg.device`. Besides the feedbacks: `roomTemperature`, `thermoStatus` (`off`, `idle`, `heat`, `cool`, `dry`, `fan`, `inhibit`, `standby`), `overrideFeedback`, `overrideTime` (ms), `overrideTimeAt`, `chronoSetpoint`, `roomHumidity`, `humidityStatus`, `deliveryTemperature` / `returnTemperature` / `acsTemperature` / `pressureValue` on boilers, chillers and heat pumps, and `faultSignal`, each when enabled in the app. The commands are emitted only with **Feedback and commands**.

Example flows are available in **Menu → Import → Examples → node-red-contrib-lilitech**.

## License

MIT
