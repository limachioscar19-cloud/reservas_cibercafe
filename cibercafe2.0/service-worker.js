const CACHE_NAME = "nexus-gaming-v3";
const ARCHIVOS_BASE = [
    "./",
    "./index.html",
    "./style.css",
    "./script.js",
    "./manifest.json",
    "./data/salas.json",
    "./imagenes/hero.jpg",
    "./imagenes/ps5.jpg",
    "./imagenes/pc-gamer.jpg",
    "./imagenes/arcade.jpg",
    "./imagenes/vr.jpg",
    "./imagenes/streaming.jpg",
    "./imagenes/papas-fritas.jpg",
    "./imagenes/nachos.jpg",
    "./imagenes/galletas.jpg",
    "./imagenes/chocolate.jpg",
    "./imagenes/gaseosa.jpg",
    "./imagenes/agua.jpg",
    "./imagenes/jugo.jpg",
    "./imagenes/energizante.jpg",
    "./imagenes/mando.jpg",
    "./imagenes/audifonos.jpg"
];

self.addEventListener("install", function(evento) {
    evento.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) { return cache.addAll(ARCHIVOS_BASE); })
            .then(function() { return self.skipWaiting(); })
    );
});

self.addEventListener("activate", function(evento) {
    evento.waitUntil(
        caches.keys().then(function(claves) {
            return Promise.all(
                claves.filter(function(clave) {
                    return clave !== CACHE_NAME;
                }).map(function(clave) {
                    return caches.delete(clave);
                })
            );
        }).then(function() { return self.clients.claim(); })
    );
});

self.addEventListener("fetch", function(evento) {
    if (evento.request.method !== "GET") return;

    const url = new URL(evento.request.url);
    if (url.origin !== self.location.origin) return;

    evento.respondWith(
        caches.match(evento.request).then(function(respuestaCache) {
            if (respuestaCache) return respuestaCache;

            return fetch(evento.request).then(function(respuestaRed) {
                if (respuestaRed && respuestaRed.status === 200) {
                    const copia = respuestaRed.clone();
                    caches.open(CACHE_NAME).then(function(cache) {
                        cache.put(evento.request, copia);
                    });
                }
                return respuestaRed;
            }).catch(function() {
                if (evento.request.mode === "navigate") {
                    return caches.match("./index.html");
                }
                throw new Error("Recurso no disponible sin conexión.");
            });
        })
    );
});
