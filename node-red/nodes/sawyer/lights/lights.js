module.exports = RED => {
    const socket = require("../connection").socket;
    const ConnectionHelper = require("../connectionHelper");
    const EventPubSub = require("../eventPubSub");

    const events = new EventPubSub();

    function LightsNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        node.path = "/sawyer/lights";
        let waitingNode = null;
        const ch = new ConnectionHelper(socket, node);

        node.on("input", msg => {
            let LED = config.led;
            let power = config.power;
            waitingNode = msg;

            node.status({ fill: "blue", shape: "dot", text: "Displaying"});
            
            ch.emit([LED, power]);
        });

        ch.socket.on("/sawyer/lights/finished", msg => {
     		if (msg == ""){
        		node.status({});
        	} else {
        		console.log(msg);
        		node.status({ fill: "red", shape: "dot", text: "" + msg});
        	}
        	if (!waitingNode) {
                	return;
              	}
              	node.send(waitingNode);
              	waitingNode = null; 
        });

        events.subscribe(EventPubSub.RESET_NODE_STATE, msg => {
            node.status({})
            node.send(waitingNode);
            waitingNode = null;
        });
    }
    RED.nodes.registerType("Lights", LightsNode);
}
