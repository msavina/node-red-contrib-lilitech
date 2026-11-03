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
    Accetta { r, g, b } oppure le stringhe "#rrggbb", '{"r":..}', "{r:..,g:..,b:..}", "r,g,b", "rgb(r,g,b)"
----------------------------------------------------------------------------------------------------------------------*/
function toColor(value) {
    const color = typeof value === 'string' ? parseColorString(value.trim()) : value;
    if (!color || typeof color !== 'object' || color.r === undefined || color.g === undefined || color.b === undefined) {
        throw new Error(`Invalid color: ${JSON.stringify(value)} (expected {r,g,b}, "#rrggbb" or "r,g,b")`);
    }
    return { r: toInteger(color.r, 0, 255), g: toInteger(color.g, 0, 255), b: toInteger(color.b, 0, 255) };
}

/*----------------------------------------------------------------------------------------------------------------------
    Restituisce { r, g, b } oppure null se la stringa non è in un formato riconosciuto
----------------------------------------------------------------------------------------------------------------------*/
function parseColorString(text) {
    const hex = text.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (hex) return { r: parseInt(hex[1], 16), g: parseInt(hex[2], 16), b: parseInt(hex[3], 16) };

    const list = text.match(/^(?:rgb\s*\()?\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)?$/i);
    if (list) return { r: list[1], g: list[2], b: list[3] };

    // Oggetto con o senza virgolette sulle chiavi, es. {r:255, g:0, b:0}
    if (text.startsWith('{') && text.endsWith('}')) {
        const color = {};
        for (const key of ['r', 'g', 'b']) {
            const match = text.match(new RegExp(`["']?\\b${key}["']?\\s*:\\s*(-?[\\d.]+)`, 'i'));
            if (match) color[key] = match[1];
        }
        return color;
    }
    return null;
}

module.exports = { toBoolean, toInteger, toPercent, toColor };
