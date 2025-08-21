module.exports = function (RED) {
    
    

    // Broker configuration
    var brokerConfig = {
        brokerurl: process.env.MQTT_BROKER_URL,
        username: process.env.MQTT_BROKER_USERNAME,
        password: process.env.MQTT_BROKER_PASSWORD

    };

     
    const getLocationsTopic = "temi/get_locations";
    const locationsTopic = "temi/locations";

    
    var mqttClient = require("mqtt").connect(brokerConfig.brokerurl, {
        username: brokerConfig.username,
        password: brokerConfig.password
    });

	
    
    function updateLocations(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var nodeAlreadyTriggered = true;
         

        mqttClient.subscribe(locationsTopic);
        
        // event ahndling for incoming mqtt-messages
        mqttClient.on('message', function (topic, message) {

            // check if finish message
            if (topic === locationsTopic) {
                const fs = require('fs');
                const path = require('path');
                try {
                    const payload = message.toString();
                    node.warn("Receive finish message: " + payload);
                    const payloadArray = JSON.parse(payload);

                    if (Array.isArray(payloadArray)) {
                        const jsonData =  payloadArray;

                        
                        const filePath = path.join(RED.settings.userDir,"locations.json");
                        node.warn("Try to write to: " + filePath);

                        fs.writeFile(filePath, JSON.stringify(jsonData, null, 2), (err) => {
                            if (err) {
                                node.error("Error while writing JSON file: " + err.toString());
                            } else {
                                node.warn("JSON file successfully written: " + filePath);
                            }
                        });
                    } else {
                        node.error("Received data are no array");
                    }
                }catch (err){
                    node.warn("wrong format received:",err);
                }



                // triggering the next node 
                if (!nodeAlreadyTriggered) {
                   
                    var newMsg = {
                        payload: "Trigger next node"
                    };
                    node.send(newMsg);

                    nodeAlreadyTriggered = true;
                }
            }
        });


        // event handling for incoming node-red messages
        this.on('input', async function (msg) {
            node.warn("update locations node was triggered");
            
            // reset the flag to enable independant triggering
            nodeAlreadyTriggered = false;
            
            var messageText = "update";
            
            sendMessage(getLocationsTopic, messageText);
        });

        // function to send messages over mqtt
        function sendMessage(topic, messageText) {
            mqttClient.publish(topic, messageText, function (err) {
                if (err) {
                    node.error(" Error when sending the message: " + err.toString());
                } else {
                    node.log("Message sent successfully: " + messageText);
                }
            });
        }

        // event handling for closing of node
        this.on('close', function () {
            mqttClient.unsubscribe(locationsTopic);    
        });
    }

    // registration of node in Node-RED
    RED.nodes.registerType("updateLocations", updateLocations);
};