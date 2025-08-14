module.exports = RED => {
    const socket = require("../connection").socket;
    const ConnectionHelper = require("../connectionHelper");
    const EventPubSub = require("../eventPubSub");

    const events = new EventPubSub();

    function GiveOrderNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        node.path = "/sawyer/give_order";
        
        const ch = new ConnectionHelper(socket, node);

        node.on("input", msg => {

            node.status({ fill: "orange", shape: "dot", text: "Waiting for the robot"});

            ch.emit([msg['payload'],msg['topic']]);
        });

        ch.socket.on("/sawyer/give_order/finished", msg => {
        	node.status({});
        	node.send(msg);
        });
        
        ch.socket.on("/sawyer/give_order/error", msg => {
        	node.status({ fill: "red", shape: "dot", text: ""+ msg});

        });
        
        ch.socket.on("/sawyer/give_order/starting", msg => {
        	node.status({ fill: "blue", shape: "dot", text: "Giving order n°" + msg});

        });

        events.subscribe(EventPubSub.RESET_NODE_STATE, () => {
            node.status({});
        });
    }
    RED.nodes.registerType("Give Order", GiveOrderNode);
}
