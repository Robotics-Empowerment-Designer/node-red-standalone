module.exports = RED => {
    const socket = require("../connection").socket;
    const ConnectionHelper = require("../connectionHelper");
    const EventPubSub = require("../eventPubSub");

    const events = new EventPubSub();

    function ManageOrderNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        node.path = "/sawyer/manage_order";
        
        let nb_commande = 0


        const ch = new ConnectionHelper(socket, node);

        node.on("input", msg => {

	    nb_commande = nb_commande + 1;
	    

            node.status({ fill: "blue", shape: "dot", text: nb_commande + " waiting"});

            ch.emit([msg['payload']]);
        });

        ch.socket.on("/sawyer/manage_order/finished", msg => {
        	if (msg == "None"){
        		nb_commande=0;
        	} else {
        		nb_commande = nb_commande - 1;
        	}

        	if (nb_commande == 0){
        		node.status({});
        	} else {
			node.status({ fill: "blue", shape: "dot", text: nb_commande + " waiting"});
		}
              	node.send(msg);

        });

        events.subscribe(EventPubSub.RESET_NODE_STATE, () => {
            waitingNode = null;
            node.status({});
        });
    }
    RED.nodes.registerType("Manage Order", ManageOrderNode);
}
