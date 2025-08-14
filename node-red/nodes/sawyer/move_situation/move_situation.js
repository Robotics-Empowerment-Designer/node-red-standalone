module.exports = RED => {
    const socket = require("../connection").socket;
    const ConnectionHelper = require("../connectionHelper");
    const EventPubSub = require("../eventPubSub");

    const events = new EventPubSub();

    function MTSNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        node.path = "/sawyer/move_s";
        let waitingNode = null;
        const ch = new ConnectionHelper(socket, node);

        node.on("input", msg => {

            waitingNode = msg;

            node.status({ fill: "blue", shape: "dot", text: "Moving"});
            
            ch.emit([config.xp,config.yp,config.zp,config.xo,config.yo,config.zo,config.wo,config.ls,config.la,config.rs,config.ra]);
        });

        ch.socket.on("/sawyer/move_s/finished", msg => {
     
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
    RED.nodes.registerType("Move To Situation", MTSNode);
}
