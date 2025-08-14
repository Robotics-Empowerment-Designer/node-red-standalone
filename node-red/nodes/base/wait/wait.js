/**
 * @param {import("node-red").NodeAPI} RED Node-RED runtime object
 */
module.exports = (RED) => {
    const EventPubSub = require("node-red-contrib-base/eventPubSub");

    const events = new EventPubSub();

    /**
     * @this {import("node-red-contrib-base/types").WaitBaseRuntimeDef} Node-RED node instance
     * @param {import("node-red-contrib-base/types").WaitBaseEditorDef} config Node-RED node instance definition/configuration
     */
    function WaitNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.on("input", (msg) => {
            node.status({fill: "blue", shape: "dot", text: node.type + ".waiting"});

            node.timeout = setTimeout(() => {
                node.send(msg);

                node.status({});
            }, config.time * 1000);
        });

        events.subscribe(EventPubSub.RESET_NODE_STATE, () => {
            clearTimeout(node.timeout);
            node.status({});
        });
    }
    RED.nodes.registerType("Wait time", WaitNode);
};
