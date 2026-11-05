# Changelog

## 0.21.3

- New icon for the irrigation node (leaf).

## 0.21.2

- Scenario node editor like the device nodes: **Items** row (`command`, play only with the manual control) and **Output** option; with *Feedback and commands* the node also emits `topic: "command"` (play/stop sent by the app or by other nodes).

## 0.21.1

- Scenario node editor: new **Commands** row with the accepted commands (play only with the manual control enabled in the app).

## 0.21.0

- New `scenario` node (at the end of the palette, in a lighter orange): starts and stops a scenario (`play` / `stop` / `toggle`, like the app; play only with the manual control enabled) and emits its running state (`run` / `stop`) with the timestamps of the last execution (`msg.lastRun`, `msg.lastEnd`) and `msg.inhibited`, shown in yellow in the node status. Requires the headunit with the scenario list on the tube (`DATABASE_LIST_REQUEST_SCENARIOS`).

## 0.20.0

- New `video surveillance` node (video cameras for now, monitors later): records a clip like the REC button of the app (with loop recording enabled, `msg.source` shown in the history) and emits `status`, `triggerRecording` and each uploaded clip (`topic: "clip"`, file name, trigger and source).
- Families receive the node configuration in `parseInput`.

## 0.19.0

- New `thermostat` node: switch (when powerable), temperature (limited to the base setpoint ± 3 °C when the setpoint block is enabled, like the app), profile, mode on heat/cool thermostats and override restore; emits feedbacks, room temperature, thermo status, override, valves, chrono setpoint, humidity and fault.

## 0.18.0

- New `system` node (read only): clock (`sunrise`, `sunset`, `night`, sunrise/sunset times, optionally the current day and time every minute) and weather (conditions, temperatures, humidity, pressure, wind, rain, UV, air pollution, alerts, optionally the daily and hourly forecast). Items are emitted only when they change, although the headunit resends them every minute.

## 0.17.1

- The nodes are listed in alphabetical order in the palette.

## 0.17.0

- New `presence simulator` node: starts and stops the simulation (`command` play/stop/toggle) and its programs (`programsCmd` like the app, program by id or name with `msg.program`; only play/stop, the headunit does not pause simulation programs).
- Emits `status`, `programRunning`, `programStartAt` and `programsRun` (decoded, only when it changes); the node status shows the running programs or the next start.
- Requires a headunit that answers the device list request for `simulators`.

## 0.16.0

- New `security sensor` node: emits `input`, `trigger` (every alarm), `armed`, `exclusion`, `testing`, `maintenance` and the anomalies enabled in the app (tamper, sensor loss, low battery, fault, masked, weak, pet detected, max alarms reached), shown in the node status like the badges of the app card.
- Writes `exclusion` (sensors with *excludible*), `testing` and `maintenance` like the toggles of the app; `msg.topic` is required. The exclusion timer is set in the app.
- Requires a headunit that answers the device list request for `security-sensors`.

## 0.15.1

- `metering sensor`: the editor lists only the writable items (the energy resets); the measure of volume, pressure, level and temperature sensors is output only.

## 0.15.0

- New `metering sensor` node: emits the measures of single and three phase energy meters (energies in Wh, powers in W, voltage, current, frequency and power factor per phase, as enabled in the app) and of volume, pressure, level and temperature sensors, with `msg.unit`.
- Resets the relative energy of the energy meters like the app (`activeEnergyRelativeLaReset`, `...LbReset`, `...LcReset`, `...TotalReset`).
- Emits `sensorLoss`, `lowBattery` and `faultSignal` when enabled, shown in the node status.
- Requires a headunit that answers the device list request for `metering-sensors`.

## 0.14.4

- `automation`: emits `simulated` (the automation is moved by the presence simulator, like the badge on the app card) and shows "Simulated" in the node status.
- `light`: `powerOffTimerAt` is no longer emitted (the timer is managed in the app).

## 0.14.3

- `light`: shows "Simulated" in the node status when the presence simulator switches the light, like the badge on the app card (`simulated` was already emitted).

## 0.14.2

- `socket`: emits `simulated` (the socket is switched by the presence simulator, like the badge on the app card) and shows "Simulated" in the node status.

## 0.14.1

- `socket`: `powerOffTimerAt` is no longer emitted and the node status no longer shows the power off time (the timer is managed in the app).

## 0.14.0

- New `socket` node: switches simple and measurable sockets (`true` / `false` / `"toggle"`) and resets their measures like the app (`restoreEnergy` resets the relative energy, `restorePower` / `restoreCurrent` / `restoreVoltage` reset minimum and maximum).
- Emits `switchFeedback`, `overload` / `economy` / `green` and, when enabled in the app, the measures with their minimum and maximum, `powerOffTimerAt` and `faultSignal`, with `msg.unit`.
- Requires a headunit that answers the device list request for `sockets`.

## 0.13.1

- `hvac`: `overrideTime` is no longer writable (it is configured in the app) and is only emitted.
- `hvac`: temperature and humidity are sent also while the hvac is off, without an error; the headunit applies them only while it is on.

## 0.13.0

- New `hvac` node for conditioners, fancoils, boilers, chillers, heat pumps, dehumidifiers, air purifiers, fans and vmc. It offers only the items enabled on the hvac in the app:
  - `switch`; on conditioners and fancoils `setpointTemperature` (5-35 °C, step 0.5), `thermoProfile`, `thermoMode` (only the modes enabled in the app), `overrideTime` and `overrideRestore`;
  - `setpointHumidity` with humidity control, `fanSpeed` / `fanAuto` / `fanEco` / `fanStrong` / `fanDirection` with fan management, `supplyFanSpeed` / `returnFanSpeed` on vmc.
- Emits the feedbacks, `roomTemperature`, `thermoStatus`, the override state, `chronoSetpoint`, `roomHumidity`, `humidityStatus`, the plant measures of boilers, chillers and heat pumps and `faultSignal`, with `msg.unit`.
- Temperature and humidity are rejected while the hvac is off, since the headunit would ignore them.
- Requires a headunit that answers the device list request for `hvac`.

## 0.12.1

- `irrigation`: a program command without `msg.program` (e.g. `topic: "programsCmd"`, `payload: "play"`) uses the program of the irrigation when it has only one; with several programs the error lists their ids and names.

## 0.12.0

- New `irrigation` node: starts and stops the irrigation controller (`command`: `play` / `stop`) and plays, pauses and stops its programs by id or name (`msg.program`, or `{ "programId": 1, "cmd": "play" }`).
- Emits `status`, `programRunning`, `programStartAt`, `programsRun` (decoded into an object), `windy`, `rainy` and `override` (%).
- Families can list items emitted only when their value changes: the headunit sends the programs every minute even when nothing changed.
- Requires a headunit that answers the device list request for `irrigations`.

## 0.11.0

- New `energy management` node: starts and stops the load control (`command`: `play` / `stop`, also `true` / `false` and `"toggle"`).
- Emits `status`, the powers (`gridPower`, and `greenPower` / `housePower` on green control, in W with `msg.unit`), the badges `overloadBadge` / `economyBadge` / `greenBadge` and the energy flows (`gridProduction`, `greenProduction`, `houseConsumption`, `gridToHouse`, `greenToHouse`, `greenToGrid`).
- Requires a headunit that answers the device list request for `energy-managements`.

## 0.10.0

- New `appliance` node: switches dishwashers, washing machines, ovens, water heaters and the other appliances (`true` / `false` / `"toggle"`).
- Emits `switchFeedback`, `overload` / `economy` / `green` and, when enabled in the app, the measures (power, energy, current, voltage) and `faultSignal`, with `msg.unit`.
- Requires a headunit that answers the device list request for `appliances`.

## 0.9.0

- New `access control` node: emits every access attempt on badge readers and keypads (`access`: `granted` / `denied`) with the recognized user (`msg.user`) and the reason of a denial (`msg.reason`), plus `exclusion` and `tamper` when enabled in the app; the PIN and the badge are never emitted.
- Excludes and enables the reader (`exclusion`) when *excludible* is enabled.
- The headunit connection now also receives the history events of the devices.
- Requires a headunit that answers the device list request for `access-controls`.

## 0.8.0

- New `charger` node: switches simple EV chargers and drives smart chargers: start/pause (`play` / `pause`), lock/unlock and maximum charging current (`maxChargingCurrent`, 1-16 A).
- Emits `switchFeedback` and the measures enabled in the app (power, energy, current, voltage) of simple chargers, `status`, `statusLock`, `chargingPower`, `addedEnergy`, `chargingTime` and `sessionTime` of smart chargers, `overload` / `economy` / `green` and `faultSignal`, with `msg.unit`.
- Requires a headunit that answers the device list request for `chargers`.

## 0.7.0

- New `notifier` node: switches sirens, buzzers, flashes and status leds (`true` / `false` / `"toggle"`), starts the test (when *testable*) and sets the maintenance.
- Emits `switchFeedback`, `test`, `maintenance` and, when enabled in the app, `tamperSignal` and `lowBattery`.
- Requires a headunit that answers the device list request for `notifiers`.

## 0.6.0

- New `automation` node: opens, closes and stops shutters, sun blinds, awnings, curtains, gates, barriers, doors and windows, locks/unlocks front doors with a smart lock and sets the position (`absolutePosition`) and the slats (`absolutePositionFoil`), following the features enabled in the app.
- Emits `driveFeedback`, the position feedbacks, `openStatus` and `faultSignal` (when enabled) and the smart lock `status` / `battery`, with `msg.unit`.
- Requires a headunit that answers the device list request for `automations`.

## 0.5.0

- New `actuator` node: switches pumps, valves, sprinklers and faucets (with `proportionalDrive` on proportional actuators), drives servo valves (`open` / `close` / `stop`) and sets the setpoint of thermostatic valves.
- Emits the feedbacks, `roomTemperature`, valve opening, battery, volume, `openStatus` and `faultSignal` (when enabled on the actuator), with `msg.unit`.
- Requires a headunit that answers the device list request for `actuators`.

## 0.4.1

- electronic: the item is `isOnline` (boolean, `true` = online), the same used by the Lilitech app, instead of `status`.

## 0.4.0

- New `electronic` node (read only): emits the `online` / `offline` status of smartphones, laptops, tablets, watches, printers and scanners.
- Requires a headunit that answers the device list request for `electronics`.

## 0.3.4

- security area: the default output is "Area state only" (like the light node); `areaControl` is emitted only with "Area state and commands".

## 0.3.3

- security area: the "Output" option is back to control `areaControl`: emitted with "Area state and commands" (default), not emitted with "Area state only".

## 0.3.2

- security area: `areaControl` is always emitted; the "Output" option has been removed.

## 0.3.1

- security area: the exit/entry/alarm/patrol timers (`timerExitAt`, `timerEnterAt`, `timerAlarmAt`, `timerPatrolAt`) are no longer emitted.

## 0.3.0

- New `security area` node: arms, disarms and starts the patrol of a security area (`"arm"`, `"disarm"`, `"patrol"`, or `true`/`false`) and emits `areaStatus`, `memory` and `history`.
- Commands sent from Node-RED do not ask for the area PIN.
- Requires a headunit that answers the device list request for `security-areas`.

## 0.2.7

- light and common node status labels are capitalized (e.g. `On · 80%`, `Off`, `Disconnected`, `Device Not Found`).

## 0.2.6

- environment sensor: node status labels are capitalized (e.g. `No Presence`, `Night`, `Sensor Lost`).

## 0.2.5

- environment sensor: the node status always shows the value; sensor lost / fault / low battery are appended (e.g. `45.2 % · sensor lost`).

## 0.2.4

- environment sensor: the items list in the editor shows only the measures; diagnostics (sensor loss, low battery, fault) are controlled by their own option.

## 0.2.3

- environment sensor: `luminosity` (and its min/max statistics) is rounded to an integer.

## 0.2.2

- environment sensor: the node status shows fault / sensor lost / low battery only when the feature is enabled on the sensor and diagnostics are enabled on the node.

## 0.2.1

- environment sensor: numeric values are rounded to 1 decimal (2 for `voc`), removing the float noise of the drivers (e.g. `26.899999618530273` → `26.9`). Timestamps are not rounded.

## 0.2.0

- New `environment sensor` node (read only): temperature, humidity, light, twilight, presence, air quality, barometer, wind, rain and soil moisture sensors, with units of measure, optional min/max statistics and diagnostics.
- Requires a headunit that answers the device list request for `environment-sensors`.

## 0.1.2

- light: `color` also accepts `"{r:255,g:0,b:0}"` (unquoted keys), `"255,0,0"` and `"rgb(255,0,0)"` strings.
- light: when `msg.topic` is an item, an object payload is the value of that item (e.g. `topic: "color"`, `payload: {r,g,b}`).

## 0.1.1

- light: leading/trailing spaces in `msg.topic` are ignored.
- light: clearer error when `msg.topic` is not a known item.

## 0.1.0

- `headunit` configuration node: shared connection to the headunit tube.
- `light` node: read and write switch, brightness, temperature, color, brightnessColor and DALI scenes, depending on the light type.
