module.exports = RED => {
    const socket = require("../connection").socket;
    const ConnectionHelper = require("../connectionHelper");
    const EventPubSub = require("../eventPubSub");
	
    const events = new EventPubSub();

    function GetGlassAdvancedNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        node.path = "/sawyer/getglass+";

        let waitingNode = null;
        const ch = new ConnectionHelper(socket, node);

        node.on("input", msg => {
        
            if (msg == "None"){
            	node.send(msg);
            	return;
            }
        
            if (msg['endpos']==null){
            	node.status({ fill: "red", shape: "dot", text: "Error"});
            	node.send("None");
            	return;
            }
            
            waitingNode = msg;
            node.status({ fill: "orange", shape: "dot", text: "Waiting the robot" });

            ch.emit([msg['endpos']]);
        });
        
	ch.socket.on("/sawyer/getglass+/starting", msg => {
        	node.status({ fill: "blue", shape: "dot", text: ""+msg});
        });

        
        ch.socket.on("/sawyer/getglass+/2ndTry", msg => {
        	console.log(msg);
        	node.status({ fill: "yellow", shape: "dot", text: "ERROR. Retry..."});
        });
        
        ch.socket.on("/sawyer/getglass+/ForceReset", msg => {
        	console.log(msg);
        	node.status({ fill: "yellow", shape: "dot", text: "ERROR. Resetting"});
        });
        
        ch.socket.on("/sawyer/getglass+/finished", msg => {
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
            waitingNode = null;
            node.status({});
        });
    }
    RED.nodes.registerType("Get Glass +", GetGlassAdvancedNode);
}
