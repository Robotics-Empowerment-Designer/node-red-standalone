const EventPubSub = require("node-red-contrib-base/eventPubSub");
const SocketIOStrategy = require("node-red-contrib-base/connection/SocketIOStrategy");
const MQTTStrategy = require("node-red-contrib-base/connection/MQTTStrategy");
const nodeRedPort = require("node-red-contrib-base/config").nodeRedPort;
const CONNECTION_TYPES = require("node-red-contrib-base/connection/connectionTypesEnum");
const NODE_STATUSES = require("node-red-contrib-base/connection/statusMessages");
const ROBOT_DEFAULT_CONNECTION_TYPES = require("node-red-contrib-base/connection/robotDefaultConnectionTypesEnum");
const logger = require("node-red-contrib-base/log")(module);
// const {robotConnectionStore} = require("../../pepper/connectionHelper");

class ConnectionHelper {
    static robotConnectionStore = {};
    static configuredRobotsStatus = {successfulConnections: [], failedConnections: []};
    static globalEventPubSub = null;
    static updateInProgress = false;
    static updateConnectionsCallback = (newRobotConnectionStore) => {
        ConnectionHelper.updateConnections(newRobotConnectionStore);
    };
    checkSelectedConnectionCallback = this._checkConnectionOfSelectedRobotWrapper.bind(this);
    lastNodeConnectionStatus = null;
    testedRobotConnection = null;

    static cleanup() {
        logger.debug("cleanup");
        for (const robotConnection in ConnectionHelper.robotConnectionStore) {
            try {
                ConnectionHelper.robotConnectionStore[robotConnection].disconnectRobot();
                logger.debug("disconnected");
            } catch (error) {
                logger.error("Error cleaning up robotConnectionStore");
                logger.error(error);
            }
        }
        ConnectionHelper.robotConnectionStore = {};
        ConnectionHelper.globalEventPubSub?.unsubscribe(
            EventPubSub.UPDATED_CONNECTIONS,
            ConnectionHelper.updateConnectionsCallback
        );
        ConnectionHelper.globalEventPubSub = null;
    }

    static initGlobalEventPubSub() {
        if (ConnectionHelper.globalEventPubSub) return;

        ConnectionHelper.globalEventPubSub = new EventPubSub();
        ConnectionHelper.globalEventPubSub.subscribe(
            EventPubSub.UPDATED_CONNECTIONS,
            ConnectionHelper.updateConnectionsCallback
        );
    }

    static updateConnections(newRobotConnectionStore) {
        ConnectionHelper.robotConnectionStore = newRobotConnectionStore;
    }

    constructor(socket, node, config, robotType) {
        // TODO null default while refactoring, required parameter later
        this.socket = socket;
        this.node = node;
        this.robotType = robotType;
        this.config = config;
        this.connectedRobotsOfTypeAmount = 0;
        this.performedRobotAction = false;

        if (!this.robotType) {
            // TODO remove after refactoring/multi robot feature
            this.initSocket();
            return;
        }

        if (this.node.type !== "Start config") {
            // will maybe cause issues with other config nodes
            this.events = new EventPubSub();
            this.events.subscribe(
                EventPubSub.CHECK_SELECTED_CONNECTION,
                this.checkSelectedConnectionCallback
            );

            this.node.on("close", (removed, done) => {
                if (removed) {
                    this.events.unsubscribe(
                        EventPubSub.CHECK_SELECTED_CONNECTION,
                        this.checkSelectedConnectionCallback
                    );
                    logger.info("node " + this.node.type + " unsubscribed");
                }
                done();
            });

            this.checkConnectionOfSelectedRobot(
                this._parseSelectedOptionRobotName(this.config.selectedRobotConnection)
            );
        } else {
            ConnectionHelper.initGlobalEventPubSub();
        }
    }

    initSocket() {
        if (this.socket.connected) {
            this.connected();
        } else {
            this.disconnected();
        }

        this.socket.on("connect", () => {
            this.connected();
        });

        this.socket.on("disconnect", () => {
            this.disconnected();
        });

        // triggered when node gets deleted
        this.node.on("close", (removed, done) => {
            this.socket.emit(this.node.path + "/close");
            done();
        });
    }

    connected() {
        this.node.status({});
        this.node.log(this.node.path + " connected");
    }

    disconnected() {
        this.node.status({
            fill: "red",
            shape: "dot",
            text: this.node.type + ".connectionError",
        });
        this.node.log(this.node.path + " disconnected");
    }

    emit(message = null, path = this.node.path) {
        if (!this.socket.connected) {
            logger.warn("Socket not connected");
            return;
        }

        try {
            if (message) {
                this.socket.emit(path, message);
            } else {
                this.socket.emit(path);
            }
            logger.info("emitted " + path + " " + message);
        } catch (error) {
            logger.error(error);
        }
    }

    emitTemp(data = null, event = this.node.path, robotName = this.selectedOptionRobotName) {
        // TODO temp name due to inability to overload
        const isRobotConnected =
            ConnectionHelper.configuredRobotsStatus.successfulConnections.some(
                (robot) => robot.robotName === robotName
            );
        let connectionObj = ConnectionHelper.robotConnectionStore[robotName] || null;
        const connectedRobotTypeCount = this.getConnectedRobotsOfTypeAmount();

        if (!connectionObj || !isRobotConnected) {
            if (this.config.selectedRobotConnection === "" && connectedRobotTypeCount === 1) {
                const matchingConnections = this.getMatchingTypeConnections();
                logger.verbose(`matchingConnections: ${matchingConnections}`);
                if (matchingConnections.length === 1) {
                    connectionObj =
                        ConnectionHelper.robotConnectionStore[
                            matchingConnections[0].robotName
                        ];
                    this.selectedOptionRobotName = matchingConnections[0].robotName;
                }
            } else {
                this.node.status(NODE_STATUSES.ROBOT_SELECTION_ERROR);
                this.lastNodeConnectionStatus = NODE_STATUSES.ROBOT_SELECTION_ERROR;
                return;
            }
        } else {
            this.selectedOptionRobotName = robotName;
        }

        this.performedRobotAction = true;

        if (this.connectionStrategy) {
            // if we have a strategy or the strategy is the same as the override we won't need to create a new one
            this.connectionStrategy.emit(event, data);
            logger.verbose("emitted existing " + event + " " + JSON.stringify(data));

            return;
        } else {
            logger.verbose("default strategy");
            this.connectionStrategy = this.selectDefaultConnectionStrategy(
                connectionObj,
                this.selectedOptionRobotName
            );
        }
        this.connectionStrategy.emit(event, data);
    }

    on(event, callback, removeAfterMessage = true) {
        logger.verbose("on", event, callback);
        logger.verbose(
            "selectedOptionRobotName " + JSON.stringify(this.selectedOptionRobotName)
        );
        let matchingConnections = this.getMatchingTypeConnections();
        if (this.selectedOptionRobotName === "" && matchingConnections.length === 1) {
            this.selectedOptionRobotName = matchingConnections[0].robotName;
        } else if (!ConnectionHelper.robotConnectionStore[this.selectedOptionRobotName]) {
            logger.warn(
                `Robot ${this.selectedOptionRobotName ?? "unknown"} of type ${
                    this.robotType
                } not connected.`
            );
            return;
        }

        if (!this.connectionStrategy) {
            this.connectionStrategy = this.selectDefaultConnectionStrategy(
                ConnectionHelper.robotConnectionStore[this.selectedOptionRobotName],
                this.selectedOptionRobotName
            );
        }

        this.connectionStrategy.on(
            this.selectedOptionRobotName,
            event,
            callback,
            removeAfterMessage
        );
    }

    removeCallbacks(
        sourceId = `${this.node.type}:${this.node.id}`,
        robotName = this.selectedOptionRobotName,
        robotType = this.robotType
    ) {
        if (!this.connectionStrategy || !sourceId) {
            logger.info("No connection strategy found. Aborting...");
            return;
        }

        try {
            // @ts-ignore
            this.connectionStrategy.removeAllTopicSubscriptionsForNode(
                sourceId,
                robotName,
                robotType
            );
        } catch (error) {
            logger.error(error);
        }
    }

    _parseSelectedOptionRobotName(selectedOptionRobotName) {
        try {
            const robotName = selectedOptionRobotName?.split("___")[1] || "";
            return robotName;
        } catch (error) {
            logger.error(error);
            return null;
        }
    }

    _checkConnectionOfSelectedRobotWrapper() {
        try {
            const robotName = this._parseSelectedOptionRobotName(
                this.config.selectedRobotConnection
            );
            this.connectedRobotsOfTypeAmount = this.getConnectedRobotsOfTypeAmount();
            this.checkConnectionOfSelectedRobot(robotName); // type___name || null
        } catch (error) {
            logger.error(error);
        }
    }

    checkConnectionOfSelectedRobot(robotName) {
        if (
            ConnectionHelper.updateInProgress ||
            robotName === undefined ||
            robotName === null
        ) {
            return null;
        }

        if (
            ConnectionHelper.configuredRobotsStatus === undefined ||
            this.connectedRobotsOfTypeAmount === 0
        ) {
            this.node.status(NODE_STATUSES.NO_ROBOT_CONNECTED);
            this.lastNodeConnectionStatus = NODE_STATUSES.NO_ROBOT_CONNECTED;
            return null;
        }

        const hasConnectedRobotsOfType =
            ConnectionHelper.configuredRobotsStatus !== undefined &&
            this.connectedRobotsOfTypeAmount > 0;
        const noSelectedRobot =
            this.config.selectedRobotConnection === "" ||
            this.config.selectedRobotConnection === null;

        if (
            this.connectedRobotsOfTypeAmount > 1 &&
            (this.config.selectedRobotConnection === "" ||
                this.config.selectedRobotConnection === null)
        ) {
            this.node.status(NODE_STATUSES.MISSING_ROBOT_SELECTION);
            this.lastNodeConnectionStatus = NODE_STATUSES.MISSING_ROBOT_SELECTION;
            return null;
        }

        const robotIndex =
            ConnectionHelper.configuredRobotsStatus.successfulConnections.findIndex(
                (robot) => robot.robotName === robotName
            );

        if (
            robotIndex === -1 &&
            (this.config.selectedRobotConnection === "" ||
                this.config.selectedRobotConnection === null) &&
            this.connectedRobotsOfTypeAmount === 1
        ) {
            if (this.lastNodeConnectionStatus) {
                this.lastNodeConnectionStatus = null;
                this.node.status({});
            }
            let robotName =
                ConnectionHelper.configuredRobotsStatus.successfulConnections[0].robotName;
            this.selectedOptionRobotName = robotName;
            return `${this.robotType}___${robotName}`;
        } else if (robotIndex === -1) {
            this.node.status(NODE_STATUSES.ROBOT_OFFLINE);
            this.lastNodeConnectionStatus = NODE_STATUSES.ROBOT_OFFLINE;
            return null;
        } else if (
            ConnectionHelper.configuredRobotsStatus.successfulConnections[robotIndex]
                .robotType !== this.robotType
        ) {
            this.node.status(NODE_STATUSES.ROBOT_TYPE_ERROR);
            this.lastNodeConnectionStatus = NODE_STATUSES.ROBOT_TYPE_ERROR;
            return null;
        } else if (ConnectionHelper.configuredRobotsStatus.successfulConnections[robotIndex]) {
            if (this.lastNodeConnectionStatus) {
                // only overwrite the status if we changed it before
                this.lastNodeConnectionStatus = null;
                this.node.status({});
            }
        }

        this.selectedOptionRobotName = robotName;
        logger.debug(`selectedOptionRobotName: ${this.selectedOptionRobotName}`);

        return `${this.robotType}___${robotName}`;
    }

    getConnectedRobotsOfTypeAmount(robotType = this.robotType) {
        let connectedRobotTypeCount = 0;
        for (const robot of ConnectionHelper.configuredRobotsStatus.successfulConnections) {
            if (robot.robotType !== robotType) continue;
            connectedRobotTypeCount++;
        }

        return connectedRobotTypeCount;
    }

    getMatchingTypeConnections(
        robotType = this.robotType,
        robots = ConnectionHelper.configuredRobotsStatus.successfulConnections
    ) {
        const matchingConnections = robots.filter((robot) => robot.robotType === robotType);

        return matchingConnections;
    }

    selectDefaultConnectionStrategy(connectionObj, robotName) {
        let connectionStrategy = null;

        logger.debug(
            `selectDefaultConnectionStrategy: ${connectionObj.robotDefaultConnectionType},
            "for robot",
            ${robotName}`
        );

        switch (connectionObj.robotDefaultConnectionType) {
            case ROBOT_DEFAULT_CONNECTION_TYPES.PEPPER:
                connectionStrategy = new SocketIOStrategy(
                    this.node,
                    connectionObj,
                    robotName,
                    this.robotType
                );
                break;
            case ROBOT_DEFAULT_CONNECTION_TYPES.PEPPER_ANDROID:
                connectionStrategy = new MQTTStrategy(
                    this.node,
                    connectionObj,
                    robotName,
                    this.robotType
                );
                break;
            // case ROBOT_DEFAULT_CONNECTION_TYPES.TEMI: // NYI
            //     connectionStrategy = new MQTTStrategy(this.node, connectionObj, robotName);
            //     break;
            default:
                throw new Error(
                    `Default connection type "${connectionObj.robotDefaultConnectionType}" not supported`
                );
        }

        return connectionStrategy;
    }
}

module.exports = ConnectionHelper;
