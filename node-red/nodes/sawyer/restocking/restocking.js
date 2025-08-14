module.exports = RED => {
    const socket = require("../connection").socket;
    const ConnectionHelper = require("../connectionHelper");
    const EventPubSub = require("../eventPubSub");
	
    const events = new EventPubSub();

    function RestockingNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        node.path = "/sawyer/restocking";

        let waitingNode = null;
        const ch = new ConnectionHelper(socket, node);

        node.on("input", msg => {
                   
            waitingNode = msg;
            node.status({ fill: "blue", shape: "dot", text: "Restocking Glass at postion " + config.glassPos });

            ch.emit([config.glassPos]);
        });
        

        ch.socket.on("/sawyer/restocking/finished", msg => {
        	node.status({ fill: "green", shape: "dot", text: "Sucessfully restock"});       
        	if (!waitingNode) {
                return;
              	}
              	node.send(waitingNode);
              	waitingNode = null;
              	node.timeout = setTimeout(() => {node.status({});}, 3 * 1000);
        });
        


        events.subscribe(EventPubSub.RESET_NODE_STATE, () => {
            waitingNode = null;
            node.status({});
        });
    }
    RED.nodes.registerType("Restocking", RestockingNode);
}
