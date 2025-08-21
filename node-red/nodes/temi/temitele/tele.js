module.exports = function (RED) {
    // Unterbrechnungslogik importieren
    const { interruptHandling } = require("../interruptHelper");
    
    
    var brokerConfig = {
        brokerurl: process.env.MQTT_BROKER_URL,
        username: process.env.MQTT_BROKER_USERNAME,
        password: process.env.MQTT_BROKER_PASSWORD

    };

     
    var sayTopic = "temi/tele";
    var finishedTopic = "temi/tele/finished";

    var mqttClient = require("mqtt").connect(brokerConfig.brokerurl, {
        username: brokerConfig.username,
        password: brokerConfig.password
    });


    function tele(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        const { waitIfInterrupted, cleanup } = interruptHandling(node, mqttClient);
        var nodeAlreadyTriggered = true;

         

        mqttClient.subscribe(finishedTopic);

        // event handling for incoming mqtt-messages
        mqttClient.on('message', function (topic, message) {
            if (topic === finishedTopic && nodeAlreadyTriggered == false) {
                node.log("Received done message: " + message.toString());

                var receivedMessage = message.toString();
                // triggering the next node
                if (receivedMessage === "done") {
                    var newMsg = {
                        payload: "trigger next node"
                    };
                    node.send(newMsg);
                    node.status({});
                    nodeAlreadyTriggered = true;
                }
            }
        });

        // event handling for incoming node-red messages
        this.on('input', async function (msg) {
            node.log("Tele node was triggered");
            node.status({ fill: "blue", shape: "dot", text: node.type + ".calling" });
            
            // check if flow is interrupted
            var wasInterrupted = await  waitIfInterrupted();
            if (wasInterrupted){
                node.log("Flow was interrupted.")
            }else{
                node.log("Flow is continued.")
            }
            
            nodeAlreadyTriggered = false;

            
            var selectedOption = config.location.split('-');
            var messageId = selectedOption[0];
            var messageText = selectedOption[1] || "Standard message, if 'text' is not provided.";

            sendMessage(sayTopic, { id: messageId, value: messageText });
        });

        // function to send messages over mqtt
        function sendMessage(topic, message) {
            var messageText = JSON.stringify(message);
            mqttClient.publish(topic, messageText, function (err) {
                if (err) {
                    node.error("Error when sending the message: " + err.toString());
                } else {
                    node.log("Message sent successfully: " + messageText);
                }
            });
        }

        // event handling for closing of node
        this.on('close', function () {
            mqttClient.unsubscribe(finishedTopic);
             cleanup();
        });
    }

    RED.nodes.registerType("temitele", tele);
};
