'use strict';

/*----------------------------------------------------------------------------------------------------------------------
    Accetta true/false, 1/0, "on"/"off", "true"/"false"
----------------------------------------------------------------------------------------------------------------------*/
function toBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (value === 1 || value === 0) return value === 1;
    if (typeof value === 'string') {
        const v = value.trim().toLowerCase();
        if (['on', 'true', '1'].includes(v)) return true;
        if (['off', 'false', '0'].includes(v)) return false;
    }
    throw new Error(`Invalid boolean value: ${JSON.stringify(value)}`);
}

/*----------------------------------------------------------------------------------------------------------------------
    Intero compreso tra min e max (i valori fuori range vengono limitati)
----------------------------------------------------------------------------------------------------------------------*/
function toInteger(value, min, max) {
    const n = Number(value);
    if (value === null || value === '' || typeof value === 'boolean' || !Number.isFinite(n)) {
        throw new Error(`Invalid number: ${JSON.stringify(value)}`);
    }
    return Math.max(min, Math.min(max, Math.round(n)));
}

/*----------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------*/
function toPercent(value) {
    return toInteger(value, 0, 100);
}

/*----------------------------------------------------------------------------------------------------------------------
    Accetta { r, g, b }, "#rrggbb" oppure la stringa JSON '{"r":..,"g":..,"b":..}'
----------------------------------------------------------------------------------------------------------------------*/
function toColor(value) {
    let color = value;
    if (typeof value === 'string') {
        const hex = value.trim().match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
        if (hex) {
            color = { r: parseInt(hex[1], 16), g: parseInt(hex[2], 16), b: parseInt(hex[3], 16) };
        } else {
            try {
                color = JSON.parse(value);
            } catch (error) {
                throw new Error(`Invalid color: ${JSON.stringify(value)}`);
            }
        }
    }
    if (!color || typeof color !== 'object' || color.r === undefined || color.g === undefined || color.b === undefined) {
        throw new Error(`Invalid color: ${JSON.stringify(value)} (expected {r,g,b} or "#rrggbb")`);
    }
    return { r: toInteger(color.r, 0, 255), g: toInteger(color.g, 0, 255), b: toInteger(color.b, 0, 255) };
}

module.exports = { toBoolean, toInteger, toPercent, toColor };
