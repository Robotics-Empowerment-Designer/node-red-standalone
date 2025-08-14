module.exports = RED => {
    const socket = require("../connection").socket;
    const ConnectionHelper = require("../connectionHelper");
    const EventPubSub = require("../eventPubSub");

    const events = new EventPubSub();

    function OrderReadyNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        node.path = "/sawyer/order_ready";

        const ch = new ConnectionHelper(socket, node);

        node.on("input", msg => {
            
            //Check if its a reset order
            if (msg['endpos'] == null || msg['order'] == null){
            	return;
            }

            node.status({ fill: "blue", shape: "dot", text: "Sending to " + config.ho + ":" + config.p});
            ch.emit([msg['num'],config.ho,config.p]);
        });

        ch.socket.on("/sawyer/order_ready/finished", () => {
        	node.status({});

        });

        events.subscribe(EventPubSub.RESET_NODE_STATE, () => {
            waitingNode = null;
            node.status({});
        });
    }
    RED.nodes.registerType("Order Ready", OrderReadyNode);
}
