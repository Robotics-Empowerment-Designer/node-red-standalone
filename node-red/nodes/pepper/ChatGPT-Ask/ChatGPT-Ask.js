module.exports = RED => {
    const got = (...args) => import('got').then(module => module.default(...args));

    // Define the ChatGPTAskNode function
    function ChatGPTAskNode(config) {
        // ChatGPT API key for authentication
        const ChatGPTkey = process.env.OPENAI_API_KEY;
        RED.nodes.createNode(this, config);
        const node = this;

        // Main function triggered on input
        node.on("input", async msg => {
            node.log(`Token: ${ChatGPTkey}`);

            let emotion = msg.emotion;
        
            if (msg.emotion === '"Kein Gesicht erkannt"' || msg.emotion === '"Keine klare Emotion erkannt"') {
                emotion = "";
            }

            // Extract message and history from the input message and build the content with emotion and message
            let text = "[" + emotion + "] " + msg.message;

            let conversationHistory = msg.history || [];
            console.log(text);


            // Set up headers for the HTTP request
            const headers = {
                "Authorization": "Bearer " + ChatGPTkey,
                "Content-Type": "application/json",
            };

            // Function to add messages to the history
            function addToHistory(role, content) {
                conversationHistory.push({ role: role, content: content });
            }
            
            // Add the new user message to the conversation history
            addToHistory("user", text);


            // Data to be sent in the request
            const data = {
                "model": "gpt-4o-mini",
                "messages": conversationHistory,
            };


            // Function to get the conversation history
            function getConversationHistory() {
                return conversationHistory;
            }

            // Make the request to the ChatGPT API
            try {
                node.status({ fill: "blue", shape: "dot", text: node.type + ".wait" });
                const response = await got("https://api.openai.com/v1/chat/completions", { headers: headers, json: data, method: 'post' }).json();

                // Add the assistant's response to the conversation history
                addToHistory("assistant", response.choices[0].message.content);

                // Update the message payload with the assistant's response and conversation history
                msg.payload = response.choices[0].message.content;
                msg.history = getConversationHistory();

            } catch (error) {
                node.error("ChatGPT error: " + error);
                msg = { payload: "Ein Fehler ist aufgetreten" };
            }
            

            // Send the message with the response payload and updated conversation history
            node.send(msg);
            node.status({});
        });
    }

    // Register a new Node-RED node type called "ChatGPT-Ask"
    RED.nodes.registerType("ChatGPT-Ask", ChatGPTAskNode);
};
