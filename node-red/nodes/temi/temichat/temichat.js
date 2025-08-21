module.exports = function (RED) {
    const mqtt = require("mqtt");
    const axios = require("axios");
    const { interruptHandling } = require("../interruptHelper");
    

    const openAIConfig = {
        apiKey: process.env.OPENAI_API_KEY,
        endpoint: "https://api.openai.com/v1/chat/completions",
        model: "gpt-4o",
    };

    const brokerConfig = {
        brokerurl: process.env.MQTT_BROKER_URL,
        username: process.env.MQTT_BROKER_USERNAME,
        password: process.env.MQTT_BROKER_PASSWORD

    };
    const mqttClient = mqtt.connect(brokerConfig.brokerurl, {
        username: brokerConfig.username,
        password: brokerConfig.password
    });


    const sayTopic = "temi/tts";
    const finishedTopic = "temi/tts/finished";
    const ageTopic = "temi/age_detection";
    const languageTopic = "temi/user_language";

    

    // check for published user language
    let currentLanguage = "german";
    mqttClient.subscribe(languageTopic);
    mqttClient.on("message", function(topic,message){
        if(topic==languageTopic){
            let receivedLanguage = message.toString().trim();
            if(receivedLanguage){
                currentLanguage = receivedLanguage;
            }
        }
    });

    // check for published user age
    let currentAge = 30;
    mqttClient.subscribe(ageTopic);
    mqttClient.on('message', function(topic,message){
        if (topic == ageTopic){
            let receivedAge = parseInt(message.toString(), 10);
            if (!isNaN(receivedAge)){
                currentAge = receivedAge;
            }
        }
    });

    function chat(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        const { waitIfInterrupted, cleanup } = interruptHandling(node, mqttClient);
        const flow = node.context().flow;
        const global = node.context().global;
        
        const nodeFinishedTopic = `${finishedTopic}/${node.id}`;
        
        let currentDoneCallback = null; 
        let shouldSendNextMessage = true;

        mqttClient.subscribe(nodeFinishedTopic);

        // event handling for incoming mqtt-messages
        mqttClient.on('message', function (topic, message) {
            if (topic === nodeFinishedTopic) {
                const receivedMessage = message.toString();
                if (receivedMessage === "done") {
                    node.warn(`Node ${node.id} received done message - currentDoneCallback exists: ${!!currentDoneCallback}`);
                    node.log("Received done message");

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

                        const newMsg = { payload: "Trigger next node" };
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
            }
        });

        // event handling for incoming node-red messages
        this.on('input', async function (msg, send, done) {
            node.warn("TemiChat node was triggered.");
            node.status({ fill: "blue", shape: "dot", text: "Processing message..." });

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
            var wasInterrupted = await waitIfInterrupted();
            if (wasInterrupted){
                node.warn("Flow  was interrupted.");
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

            const originalText = config.text || "Standard message, if 'text' is not provided";
            const animation = config.animation || false;
            node.warn(`Chosen language ${currentLanguage}`);
            
            

            // Prompt für ChatGPT
            const prompt = `Du bist ein Roboter, der mit einer ${currentAge}-Jährigen Person spricht. 
                            Stelle sicher, dass du die folgenden Restriktionen befolgst:
                            1. Erwähne niemals, dass es sich bei dir um ein Sprachmodell, eine KI oder ähnliches handelt.
                            2. Gib direkte Antworten. Verwende keine Einleitung, Zusammenfassung oder ähnliches, dass nicht zu dem dir übermittelten Text gehört.
                            3. Passe dich an das Alter der Person mit der du kommunizierst.
                            4. Übersetze den Text in die folgende Sprache: ${currentLanguage}.
                            5. Ändere den Begriff "MachMit Haus" nicht, wenn er im Text vorkommt.
                            6. Duze Personen die 40 Jahre oder jünger sind. Sieze Personen, die älter als 40 Jahre sind. 
                            Passe den folgenden Text den Vorgaben entsprechend an:${originalText}`;
            
            node.warn(`Generated prompt: ${prompt}`);

            try {
                // Check for cancellation before API call
                const cancelBeforeAPI = global.get("cancel_flow_signal") === true;
                if (cancelBeforeAPI) {
                    node.warn("Flow cancelled before OpenAI API call.");
                    node.status({ fill: "red", shape: "cross", text: node.type + ".cancelled" });
                    shouldSendNextMessage = false;
                    if (currentDoneCallback) {
                        currentDoneCallback();
                        currentDoneCallback = null;
                    }
                    return;
                }

                // Text adjustment with OPEN-API
                const adjustedText = await adjustTextWithOpenAI(prompt);

                // Check for cancellation after API call
                const cancelAfterAPI = global.get("cancel_flow_signal") === true;
                if (cancelAfterAPI) {
                    node.warn("Flow cancelled after OpenAI API call.");
                    node.status({ fill: "red", shape: "cross", text: node.type + ".cancelled" });
                    shouldSendNextMessage = false;
                    if (currentDoneCallback) {
                        currentDoneCallback();
                        currentDoneCallback = null;
                    }
                    return;
                }

                node.warn(`Adjusted text: ${adjustedText}`);

                const messageObject = {
                    text: adjustedText,
                    language: currentLanguage,
                    animation,
                    id: node.id 
                };

                const messageJSON = JSON.stringify(messageObject);
                sendMessage(sayTopic, messageJSON);
            } catch (error) {
                node.error("Error when trying to adapt the text: " + error.message);
                node.status({ fill: "red", shape: "ring", text: "Error in text adaptation" });
                
               
                if (currentDoneCallback) {
                    currentDoneCallback(error);
                    currentDoneCallback = null;
                }
            }
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

        // function to adjust the text with Open-API
        async function adjustTextWithOpenAI(prompt) {
            const response = await axios.post(openAIConfig.endpoint, {
                model: openAIConfig.model,
                messages: [{ role: "user", content: prompt }],
            }, {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${openAIConfig.apiKey}`,
                },
            });

            node.log(`API response: ${JSON.stringify(response.data)}`);

            if (response.data && response.data.choices && response.data.choices[0].message.content) {
                return response.data.choices[0].message.content.trim();
            } else {
                throw new Error("Invalid response from Open-API");
            }
        }

        // event handling for node closure
        this.on('close', function (done) {
            mqttClient.unsubscribe([nodeFinishedTopic, ageTopic, languageTopic]);
            cleanup();
            currentDoneCallback = null; 
            done();
        });
    }

    // register the node type with Node-RED
    RED.nodes.registerType("temiChat", chat);
};