module.exports = (RED) => {
    const socket = require("../connection").socket;
    const ConnectionHelper = require("../connectionHelper");
    const EventPubSub = require("../eventPubSub");

    const events = new EventPubSub();

    function GetArmPositionNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        node.path = "/sawyer/getpos"; // Der Endpunkt für die Armposition

        let waitingNode = null;
        const ch = new ConnectionHelper(socket, node);

        node.on("input", (msg) => {
            // Zeige an, dass der Node eine Anfrage sendet
            node.status({
                fill: "blue",
                shape: "dot",
                text: node.type + ".executing",
            });

            // Setze das payload auf einen Trigger-Wert (z.B. "get_pos" oder leer)
            msg["payload"] = "get_pos";

            waitingNode = msg; // Speichern der Nachricht, um sie später zurückzusenden
            ch.emit([]); // Sende ein leeres Array oder entsprechendes Kommando
        });

        // Verarbeite die Antwort, wenn der Arm die Position zurückgibt
        ch.socket.on("/sawyer/getPos/finished", (msg) => {
            if (msg === "") {
                node.status({});
            } else {
                console.log(msg); // Hier wird die Armposition im Log ausgegeben
                node.status({
                    fill: "green",
                    shape: "dot",
                    text: "Arm position: " + msg,
                });
            }

            node.send(waitingNode); // Sende die Nachricht weiter
            waitingNode = null; // Setze waitingNode zurück
        });

        // Wenn der Node zurückgesetzt wird, setze den Status zurück
        events.subscribe(EventPubSub.RESET_NODE_STATE, () => {
            node.status({});
            waitingNode = null;
        });
    }

    // Registriere den neuen Node
    RED.nodes.registerType("Get arm position", GetArmPositionNode);
};
