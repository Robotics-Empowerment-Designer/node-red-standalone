const ConnectionHelper = require("node-red-contrib-base/connection/connectionHelper");
const logger = require("node-red-contrib-base/log")(module);

/**
 * @param {import("node-red").NodeAPI} RED Node-RED runtime object
 */
module.exports = function (RED) {
    const {
        createRobotConnection,
        createRobotConnections,
        _testRobotConnection,
        disconnectPreviousConnections,
    } = require("./connectionStrategyHelper");
    const EventPubSub = require("../eventPubSub");
    const {sendNotification} = require("../editorUtils");
    const exposedEvents = [EventPubSub.CHECK_SELECTED_CONNECTION];
    const events = new EventPubSub();
    let isSubscribedToUpdatedConnections = false;
    let _robotConnectionStore = {};
    let _frontEndRobotConnectionStore = [];

    RED.httpAdmin.post(
        "/create-robot-connection/",
        RED.auth.needsPermission("Start config.write"),
        async (req, res) => {
            let updateConnections = req.body.updateConnections;
            let robotConnectionStore = getRobotConnectionStore();
            try {
                if (
                    !(
                        req.body.robotName &&
                        req.body.robotType &&
                        req.body.robotIp &&
                        req.body.robotPort
                    )
                ) {
                    res.status(400)
                        .json(
                            "Missing parameters. Expected: robotName, robotType, robotIp, robotPort. Got: " +
                                JSON.stringify(req.body)
                        )
                        .end();
                    return;
                }

                if (
                    req.body.updateConnections === "first" ||
                    req.body.updateConnections === "both"
                ) {
                    disconnectPreviousConnections(robotConnectionStore);
                    setRobotConnectionStore({});
                    robotConnectionStore = {};
                }

                let creationResult = await createRobotConnection(
                    req.body.robotName,
                    req.body.robotType,
                    req.body.robotIp,
                    req.body.robotPort
                )
                    // @ts-ignore
                    .then((connectionObj) => {
                        robotConnectionStore[req.body.robotName] = connectionObj;
                        if (updateConnections === "last" || updateConnections === "both") {
                            // disconnectPreviousConnections(robotConnectionStore);
                            events.trigger(
                                EventPubSub.UPDATE_CONNECTIONS,
                                robotConnectionStore
                            );
                        }

                        return {hasKnownError: false};
                    })
                    .catch((error) => {
                        if (updateConnections === "last" || updateConnections === "both") {
                            // disconnectPreviousConnections(robotConnectionStore);
                            events.trigger(
                                EventPubSub.UPDATE_CONNECTIONS,
                                robotConnectionStore
                            );
                        }

                        if (error.hasKnownError) return error;
                        else new Error(error);
                    });

                if (creationResult.hasKnownError) {
                    res.status(creationResult.statusCode).json(creationResult).end();
                    return;
                }

                let connectionTestObj = await _testRobotConnection(
                    robotConnectionStore,
                    req.body.robotName
                );
                res.status(connectionTestObj.statusCode).json(connectionTestObj).end();
            } catch (error) {
                logger.error(
                    `Create robot connection failed due to an unexpected error: ${error}`
                );
                res.status(500).json({message: error.message}).end();
                return;
            }
        }
    );

    RED.httpAdmin.post(
        "/create-robot-connections/",
        RED.auth.needsPermission("Start config.write"),
        async (req, res) => {
            ConnectionHelper.updateInProgress = true;
            const robotConfigs = req.body.robotConfigs;
            let robotConnectionStore = getRobotConnectionStore();
            disconnectPreviousConnections(robotConnectionStore);
            setRobotConnectionStore({});
            setFrontEndRobotConnectionStore([]);
            robotConnectionStore = {};
            createRobotConnections(robotConfigs)
                .then((creationResults) => {
                    createRobotConnectionsCallback(creationResults, events);
                    let connectedRobots = [];

                    Object.keys(creationResults.successfulConnections).forEach((robotName) => {
                        let isRobotConnected =
                            creationResults.successfulConnections[robotName].isRobotConnected;
                        connectedRobots.push({
                            robotName: robotName,
                            robotType:
                                creationResults.successfulConnections[robotName].robotType,
                            statusCode: 200,
                            connectionStatus:
                                isRobotConnected === true ? "connected" : "disconnected",
                            message:
                                isRobotConnected === true
                                    ? "Robot connection found."
                                    : "Socket connection successful, but robot is not connected.",
                        });
                    });

                    creationResults.successfulConnections = connectedRobots;
                    ConnectionHelper.configuredRobotsStatus = creationResults;
                    setFrontEndRobotConnectionStore(creationResults);
                    ConnectionHelper.updateInProgress = false;
                    res.status(200).json(creationResults).end();
                })
                .catch((error) => {
                    logger.error(`Critical error creating robot connections: ${error}`);
                    res.status(500).json(error).end();
                });
        }
    );

    RED.httpAdmin.get("/simple-robot-connection-list/", async (req, res) => {
        let robotConnectionStore = getRobotConnectionStore();
        let robotConnectionsByType = {};

        if (req.query.debug) {
            logger.debug("configuredRobotsStatus");
            logger.debug(ConnectionHelper.configuredRobotsStatus);
            logger.debug("frontendRobotConnectionStore");
            logger.debug(getFrontEndRobotConnectionStore());
        }

        for (const robotName in robotConnectionStore) {
            if (robotConnectionStore[robotName].isNRSocketConnected === false) continue;

            let robotType = robotConnectionStore[robotName].robotType;
            if (!robotConnectionsByType[robotType]) {
                robotConnectionsByType[robotType] = [];
            }
            robotConnectionsByType[robotType].push(robotName);
        }

        res.status(200).json(robotConnectionsByType).end();
    });

    RED.httpAdmin.get("/robot-connection-status-list/", async (req, res) => {
        res.status(200).json(getFrontEndRobotConnectionStore()).end();
    });

    RED.httpAdmin.post("/test-robot-connection/", async (req, res) => {
        try {
            let connectionTestObj = await _testRobotConnection(
                getRobotConnectionStore(),
                req.body.robotName
            );
            res.status(connectionTestObj.statusCode).json(connectionTestObj).end();
        } catch (error) {
            logger.error(`Test robot connection failed due to an unexpected error: ${error}`);
            res.status(500).json({message: error.message}).end();
            return;
        }
    });

    RED.httpAdmin.post("/test-robot-connections/", async (req, res) => {
        let robotConnectionStore = getRobotConnectionStore();

        if (!req.body.savedRobots) {
            req.body.savedRobots = [];
        }

        const savedRobotsNames = req.body.savedRobots.map((robot) => robot.robotName);
        const robotNamesSet = new Set([
            ...Object.keys(robotConnectionStore),
            ...savedRobotsNames,
        ]);
        try {
            let connectionTestPromises = [];
            for (const robotName of robotNamesSet) {
                const testPromise = _testRobotConnection(robotConnectionStore, robotName)
                    .then((connectionTestResult) => {
                        if (robotConnectionStore[robotName]) {
                            connectionTestResult.robotType =
                                robotConnectionStore[robotName].robotType;
                        } else {
                            connectionTestResult.robotType =
                                req.body.savedRobots.find(
                                    (robot) => robot.robotName === robotName
                                )?.robotType || "unknown";
                        }
                        return connectionTestResult;
                    })
                    .catch((error) => {
                        error.robotName = robotName;
                        if (robotConnectionStore[robotName]) {
                            error.robotType = robotConnectionStore[robotName].robotType;
                        }
                        // check if robotType exists in savedRobots for current robotName
                        else {
                            error.robotType =
                                req.body.savedRobots.find(
                                    (robot) => robot.robotName === robotName
                                )?.robotType || "unknown";
                        }

                        return error;
                    });
                connectionTestPromises.push(testPromise);
            }

            let results = await Promise.all(connectionTestPromises)
                .then((connectionTestResults) => {
                    try {
                        let configuredRobotsStatus = {
                            successfulConnections: [],
                            failedConnections: [],
                        };
                        let hasConnectionChanged = false;
                        connectionTestResults.forEach((connectionTestResult) => {
                            let isConnected =
                                connectionTestResult.connectionStatus === "connected";

                            let robotConnectionObj =
                                robotConnectionStore[connectionTestResult.robotName];

                            if (
                                robotConnectionObj !== undefined &&
                                isConnected !== robotConnectionObj.isNRSocketConnected
                            ) {
                                robotConnectionStore[
                                    connectionTestResult.robotName
                                ].isNRSocketConnected = isConnected;

                                hasConnectionChanged = true;
                            }

                            if (isConnected) {
                                configuredRobotsStatus.successfulConnections.push({
                                    robotName: connectionTestResult.robotName,
                                    robotType: connectionTestResult.robotType,
                                });
                            } else {
                                configuredRobotsStatus.failedConnections.push(
                                    connectionTestResult
                                );
                            }
                        });

                        if (hasConnectionChanged) {
                            setRobotConnectionStore(robotConnectionStore);
                        }

                        ConnectionHelper.configuredRobotsStatus = configuredRobotsStatus;
                    } catch (error) {
                        logger.error(`startConfig.js test-robot-connections error: ${error}`);
                    }

                    return connectionTestResults;
                })
                .catch((error) => {
                    return error;
                });
            res.status(200).json(results).end();
        } catch (error) {
            logger.error(`Test robot connections failed due to an unexpected error: ${error}`);
            res.status(500).json({message: error.message}).end();
            return;
        }
    });

    /**
     * HTTP POST endpoint at '/trigger-start-config-event/'.
     * This endpoint is used to trigger an event in the Node-RED (through our custom EventPubSub class) editor.
     *
     * @route {POST} /trigger-start-config-event/
     * @authentication This route requires HTTP Basic authentication (@see https://nodered.org/docs/user-guide/runtime/securing-node-red) (once configured). If authentication fails it will return a 401 error.
     * @bodyparam {number} eventId - The ID of the event to be triggered.
     *
     * @responsecode {400} If the 'eventId' body parameter is missing or if the event is not found in the exposed events, the API will return a 400 status code with a message.
     * @responsecode {200} If the event is successfully triggered, the API will return a 200 status code with a message.
     */
    RED.httpAdmin.post(
        // maybe include data in the body later, need to sanitize before propagating though
        "/trigger-start-config-event/",
        RED.auth.needsPermission("Start config.write"),
        async (req, res) => {
            // get event id from req, check if in exposed events, trigger event
            let eventId = req.body.eventId;
            if (!eventId) {
                res.status(400).json("Missing parameter. Expected: eventId").end();
                return;
            }

            // @ts-ignore
            if (!exposedEvents.includes(Number(eventId))) {
                res.status(400).json("Event not found").end();
                return;
            }

            events.trigger(eventId);
            res.status(200)
                .json("Event " + eventId + " triggered")
                .end();
        }
    );

    function getRobotConnectionStore() {
        return _robotConnectionStore;
    }

    function setRobotConnectionStore(newRobotConnectionStore, triggerUpdateEvent = false) {
        if (triggerUpdateEvent) {
            disconnectPreviousConnections(_robotConnectionStore);
            _robotConnectionStore = newRobotConnectionStore;
            events.trigger(EventPubSub.UPDATE_CONNECTIONS, newRobotConnectionStore);
        } else {
            _robotConnectionStore = newRobotConnectionStore;
        }
    }

    function getFrontEndRobotConnectionStore() {
        return _frontEndRobotConnectionStore;
    }

    function setFrontEndRobotConnectionStore(newFrontEndRobotConnectionStore) {
        _frontEndRobotConnectionStore = newFrontEndRobotConnectionStore;
    }

    function createRobotConnectionsCallback(creationResults, events) {
        // retain info about failed connections
        let failedConnections = [];

        for (const connectionObj of creationResults.failedConnections) {
            failedConnections.push({
                robotName: connectionObj.robotName,
                robotType: connectionObj.robotType,
                hasKnownError: connectionObj.hasKnownError,
                message: connectionObj.message,
                statusCode: connectionObj.statusCode,
            });
        }

        ConnectionHelper.initGlobalEventPubSub();
        setRobotConnectionStore(creationResults.successfulConnections, true);
        disconnectPreviousConnections(creationResults.failedConnections);
        creationResults.failedConnections = failedConnections;
        return creationResults;
    }

    /**
     * @this {import("node-red-contrib-base/types").StartConfigBaseRuntimeDef} Node-RED node instance
     * @param {import("node-red-contrib-base/types").StartConfigBaseEditorDef} config Node-RED node instance definition/configuration
     */
    function StartConfigNode(config) {
        RED.nodes.createNode(this, config);

        const node = this;
        const ch = new ConnectionHelper(null, node, config, "ASDF");
        const updateConnectionsCallback = (newRobotConnectionStore) => {
            logger.debug("Updating connections in startConfig node");
            setRobotConnectionStore(newRobotConnectionStore);
            ConnectionHelper.initGlobalEventPubSub();
            events.trigger(EventPubSub.UPDATED_CONNECTIONS, newRobotConnectionStore);
        };

        if (!isSubscribedToUpdatedConnections) {
            events.subscribe(EventPubSub.UPDATE_CONNECTIONS, updateConnectionsCallback);
            isSubscribedToUpdatedConnections = true;
        }

        node.on("close", (removed, done) => {
            if (removed) {
                events.unsubscribe(EventPubSub.UPDATE_CONNECTIONS, updateConnectionsCallback);
                ConnectionHelper.cleanup();
                isSubscribedToUpdatedConnections = false;
            }
            done();
        });
        logger.info(JSON.stringify(config));
        if (
            config.robots &&
            ConnectionHelper.configuredRobotsStatus.successfulConnections.length == 0
        ) {
            createRobotConnections(config.robots)
                .then((creationResults) => {
                    let results = createRobotConnectionsCallback(creationResults, events);
                    let connectedRobots = [];
                    let disconnectedRobots = [];

                    Object.keys(results.successfulConnections).forEach((index) => {
                        connectedRobots.push({
                            robotName: results.successfulConnections[index].robotName,
                            robotType: results.successfulConnections[index].robotType,
                        });
                    });

                    Object.keys(results.failedConnections).forEach((index) => {
                        disconnectedRobots.push({
                            robotName: results.failedConnections[index].robotName,
                            robotType: results.failedConnections[index].robotType,
                        });
                    });

                    results.successfulConnections = connectedRobots;
                    results.failedConnections = disconnectedRobots;
                    setFrontEndRobotConnectionStore(results);
                    ConnectionHelper.configuredRobotsStatus = results;
                    events.trigger(EventPubSub.CHECK_SELECTED_CONNECTION);
                })
                .catch((error) => {
                    logger.error(
                        `Critical error creating robot connections: ${JSON.stringify(error)}`
                    );
                    sendNotification(
                        RED,
                        "connectionError",
                        "Critical error creating robot connections: " + error,
                        "error",
                        5000
                    );
                });
        }
    }
    RED.nodes.registerType("Start config", StartConfigNode);
};
