module.exports = RED => {
    const socket = require("../connection").socket;
    const ConnectionHelper = require("../connectionHelper");
    const EventPubSub = require("../eventPubSub");
	
    const events = new EventPubSub();

    function PourAdvancedNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        node.path = "/sawyer/pour+";

        let waitingNode = null;
        const ch = new ConnectionHelper(socket, node);

        node.on("input", msg => {
        
            if (msg == "None"){
            	node.send(msg);
            	return;
            }

            if (msg['endpos']==null || msg['order']==null){
            	node.status({ fill: "red", shape: "dot", text: "Error"});
            	node.send("None");
            	return;
            }
            
            waitingNode = msg;
            node.status({ fill: "orange", shape: "dot", text: "Waiting the robot" });

            ch.emit([msg['order'],msg['endpos']]);
        });

        ch.socket.on("/sawyer/pour+/finished", msg => {
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
        
        ch.socket.on("/sawyer/pour+/2ndTry", msg => {
        	if (msg == ""){
        		node.status({});
        	} else {
        		node.status({ fill: "red", shape: "dot", text: "ERROR. Retry..."});
        	}
        	    
        });
        
        ch.socket.on("/sawyer/pour+/ForceReset", msg => {
        	if (msg == ""){
        		node.status({});
        	} else {
        		node.status({ fill: "red", shape: "dot", text: "Force Reset..."});
        	}
        	         
        });
        
        ch.socket.on("/sawyer/pour+/starting", msg => {
        	node.status({ fill: "blue", shape: "dot", text: ""+msg});
        });

        events.subscribe(EventPubSub.RESET_NODE_STATE, () => {
            waitingNode = null;
            node.status({});
        });
    }
    RED.nodes.registerType("Pour +", PourAdvancedNode);
}
