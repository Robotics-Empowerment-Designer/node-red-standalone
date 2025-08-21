module.exports = function(RED){
    const mqtt = require("mqtt");

    const brokerConfig = {
        brokerurl: process.env.MQTT_BROKER_URL,
        username: process.env.MQTT_BROKER_USERNAME,
        password: process.env.MQTT_BROKER_PASSWORD

    };

    const interruptFlowTopic = "interrupt/flow";
    

    var mqttClient = require("mqtt").connect(brokerConfig.brokerurl, {
        username: brokerConfig.username,
        password: brokerConfig.password
    });


    function attention(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        const global = node.context().global;

        
        // event handling for incoming node-red messages
        this.on("input", async function(msg) {
            // stop the flow
            mqttClient.publish(interruptFlowTopic,"true");
            node.warn("Stop message published");
            
            // wait until interruption is acknowlegded
            await waitForInterruptionFeedback(global);
            node.warn("Feedback received");
            
            // delay for safety
            await new Promise(resolve => setTimeout(resolve, 500));

            // reset global feedback variable
            global.set("interruption_feedback",false);
            node.warn("interruption feedback variable reset")
            
            //trigger next node
            node.warn("Next node triggered");
            node.send({payload: "Test"})
            node.status({});
                
            
        });

        
    }

    // help function to wait for interruption feedback
    async function waitForInterruptionFeedback(globalContext){
        return new Promise((resolve) =>{
            const interval = setInterval(() =>{
                const isStillInterrupted = globalContext.get("interruption_feedback");
                if(isStillInterrupted){
                    clearInterval(interval);
                    resolve();
                }
            }, 200); 
        });

    }

    // register the node type with Node-RED
    RED.nodes.registerType("attention", attention);
};



