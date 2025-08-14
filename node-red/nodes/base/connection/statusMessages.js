/**
 * @fileoverview This file contains status message objects for connection related node statuses in the Node-RED editor.
 */

const STATUS_MESSAGES_CHECK_CONNECTION = Object.freeze({
    NO_ROBOT_CONNECTED: {
        fill: "red",
        shape: "dot",
        text: "node-red-contrib-base/startConfig:Start config.cHNodeConnectionStatus.noRobotConnected",
    },
    MISSING_ROBOT_SELECTION: {
        fill: "red",
        shape: "dot",
        text: "node-red-contrib-base/startConfig:Start config.cHNodeConnectionStatus.missingRobotSelection",
    },
    ROBOT_OFFLINE: {
        fill: "red",
        shape: "dot",
        text: "node-red-contrib-base/startConfig:Start config.cHNodeConnectionStatus.robotOffline",
    },
    ROBOT_TYPE_ERROR: {
        fill: "red",
        shape: "dot",
        text: "node-red-contrib-base/startConfig:Start config.cHNodeConnectionStatus.robotTypeError",
    },
    ROBOT_SELECTION_ERROR: {
        fill: "red",
        shape: "dot",
        text: "node-red-contrib-base/startConfig:Start config.cHNodeConnectionStatus.robotSelectionError",
    },
});

module.exports = STATUS_MESSAGES_CHECK_CONNECTION;
