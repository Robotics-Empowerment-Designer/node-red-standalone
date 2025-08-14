function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined || unsafe === "undefined") return "";

    return unsafe
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .replace(/&(?!(amp|lt|gt|quot|#039);)/g, "&amp;");
}
