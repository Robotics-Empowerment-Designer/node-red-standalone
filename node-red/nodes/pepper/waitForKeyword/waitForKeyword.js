module.exports = RED => {
    const socket = require("../connection").socket;
    const ConnectionHelper = require("../connectionHelper");
    const EventPubSub = require('node-red-contrib-base/eventPubSub');

    const events = new EventPubSub();

    let lastReset = 0;
    let timeoutId = null;

    function resetNodeState(ch, node) {
        if (lastReset + 100 > Date.now()) {
            return;
        }

        clearTimeout(timeoutId);
        timeoutId = null;
        node.waitingNode = null;

        lastReset = Date.now();
        ch.emit(null, "/robot/speech-recognition/stop");
    }

    function timeoutHandler(ch, node, config) {
        if (node.waitingNode !== null) {
            const output = new Array(config.keywords.length + 1).fill(null);
            node.waitingNode.payload = RED._(node.type + ".timeout");
            output[config.keywords.length] = node.waitingNode;

            node.status({});
            node.send(output);

            resetNodeState(ch, node);
        }
        timeoutId = null;
    }

    function WaitForKeyword(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        node.path = "/robot/speech-recognition/start";
        node.waitingNode = null;

        const ch = new ConnectionHelper(socket, node);
        node.on("input", msg => {
            node.waitingNode = msg;
            node.status({ fill: "blue", shape: "dot", text: node.type + ".waiting" });

            if (config.timeout !== null && config.timeout > 0 && timeoutId === null) { // timeout === null prevents multiple/non-cancellable timeouts
                node.timeoutDuration = config.timeout * 1000;
                timeoutId = setTimeout(timeoutHandler, node.timeoutDuration, ch, node, config)[Symbol.toPrimitive](); // we don't want to use the node.js setTimeout version (returns object), we only want the ID;
            }

            // lookup table for the correct output
            let indexLookup = [];
            config.newKeywords = [];
            // iterate through each defined keyword
            for (let i = 0; i < config.keywords.length; i++) {
                if (msg[config.keywords[i]] != undefined) {
                    // if an array of msg.*name* exists go through each array element and add it to the newKeywords
                    msg[config.keywords[i]].forEach(element => {
                        config.newKeywords.push(element);
                        indexLookup.push(i);
                    });
                } else {
                    // otherwise add the keyword to the newKeywords
                    config.newKeywords.push(config.keywords[i]);
                    indexLookup.push(i);
                }
            }
            // add the lookup table to the newKeywords to gain access to it in the speech/recognized event
            config.newKeywords.push(JSON.stringify(indexLookup));

            ch.emit([config.newKeywords, config.detectionFailedInquires, config.language, config.threshold]);
        });

        ch.socket.on("/event/speech/recognized", keyword => {
            if (!node.waitingNode || !config.newKeywords.includes(keyword)) {
                return;
            }

            clearTimeout(timeoutId);
            timeoutId = null;

            const output = new Array(config.newKeywords.length).fill(null);

            // get the lookup table ex: [0, 0, 1, 2, 2, 2] -> output 0 has an array with 2 elements, output 1 is hard coded and output 2 has an array with 3 elements
            let indexLookup = JSON.parse(config.newKeywords.pop());
            let index = config.newKeywords.indexOf(keyword);

            // set the payload to use the keyword after the waitForKeyword node
            node.waitingNode.payload = keyword
            // set the correct output index with help from the lookup table
            output[indexLookup[index]] = node.waitingNode;

            node.send(output);
            node.waitingNode = null;

            node.status({});
        });

        node.on("close", (removed, done) => {
            resetNodeState(ch, node);
            done();
        });

        events.subscribe(EventPubSub.RESET_NODE_STATE, () => {
            resetNodeState(ch, node);
            node.status({});
        });
    }
    RED.nodes.registerType("Wait for keyword", WaitForKeyword);
}