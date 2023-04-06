/**
 * Send message from service worker to iframe
 * @param message object with message data
 */
export const postMessageToIframe = async (message) => {
    await globalThis.clients
        .matchAll({
        frameType: "top-level",
        includeUncontrolled: true,
        type: "window",
        visibilityState: "visible",
    })
        .then((clients) => {
        clients.forEach((client) => {
            client.postMessage(message);
        });
    });
};
//# sourceMappingURL=shared.js.map