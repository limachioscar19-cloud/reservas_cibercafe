const WHATSAPP = "59178826105";
const CLAVE_RESERVAS = "nexusReservas";
const CLAVE_TEMA = "nexusTema";
const CLAVE_PROMO = "nexusPromoFin";

let salas = [];
let reservas = JSON.parse(localStorage.getItem(CLAVE_RESERVAS)) || [];
let reservaPendiente = null;
let temporizadorConfirmacion = null;

function escaparHTML(texto) {
    return String(texto).replace(/[&<>"']/g, function(caracter) {
        const equivalencias = {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"};
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
    if (!reservas.length) {
        $("#reservasLista").html('<div class="panel"><p>Todavía no tienes reservas registradas.</p></div>');
        return;
    }
    let contenido = "";
    reservas.forEach(function(reserva) {
        contenido += `
            <div class="reserva-card">
                <h3>${escaparHTML(reserva.sala)}</h3>
                <p><strong>Nombre:</strong> ${escaparHTML(reserva.nombre)}</p>
                <p><strong>Fecha:</strong> ${escaparHTML(reserva.fecha)}</p>
                <p><strong>Hora:</strong> ${escaparHTML(reserva.hora)}</p>
                <p><strong>Duración:</strong> ${Number(reserva.duracion)} hora(s)</p>
                <p><strong>Total:</strong> ${Number(reserva.total).toFixed(2)} Bs</p>
                <button type="button" class="btn-cancelar-reserva" data-id="${Number(reserva.id)}" data-hidratado="false">Cancelar reserva</button>
            </div>`;
    });
    $("#reservasLista").html(contenido);
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

function iniciarTemporizadorPromo() {
    let fin = Number(localStorage.getItem(CLAVE_PROMO));
    if (!fin || fin <= Date.now()) {
        fin = Date.now() + 30 * 60 * 1000;
        localStorage.setItem(CLAVE_PROMO, String(fin));
    }
    let intervaloPromo;
    function actualizar() {
        const restante = Math.max(0, fin - Date.now());
        const horas = Math.floor(restante / 3600000);
        const minutos = Math.floor((restante % 3600000) / 60000);
        const segundos = Math.floor((restante % 60000) / 1000);
        $("#promoTimer").text(String(horas).padStart(2, "0") + ":" + String(minutos).padStart(2, "0") + ":" + String(segundos).padStart(2, "0"));
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
    const ahora = new Date();
    const dia = ahora.getDay();
    const minutos = ahora.getHours() * 60 + ahora.getMinutes();
    let apertura = dia === 0 ? 720 : 600;
    let cierre = dia === 6 ? 1380 : 1320;
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
    hidratar("#nombre, #celular, #roomSelect, #fecha, #hora", "input", function() { validarCampo(this.id); });
    hidratar("#nombre, #celular, #roomSelect, #fecha, #hora", "change", function() { validarCampo(this.id); });
    hidratar("#nombre, #celular, #roomSelect, #fecha, #hora", "blur", function() { validarCampo(this.id); });
    hidratar("#reserveForm", "submit", function(evento) {
        evento.preventDefault();
        if (!validarReserva()) return;
        const sala = obtenerSalaSeleccionada();
        const horas = Number($("#duracion").val());
        const subtotal = sala.precio * horas;
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
}

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

function iniciarPWA() {
    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
        window.addEventListener("load", function() {
            navigator.serviceWorker.register("./service-worker.js")
                .then(function() { console.log("PWA: Service Worker registrado."); })
                .catch(function(error) { console.error("PWA: Error al registrar Service Worker:", error); });
        });
    }
}

$(document).ready(function() {
    registrarEventos();
    cargarTema();
    $("#fecha").attr("min", fechaLocal());
    cargarCatalogo();
    actualizarResumen();
    mostrarReservas();
    iniciarTemporizadorPromo();
    actualizarEstado();
    setInterval(actualizarEstado, 60000);
    iniciarPWA();
});
