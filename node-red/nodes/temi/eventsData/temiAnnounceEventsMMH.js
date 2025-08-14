module.exports = function (RED) {
    const fetch = require("node-fetch"); 
    const { interruptHandling } = require("../interruptHelper");
    

    const brokerConfig = {
        brokerurl: process.env.MQTT_BROKER_URL
    };

    const sayTopic = "temi/tts";
    const finishedTopic = "temi/tts/finished";

    const mqttClient = require("mqtt").connect(brokerConfig.brokerurl);

    // Function to fetch event data from the API
    async function getEventDescriptions(date) {
        const apiUrl = `https://oveda.de/api/v1/event-dates/search?date_from=${date}`;
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`API call failed with status ${response.status}`);
            }
            const data = await response.json();
            let necesaryEventInformation = "";

            if(data.items.length===0){
                 necesaryEventInformation = "Im MachMit Haus finden heute leider keine Veranstaltungen statt.";
                 return necesaryEventInformation;
            }
            for(let i =0; i< data.items.length; i++){
                if (data.items[i].event.place.name === "MachMit!Haus"){
                    //necesaryEventInformation.push({"Name": data.items[i].event.name, "Startzeit": data.items[i].start, "Beschreibung": data.items[i].event.description, "Endzeit":data.items[i].end})
                    necesaryEventInformation = necesaryEventInformation + "Von" + data.items[i].start + "bis" + data.items[i].end + "findet heute die Veranstaltung"+data.items[i].event.name+"statt."
                }
            }
            console.log(necesaryEventInformation)
            return necesaryEventInformation;
        } catch (error) {
            console.error("Error fetching event data:", error);
            return ["Fehler beim Abrufen von Ereignisdaten."];
        }
    }

    // Definition of the "announceEventsMMH" node type
    function say(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        const { waitIfInterrupted, cleanup } = interruptHandling(node, mqttClient);

        const flow = node.context().flow;
        const global = node.context().global;

        
        const nodeFinishedTopic = `${finishedTopic}/${node.id}`;
        
        
        let currentDoneCallback = null; 
        
        let shouldSendNextMessage = true;

        mqttClient.subscribe(nodeFinishedTopic);

        // Handle incoming MQTT messages
        mqttClient.on("message", function (topic, message) {
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
                        payload: "Trigger next node"
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

        // Handle incoming Node-RED messages
        this.on("input", async function (msg,send,done) {
            node.log("Events node was triggered");
            node.status({ fill: "blue", shape: "dot", text: node.type + ".speaking" });

            
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
                node.log("Flow was interrupted.");
            }else{
                node.log("Flow is active.");
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


            // Get today's date in YYYY-MM-DD format
            const todayDate = new Date().toISOString().split("T")[0];

            // Fetch event descriptions from the API
            const descriptions = await getEventDescriptions(todayDate);

            // Prepare the message text, limit to 10 words
            const messageText = descriptions.length > 0
                ? descriptions.join("\n\n").split(" ").slice(0, 100).join(" ") // Limit to 10 words
                : "Heute finden hier keine Veranstaltungen statt.".split(" ").slice(0, 10).join(" "); // Limit to 10 words if no events

            const messageObject = {
                text: messageText,
                language: config.language,
                animation: config.animation
            };
            const messageJSON = JSON.stringify(messageObject);
            sendMessage(sayTopic, messageJSON);
        });

        // Function to send messages via MQTT
        function sendMessage(topic, messageText) {
            mqttClient.publish(topic, messageText, function (err) {
                if (err) {
                    node.error("Error sending message: " + err.toString());
                    if (currentDoneCallback) {
                        currentDoneCallback(err);
                        currentDoneCallback = null; 
                    }
                } else {
                    node.log("Message sent successfully: " + messageText);
                }
            });
        }

        // Handle node closure
        this.on("close", function (done) {
            mqttClient.unsubscribe(finishedTopic);
            cleanup();
            currentDoneCallback = null; 
            done();
        });
    }
    // Register the node type
    RED.nodes.registerType("announceEventsMMH", say);
};

