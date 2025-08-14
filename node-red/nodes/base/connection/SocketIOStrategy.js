const ConnectionStrategy = require("node-red-contrib-base/connection/ConnectionStrategyBase");
const CONNECTION_TYPES = require("node-red-contrib-base/connection/connectionTypesEnum");
const NODE_STATUSES = require("node-red-contrib-base/connection/statusMessages");
const logger = require("node-red-contrib-base/log")(module);

class SocketIOStrategy extends ConnectionStrategy {
    constructor(node, socket, robotName, robotType) {
        super(CONNECTION_TYPES.SOCKET_IO);
        this.node = node;
        this.socket = socket;
        this.robotName = robotName;
    }

    on(event, callback) {
        this.socket.on(event, callback);
    }

    emit(event, data) {
        if (!this.socket) {
            this.node.status(NODE_STATUSES.ROBOT_SELECTION_ERROR);
            logger.error("Robot " + this.robotName + " not found in robotConnectionStore");
            return;
        } else if (!this.socket.connected) {
            this.node.status(NODE_STATUSES.ROBOT_OFFLINE);
            logger.error("Socket for robot " + this.robotName + " not connected");
            return;
        }

        logger.debug("Emitting event: " + event + " to robot: " + this.robotName);

        if (data) {
            this.socket.emit(event, data);
        } else {
            this.socket.emit(event);
        }
    }
}

module.exports = SocketIOStrategy;
