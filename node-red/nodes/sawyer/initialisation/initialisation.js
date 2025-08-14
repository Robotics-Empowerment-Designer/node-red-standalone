module.exports = RED => {
    const socket = require("../connection").socket;
    const ConnectionHelper = require("../connectionHelper");
    const EventPubSub = require("../eventPubSub");

    const events = new EventPubSub();

    function InitNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        node.path = "/sawyer/init";
	
	let waitingNode = null;
        const ch = new ConnectionHelper(socket, node);

        node.on("input", msg => {

            node.status({ fill: "blue", shape: "dot", text: node.type + ".executing" });
            msg['payload']="reset,";
            waitingNode=msg;
            ch.emit([]);
        });

        ch.socket.on("/sawyer/init/finished", msg => {
        	if (msg == ""){
        		node.status({});
        	} else {
        		console.log(msg);
        		node.status({ fill: "red", shape: "dot", text: "" + msg});
        	}   
              	node.send(waitingNode);
              	waitingNode=null;
        });

        events.subscribe(EventPubSub.RESET_NODE_STATE, () => {
            node.status({});
            waitingNode = null;
        });
    }
    RED.nodes.registerType("Initialisation", InitNode);
}
