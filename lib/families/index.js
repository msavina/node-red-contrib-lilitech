'use strict';

const lights = require('./lights');
const envSensors = require('./env-sensors');
const securityAreas = require('./security-areas');

// Famiglie supportate, per familyId
module.exports = {
    [lights.FAMILY_ID]: lights,
    [envSensors.FAMILY_ID]: envSensors,
    [securityAreas.FAMILY_ID]: securityAreas
};
