module.exports = function (RED) {
    const fs = require('fs');
    const path = require('path');
    const { interruptHandling } = require("../interruptHelper");
    

    // Configuration for the MQTT broker
    const brokerConfig = {
        brokerurl: process.env.MQTT_BROKER_URL
    };

    const gotoTopic = "temi/goto";
    const finishedTopic = "temi/goto/finished";

    var mqttClient = require("mqtt").connect(brokerConfig.brokerurl);

    function goto(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        const { waitIfInterrupted, cleanup } = interruptHandling(node, mqttClient);
        
        const flow = node.context().flow;
        const global = node.context().global;

        const nodeFinishedTopic = `${finishedTopic}/${node.id}`;
        
        let currentDoneCallback = null; 
       
        let shouldSendNextMessage = true;

        mqttClient.subscribe(nodeFinishedTopic);

        // Event handler for incoming MQTT messages
        mqttClient.on('message', function (topic, message) {
            var receivedMessage = message.toString().trim().toLowerCase();

            if (topic === nodeFinishedTopic && receivedMessage === "done") {
                node.warn(`Node ${node.id} received done message - currentDoneCallback exists: ${!!currentDoneCallback}`);
                node.log("Received done message: " + message.toString());

                const cancelSignalActive = global.get("cancel_flow_signal") === true;

                if(cancelSignalActive){
                    node.warn("MQTT done received but flow is cancelled - not sending to next node");
                    if (currentDoneCallback){
                        currentDoneCallback();
                        currentDoneCallback = null;
                    }
                    return; 
                }

                // triggering the next node 
                if (shouldSendNextMessage) {
                    if (flow.get("interruption_requested") && !global.get("interruption_feedback")) {                     
                        global.set("interruption_feedback", true);                        
                        node.warn("Interruption feedback is sent");
                        flow.set("interruption_requested",false);
                    }                    
                    var newMsg = {
                        payload: "Next node triggered",
                        topic: gotoTopic 
                    };

                    node.send(newMsg);
                    node.status({});

                }else {
                    node.log("Skipping sending message to next node due to cancellation.");
                    node.status({ fill: "red", shape: "ring", text: node.type + ".cancelled" });
                }
               
                if (currentDoneCallback) {
                    currentDoneCallback();
                    currentDoneCallback = null;
                }
            }
        });

        // Event handler for incoming messages to the node
        this.on('input', async function (msg, send,done) {
            node.log("Goto node was triggered");
            node.status({ fill: "blue", shape: "dot", text: node.type + ".driving" });

            currentDoneCallback = done;
            shouldSendNextMessage = true;

            // check if flow is cancelled
            const cancelSignalActive = global.get("cancel_flow_signal") === true;
            if (cancelSignalActive) {
                node.warn("Flow explicitly cancelled by global signal.");
                node.status({ fill: "red", shape: "cross", text: node.type + ".cancelled" });
                shouldSendNextMessage = false; 
                
                if (currentDoneCallback) {
                    currentDoneCallback();
                    currentDoneCallback = null;
                }
                return; 
            }

            // check if flow is interrupted
            node.warn("Calling waitIfInterrupted");
            node.warn(flow.get("interrupting_flow"));
            node.warn(flow.get("interruption_requested"));
            var wasInterrupted = await  waitIfInterrupted();
            if (wasInterrupted){
                node.log("Flow was interrupted.")
            }else{
                node.log("Flow is active.")
            }

            // check again if flow is cancelled
            const cancelSignalAfterWait = global.get("cancel_flow_signal") === true;
            if (cancelSignalAfterWait) {
                node.warn("Flow explicitly cancelled by global signal after interruption check.");
                node.status({ fill: "red", shape: "cross", text: node.type + ".cancelled" });
                shouldSendNextMessage = false; 
                
                if (currentDoneCallback) {
                    currentDoneCallback();
                    currentDoneCallback = null;
                }
                return; 
            }else{
                node.warn("No Cancellation after potential interruption.");
            }

            

            var messageText = config.location || "No checkpoint specified";
            var messageObject = {
                text: messageText,
                id: node.id
            };
            var messageJSON = JSON.stringify(messageObject);
            sendMessage(gotoTopic, messageJSON);
        });

        

        // Function to send an MQTT message
        function sendMessage(topic, messageText) {
            mqttClient.publish(topic, messageText, function (err) {
                if (err) {
                    node.error("Error sending message: " + err.toString());
                    if (currentDoneCallback) {
                        currentDoneCallback(err);
                        currentDoneCallback = null;
                    }
                } else {
                    node.log("Message successfully sent: " + messageText);
                }
            });
        }

        // Event handler for node closure
        this.on('close', function (done) {
            mqttClient.unsubscribe(nodeFinishedTopic);
            cleanup();
            currentDoneCallback = null; 
            done();
        });
    }

    // Register the node type with Node-RED
    RED.nodes.registerType("temigoto", goto);

    // HTTp endpoint to serve locations
    RED.httpAdmin.get("/temigoto/locations", RED.auth.needsPermission('temigoto.read'), function(req,res){
        const userDir = RED.settings.userDir;
        const locationsFilePath = path.join(userDir,'locations.json');

        fs.readFile(locationsFilePath, 'utf8', (err,data)=>{
            if(err){
                if(err.code ==='ENOENT'){
                    // file not found
                    RED.log.warn(`locations file not found at: ${locationsFilePath}. Returnng empty list`);
                    return res.json([]);
                }
                // other read error
                RED.log.error(`Error reading locations file: ${err.message}.`);
                return res.status(500).send("Error reading lcoations file.");
            }
            try{
                // sending json data as response
                const locations = JSON.parse(data);
                res.json(locations);
            }catch (e){
                RED.log.error(`Error parsing locations Json: ${e.message}. `);
                res.status(500).send("Error parsing locations data");
            }
        });
    });
};
