module.exports = RED => {
    const socket = require("../connection").socket;
    const ConnectionHelper = require("../connectionHelper");
    const EventPubSub = require("../eventPubSub");

    const events = new EventPubSub();

    function DisplayOrderNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        node.path = "/sawyer/display_order";
        
        const ch = new ConnectionHelper(socket, node);

        node.on("input", msg => {
	    
	    let num = 0;
	    let drink = "";
	    let endpos = 0;
	    
	    node.status({ fill: "blue", shape: "dot", text: "Displaying"});
	    
	    if (msg.topic == "order from waiters"){
	    	const payload = msg['payload'].split(",");
	    	num = payload[0];
	    	drink = payload[1];
	    } else if (msg.topic == "order given"){
	    	num = msg['payload'];
	    	endpos=-1;
	    } else {
	    	num = msg['num'];
	    	drink = msg['order'];
	    	endpos = msg['endpos'];
	    }          

            ch.emit([num,drink,endpos]);
        });

        ch.socket.on("/sawyer/display_order/finished", msg => {
     		if (msg == ""){
        		node.status({});
        	} else {
        		console.log(msg);
        		node.status({ fill: "red", shape: "dot", text: "" + msg});
        	}  

        });

        events.subscribe(EventPubSub.RESET_NODE_STATE, () => {
            waitingNode = null;
            node.status({})
        });

    }
    RED.nodes.registerType("Display Order", DisplayOrderNode);
}
