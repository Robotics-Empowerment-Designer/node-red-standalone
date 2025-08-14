module.exports = RED => {
    const socket = require("../connection").socket;
    const ConnectionHelper = require("../connectionHelper");
    const EventPubSub = require("../eventPubSub");

    const events = new EventPubSub();

    function PourNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        node.path = "/sawyer/pour";

        let waitingNode = null;
        const ch = new ConnectionHelper(socket, node);

        node.on("input", msg => {
        
            if (msg == "None"){
            	node.send(msg);
            	return;
            }

            let endpos = config.endpos;
            let drinks = config.drinks;
            
            //If automatic is set, we use settings of the msg       
            if (config.endpos == "automatic"){
            	endpos = msg['endpos'];
            }
            if (config.drinks == "automatic"){
            	drinks = msg['order'];
            }
            
            waitingNode = msg;
            node.status({ fill: "orange", shape: "dot", text: "Waiting the robot" });

            ch.emit([drinks,endpos]);
        });
        
        ch.socket.on("/sawyer/pour/starting", msg => {
        	node.status({ fill: "blue", shape: "dot", text: ""+msg});
        });

        ch.socket.on("/sawyer/pour/finished", msg => {
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
        
        ch.socket.on("/sawyer/pour/2ndTry", msg => {
        	console.log(msg);
        	node.status({ fill: "yellow", shape: "dot", text: "ERROR. Retry..."});
        });

        events.subscribe(EventPubSub.RESET_NODE_STATE, () => {
            waitingNode = null;
            node.status({});
        });
    }
    RED.nodes.registerType("Pour", PourNode);
}
