/**
 * Sends a notification to all connected editor sessions.
 *
 * @param {string} id - The ID of the notification.
 * @param {string} text - The text of the notification.
 * @param {string} type - The type of the notification.
 * @param {number} timeout - The timeout for the notification (in ms).
 */
function sendNotification(RED, id, text, type, timeout) {
    text = text
        .replace(/:/g, "∶") // TODO fix this bs of a workaround (events.emit doesn't seem to work with ":" and omits everything before it)
        .replace(/http \/\//g, "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    RED.events.emit("runtime-event", {
        id: id,
        payload: {
            text: text,
            type: type,
            timeout: 5000,
        },
    });
}

module.exports = {sendNotification};
