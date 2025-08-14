const ip = process.env.REST_SERVER_IP || require("./IPHelper").ip;
const nodeRedPort = process.env.PORT;
const flaskPort = process.env.REST_SERVER_PORT;

module.exports.nodeRedPort = nodeRedPort;
module.exports.serverUrl = `http://${ip}:${flaskPort}`;
module.exports.serviceName = "Node-RED";
