module.exports = RED => {
    const socket = require("../connection").socket;
    const ConnectionHelper = require("../connectionHelper");
    const EventPubSub = require("../eventPubSub");

    const events = new EventPubSub();

    function MTJANode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        node.path = "/sawyer/move_j";
        let waitingNode = null;
        const ch = new ConnectionHelper(socket, node);

        node.on("input", msg => {

            waitingNode = msg;

            node.status({ fill: "blue", shape: "dot", text: "Moving"});
            
            ch.emit([config.j0,config.j1,config.j2,config.j3,config.j4,config.j5,config.j6,config.r]);
        });

        ch.socket.on("/sawyer/move_j/finished", msg => {
     
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

        events.subscribe(EventPubSub.RESET_NODE_STATE, () => {
            
            node.status({});
            node.send(waitingNode);
            waitingNode = null;
        });
    }
    RED.nodes.registerType("Move To Joints Angle", MTJANode);
}
