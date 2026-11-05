'use strict';

const lights = require('./lights');
const envSensors = require('./env-sensors');
const securityAreas = require('./security-areas');
const electronics = require('./electronics');
const actuators = require('./actuators');
const automations = require('./automations');
const notifiers = require('./notifiers');
const chargers = require('./chargers');
const accessControls = require('./access-controls');
const appliances = require('./appliances');
const energyManagements = require('./energy-managements');
const irrigations = require('./irrigations');
const hvacs = require('./hvacs');
const sockets = require('./sockets');
const meteringSensors = require('./metering-sensors');
const securitySensors = require('./security-sensors');
const simulators = require('./simulators');
const systems = require('./systems');

// Famiglie supportate, per familyId
module.exports = {
    [lights.FAMILY_ID]: lights,
    [envSensors.FAMILY_ID]: envSensors,
    [securityAreas.FAMILY_ID]: securityAreas,
    [electronics.FAMILY_ID]: electronics,
    [actuators.FAMILY_ID]: actuators,
    [automations.FAMILY_ID]: automations,
    [notifiers.FAMILY_ID]: notifiers,
    [chargers.FAMILY_ID]: chargers,
    [accessControls.FAMILY_ID]: accessControls,
    [appliances.FAMILY_ID]: appliances,
    [energyManagements.FAMILY_ID]: energyManagements,
    [irrigations.FAMILY_ID]: irrigations,
    [hvacs.FAMILY_ID]: hvacs,
    [sockets.FAMILY_ID]: sockets,
    [meteringSensors.FAMILY_ID]: meteringSensors,
    [securitySensors.FAMILY_ID]: securitySensors,
    [simulators.FAMILY_ID]: simulators,
    [systems.FAMILY_ID]: systems
};
