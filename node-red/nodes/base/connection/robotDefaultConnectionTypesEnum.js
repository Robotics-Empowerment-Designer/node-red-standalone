const CONNECTION_TYPES = require("node-red-contrib-base/connection/connectionTypesEnum");

/**
 * IF YOU ADD A NEW ROBOT YOU NEED TO ADD IT HERE AND IN THE FRONTEND IN nodes/base/resources/nodesRobotConnectionUtils.js.
 * ADDITIONALLY YOU NEED TO ADD YOUR NEW TYPE TO A NEW ATTRIBUTE "contribRobotType" IN THE NODE HTML DEFINITION IN nodes/<robot>/<function>/<node>.html.
 */
const ROBOT_DEFAULT_CONNECTION_TYPES = Object.freeze({
    PEPPER: CONNECTION_TYPES.SOCKET_IO,
    PEPPER_ANDROID: CONNECTION_TYPES.MQTT,
    // TEMI: CONNECTION_TYPES.MQTT, // TODO NYI
    // SAWYER: CONNECTION_TYPES.??? // TODO NYI
});

module.exports = ROBOT_DEFAULT_CONNECTION_TYPES;
