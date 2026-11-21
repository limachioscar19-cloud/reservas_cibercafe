const CACHE_NAME = "nexus-gaming-v5";

const ARCHIVOS_BASE = [
    "./",
    "./index.html",
    "./styles.css",
    "./script.js",
    "./manifest.json",
    "./icons/icon-192.png",
    "./icons/icon-512.png",
    "./icons/icon-maskable-512.png"
];

const ARCHIVOS_IMAGENES = [
    "./imagenes/inicio.jpg",
    "./imagenes/pedidos/agua.jpg",
    "./imagenes/pedidos/audifonos.jpg",
    "./imagenes/pedidos/energizante.jpg",
    "./imagenes/pedidos/gaseosa.jpg",
    "./imagenes/pedidos/hamburguesa.jpg",
    "./imagenes/pedidos/mando-adicional.jpg",
    "./imagenes/pedidos/papas-fritas.jpg",
    "./imagenes/pedidos/pizza.jpg",
    "./imagenes/salas/arcade-retro.jpg",
    "./imagenes/salas/pc-gamer.jpg",
    "./imagenes/salas/ps5-gaming.jpg",
    "./imagenes/salas/realidad-virtual.jpg",
    "./imagenes/salas/streaming.jpg"
];

const ARCHIVOS_EXTERNOS = [
    "https://code.jquery.com/jquery-3.7.1.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
];

const HOSTS_PERMITIDOS = [
    "code.jquery.com",
    "cdnjs.cloudflare.com"
];

self.addEventListener("install", function(evento) {
    evento.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(ARCHIVOS_BASE).then(function() {
                return Promise.allSettled(ARCHIVOS_IMAGENES.map(function(url) {
                    return cache.add(url);
                }));
            }).then(function() {
                return Promise.allSettled(ARCHIVOS_EXTERNOS.map(function(url) {
                    return fetch(new Request(url, { mode: "no-cors" })).then(function(respuesta) {
                        return cache.put(url, respuesta);
                    });
                }));
            });
        }).then(function() {
            return self.skipWaiting();
        })
    );
});

self.addEventListener("activate", function(evento) {
    evento.waitUntil(
        caches.keys().then(function(claves) {
            return Promise.all(claves.filter(function(clave) {
                return clave !== CACHE_NAME;
            }).map(function(clave) {
                return caches.delete(clave);
            }));
        }).then(function() {
            return self.clients.claim();
        })
    );
});

function redPrimero(peticion) {
    return fetch(peticion).then(function(respuesta) {
        if (respuesta && respuesta.ok) {
            const copia = respuesta.clone();
            caches.open(CACHE_NAME).then(function(cache) {
                cache.put(peticion, copia);
            });
        }
        return respuesta;
    }).catch(function() {
        return caches.match(peticion).then(function(guardada) {
            return guardada || caches.match("./index.html");
        });
    });
}

function cacheYActualizar(peticion) {
    return caches.open(CACHE_NAME).then(function(cache) {
        return cache.match(peticion).then(function(guardada) {
            const desdeRed = fetch(peticion).then(function(respuesta) {
                if (respuesta && (respuesta.ok || respuesta.type === "opaque")) {
                    cache.put(peticion, respuesta.clone());
                }
                return respuesta;
            }).catch(function() {
                return guardada || Response.error();
            });

            return guardada || desdeRed;
        });
    });
}

self.addEventListener("fetch", function(evento) {
    const peticion = evento.request;

    if (peticion.method !== "GET") return;

    const url = new URL(peticion.url);
    const esPropio = url.origin === self.location.origin;

    if (!esPropio && HOSTS_PERMITIDOS.indexOf(url.hostname) === -1) return;

    if (peticion.mode === "navigate") {
        evento.respondWith(redPrimero(peticion));
        return;
    }

    evento.respondWith(cacheYActualizar(peticion));
});
