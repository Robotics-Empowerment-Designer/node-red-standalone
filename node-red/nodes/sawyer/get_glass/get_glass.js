module.exports = RED => {
    const socket = require("../connection").socket;
    const ConnectionHelper = require("../connectionHelper");
    const EventPubSub = require("../eventPubSub");
	
    const events = new EventPubSub();

    function GetGlassNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        node.path = "/sawyer/getglass";

        let waitingNode = null;
        const ch = new ConnectionHelper(socket, node);

        node.on("input", msg => {
        
            if (msg == "None"){
            	node.send(msg);
            	return;
            }
        
            let startpos = config.startpos;
            let endpos = config.endpos;
        
            //If automatic, we use the message informations
            if (config.startpos == "automatic"){
            	startpos = msg['startpos'];
            }
            if (config.endpos == "automatic"){
            	endpos = msg['endpos'];
            }
            
            waitingNode = msg;
            node.status({ fill: "orange", shape: "dot", text: "Waiting the robot" });

            ch.emit([startpos,endpos]);
        });
        
        ch.socket.on("/sawyer/getglass/starting", msg => {
        	node.status({ fill: "blue", shape: "dot", text: ""+msg});
        });

        ch.socket.on("/sawyer/getglass/finished", msg => {
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
        
        ch.socket.on("/sawyer/getglass/2ndTry", msg => {
        	console.log(msg);
        	node.status({ fill: "yellow", shape: "dot", text: "ERROR. Retry..."});
        });

        events.subscribe(EventPubSub.RESET_NODE_STATE, () => {
            waitingNode = null;
            node.status({});
        });
    }
    RED.nodes.registerType("Get Glass", GetGlassNode);
}
