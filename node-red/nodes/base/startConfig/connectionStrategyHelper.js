// create function to select robot connection create strategy (based on robot type)
// create implementations for each robot type (pepper, temi, sawyer)
// in strategy selector, after creation of robot connection, add robot connection to context
const http = require("http");
const mqtt = require("mqtt");
const logger = require("node-red-contrib-base/log")(module);
const CONNECTION_TYPES = require("node-red-contrib-base/connection/connectionTypesEnum");
const ROBOT_DEFAULT_CONNECTION_TYPES = require("node-red-contrib-base/connection/robotDefaultConnectionTypesEnum");
const CONNECTION_TIMEOUT_DURATION = 3000; // 5 seconds timeout to declare no connection could be established

function createPepperConnection(robotName, robotType, robotIP, robotPort) {
    socketIOClient = require("socket.io-client");
    const agent = new http.Agent();

    const robotUrl = `http://${robotIP}:${robotPort}`;
    const socket = socketIOClient(robotUrl, {
        autoConnect: false,
        extraHeaders: {
            serviceName: `[${robotPort}] Node-RED:${robotName}`,
        },
        agent: agent,
    });

    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            socket.close();
            reject({
                hasKnownError: true,
                message: `Connection took to long to establish for ${robotUrl} with robot ${robotName}. Is the middleware running and reachable?`,
                statusCode: 504,
            });
        }, CONNECTION_TIMEOUT_DURATION);

        const onConnect = () => {
            clearTimeout(timeoutId);
            socket.off("connect_error", onConnectError);
            socket.testRobotConnection = () =>
                // NEEDED FOR ALL CONNECTION STRATEGIES
                testPepperConnection(robotIP, robotPort, socket);
            socket.disconnectRobot = disconnectPepperRobotSocket.bind(socket); // NEEDED FOR ALL CONNECTION STRATEGIES
            socket.robotType = robotType;
            socket.isNRSocketConnected = true;
            resolve(socket);
        };

        const onConnectError = (error) => {
            logger.warn(`Connection error with ${robotUrl}: ${error.message}`);
            clearTimeout(timeoutId);
            socket.isNRSocketConnected = false;
            socket.close();
            reject({
                hasKnownError: true,
                message: `Connection error with ${robotUrl} for robot ${robotName}. Is the middleware running and reachable? Error: ${error.message}`,
                statusCode: 502,
            });
        };

        const onConnectionStatus = (connectionStatus) => {
            logger.info("Connection status changed. New status: " + connectionStatus);
        };

        socket.on("/update/connection_type", onConnectionStatus);
        socket.on("connect", onConnect);
        socket.on("connect_error", onConnectError);

        socket.connect();
    });
}

function testPepperConnection(robotIp, robotPort, socket) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: robotIp,
            port: robotPort,
            path: "/robot/system/connection_state",
            method: "GET",
        };

        const req = http.request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => {
                data += chunk;
            });

            res.on("end", () => {
                const connectionState = JSON.parse(data).connection_state;
                const isRobotConnected = connectionState === "connected";
                const isSocketConnected = socket.isNRSocketConnected;
                resolve({
                    isRobotConnected: isRobotConnected,
                    isSocketConnected: isSocketConnected,
                    isConnected: isRobotConnected && isSocketConnected,
                });
            });
        });

        req.on("error", (_) => {
            const isSocketConnected = socket.isNRSocketConnected;
            resolve({
                isRobotConnected: false,
                isSocketConnected: isSocketConnected,
                isConnected: false,
            });
        });

        req.end();
    });
}

function disconnectPepperRobotSocket() {
    return new Promise((resolve, reject) => {
        try {
            this.isNRSocketConnected = false;
            // @ts-ignore
            this.close();
            resolve();
        } catch (error) {
            logger.error("Error while disconnecting from pepper robot");
            logger.error(error);
            reject(error);
        }
    });
}

function createPepperAndroidConnection(
    robotName,
    robotType,
    brokerIp,
    brokerPort,
    username = null,
    password = null
) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            if (mqttClient.connected === true) {
                mqttClient.hasKnownError = true;
                mqttClient.message = `Took too long to wait for connection update from the robot ${robotName}. Is the robot connected to the broker?`;
                mqttClient.statusCode = 504;
                mqttClient.isRobotConnected = false;
                mqttClient.isNRSocketConnected = true;
                mqttClient.testRobotConnection = () => testPepperAndroidConnection(mqttClient);
                mqttClient.disconnectRobot =
                    disconnectPepperAndroidRobotSocket.bind(mqttClient);
                resolve(mqttClient);
            } else {
                destroyMqttClient(mqttClient).finally(() => {
                    mqttClient = null;
                    reject({
                        hasKnownError: true,
                        message: `Connection took too long to establish for MQTT broker at ${brokerIp}:${brokerPort} with robot ${robotName}. Is the middleware running and reachable?`,
                        statusCode: 503,
                    });
                });
            }
        }, CONNECTION_TIMEOUT_DURATION);

        let mqttClient = mqtt.connect(`mqtt://${brokerIp}:${brokerPort}`, {
            clientId: `Node-RED:${robotName}-${Math.random().toString(16).substring(2, 8)}`,
            username: username,
            password: password,
            keepalive: 0, // TODO CHECK IF THIS CAUSES ANY ISSUES, CURRENTLY 0 (DISABLED) BECAUSE OF PERMANENT RECONNECTS
        });
        mqttClient.isRobotConnected = false;

        mqttClient.on("connect", (connack) => {
            if (connack.isSessionPresent) {
                logger.debug("Reconnected to MQTT broker. Skipping listener setup.");
                return;
            }

            mqttClient.robotName = robotName;
            mqttClient.robotType = robotType;

            logger.info(`Connected to MQTT broker at ${brokerIp}:${brokerPort}`);

            mqttClient.on("message", (topic, message) => {
                logger.verbose(
                    `Received message on topic: ${topic}, broker connected: ${mqttClient.connected}, robot connected: ${mqttClient.isRobotConnected}`
                );
                if (topic === `${robotType}/${robotName}/system/connectionState`) {
                    clearTimeout(timeoutId);
                    let isRobotConnected = false;
                    try {
                        isRobotConnected =
                            JSON.parse(message.toString()).isRobotConnectedToBroker ?? false;
                    } catch (error) {
                        logger.error("Error while parsing connection state message: " + error);
                    }
                    logger.info(`${robotName} isRobotConnected: ${isRobotConnected}`);
                    mqttClient.isRobotConnected = isRobotConnected;
                    mqttClient.isNRSocketConnected = mqttClient.connected; // sue me
                    mqttClient.testRobotConnection = () =>
                        testPepperAndroidConnection(mqttClient);
                    mqttClient.disconnectRobot =
                        disconnectPepperAndroidRobotSocket.bind(mqttClient);
                    resolve(mqttClient);
                }
            });

            mqttClient.subscribe(
                `${robotType}/${robotName}/system/connectionState`,
                (err, granted) => {
                    logger.verbose(JSON.stringify(granted));
                    if (err) {
                        logger.error(
                            `Error while subscribing to connection info topic: ${err}`
                        );

                        reject({
                            hasKnownError: true,
                            message: `Error while subscribing to connection info topic: ${err}`,
                            statusCode: 503,
                        });
                    } else {
                        logger.debug(
                            `connectionStrategyHelper: Subscribed to topic: ${robotType}/${robotName}/system/connectionState`
                        );
                        mqttClient.publish(
                            `${robotType}/${robotName}/system/connectionState/run`,
                            "",
                            (err) => {
                                if (err) {
                                    logger.error(`Error while publishing to topic: ${err}`);
                                    reject({
                                        hasKnownError: true,
                                        message: `Error while publishing to topic: ${err}`,
                                        statusCode: 503,
                                    });
                                }
                            }
                        );
                    }
                }
            );
            mqttClient.on("error", (error) => {
                destroyMqttClient(mqttClient).finally(() => {
                    mqttClient = null;
                    reject({
                        hasKnownError: true,
                        message: `Connection took too long to establish for MQTT broker at ${brokerIp}:${brokerPort} with robot ${robotName}. Is the middleware running and reachable?`,
                        statusCode: 503,
                    });
                });
            });

            mqttClient.on("reconnect", (connack) => {
                logger.info("Reconnected to MQTT broker");
            });
        });
    });
}

function testPepperAndroidConnection(mqttClient) {
    return new Promise((resolve, reject) => {
        try {
            let isSocketConnected = mqttClient.connected;
            let isRobotConnected = mqttClient.isRobotConnected;

            resolve({
                isSocketConnected: isSocketConnected,
                isRobotConnected: isRobotConnected,
                isConnected: isSocketConnected && isRobotConnected,
            });
        } catch (error) {
            logger.warn("Error while testing connection to robot");
            logger.warn(error);
            reject(error);
        }
    });
}

function disconnectPepperAndroidRobotSocket() {
    return new Promise((resolve, reject) => {
        try {
            destroyMqttClient(this).finally(() => {
                resolve();
            });
        } catch (error) {
            logger.error("Error while disconnecting from MQTT broker");
            logger.error(error);
            reject(error);
        }
    });
}

function createTemiConnection(robotName, robotType, robotIP, robotPort) {
    throw new Error("Not implemented");
}

function createSawyerConnection(robotName, robotType, robotIP, robotPort) {
    throw new Error("Not implemented");
}

async function _testRobotConnection(robotConnectionStore, robotName) {
    let connectionTestObj = {};
    try {
        if (!robotName) {
            connectionTestObj = {
                statusCode: 400,
                message:
                    "Missing parameter. Expected: robotName. Got: " +
                    JSON.stringify(robotName),
                connectionStatus: "disconnected",
                robotName: "undefined",
                robotType: "unknown",
            };
            return connectionTestObj;
        } else if (!robotConnectionStore[robotName]) {
            connectionTestObj = {
                statusCode: 404,
                message:
                    "Robot connection not found. Is the middleware running and reachable?",
                connectionStatus: "disconnected",
                robotName: robotName,
                robotType: "unknown",
            };
            return connectionTestObj;
        } else if (robotConnectionStore[robotName].hasError) {
            connectionTestObj = {
                statusCode: 502,
                message: robotConnectionStore[robotName].message,
                connectionStatus: "disconnected",
                robotName: robotName,
                robotType: robotConnectionStore[robotName].robotType,
            };
            return connectionTestObj;
        }
        let connectionTestResult = null;
        try {
            connectionTestResult = await robotConnectionStore[robotName].testRobotConnection();
            if (!connectionTestResult) throw new Error("Connection test aborted.");
        } catch (error) {
            logger.error(error);
            connectionTestObj = {
                statusCode: 500,
                message: error.message,
                connectionStatus: "unknown",
                robotName: robotName,
                robotType: robotConnectionStore[robotName].robotType,
            };
            return connectionTestObj;
        }
        if (connectionTestResult.isConnected) {
            // @ts-ignore
            connectionTestObj = {
                statusCode: 200,
                message: "Robot connection found",
                connectionStatus: "connected",
            };
        } else if (connectionTestResult.isSocketConnected) {
            // @ts-ignore
            connectionTestObj = {
                statusCode: 502,
                message: "Socket connection successful, but robot is not connected.",
                connectionStatus: "disconnected",
            };
        } else {
            // @ts-ignore
            connectionTestObj = {
                statusCode: 502,
                message:
                    "Connection test failed. Couldn't establish connection to robot or middleware.",
                connectionStatus: "disconnected",
            };
        }

        connectionTestObj.robotName = robotName;
        connectionTestObj.robotType = robotConnectionStore[robotName].robotType;

        return connectionTestObj;
    } catch (error) {
        logger.error("Error in _testRobotConnection:");
        logger.error(error);
        connectionTestObj = {
            robotName: robotName,
            robotType: robotConnectionStore[robotName]?.robotType ?? "unknown",
            statusCode: 500,
            message: error.message,
            connectionStatus: "disconnected",
        };
        return connectionTestObj;
    }
}

function disconnectPreviousConnections(robotConnectionStore) {
    for (const robot in robotConnectionStore) {
        robotConnectionStore[robot].disconnectRobot?.();
        robotConnectionStore[robot] = null;
        delete robotConnectionStore[robot];
    }
}

/**
 *
 * @param {String} robotName Robot name specified through the sidebar in Node-RED.
 * @param {String} robotType Robot type specified through the sidebar in Node-RED. Can be "pepper", "pepper_android", "temi" or "sawyer".
 * @param {String} robotIP IPv4 address of the robot OR middleware OR MQTT broker, depending on the robot type.
 * @param {Number} robotPort Port number of the robot OR middleware OR MQTT broker, depending on the robot type.
 * @returns {Promise<any>} Promise that resolves with the connection object for the robot.
 */
function createRobotConnection(robotName, robotType, robotIP, robotPort) {
    let robotConnectionObj = null;
    logger.debug("Creating connection for robot: " + robotName + " of type: " + robotType);
    switch (robotType) {
        case "pepper":
            robotConnectionObj = createPepperConnection(
                robotName,
                robotType,
                robotIP,
                robotPort
            );
            break;
        case "pepper_android":
            robotConnectionObj = createPepperAndroidConnection(
                robotName,
                robotType,
                robotIP,
                robotPort
            );
            break;
        case "temi":
            robotConnectionObj = createTemiConnection(
                robotName,
                robotType,
                robotIP,
                robotPort
            );
            // robotConnectionObj.robotConnectionType = CONNECTION_TYPES.MQTT; // TODO NYI
            break;
        case "sawyer":
            robotConnectionObj = createSawyerConnection(
                robotName,
                robotType,
                robotIP,
                robotPort
            );
            // robotConnectionObj.robotConnectionType = CONNECTION_TYPES.???; // TODO
            break;
    }

    // robotConnectionObj.robotType = robotType;

    if (robotConnectionObj) {
        return Promise.resolve(robotConnectionObj);
    } else {
        return Promise.reject({
            robotName: robotName,
            robotType: robotType,
            hasKnownError: true,
            error: "Unknown robot type",
        }); // TODO TEST
    }
}

async function createRobotConnections(robotList) {
    return new Promise((resolve, reject) => {
        if (!robotList) {
            reject(
                "Missing parameter. Expected: robotList. Got: " + JSON.stringify(robotList)
            );
        }

        let creationPromises = [];

        Object.keys(robotList).forEach((robotType) => {
            robotList[robotType].forEach((robot) => {
                let robotConnectionObj = null;
                if (robot.robotType == null || robot.robotType === "") return;
                try {
                    robotConnectionObj = createRobotConnection(
                        robot.robotName,
                        robot.robotType,
                        robot.robotIp,
                        robot.robotPort
                    )
                        .then((connectionObj) => {
                            if (robot.robotType === "pepper_android")
                                logger.info(
                                    "Created connection for robot: " + robot.robotName
                                );
                            try {
                                const result = {};
                                result[robot.robotName] = connectionObj;
                                result[robot.robotName].robotType = robot.robotType;
                                result[robot.robotName].robotDefaultConnectionType =
                                    ROBOT_DEFAULT_CONNECTION_TYPES[
                                        robot.robotType?.toUpperCase()
                                    ];
                                return result;
                            } catch (error) {
                                logger.error(error);
                            }
                        }) // wrap individual promise results in named object
                        .catch((e) => {
                            logger.error(
                                "Error while creating connection for robot: " + robot.robotName
                            );
                            e.robotName = robot.robotName;
                            e.robotType = robot.robotType;
                            logger.error(JSON.stringify(e));
                            return e;
                        }); // catch individual promise rejections
                } catch (error) {
                    logger.error(error);
                }

                if (robotConnectionObj != null && robotConnectionObj !== undefined) {
                    creationPromises.push(robotConnectionObj);
                }
            });
        });

        Promise.all(creationPromises)
            .then((results) => {
                // results contain both connection objects and failedConnections, thus we need to split them
                const {successfulConnections, failedConnections} = results.reduce(
                    (acc, result, index) => {
                        if (
                            result != null &&
                            !(result instanceof Error) &&
                            result.hasKnownError !== true
                        ) {
                            acc.successfulConnections = {
                                ...result,
                                ...acc.successfulConnections,
                            };
                        } else {
                            acc.failedConnections.push(result);
                        }
                        return acc;
                    },
                    {successfulConnections: [], failedConnections: []} // initial value
                );
                resolve({
                    successfulConnections: successfulConnections,
                    failedConnections: failedConnections,
                });
            })
            .catch((error) => {
                // This will only be executed if there was an error not caught in the promises
                console.error(error);
                reject(error);
            });
    });
}

////// HELPER FUNCTIONS //////
function destroyMqttClient(client) {
    return new Promise((resolve, reject) => {
        try {
            client.end(true, () => {
                client = null;
                resolve();
            });
        } catch (error) {
            logger.error("Error while destroying mqtt client");
            logger.error(error);
            reject(error);
        }
    });
}

module.exports = {
    createRobotConnection,
    createRobotConnections,
    _testRobotConnection,
    disconnectPreviousConnections,
};
