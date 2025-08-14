module.exports = RED => {
    const socket = require("../connection").socket;
    const ConnectionHelper = require("../connectionHelper");
    const EventPubSub = require("../eventPubSub");

    const events = new EventPubSub();

    function GripperNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        node.path = "/sawyer/grip";

        let waitingNode = null;
        const ch = new ConnectionHelper(socket, node);

        node.on("input", msg => {

            waitingNode = msg;
            node.status({ fill: "blue", shape: "dot", text: node.type + ".executing" });

            ch.emit([config.action]);
        });

        ch.socket.on("/sawyer/grip/finished", msg => {
        	if (msg == ""){
        		node.status({});
        	} else {
        		console.log(msg);
        		node.status({ fill: "red", shape: "dot", text: "" + msg});
        	}    
              	node.send(waitingNode);
              	waitingNode = null;
        });

        events.subscribe(EventPubSub.RESET_NODE_STATE, () => {
            waitingNode = null;
            node.status({});  
        });
    }
    RED.nodes.registerType("Gripper", GripperNode);
}
