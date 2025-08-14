module.exports = RED => {
    const socket = require("../connection").socket;
    const ConnectionHelper = require("../connectionHelper");
    const EventPubSub = require("../eventPubSub");

    const events = new EventPubSub();

    function DisplayNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        node.path = "/sawyer/display";
        
        const ch = new ConnectionHelper(socket, node);

        node.on("input", msg => {
	    
	    node.status({ fill: "blue", shape: "dot", text: "Displaying"});

            ch.emit([config.url,config.rate,config.loop]);
        });

        ch.socket.on("/sawyer/display/finished", msg => {
              	if (msg == ""){
        		node.status({});
        	} else {
        		console.log(msg);
        		node.status({ fill: "red", shape: "dot", text: "" + msg});
        	}  

        });

        events.subscribe(EventPubSub.RESET_NODE_STATE, () => {
            waitingNode = null;
            node.status({});
        });
    }
    RED.nodes.registerType("Display", DisplayNode);
}
