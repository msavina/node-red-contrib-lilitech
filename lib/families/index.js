'use strict';

const lights = require('./lights');
const envSensors = require('./env-sensors');
const securityAreas = require('./security-areas');
const electronics = require('./electronics');
const actuators = require('./actuators');

// Famiglie supportate, per familyId
module.exports = {
    [lights.FAMILY_ID]: lights,
    [envSensors.FAMILY_ID]: envSensors,
    [securityAreas.FAMILY_ID]: securityAreas,
    [electronics.FAMILY_ID]: electronics,
    [actuators.FAMILY_ID]: actuators
};
