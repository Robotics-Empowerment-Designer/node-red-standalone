const ip = process.env.PEPPER_REST_SERVER_IP || require("./IPHelper").ip;
const nodeRedPort = process.env.NODE_RED_PORT;
const flaskPort = process.env.FLASK_PORT_PEPPER;

require("events").EventEmitter.defaultMaxListeners = 200;

module.exports.nodeRedPort = nodeRedPort;
module.exports.serverUrl = `http://${ip}:${flaskPort}`;
module.exports.serviceName = "Pepper";
