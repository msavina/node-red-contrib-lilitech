# Changelog

## 0.1.2

- light: `color` also accepts `"{r:255,g:0,b:0}"` (unquoted keys), `"255,0,0"` and `"rgb(255,0,0)"` strings.
- light: when `msg.topic` is an item, an object payload is the value of that item (e.g. `topic: "color"`, `payload: {r,g,b}`).

## 0.1.1

- light: leading/trailing spaces in `msg.topic` are ignored.
- light: clearer error when `msg.topic` is not a known item.

## 0.1.0

- `headunit` configuration node: shared connection to the headunit tube.
- `light` node: read and write switch, brightness, temperature, color, brightnessColor and DALI scenes, depending on the light type.
