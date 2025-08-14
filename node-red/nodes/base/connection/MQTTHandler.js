const logger = require("node-red-contrib-base/log")(module);

class MQTTManager {
    constructor() {
        this.initializedRobots = new Set(); // Set of robot names
        this.robotSubscriptions = new Map(); // Map of robotName -> Map of topic -> Map of callbacks (sourceId -> callbacks)
        this.client = null;
    }

    async addTopicSubscription(
        robotName,
        robotType,
        topic,
        callback,
        sourceId,
        removeAfterMessage
    ) {
        const fullTopic = `${robotType}/${robotName}/${topic}`;
        if (!this.robotSubscriptions.has(robotName)) {
            logger.debug(
                `MQTTHandler: No subscriptions found yet, creating new Map for robot: ${robotName}`
            );
            this.robotSubscriptions.set(robotName, new Map());
        }

        const robotTopics = this.robotSubscriptions.get(robotName);
        if (!robotTopics.has(fullTopic)) {
            logger.debug(
                `MQTTHandler: No topics found yet, creating new Map for topic: ${fullTopic}`
            );

            await this.client.subscribe(fullTopic);
            robotTopics.set(fullTopic, new Map());
        }

        const callbacks = robotTopics.get(fullTopic);
        callback._removeAfterMessage = removeAfterMessage;
        callback._sourceId = sourceId;
        callbacks.set(sourceId, callback);
        logger.info(`MQTTHandler: Subscribed to topic: ${fullTopic}`);
    }

    removeTopicSubscription(robotName, robotType, topic, sourceId, unsubscribeTopic = true) {
        const fullTopic = `${robotType}/${robotName}/${topic}`;
        if (!this.robotSubscriptions.has(robotName)) {
            logger.warn(`MQTTHandler: No subscriptions found for robot: ${robotName}`);
            return;
        }

        const robotTopics = this.robotSubscriptions.get(robotName);
        if (!robotTopics.has(fullTopic)) {
            logger.warn(`MQTTHandler: Topic ${fullTopic} not found for robot: ${robotName}`);
            return;
        }

        const callbacks = robotTopics.get(fullTopic);
        if (callbacks.has(sourceId)) {
            callbacks.delete(sourceId);
            logger.info(`MQTTHandler: Unsubscribed from topic: ${fullTopic}`);
        } else {
            logger.warn(`MQTTHandler: Callback not found for topic: ${fullTopic}`);
        }

        if (callbacks.size === 0 && unsubscribeTopic) {
            robotTopics.delete(fullTopic);
            this.client.unsubscribe(fullTopic);
        }

        if (robotTopics.size === 0) {
            this.robotSubscriptions.delete(robotName);
        }
    }

    removeAllTopicSubscriptionsForNode(sourceId, robotName, robotType) {
        if (!this.robotSubscriptions.has(robotName)) {
            logger.warn(`MQTTHandler: No subscriptions found for robot: ${robotName}`);
            return;
        }

        const robotTopics = this.robotSubscriptions.get(robotName);
        robotTopics.forEach((callbacks, topic) => {
            if (callbacks.has(sourceId)) {
                const [_, __, ...topicParts] = topic.split("/");
                const actionTopic = topicParts.join("/");
                this.removeTopicSubscription(robotName, robotType, actionTopic, sourceId);
            }
        });
    }

    removeAllTopicSubscriptions() {
        this.robotSubscriptions.forEach((robotName, robotTopics) => {
            robotName.forEach((callbacks, topic) => {
                const [_robotType, _robotName, ...topicParts] = topic.split("/");
                const completeTopic = topicParts.join("/");

                callbacks.forEach((callback, sourceId) => {
                    callbacks.delete(sourceId);
                    this.removeTopicSubscription(
                        _robotName,
                        _robotType,
                        completeTopic,
                        sourceId,
                        false
                    );
                });
            });
        });
    }

    initClient(robotName, client) {
        if (this.initializedRobots.has(robotName)) {
            logger.info(
                `MQTTHandler: Client already exists for robot: ${robotName} Aborting...`
            );
            return;
        } else if (!robotName || robotName === "unknown") {
            logger.error("MQTTHandler: Robot name is unknown. Aborting...");
            return;
        }
        logger.info(`MQTTHandler: Initializing client for robot: ${robotName}`);
        this.client = client;
        this.initializedRobots.add(robotName);

        this.client.on("message", (topic, message) => {
            logger.debug(`MQTTHandler: Received message on topic: ${topic}`);
            const robotTopics = this.robotSubscriptions.get(robotName);
            if (!robotTopics) {
                logger.debug(`MQTTHandler: No subscriptions found for robot: ${robotName}`);
                return;
            }

            const callbacks = robotTopics.get(topic);
            if (!callbacks) {
                logger.debug(`MQTTHandler: No topics found for robot: ${robotName}`);
                return;
            }

            const messageString = message.toString();
            let messageJson = null;
            try {
                messageJson = JSON.parse(messageString);
            } catch (e) {
                logger.error(
                    `MQTTHandler: Failed to parse message: ${messageString}. Skipping JSON parsing.`
                );
                messageJson = messageString;
            }

            callbacks.forEach((callback) => {
                callback(messageJson);
                if (callback._removeAfterMessage) {
                    const [_robotType, _robotName, ...topicParts] = topic.split("/");
                    const actionTopic = topicParts.join("/");

                    this.removeTopicSubscription(
                        _robotName,
                        _robotType,
                        actionTopic,
                        callback._sourceId
                    );
                }
            });
        });
    }
}

const mqttManager = new MQTTManager();
module.exports = mqttManager;
