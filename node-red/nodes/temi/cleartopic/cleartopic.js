module.exports = function (RED) {
    
    var brokerConfig = {
        brokerurl: process.env.MQTT_BROKER_URL
    };

    // MQTT-Themen für Wait-Nachrichten und weitere Themen
    var topics = ["temi/wait", "temi/wait/finished", "temi/tts", "temi/tts/finished", "temi/clear", "temi/clear/finished", "temi/img", "temi/img/finished", "temi/txt", "temi/txt/finished", "temi/vid", "temi/vid/finished", "temi/tele", "temi/tele/finished", "temi/goto", "temi/goto/finished", "temi/waitforkeyword", "temi/wfk/finished"];

    
    var mqttClient = require("mqtt").connect(brokerConfig.brokerurl);

     "wait"
    function cleartopic(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        // event handling for incoming node-red messages
        this.on('input', function (msg) {
            node.log("Ich was triggered");

            // Senden einer leeren Nachricht an alle definierten Themen
            topics.forEach(function (topic) {
                sendMessage(topic,"");
            });
        });

        // function to send messages over mqtt
        function sendMessage(topic, messageText) {
            mqttClient.publish(topic, messageText, function (err) {
                if (err) {
                    node.error(" Error when sending the message an " + topic + ": " + err.toString());
                } else {
                    node.log("Message sent successfully an " + topic + ": " + messageText);
                }
            });
        }

        // event handling for node closure
        this.on('close', function () {
            mqttClient.end();
        });
    }

    // Registrieren des Node-Typs "wait" in Node-RED
    RED.nodes.registerType("cleartopic", cleartopic);
};
