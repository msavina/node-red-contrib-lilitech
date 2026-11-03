# Changelog

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
