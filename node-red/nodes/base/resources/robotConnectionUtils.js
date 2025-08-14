// @ts-nocheck
function recreateRobotConnections(force = false, callback = (data) => {}) {
    robotsConfigNode = null;

    RED.nodes.eachConfig(function (node) {
        if (node.type === "Start config") {
            robotsConfigNode = node;
            return;
        }
    });

    if (!robotsConfigNode?.dirty && !force) {
        console.log("No changes in robot connections. Skipping recreation.");
        return;
    }

    if (robotsConfigNode !== null && robotsConfigNode.robots.length !== 0) {
        console.log("Recreating robot connections. ", robotsConfigNode.robots);
        createRobotConnections(robotsConfigNode.robots)
            .then((data) => {
                callback(data);
            })
            .catch((error) => {
                console.log("recreateRobotConnections catch");
                console.log(error);
            });
    } else {
        console.log(
            "No robot connections found. Or robotsConfigNode is null. ",
            robotsConfigNode
        );
    }
}

function createRobotConnections(_robotConfigs) {
    return new Promise((resolve, reject) => {
        $.ajax({
            url: "create-robot-connections",
            type: "POST",
            contentType: "application/json",
            data: JSON.stringify({robotConfigs: _robotConfigs}),
            success: function (data, textStatus, jqXHR) {
                if (data.statusCode === 200) {
                    resolve(data);
                    return;
                }

                let notifications = [];

                for (let failedConnection of data.failedConnections) {
                    if (
                        failedConnection === null ||
                        failedConnection === undefined ||
                        failedConnection === "undefined"
                    )
                        continue;

                    let notification = RED.notify(escapeHtml(failedConnection.message), {
                        modal: false,
                        fixed: true,
                        type: "error",
                        timeout: 5000,
                        buttons: [
                            {
                                text: "Close all",
                                class: "primary",
                                click: function (e) {
                                    notifications.forEach((_notification) => {
                                        _notification.close();
                                    });
                                },
                            },
                            {
                                text: "OK",
                                class: "primary",
                                click: function (e) {
                                    notification.close();
                                },
                            },
                        ],
                    });
                    notifications.push(notification);
                }
                triggerCheckConnection();
                resolve(data);
            },
            error: function (jqXHR, textStatus, errorThrown) {
                let resultJson =
                    jqXHR.responseJSON ??
                    "Response JSON is null. Server most likely not reachable.";
                console.log(
                    new Error(
                        `Error while creating robot connections. Error (${jqXHR.status}): ${errorThrown}. Message: ${resultJson}`
                    )
                );
                reject(resultJson);
            },
        });
    });
}

function createRobotConnection(
    robotName,
    robotType,
    robotIP,
    robotPort,
    updateConnections = false
) {
    return new Promise((resolve, reject) => {
        $.ajax({
            url: "create-robot-connection",
            type: "POST",
            contentType: "application/json",
            data: JSON.stringify({
                robotName: robotName,
                robotType: robotType,
                robotIp: robotIP,
                robotPort: robotPort,
                updateConnections: updateConnections,
            }),
            success: function (data, textStatus, jqXHR) {
                if (data.statusCode === 200) {
                    resolve(data);
                    return;
                }

                reject(data.message);
            },
            error: function (jqXHR, textStatus, errorThrown) {
                console.log(
                    new Error(
                        `Error while creating robot connection for ${robotName} ${robotIP}:${robotPort}. Error (${jqXHR.status}): ${errorThrown}. Message: ${resultJson}`
                    )
                );
                reject(resultJson);
            },
        });
    });
}

function testRobotConnection(robotName, node, row) {
    $.ajax({
        url: "test-robot-connection",
        type: "POST",
        data: JSON.stringify({robotName: robotName}),
        contentType: "application/json",
        success: function (data, textStatus, jqXHR) {
            if (data.statusCode === 200) {
                node._def.updateConnectionIndicator(row, data.connectionStatus);
                return;
            }

            node._def.updateConnectionIndicator(row, "disconnected", data.message);
        },
        error: function (jqXHR, textStatus, errorThrown) {
            let message = jqXHR.responseJSON?.message ?? errorThrown;
            console.log(message);
            node._def.updateConnectionIndicator(row, "disconnected", message);
            console.log(
                "Error while testing robot connection for " +
                    robotName +
                    ". Message: " +
                    errorThrown
            );
        },
    });
}

function testRobotConnections(_savedRobots = []) {
    return new Promise((resolve, reject) => {
        $.ajax({
            url: "test-robot-connections",
            type: "POST",
            contentType: "application/json",
            data: JSON.stringify({savedRobots: _savedRobots}),
            success: function (data, textStatus, jqXHR) {
                let connections = {successfulConnections: [], failedConnections: []};

                data.forEach((connection) => {
                    if (connection.connectionStatus === "connected") {
                        connections.successfulConnections.push(connection);
                    } else {
                        connections.failedConnections.push(connection);
                    }
                });

                resolve(connections);
            },
            error: function (jqXHR, textStatus, errorThrown) {
                let message = jqXHR.responseJSON?.message ?? errorThrown;
                console.log("Error while testing robot connections. Message: " + errorThrown);
                reject(message);
            },
        });
    });
}

function deleteRobotConnection(robotsConfigNode, robotName, robotType) {
    try {
        let robotIndex = robotsConfigNode.robots[robotType].findIndex((robot) => {
            return robot.robotName === robotName;
        });

        if (robotIndex !== -1) {
            robotsConfigNode.robots[robotType].splice(robotIndex, 1);
            robotsConfigNode.dirty = true;
            RED.nodes.dirty(true);
            const deleteNotification = RED.notify(
                `Marked robot ${robotName} for deletion. Deploy to confirm deletion or reload without saving to revert it.`,
                {
                    modal: true,
                    fixed: true,
                    type: "info",
                    buttons: [
                        {
                            text: "Revert",
                            click: function (e) {
                                window.location.reload();
                            },
                        },
                        {
                            text: "Continue",
                            class: "primary",
                            click: function (e) {
                                deleteNotification.close();
                            },
                        },
                    ],
                }
            );
        } else {
            console.log(robotName + " not found in list.");
            RED.notify("Robot not found in list. Refresh the page to fix.", "error"); // TODO occurs when: robot initially created => deployed => deleted. Then the removeItem functions data is empty, thus we can't find the robot in the list
        }
    } catch (error) {
        console.log("Error while deleting robot connection. Message: " + error);
    }
}

function getRobotConnectionStatusList() {
    return new Promise((resolve, reject) => {
        $.ajax({
            url: "robot-connection-status-list",
            type: "GET",
            success: function (data, textStatus, jqXHR) {
                resolve(data);
            },
            error: function (jqXHR, textStatus, errorThrown) {
                console.log("Error while getting robot connections. Message: " + errorThrown);
                reject();
            },
        });
    });
}

function isFirstOrLastRobotConnection(index, length) {
    if (index === 0 && index === length - 1) {
        return "both";
    } else if (index === 0) {
        return "first";
    } else if (index === length - 1) {
        return "last";
    } else {
        return "none";
    }
}

function triggerCheckConnection(callback = (data) => {}) {
    // TODO NO ROBOT CONNECTED ISSUES PROBABLY HERE, BECAUSE OF 2 EVENTS TRIGGERED AT THE SAME TIME
    return new Promise((resolve, reject) => {
        $.ajax({
            type: "POST",
            url: "trigger-start-config-event/",
            data: {
                eventId: 11, // EventPubSub.CHECK_SELECTED_CONNECTION
            },
            success: function (data) {
                callback(data);
                console.log(data);
                resolve(data);
            },
            error: function (error) {
                callback(data);
                console.log(error);
                reject(error);
            },
        });
    });
}
