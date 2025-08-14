module.exports = function (RED) {
    
    const { interruptHandling } = require("../interruptHelper");
    

    
    const brokerConfig = {
        brokerurl: process.env.MQTT_BROKER_URL
    };

    
    var showImageTopic = "temi/img";
    var finishedTopic = "temi/img/finished";

    
    var mqttClient = require("mqtt").connect(brokerConfig.brokerurl);
	
    function showImage(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        const { waitIfInterrupted, cleanup } = interruptHandling(node, mqttClient);
        const flow = node.context().flow;
        const global = node.context().global;
        
        const nodeFinishedTopic = `${finishedTopic}/${node.id}`;        
        
        let currentDoneCallback = null;         
        let shouldSendNextMessage = true;
        
        mqttClient.subscribe(nodeFinishedTopic);        

        // event handling for incoming mqtt-messages
        mqttClient.on('message', function (topic, message) {
            var receivedMessage = message.toString();

            
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
                if (shouldSendNextMessage){
                    
                    if (flow.get("interruption_requested") && !global.get("interruption_feedback")) {                     
                        global.set("interruption_feedback", true);                        
                        node.warn("Interruption feedback is sent");
                        flow.set("interruption_requested",false);
                    }
                    
                    var newMsg = {
                        payload: "Trigger next node"
                    };
                    
                    node.send(newMsg);
                    node.status({});
                } else {
                    node.log("Skipping sending message to next node due to cancellation.");
                    node.status({ fill: "red", shape: "ring", text: node.type + ".cancelled" });
                }

                
                if (currentDoneCallback) {
                    currentDoneCallback();
                    currentDoneCallback = null;
                }
            }
        });

    

        // event handling for incoming node-red messages
        this.on('input', async function (msg, send, done) {
            node.warn("Temi image node was triggered.");
            node.status({ fill: "blue", shape: "dot", text: node.type + ".displaying" });

            
            currentDoneCallback = done;
            shouldSendNextMessage = true; 

            
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
            var wasInterrupted = await waitIfInterrupted();
            if (wasInterrupted){
                node.warn("Flow was interrupted.");
            }else{
                node.warn("Flow is active.");
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

            
            var messageText = config.text || "No input";
            
            
            var messageObject = {
                image: messageText,
                id: node.id
            };
            
            
            var messageJSON = JSON.stringify(messageObject);
            sendMessage(showImageTopic, messageJSON);
        });

        // function to send messages over mqtt
        function sendMessage(topic, messageText) {
            mqttClient.publish(topic, messageText, function (err) {
                if (err) {
                    node.error(" Error when sending the message: " + err.toString());
                    if (currentDoneCallback) {
                        currentDoneCallback(err);
                        currentDoneCallback = null; 
                    }
                } else {
                    node.warn("Message sent successfully: " + messageText);
                }
            });
        }

        // event handling for node closure
        this.on('close', function (done) {
            
            mqttClient.unsubscribe(nodeFinishedTopic);
            
            cleanup();
            currentDoneCallback = null; 
            done();
        });
    }

    // register the node type with Node-RED
    RED.nodes.registerType("temiImage", showImage);
};