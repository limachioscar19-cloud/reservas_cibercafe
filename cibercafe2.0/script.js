const WHATSAPP = "59178826105";
const CLAVE_RESERVAS = "nexusReservas";
const CLAVE_TEMA = "nexusTema";
const CLAVE_PROMO = "nexusPromoFin";
const CLAVE_CARRITO = "nexusCarrito";

let salas = [];
let reservas = JSON.parse(localStorage.getItem(CLAVE_RESERVAS)) || [];
let reservaPendiente = null;
let temporizadorConfirmacion = null;
let categoriaActual = "todos";
let carrito = JSON.parse(localStorage.getItem(CLAVE_CARRITO)) || [];

const productos = [
    { id: 1, nombre: "Papas fritas",    categoria: "snacks",     descripcion: "Crujientes y deliciosas.",              precio: 8,  imagen: "./imagenes/papas-fritas.jpg" },
    { id: 2, nombre: "Nachos",          categoria: "snacks",     descripcion: "Nachos para compartir.",                precio: 12, imagen: "./imagenes/nachos.jpg" },
    { id: 3, nombre: "Galletas",        categoria: "snacks",     descripcion: "Un snack para tu partida.",             precio: 5,  imagen: "./imagenes/galletas.jpg" },
    { id: 4, nombre: "Chocolate",       categoria: "snacks",     descripcion: "Algo dulce para disfrutar.",            precio: 6,  imagen: "./imagenes/chocolate.jpg" },
    { id: 5, nombre: "Gaseosa",         categoria: "bebidas",    descripcion: "Bebida refrescante.",                   precio: 7,  imagen: "./imagenes/gaseosa.jpg" },
    { id: 6, nombre: "Agua",            categoria: "bebidas",    descripcion: "Agua embotellada.",                     precio: 5,  imagen: "./imagenes/agua.jpg" },
    { id: 7, nombre: "Jugo",            categoria: "bebidas",    descripcion: "Bebida frutal.",                        precio: 8,  imagen: "./imagenes/jugo.jpg" },
    { id: 8, nombre: "Energizante",     categoria: "bebidas",    descripcion: "Bebida energética.",                    precio: 12, imagen: "./imagenes/energizante.jpg" },
    { id: 9, nombre: "Mando adicional", categoria: "accesorios", descripcion: "Control adicional para jugar.",         precio: 10, imagen: "./imagenes/mando.jpg" },
    { id: 10, nombre: "Audífonos",      categoria: "accesorios", descripcion: "Audífonos para tu experiencia gaming.", precio: 8,  imagen: "./imagenes/audifonos.jpg" }
];

function escaparHTML(texto) {
    return String(texto).replace(/[&<>"']/g, function(caracter) {
        const equivalencias = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
        return equivalencias[caracter];
    });
}

function hidratar(selector, evento, funcion) {
    $(selector).each(function() {
        const elemento = $(this);
        if (elemento.attr("data-hidratado") === "true") return;
        elemento.off(evento + ".hidratacion").on(evento + ".hidratacion", funcion);
        elemento.attr("data-hidratado", "true");
    });
}

function guardarReservas() {
    localStorage.setItem(CLAVE_RESERVAS, JSON.stringify(reservas));
}

function guardarCarrito() {
    localStorage.setItem(CLAVE_CARRITO, JSON.stringify(carrito));
}

function mostrarToast(mensaje) {
    $("#toast").stop(true, true).text(mensaje).fadeIn(200).delay(2200).fadeOut(400);
}

function cerrarMenu() {
    $("#navMenu").removeClass("open");
    $("#menuToggle").attr("aria-expanded", "false").attr("aria-label", "Abrir menú").html('<i class="fas fa-bars"></i>');
}

function cambiarPagina(nombrePagina) {
    if (!$("#" + nombrePagina).length) return;

    $(".page").removeClass("active").stop(true, true).hide();
    $("#" + nombrePagina).addClass("active").fadeIn(220);
    $(".nav-btn").removeClass("active");
    $('.nav-btn[data-page="' + nombrePagina + '"]').addClass("active");
    cerrarMenu();

    if (nombrePagina === "misreservas") mostrarReservas();
    if (nombrePagina === "pedidos") {
        cargarProductos();
        mostrarCarrito();
    }
}

function cargarSalas() {
    const busqueda = $("#searchRoom").val().toLowerCase().trim();
    const categoria = $("#categoryFilter").val() || "todos";

    const filtradas = salas.filter(function(sala) {
        const coincideNombre = sala.nombre.toLowerCase().includes(busqueda) || sala.descripcion.toLowerCase().includes(busqueda);
        const coincideCategoria = categoria === "todos" || sala.categoria === categoria;
        return coincideNombre && coincideCategoria;
    });

    if (filtradas.length === 0) {
        $("#roomsGrid").html('<p class="empty-message">No se encontraron salas con esos criterios.</p>');
        return;
    }

    let contenido = "";
    filtradas.forEach(function(sala) {
        contenido += `
            <article class="room-card">
                <img src="${escaparHTML(sala.imagen)}" alt="${escaparHTML(sala.nombre)}" width="800" height="500" loading="lazy" decoding="async">
                <div class="room-content">
                    <h3>${escaparHTML(sala.nombre)}</h3>
                    <p>${escaparHTML(sala.descripcion)}</p>
                    <div class="room-price">${Number(sala.precio)} Bs / hora</div>
                    <button class="primary-btn btn-reservar-sala" type="button" data-id="${Number(sala.id)}" data-hidratado="false">Reservar esta sala</button>
                </div>
            </article>`;
    });

    $("#roomsGrid").html(contenido);
    hidratar("#roomsGrid .btn-reservar-sala", "click", function() {
        seleccionarSala(Number($(this).attr("data-id")));
    });
}

function cargarOpcionesSalas() {
    let opciones = '<option value="">Seleccionar sala</option>';
    salas.forEach(function(sala) {
        opciones += `<option value="${Number(sala.id)}">${escaparHTML(sala.nombre)} - ${Number(sala.precio)} Bs/h</option>`;
    });
    $("#roomSelect").html(opciones);
}

function seleccionarSala(id) {
    $("#roomSelect").val(String(id));
    actualizarResumen();
    cambiarPagina("reservar");
}

function obtenerSalaSeleccionada() {
    const id = Number($("#roomSelect").val());
    return salas.find(function(sala) { return Number(sala.id) === id; });
}

function actualizarResumen() {
    const sala = obtenerSalaSeleccionada();
    const horas = Number($("#duracion").val()) || 1;

    if (!sala) {
        $("#resumenSala").text("No seleccionada");
        $("#precioHora").text("0 Bs");
        $("#resumenHoras").text(horas + (horas === 1 ? " hora" : " horas"));
        $("#descuento, #totalPrecio").text("0 Bs");
        return;
    }

    const subtotal = Number(sala.precio) * horas;
    const descuento = horas >= 3 ? subtotal * 0.10 : 0;
    $("#resumenSala").text(sala.nombre);
    $("#precioHora").text(sala.precio + " Bs");
    $("#resumenHoras").text(horas + (horas === 1 ? " hora" : " horas"));
    $("#descuento").text(descuento.toFixed(2) + " Bs");
    $("#totalPrecio").text((subtotal - descuento).toFixed(2) + " Bs");
}

function fechaLocal() {
    const hoy = new Date();
    return hoy.getFullYear() + "-" + String(hoy.getMonth() + 1).padStart(2, "0") + "-" + String(hoy.getDate()).padStart(2, "0");
}

function mostrarError(id, mensaje) {
    const campo = $("#" + id);
    campo.toggleClass("invalid", mensaje !== "");
    let error = $("#error-" + id);
    if (!error.length) {
        campo.after('<small class="field-error" id="error-' + id + '"></small>');
        error = $("#error-" + id);
    }
    error.text(mensaje);
}

function validarCampo(id) {
    const valor = $("#" + id).val().trim();
    let mensaje = "";
    if (valor === "") mensaje = "Este campo es obligatorio.";
    else if (id === "nombre" && valor.length < 3) mensaje = "Escribe al menos 3 caracteres.";
    else if (id === "celular" && !/^[67]\d{7}$/.test(valor)) mensaje = "Ingresa un celular válido de 8 dígitos.";
    else if (id === "fecha" && valor < fechaLocal()) mensaje = "Selecciona una fecha actual o futura.";
    mostrarError(id, mensaje);
    return mensaje === "";
}

function validarHorario(fecha, hora, duracion) {
    const dia = new Date(fecha + "T00:00:00").getDay();
    const partes = hora.split(":");
    const inicio = Number(partes[0]) * 60 + Number(partes[1]);
    const fin = inicio + duracion * 60;
    let apertura = 600;
    let cierre = dia === 6 ? 1380 : 1320;
    if (dia === 0) apertura = 720;
    return inicio >= apertura && fin <= cierre;
}

function validarReserva() {
    let correcto = true;
    ["nombre", "celular", "roomSelect", "fecha", "hora"].forEach(function(id) {
        if (!validarCampo(id)) correcto = false;
    });

    const fecha = $("#fecha").val();
    const hora = $("#hora").val();
    const duracion = Number($("#duracion").val());
    const sala = obtenerSalaSeleccionada();

    if (!sala) {
        mostrarToast("Selecciona una sala.");
        correcto = false;
    }

    if (fecha && hora) {
        const fechaHora = new Date(fecha + "T" + hora);
        if (fechaHora <= new Date()) {
            mostrarToast("La reserva debe ser en una hora futura.");
            correcto = false;
        } else if (!validarHorario(fecha, hora, duracion)) {
            mostrarToast("La hora seleccionada está fuera del horario de atención.");
            correcto = false;
        }
    }
    return correcto;
}

function abrirModal() {
    let segundos = 30;
    $("#confirmTimer").text(segundos);
    $("#confirmModal").css("display", "flex").hide().fadeIn(200);
    clearInterval(temporizadorConfirmacion);
    temporizadorConfirmacion = setInterval(function() {
        segundos--;
        $("#confirmTimer").text(segundos);
        if (segundos <= 0) {
            clearInterval(temporizadorConfirmacion);
            cerrarModal();
            reservaPendiente = null;
            mostrarToast("El tiempo para confirmar terminó.");
        }
    }, 1000);
}

function cerrarModal() {
    clearInterval(temporizadorConfirmacion);
    $("#confirmModal").fadeOut(200);
}

function confirmarReserva() {
    if (!reservaPendiente) return;
    reservas.push(reservaPendiente);
    guardarReservas();
    const reserva = reservaPendiente;
    reservaPendiente = null;
    cerrarModal();
    mostrarReservas();
    mostrarToast("¡Reserva guardada correctamente!");

    const lineas = [
        "Hola, deseo confirmar mi reserva en NEXUS GAMING LOUNGE.",
        "Nombre: " + reserva.nombre,
        "Celular: " + reserva.celular,
        "Sala: " + reserva.sala,
        "Fecha: " + reserva.fecha,
        "Hora: " + reserva.hora,
        "Duración: " + reserva.duracion + " hora(s)",
        "Total: " + Number(reserva.total).toFixed(2) + " Bs"
    ];
    window.open("https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(lineas.join("\n")), "_blank", "noopener");
    cambiarPagina("misreservas");
}

function mostrarReservas() {
    const lista = $("#reservasLista");
    lista.empty();
    if (!reservas.length) {
        const panel = $("<div>").addClass("panel");
        panel.append($("<p>").text("Todavía no tienes reservas registradas."));
        lista.append(panel);
        return;
    }

    reservas.forEach(function(reserva) {
        const tarjeta = $("<div>").addClass("reserva-card");
        const titulo   = $("<h3>").text(reserva.sala);
        const nombre   = $("<p>").append($("<strong>").text("Nombre: "),   document.createTextNode(reserva.nombre));
        const fecha    = $("<p>").append($("<strong>").text("Fecha: "),    document.createTextNode(reserva.fecha));
        const hora     = $("<p>").append($("<strong>").text("Hora: "),     document.createTextNode(reserva.hora));
        const duracion = $("<p>").append($("<strong>").text("Duración: "), document.createTextNode(Number(reserva.duracion) + " hora(s)"));
        const total    = $("<p>").append($("<strong>").text("Total: "),    document.createTextNode(Number(reserva.total).toFixed(2) + " Bs"));
        const boton    = $("<button>").attr("type", "button").addClass("btn-cancelar-reserva")
                            .attr("data-id", Number(reserva.id)).attr("data-hidratado", "false").text("Cancelar reserva");
        tarjeta.append(titulo, nombre, fecha, hora, duracion, total, boton);
        lista.append(tarjeta);
    });

    hidratar("#reservasLista .btn-cancelar-reserva", "click", function() {
        cancelarReserva(Number($(this).attr("data-id")));
    });
}

function cancelarReserva(id) {
    reservas = reservas.filter(function(reserva) { return Number(reserva.id) !== id; });
    guardarReservas();
    mostrarReservas();
    mostrarToast("Reserva eliminada.");
}

/* ── TIENDA Y CARRITO ─────────────────────────────────────── */

function cargarProductos() {
    const busqueda = $("#buscarProducto").val().toLowerCase().trim();
    const filtrados = productos.filter(function(producto) {
        const coincideCategoria = categoriaActual === "todos" || producto.categoria === categoriaActual;
        const coincideBusqueda  = producto.nombre.toLowerCase().includes(busqueda) || producto.descripcion.toLowerCase().includes(busqueda);
        return coincideCategoria && coincideBusqueda;
    });

    const grid = $("#productosGrid");
    grid.empty();
    if (!filtrados.length) {
        grid.append($("<p>").addClass("empty-message").text("No se encontraron productos."));
        return;
    }

    filtrados.forEach(function(producto) {
        const tarjeta   = $("<article>").addClass("producto-card");
        const imagen    = $("<img>")
                            .attr("src", producto.imagen)
                            .attr("alt", producto.nombre)
                            .attr("width", "600")
                            .attr("height", "400")
                            .attr("loading", "lazy")
                            .attr("decoding", "async");
        const contenido = $("<div>").addClass("producto-contenido");
        const titulo    = $("<h3>").text(producto.nombre);
        const descripcion = $("<p>").text(producto.descripcion);
        const precio    = $("<div>").addClass("producto-precio").text(producto.precio + " Bs");
        const boton     = $("<button>").attr("type", "button").addClass("primary-btn")
                            .attr("data-id", producto.id).text("Agregar al carrito");
        contenido.append(titulo, descripcion, precio, boton);
        tarjeta.append(imagen, contenido);
        grid.append(tarjeta);
    });
}

function agregarAlCarrito(id) {
    const producto = productos.find(function(item) { return item.id === id; });
    if (!producto) return;
    const existente = carrito.find(function(item) { return item.id === id; });
    if (existente) existente.cantidad++;
    else carrito.push({ id: producto.id, nombre: producto.nombre, precio: producto.precio, cantidad: 1 });
    guardarCarrito();
    mostrarCarrito();
    mostrarToast("Producto agregado al carrito.");
}

function mostrarCarrito() {
    const lista = $("#carritoLista");
    lista.empty();
    if (!carrito.length) {
        lista.append($("<p>").addClass("empty-message").text("Tu carrito está vacío."));
    }

    let total = 0;
    let cantidadTotal = 0;
    carrito.forEach(function(item) {
        const subtotal = Number(item.precio) * Number(item.cantidad);
        total += subtotal;
        cantidadTotal += Number(item.cantidad);

        const tarjeta  = $("<div>").addClass("carrito-producto");
        const info     = $("<div>").addClass("carrito-producto-info");
        info.append($("<strong>").text(item.nombre), $("<span>").text(subtotal.toFixed(2) + " Bs"));

        const controles = $("<div>").addClass("carrito-controles");
        const menos   = $("<button>").attr("type", "button").attr("data-accion", "menos").attr("data-id", item.id).attr("aria-label", "Disminuir cantidad").text("-");
        const cantidad = $("<strong>").text(item.cantidad);
        const mas     = $("<button>").attr("type", "button").attr("data-accion", "mas").attr("data-id", item.id).attr("aria-label", "Aumentar cantidad").text("+");
        const eliminar = $("<button>").attr("type", "button").addClass("eliminar-producto")
                            .attr("data-accion", "eliminar").attr("data-id", item.id)
                            .attr("aria-label", "Eliminar " + item.nombre)
                            .html('<i class="fas fa-trash"></i>');
        controles.append(menos, cantidad, mas, eliminar);
        tarjeta.append(info, controles);
        lista.append(tarjeta);
    });

    $("#contadorCarrito").text(cantidadTotal);
    $("#totalCarrito").text(total.toFixed(2) + " Bs");
}

function modificarCantidad(id, accion) {
    const item = carrito.find(function(producto) { return producto.id === id; });
    if (!item) return;
    if (accion === "mas") item.cantidad++;
    else if (accion === "menos") item.cantidad--;
    else if (accion === "eliminar") carrito = carrito.filter(function(producto) { return producto.id !== id; });
    carrito = carrito.filter(function(producto) { return producto.cantidad > 0; });
    guardarCarrito();
    mostrarCarrito();
}

function enviarPedidoWhatsApp() {
    const nombre = $("#clientePedido").val().trim();
    const sala   = $("#salaPedido").val().trim();
    if (!carrito.length) {
        mostrarToast("Agrega al menos un producto.");
        return;
    }
    if (nombre.length < 3) {
        mostrarToast("Escribe tu nombre para continuar.");
        $("#clientePedido").trigger("focus");
        return;
    }
    if (sala.length < 2) {
        mostrarToast("Indica tu sala o reserva.");
        $("#salaPedido").trigger("focus");
        return;
    }

    let total = 0;
    const lineas = [
        "Hola, deseo realizar un pedido en NEXUS GAMING LOUNGE.",
        "", "CLIENTE: " + nombre, "SALA O RESERVA: " + sala, "", "PRODUCTOS:"
    ];
    carrito.forEach(function(item) {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;
        lineas.push("- " + item.nombre + " x" + item.cantidad + " = " + subtotal.toFixed(2) + " Bs");
    });
    lineas.push("", "TOTAL: " + total.toFixed(2) + " Bs", "", "Por favor, confirmar disponibilidad. Gracias.");
    const url = "https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(lineas.join("\n"));
    window.open(url, "_blank", "noopener");
    mostrarToast("Pedido preparado para enviar por WhatsApp.");
}

function vaciarCarrito() {
    if (!carrito.length) {
        mostrarToast("El carrito ya está vacío.");
        return;
    }
    carrito = [];
    guardarCarrito();
    mostrarCarrito();
    mostrarToast("Carrito vaciado.");
}

/* ── TEMPORIZADORES Y ESTADO ──────────────────────────────── */

function iniciarTemporizadorPromo() {
    let fin = Number(localStorage.getItem(CLAVE_PROMO));
    if (!fin || fin <= Date.now()) {
        fin = Date.now() + 30 * 60 * 1000;
        localStorage.setItem(CLAVE_PROMO, String(fin));
    }
    let intervaloPromo;
    function actualizar() {
        const restante = Math.max(0, fin - Date.now());
        const horas    = Math.floor(restante / 3600000);
        const minutos  = Math.floor((restante % 3600000) / 60000);
        const segundos = Math.floor((restante % 60000) / 1000);
        $("#promoTimer").text(
            String(horas).padStart(2, "0") + ":" +
            String(minutos).padStart(2, "0") + ":" +
            String(segundos).padStart(2, "0")
        );
        if (restante <= 0) {
            $("#promoTimer").text("00:00:00");
            $(".promo-info p").text("La promoción ha finalizado.");
            clearInterval(intervaloPromo);
        }
    }
    actualizar();
    intervaloPromo = setInterval(actualizar, 1000);
}

function actualizarEstado() {
    const ahora   = new Date();
    const dia     = ahora.getDay();
    const minutos = ahora.getHours() * 60 + ahora.getMinutes();
    const apertura = dia === 0 ? 720 : 600;
    const cierre   = dia === 6 ? 1380 : 1320;
    if (minutos >= apertura && minutos < cierre) {
        $("#businessStatus").text("● Estamos abiertos").css("color", "#58d68d");
    } else {
        $("#businessStatus").text("● Estamos cerrados").css("color", "#ff7777");
    }
}

function cargarTema() {
    const claro = localStorage.getItem(CLAVE_TEMA) === "claro";
    $("body").toggleClass("light-mode", claro);
    $("#themeBtn").html(claro ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>');
}

/* ── REGISTRO DE EVENTOS ──────────────────────────────────── */

function registrarEventos() {
    hidratar(".nav-btn", "click", function() { cambiarPagina($(this).data("page")); });
    hidratar("[data-go]", "click", function() { cambiarPagina($(this).attr("data-go")); });

    hidratar("#menuToggle", "click", function() {
        const abierto = $("#navMenu").toggleClass("open").hasClass("open");
        $(this).attr("aria-expanded", String(abierto)).attr("aria-label", abierto ? "Cerrar menú" : "Abrir menú");
        $(this).html(abierto ? '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>');
    });

    hidratar("#themeBtn", "click", function() {
        $("body").toggleClass("light-mode");
        const claro = $("body").hasClass("light-mode");
        localStorage.setItem(CLAVE_TEMA, claro ? "claro" : "oscuro");
        $(this).html(claro ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>');
    });

    hidratar("#searchRoom", "input", cargarSalas);
    hidratar("#categoryFilter", "change", cargarSalas);
    hidratar("#roomSelect, #duracion", "change", actualizarResumen);

    hidratar("#nombre, #celular, #roomSelect, #fecha, #hora", "input",  function() { validarCampo(this.id); });
    hidratar("#nombre, #celular, #roomSelect, #fecha, #hora", "change", function() { validarCampo(this.id); });
    hidratar("#nombre, #celular, #roomSelect, #fecha, #hora", "blur",   function() { validarCampo(this.id); });

    hidratar("#reserveForm", "submit", function(evento) {
        evento.preventDefault();
        if (!validarReserva()) return;
        const sala   = obtenerSalaSeleccionada();
        const horas  = Number($("#duracion").val());
        const subtotal  = sala.precio * horas;
        const descuento = horas >= 3 ? subtotal * 0.10 : 0;
        reservaPendiente = {
            id: Date.now(),
            nombre: $("#nombre").val().trim(),
            celular: $("#celular").val().trim(),
            sala: sala.nombre,
            precioHora: sala.precio,
            fecha: $("#fecha").val(),
            hora: $("#hora").val(),
            duracion: horas,
            total: subtotal - descuento
        };
        abrirModal();
    });

    hidratar("#cancelModal", "click", function() {
        cerrarModal();
        reservaPendiente = null;
        mostrarToast("Reserva cancelada.");
    });
    hidratar("#confirmBtn", "click", confirmarReserva);

    hidratar("#socialToggle", "click", function() {
        const visible = $("#socialLinks").stop(true, true).slideToggle(250).is(":visible");
        $(this).attr("aria-expanded", String(!visible));
    });

    // Tienda: búsqueda y filtros de categoría
    hidratar("#buscarProducto", "input", cargarProductos);

    $(document)
        .off("click.categorias", ".categoria-btn")
        .on("click.categorias", ".categoria-btn", function() {
            categoriaActual = $(this).attr("data-categoria");
            $(".categoria-btn").removeClass("active");
            $(this).addClass("active");
            cargarProductos();
        });

    // Tienda: agregar al carrito (delegación global)
    $("#productosGrid")
        .off("click.productos", "button[data-id]")
        .on("click.productos", "button[data-id]", function() {
            agregarAlCarrito(Number($(this).attr("data-id")));
        });

    // Tienda: controles del carrito (delegación global)
    $("#carritoLista")
        .off("click.carrito", "button[data-accion]")
        .on("click.carrito", "button[data-accion]", function() {
            modificarCantidad(Number($(this).attr("data-id")), $(this).attr("data-accion"));
        });

    hidratar("#enviarPedido",  "click", enviarPedidoWhatsApp);
    hidratar("#vaciarCarrito", "click", vaciarCarrito);

    // Teclado virtual en móvil: evita deformación de la navbar fija
    $(document)
        .off("focusin.teclado")
        .on("focusin.teclado", "input, select, textarea", function() {
            $("body").addClass("teclado-visible");
        });

    $(document)
        .off("focusout.teclado")
        .on("focusout.teclado", "input, select, textarea", function() {
            setTimeout(function() {
                $("body").removeClass("teclado-visible");
            }, 150);
        });
}

/* ── FETCH CATÁLOGO DE SALAS ──────────────────────────────── */

function cargarCatalogo() {
    $("#roomsGrid").html('<p class="loading-message">Cargando catálogo de salas...</p>');
    fetch("./data/salas.json")
        .then(function(respuesta) {
            if (!respuesta.ok) throw new Error("No se pudo obtener el catálogo. Código: " + respuesta.status);
            return respuesta.json();
        })
        .then(function(datos) {
            if (!Array.isArray(datos) || datos.length === 0) throw new Error("El archivo de salas está vacío o tiene un formato incorrecto.");
            salas = datos;
            cargarSalas();
            cargarOpcionesSalas();
            actualizarResumen();
        })
        .catch(function(error) {
            console.error("Error al cargar el catálogo:", error);
            $("#roomsGrid").html('<p class="empty-message">No se pudo cargar el catálogo. Comprueba tu conexión o el archivo data/salas.json.</p>');
            $("#roomSelect").html('<option value="">Catálogo no disponible</option>');
            mostrarToast("Ocurrió un error al cargar las salas.");
        });
}

/* ── PWA ──────────────────────────────────────────────────── */

function iniciarPWA() {
    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
        window.addEventListener("load", function() {
            navigator.serviceWorker.register("./service-worker.js")
                .then(function() { console.log("PWA: Service Worker registrado."); })
                .catch(function(error) { console.error("PWA: Error al registrar Service Worker:", error); });
        });
    }
}

/* ── INICIO ───────────────────────────────────────────────── */

$(document).ready(function() {
    registrarEventos();
    cargarTema();
    $("#fecha").attr("min", fechaLocal());
    cargarCatalogo();
    actualizarResumen();
    mostrarReservas();
    cargarProductos();
    mostrarCarrito();
    iniciarTemporizadorPromo();
    actualizarEstado();
    setInterval(actualizarEstado, 60000);
    iniciarPWA();
});
