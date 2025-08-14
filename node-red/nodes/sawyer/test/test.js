module.exports = RED => {
    const socket = require("../connection").socket;
    const ConnectionHelper = require("../connectionHelper");
    const EventPubSub = require("../eventPubSub");

    const events = new EventPubSub();

    function TestNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        node.path = "/sawyer/test";

        let waitingNode = null;
        const ch = new ConnectionHelper(socket, node);

        node.on("input", msg => {
            // use injected value
            let text = msg.payload;

            // use injected value from payload
            if (typeof msg.payload == "object" && "value" in msg.payload) {
                text = msg.payload.value;
            }

            // if node property input is not empty, use user input instead
            if (config.text !== "") {
                text = config.text;
            }

            waitingNode = msg;
            node.status({ fill: "blue", shape: "dot", text: node.type + ".writing" });

            ch.emit([text]);
        });

        ch.socket.on("/sawyer/test/finished", () => {
        	node.status({});
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
    RED.nodes.registerType("Test", TestNode);
}
