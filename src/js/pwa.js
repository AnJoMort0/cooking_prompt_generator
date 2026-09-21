/* PWA registration. Service workers require HTTPS (or localhost), so direct
   file:// opening simply skips this and continues as a normal static page. */
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js").catch(error => {
            console.warn("Mise service worker registration failed:", error);
        });
    });
}
