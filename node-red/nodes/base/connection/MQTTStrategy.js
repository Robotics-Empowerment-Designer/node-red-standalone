const ConnectionStrategy = require("node-red-contrib-base/connection/ConnectionStrategyBase");
const CONNECTION_TYPES = require("node-red-contrib-base/connection/connectionTypesEnum");
const NODE_STATUSES = require("node-red-contrib-base/connection/statusMessages");
const mqttHandler = require("node-red-contrib-base/connection/MQTTHandler");
const logger = require("node-red-contrib-base/log")(module);

class MQTTStrategy extends ConnectionStrategy {
    constructor(node, mqttClient, robotName, robotType) {
        super(CONNECTION_TYPES.MQTT);
        this.node = node;
        this.robotName = robotName;
        this.mqttClient = mqttClient;
        this.robotType = robotType;
        // this.sourceId = `${node.type}:${node.id}`; // to make sure a single node can't subscribe to the same topic multiple times
        mqttHandler.initClient(robotName, mqttClient);
    }

    on(robotName, event, callback, removeAfterMessage) {
        const sourceId = `${this.node.type}:${this.node.id}`;
        mqttHandler.addTopicSubscription(
            robotName,
            this.robotType,
            event,
            callback,
            sourceId,
            removeAfterMessage
        );
    }

    emit(event, data, serializePayload = true) {
        let payload = data;
        if (serializePayload) {
            payload = JSON.stringify(data, this.#jsonUndefinedReplacer);
        }

        if (this.mqttClient.connected === false) {
            logger.warn("MQTT client not connected. Cannot send message.");
            this.node.status(NODE_STATUSES.ROBOT_OFFLINE);
            return;
        }
        logger.debug(`Publishing message on topic ${event} for robot ${this.robotName}`);
        this.mqttClient.publish(
            `${this.robotType}/${this.robotName}/${event}`,
            payload,
            (err) => {
                if (err) {
                    this.node.status("Error sending event. Redeploy Flow.");
                    logger.error(`Error publishing message on topic ${event}: ${err}`);
                }
                logger.debug(
                    `Message published on topic ${event} for robot ${this.robotName}`
                );
            }
        );
    }

    removeAllTopicSubscriptionsForNode(sourceId, robotName, robotType) {
        mqttHandler.removeAllTopicSubscriptionsForNode(sourceId, robotName, robotType);
    }

    /**
     * Replaces undefined values with null in a JSON object. To be used as a replacer function in JSON.stringify
     * to avoid having fields with an undefined value being skipped by the serialization process.
     *
     * @param {string} key - The key of the current property being processed.
     * @param {*} value - The value of the current property being processed.
     * @returns {*} - The updated value with undefined replaced by null or the original value.
     */
    #jsonUndefinedReplacer(key, value) {
        if (value === undefined || value === "undefined") {
            return null;
        }
        return value;
    }
}

module.exports = MQTTStrategy;
