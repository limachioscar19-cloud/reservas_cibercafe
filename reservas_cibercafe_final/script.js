const WHATSAPP = "59178826105";
const NOMBRE_NEGOCIO = "NEXUS GAMING LOUNGE";
const CLAVE_RESERVAS = "nexusReservas";
const CLAVE_TEMA = "nexusTema";
const CLAVE_PROMO = "nexusPromoFin";

const PATRON_NOMBRE = /^[\p{L}\p{M}' .-]{3,60}$/u;
const PATRON_CELULAR = /^[67]\d{7}$/;
const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const PATRON_HORA = /^([01]\d|2[0-3]):(00|30)$/;
const PATRON_PEDIDO = /^[\p{L}\p{N}\p{M}' .,()\/+#-]{2,120}$/u;
const CATEGORIAS = ["consola", "pc", "experiencia"];
const CATEGORIAS_PRODUCTO = ["snacks", "bebidas", "accesorios"];
const PATRON_IMAGEN_LOCAL = /^imagenes\/[\w\/-]+\.(jpe?g|png|webp|avif|svg)$/i;
const DURACIONES = [1, 2, 3, 4, 5, 6];
const MAX_DIAS_ANTICIPACION = 60;
const MAX_RESERVAS = 10;
const MAX_PEDIDOS = 20;
const SEGUNDOS_CONFIRMACION = 30;
const HORAS_PARA_DESCUENTO = 3;
const PORCENTAJE_DESCUENTO = 0.1;
const CAMPOS_RESERVA = ["nombre", "celular", "roomSelect", "fecha", "hora", "duracion"];

let salas = [];
let configuracionDescuento = { horas: 3, porcentaje: 10 };
try { configuracionDescuento = Object.assign(configuracionDescuento, JSON.parse(localStorage.getItem("nexusDescuento") || "{}")); } catch (e) {}
let productos = [];
let reservas = [];
let reservaPendiente = null;
let temporizadorConfirmacion = null;
let intervaloPromo = null;
let carritoPedidos = [];
function obtenerPrecioProducto(nombre) { const base = {"Hamburguesa":28,"Papas fritas":12,"Pizza":35,"Gaseosa":8,"Energizante":15,"Agua mineral":5,"Mando adicional":10,"Audífonos":15}; let guardados={}; try{guardados=JSON.parse(localStorage.getItem("nexusPrecios")||"{}");}catch(e){} return Number(guardados[nombre] ?? base[nombre] ?? 0); }

function debounce(funcion, espera) {
    let temporizador;
    return function() {
        const contexto = this;
        const argumentos = arguments;
        clearTimeout(temporizador);
        temporizador = setTimeout(function() {
            funcion.apply(contexto, argumentos);
        }, espera);
    };
}

function sanitizarTexto(texto, maximo) {
    return String(texto)
        .replace(/[\u0000-\u001F\u007F]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maximo);
}

function aMinutos(hora) {
    const partes = hora.split(":");
    return Number(partes[0]) * 60 + Number(partes[1]);
}

function formatearFecha(fecha) {
    return fecha.getFullYear() + "-" + String(fecha.getMonth() + 1).padStart(2, "0") + "-" + String(fecha.getDate()).padStart(2, "0");
}

function fechaLocal(desplazamientoDias) {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + (desplazamientoDias || 0));
    return formatearFecha(fecha);
}

function esFechaReal(valor) {
    if (!PATRON_FECHA.test(valor)) return false;

    const partes = valor.split("-").map(Number);
    const fecha = new Date(partes[0], partes[1] - 1, partes[2]);

    return fecha.getFullYear() === partes[0] && fecha.getMonth() === partes[1] - 1 && fecha.getDate() === partes[2];
}

function horarioDelDia(fecha) {
    const dia = new Date(fecha + "T00:00:00").getDay();

    return {
        apertura: dia === 0 ? 720 : 600,
        cierre: dia === 6 ? 1380 : 1320
    };
}

function esImagenSegura(valor) {
    if (typeof valor !== "string") return false;
    if (PATRON_IMAGEN_LOCAL.test(valor)) return true;

    try {
        return new URL(valor).protocol === "https:";
    } catch (error) {
        return false;
    }
}

function esSalaValida(sala) {
    return sala !== null &&
        typeof sala === "object" &&
        Number.isInteger(sala.id) &&
        typeof sala.nombre === "string" && sala.nombre.length > 0 &&
        typeof sala.descripcion === "string" &&
        CATEGORIAS.indexOf(sala.categoria) !== -1 &&
        typeof sala.precio === "number" && sala.precio > 0 &&
        esImagenSegura(sala.imagen);
}

function esProductoValido(producto) {
    return producto !== null &&
        typeof producto === "object" &&
        Number.isInteger(producto.id) &&
        typeof producto.nombre === "string" && PATRON_PEDIDO.test(producto.nombre) &&
        CATEGORIAS_PRODUCTO.indexOf(producto.categoria) !== -1 &&
        esImagenSegura(producto.imagen);
}

function esReservaValida(reserva) {
    return reserva !== null &&
        typeof reserva === "object" &&
        Number.isFinite(reserva.id) &&
        PATRON_NOMBRE.test(String(reserva.nombre)) &&
        PATRON_CELULAR.test(String(reserva.celular)) &&
        typeof reserva.sala === "string" && reserva.sala.length > 0 &&
        esFechaReal(String(reserva.fecha)) &&
        PATRON_HORA.test(String(reserva.hora)) &&
        DURACIONES.indexOf(Number(reserva.duracion)) !== -1 &&
        Number.isFinite(Number(reserva.total));
}

function leerReservasGuardadas() {
    try {
        const guardadas = JSON.parse(localStorage.getItem(CLAVE_RESERVAS));
        return Array.isArray(guardadas) ? guardadas.filter(esReservaValida) : [];
    } catch (error) {
        return [];
    }
}

function guardarReservas() {
    try {
        localStorage.setItem(CLAVE_RESERVAS, JSON.stringify(reservas));
    } catch (error) {
        mostrarToast("No se pudo guardar la reserva en este dispositivo.");
    }
}

function mostrarToast(mensaje) {
    $("#toast").stop(true, true).text(mensaje).fadeIn(200).delay(2200).fadeOut(400);
}

function mostrarError(id, mensaje) {
    const campo = $("#" + id);
    let error = $("#error-" + id);

    if (!error.length) {
        error = $("<small>", { "class": "field-error", id: "error-" + id });
        campo.after(error);
    }

    campo.toggleClass("invalid", mensaje !== "").attr("aria-invalid", mensaje !== "" ? "true" : "false");
    error.text(mensaje);
}

function cerrarMenu() {
    $("#navMenu").removeClass("open");
    $("#menuToggle")
        .attr("aria-expanded", "false")
        .attr("aria-label", "Abrir menú")
        .html('<i class="fas fa-bars"></i>');
}

function cambiarPagina(nombrePagina) {
    if (!$("#" + nombrePagina).hasClass("page")) return;

    $(".page").removeClass("active").stop(true, true).hide();
    $("#" + nombrePagina).addClass("active").fadeIn(220);
    $(".nav-btn").removeClass("active");
    $('.nav-btn[data-page="' + nombrePagina + '"]').addClass("active");

    cerrarMenu();

    if (nombrePagina === "misreservas") mostrarReservas();
    if (nombrePagina === "pedidos") actualizarContadorPedidos();
}

function cargarCatalogo() {
    try {
        const datos = JSON.parse($("#datosSalas").text());

        salas = Array.isArray(datos) ? datos.filter(esSalaValida) : [];
        let ajustesSalas = {}; try { ajustesSalas = JSON.parse(localStorage.getItem("nexusSalas") || "{}"); } catch (e) {}
        salas = salas.map(function(s) { const a = ajustesSalas[s.id] || {}; return Object.assign({}, s, { precio: Number.isFinite(Number(a.precio)) ? Number(a.precio) : s.precio, disponible: a.disponible !== false }); });
    } catch (error) {
        salas = [];
    }

    if (salas.length === 0) {
        $("#roomsGrid").empty().append($("<p>", { "class": "empty-message" }).text("No se pudo cargar el catálogo de salas."));
        $("#roomSelect").empty().append($("<option>", { value: "" }).text("Catálogo no disponible"));
        mostrarToast("Ocurrió un error al cargar las salas.");
        return;
    }

    mostrarSalas();
    cargarOpcionesSalas();
    actualizarResumen();
}

function crearTarjetaSala(sala) {
    const imagen = $("<img>").attr({
        loading: "lazy",
        decoding: "async",
        alt: sala.nombre,
        width: 800,
        height: 500,
        src: sala.imagen
    });

    const contenido = $("<div>", { "class": "room-content" }).append(
        $("<h3>").text(sala.nombre),
        $("<p>").text(sala.descripcion),
        $("<div>", { "class": "room-price" }).text(sala.precio + " Bs / hora"),
        $("<button>", { type: "button", "class": "primary-btn btn-reservar-sala" })
            .attr("data-id", sala.id)
            .text("Reservar esta sala")
    );

    return $("<article>", { "class": "room-card" }).append(imagen, contenido);
}

function mostrarSalas() {
    const busqueda = sanitizarTexto($("#searchRoom").val(), 40).toLowerCase();
    const categoria = $("#categoryFilter").val();

    const filtradas = salas.filter(function(sala) {
        if (sala.disponible === false) return false;
        const coincideTexto = sala.nombre.toLowerCase().includes(busqueda) || sala.descripcion.toLowerCase().includes(busqueda);
        const coincideCategoria = categoria === "todos" || sala.categoria === categoria;

        return coincideTexto && coincideCategoria;
    });

    const grid = $("#roomsGrid").empty();

    if (filtradas.length === 0) {
        grid.append($("<p>", { "class": "empty-message" }).text("No se encontraron salas con esos criterios."));
        return;
    }

    filtradas.forEach(function(sala) {
        grid.append(crearTarjetaSala(sala));
    });
}

function cargarOpcionesSalas() {
    const selector = $("#roomSelect").empty();

    selector.append($("<option>", { value: "" }).text("Seleccionar sala"));

    salas.forEach(function(sala) {
        if (sala.disponible === false) return;
        selector.append($("<option>", { value: sala.id }).text(sala.nombre + " - " + sala.precio + " Bs/h"));
    });
    const ubicacion = $("#pedidoUbicacion");
    if (ubicacion.length && ubicacion.is("select")) { ubicacion.empty().append($("<option>", {value:""}).text("Selecciona tu sala")); salas.filter(s=>s.disponible!==false).forEach(s=>ubicacion.append($("<option>",{value:s.nombre}).text(s.nombre))); }
}

function cargarProductos() {
    try {
        const datos = JSON.parse($("#datosProductos").text());

        productos = Array.isArray(datos) ? datos.filter(esProductoValido) : [];
    } catch (error) {
        productos = [];
    }

    mostrarProductos("todos");
}

function crearTarjetaProducto(producto) {
    const imagen = $("<img>").attr({
        loading: "lazy",
        decoding: "async",
        alt: producto.nombre,
        width: 600,
        height: 450,
        src: producto.imagen
    });

    const estado = $("<p>", { "class": "card-item__estado", "aria-live": "polite" }).text("Estado: Disponible");
    const acciones = $("<div>", { "class": "card-item__acciones" }).append(
        $("<button>", { type: "button", "class": "primary-btn btn-agregar-producto" }).attr("data-id", producto.id).text("Agregar al pedido"),
        $("<button>", { type: "button", "class": "card-item__simular btn-simular", "aria-pressed": "false" }).text("Simular selección")
    );
    const info = $("<div>", { "class": "producto-info card-cuerpo" }).append(
        $("<h3>", { "class": "card-item__titulo" }).text(producto.nombre), $("<p>", {"class":"producto-precio"}).text((obtenerPrecioProducto(producto.nombre).toFixed(2)) + " Bs"), estado, acciones
    );
    return $("<article>", { "class": "producto-card card-item", "data-id": producto.id }).append(imagen, info);
}

function mostrarProductos(categoria) {
    const grid = $("#productosGrid").empty();

    productos.filter(function(producto) {
        return categoria === "todos" || producto.categoria === categoria;
    }).forEach(function(producto) {
        grid.append(crearTarjetaProducto(producto));
    });

    if (!grid.children().length) {
        grid.append($("<p>", { "class": "empty-message" }).text("No hay productos en esta categoría."));
    }
}

function seleccionarSala(id) {
    $("#roomSelect").val(String(id));
    actualizarResumen();
    cambiarPagina("reservar");
}

function obtenerSalaSeleccionada() {
    const id = Number($("#roomSelect").val());

    return salas.find(function(sala) {
        return sala.id === id;
    });
}

function leerDuracion() {
    const horas = Number($("#duracion").val());

    return DURACIONES.indexOf(horas) !== -1 ? horas : 0;
}

function calcularTotales(sala, horas) {
    const subtotal = sala.precio * horas;
    const horasPromo = Number(configuracionDescuento.horas || HORAS_PARA_DESCUENTO);
    const porcentajePromo = Number(configuracionDescuento.porcentaje || 0) / 100;
    const descuento = horas >= horasPromo ? subtotal * porcentajePromo : 0;

    return { subtotal: subtotal, descuento: descuento, total: subtotal - descuento };
}

function actualizarResumen() {
    const sala = obtenerSalaSeleccionada();
    const horas = leerDuracion() || 1;

    $("#resumenHoras").text(horas + (horas === 1 ? " hora" : " horas"));

    if (!sala) {
        $("#resumenSala").text("No seleccionada");
        $("#precioHora").text("0 Bs");
        $("#descuento, #totalPrecio").text("0 Bs");
        return;
    }

    const totales = calcularTotales(sala, horas);

    $("#resumenSala").text(sala.nombre);
    $("#precioHora").text(sala.precio + " Bs");
    $("#descuento").text(totales.descuento.toFixed(2) + " Bs");
    $("#totalPrecio").text(totales.total.toFixed(2) + " Bs");
}

function hayConflicto(sala, fecha, hora, duracion) {
    const inicio = aMinutos(hora);
    const fin = inicio + duracion * 60;

    return reservas.some(function(reserva) {
        const inicioReserva = aMinutos(reserva.hora);
        const finReserva = inicioReserva + Number(reserva.duracion) * 60;

        return reserva.sala === sala.nombre && reserva.fecha === fecha && inicio < finReserva && fin > inicioReserva;
    });
}

function mensajeFecha(fecha) {
    if (fecha === "") return "Este campo es obligatorio.";
    if (!esFechaReal(fecha)) return "Ingresa una fecha válida.";
    if (fecha < fechaLocal(0)) return "Selecciona una fecha actual o futura.";
    if (fecha > fechaLocal(MAX_DIAS_ANTICIPACION)) return "Solo se reserva con hasta " + MAX_DIAS_ANTICIPACION + " días de anticipación.";

    return "";
}

function mensajeHora(hora, fecha, duracion, sala) {
    if (hora === "") return "Este campo es obligatorio.";
    if (!PATRON_HORA.test(hora)) return "Elige una hora en punto o y media (ej. 15:00 o 15:30).";

    if (mensajeFecha(fecha) !== "" || duracion === 0) return "";

    const horario = horarioDelDia(fecha);
    const inicio = aMinutos(hora);

    if (inicio < horario.apertura || inicio + duracion * 60 > horario.cierre) {
        return "La reserva debe terminar dentro del horario de atención.";
    }

    if (new Date(fecha + "T" + hora) <= new Date()) return "La reserva debe ser en una hora futura.";
    if (sala && hayConflicto(sala, fecha, hora, duracion)) return "Esa sala ya está reservada en ese horario.";

    return "";
}

function obtenerMensaje(id) {
    const sala = obtenerSalaSeleccionada();
    const valor = sanitizarTexto($("#" + id).val(), 60);

    if (id === "nombre") {
        if (valor === "") return "Este campo es obligatorio.";
        return PATRON_NOMBRE.test(valor) ? "" : "Usa solo letras, espacios, punto, guion o apóstrofe (3 a 60 caracteres).";
    }

    if (id === "celular") {
        if (valor === "") return "Este campo es obligatorio.";
        return PATRON_CELULAR.test(valor) ? "" : "Ingresa un celular válido de 8 dígitos que empiece con 6 o 7.";
    }

    if (id === "roomSelect") return sala ? "" : "Selecciona una sala.";
    if (id === "fecha") return mensajeFecha(valor);
    if (id === "duracion") return leerDuracion() !== 0 ? "" : "Selecciona una duración válida.";
    if (id === "hora") return mensajeHora(valor, sanitizarTexto($("#fecha").val(), 10), leerDuracion(), sala);

    return "";
}

function validarCampo(id) {
    const mensaje = obtenerMensaje(id);

    mostrarError(id, mensaje);
    return mensaje === "";
}

function revalidarHora() {
    if ($("#hora").val() !== "") validarCampo("hora");
}

function validarReserva() {
    let correcto = true;

    CAMPOS_RESERVA.forEach(function(id) {
        if (!validarCampo(id)) correcto = false;
    });

    if (correcto && reservas.length >= MAX_RESERVAS) {
        mostrarToast("Alcanzaste el máximo de " + MAX_RESERVAS + " reservas guardadas.");
        correcto = false;
    }

    if (!correcto) {
        const primerError = $(".invalid").first();

        if (primerError.length) primerError.trigger("focus");
    }

    return correcto;
}

function crearReservaPendiente() {
    const sala = obtenerSalaSeleccionada();
    const horas = leerDuracion();

    return {
        id: Date.now(),
        nombre: sanitizarTexto($("#nombre").val(), 60),
        celular: sanitizarTexto($("#celular").val(), 8),
        sala: sala.nombre,
        precioHora: sala.precio,
        fecha: sanitizarTexto($("#fecha").val(), 10),
        hora: sanitizarTexto($("#hora").val(), 5),
        duracion: horas,
        total: calcularTotales(sala, horas).total
    };
}

function abrirModal() {
    let segundos = SEGUNDOS_CONFIRMACION;

    $("#confirmTimer").text(segundos);
    $("#confirmModal").css("display", "flex").hide().fadeIn(200);
    $("#confirmBtn").trigger("focus");

    clearInterval(temporizadorConfirmacion);

    temporizadorConfirmacion = setInterval(function() {
        segundos--;
        $("#confirmTimer").text(segundos);

        if (segundos <= 0) {
            cerrarModal();
            reservaPendiente = null;
            mostrarToast("El tiempo para confirmar terminó.");
        }
    }, 1000);
}

function cerrarModal() {
    clearInterval(temporizadorConfirmacion);
    temporizadorConfirmacion = null;
    $("#confirmModal").fadeOut(200);
}

function armarMensajeWhatsApp(reserva) {
    return [
        "Hola, deseo confirmar mi reserva en " + NOMBRE_NEGOCIO + ".",
        "Nombre: " + reserva.nombre,
        "Celular: " + reserva.celular,
        "Sala: " + reserva.sala,
        "Fecha: " + reserva.fecha,
        "Hora: " + reserva.hora,
        "Duración: " + reserva.duracion + " hora(s)",
        "Total: " + Number(reserva.total).toFixed(2) + " Bs"
    ].join("\n");
}

function confirmarReserva() {
    if (!reservaPendiente) return;

    const reserva = reservaPendiente;
    const sala = salas.find(function(item) {
        return item.nombre === reserva.sala;
    });

    if (!sala || hayConflicto(sala, reserva.fecha, reserva.hora, reserva.duracion) || reservas.length >= MAX_RESERVAS) {
        reservaPendiente = null;
        cerrarModal();
        mostrarToast("No se pudo confirmar: el horario ya no está disponible.");
        return;
    }

    reservas.push(reserva);
    window.dispatchEvent(new CustomEvent("nexus:reserva-creada", { detail: reserva }));
    guardarReservas();
    reservaPendiente = null;

    cerrarModal();
    mostrarToast("¡Reserva guardada correctamente!");

    window.open("https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(armarMensajeWhatsApp(reserva)), "_blank", "noopener,noreferrer");

    $("#reserveForm")[0].reset();
    CAMPOS_RESERVA.forEach(function(id) {
        mostrarError(id, "");
    });
    actualizarResumen();
    cambiarPagina("misreservas");
}

function crearLineaReserva(etiqueta, valor) {
    return $("<p>").append($("<strong>").text(etiqueta + ": "), document.createTextNode(valor));
}

function mostrarReservas() {
    const lista = $("#reservasLista").empty();

    if (!reservas.length) {
        lista.append($("<div>", { "class": "panel" }).append($("<p>").text("Todavía no tienes reservas registradas.")));
        return;
    }

    const ordenadas = reservas.slice().sort(function(a, b) {
        return (a.fecha + a.hora).localeCompare(b.fecha + b.hora);
    });

    ordenadas.forEach(function(reserva) {
        lista.append(
            $("<div>", { "class": "reserva-card" }).append(
                $("<h3>").text(reserva.sala),
                crearLineaReserva("Nombre", reserva.nombre),
                crearLineaReserva("Fecha", reserva.fecha),
                crearLineaReserva("Hora", reserva.hora),
                crearLineaReserva("Duración", Number(reserva.duracion) + " hora(s)"),
                crearLineaReserva("Total", Number(reserva.total).toFixed(2) + " Bs"),
                $("<button>", { type: "button", "class": "btn-cancelar-reserva" })
                    .attr("data-id", Number(reserva.id))
                    .text("Cancelar reserva")
            )
        );
    });
}

function cancelarReserva(id) {
    const cancelada = reservas.find(function(reserva) { return Number(reserva.id) === id; });
    reservas = reservas.filter(function(reserva) {
        return Number(reserva.id) !== id;
    });
    if (cancelada) window.dispatchEvent(new CustomEvent("nexus:reserva-cancelada", { detail: cancelada }));

    guardarReservas();
    mostrarReservas();
    mostrarToast("Reserva eliminada.");
}

function mensajePedido(producto) {
    if (producto === "") return "Escribe qué producto o accesorio necesitas.";
    if (!PATRON_PEDIDO.test(producto)) return "Usa entre 2 y 120 caracteres válidos.";
    const existente = carritoPedidos.find(function(item) {
        return item.nombre.toLowerCase() === producto.toLowerCase();
    });
    if (!existente && carritoPedidos.length >= MAX_PEDIDOS) return "Puedes agregar hasta " + MAX_PEDIDOS + " productos diferentes.";
    return "";
}

function agregarPedido(textoDirecto) {
    const desdeCatalogo = typeof textoDirecto === "string";
    const campo = $("#inputPedido");
    const producto = sanitizarTexto(desdeCatalogo ? textoDirecto : campo.val(), 120);
    const mensaje = mensajePedido(producto);

    if (desdeCatalogo) {
        if (mensaje) {
            mostrarToast(mensaje);
            return;
        }
    } else {
        mostrarError("inputPedido", mensaje);
        if (mensaje) {
            campo.trigger("focus");
            return;
        }
    }

    const existente = carritoPedidos.find(function(item) {
        return item.nombre.toLowerCase() === producto.toLowerCase();
    });
    if (existente) existente.cantidad += 1;
    else carritoPedidos.push({ nombre: producto, cantidad: 1 });

    if (!desdeCatalogo) campo.val("").trigger("focus");
    renderizarPedidos();
    mostrarToast("Producto agregado al pedido.");
}

function renderizarPedidos() {
    const lista = $("#listaPedidos").empty();
    const unidades = carritoPedidos.reduce(function(total, item) {
        return total + item.cantidad;
    }, 0);
    $("#contadorPedidos").text(unidades + (unidades === 1 ? " producto" : " productos"));

    if (!carritoPedidos.length) {
        lista.append($("<p>", { "class": "empty-message" }).text("Todavía no agregaste productos."));
        return;
    }

    carritoPedidos.forEach(function(item, indice) {
        lista.append(
            $("<div>", { "class": "pedido-item" }).append(
                $("<div>", { "class": "pedido-item-info" }).append(
                    $("<span>", { "class": "pedido-texto", title: item.nombre }).text(item.nombre),
                    $("<small>").text("Cantidad: " + item.cantidad + " · " + (obtenerPrecioProducto(item.nombre).toFixed(2)) + " Bs c/u · Subtotal: " + (item.cantidad * obtenerPrecioProducto(item.nombre)).toFixed(2) + " Bs")
                ),
                $("<div>", { "class": "pedido-item-actions" }).append(
                    $("<button>", { type: "button", "class": "btn-cantidad-pedido", "data-accion": "menos", "data-indice": indice, "aria-label": "Restar uno" }).text("−"),
                    $("<button>", { type: "button", "class": "btn-cantidad-pedido", "data-accion": "mas", "data-indice": indice, "aria-label": "Agregar uno" }).text("+"),
                    $("<button>", { type: "button", "class": "btn-quitar-pedido", "data-indice": indice, "aria-label": "Quitar producto" }).text("Quitar")
                )
            )
        );
    });
    const precios = JSON.parse(localStorage.getItem("nexusPrecios") || "{}");
    const totalPedido = carritoPedidos.reduce((sum, item) => sum + item.cantidad * Number(precios[item.nombre] || 0), 0);
    lista.append($("<div>", {"class":"pedido-total"}).text("Total estimado: " + totalPedido.toFixed(2) + " Bs"));
}

function validarFormularioPedido() {
    let correcto = true;
    const nombre = sanitizarTexto($("#pedidoNombre").val(), 60);
    const celular = sanitizarTexto($("#pedidoCelular").val(), 8);
    const ubicacion = sanitizarTexto($("#pedidoUbicacion").val(), 60);
    const entrega = $("#pedidoEntrega").val();

    const validaciones = [
        ["pedidoNombre", nombre.length >= 3 && PATRON_NOMBRE.test(nombre) ? "" : "Ingresa tu nombre (3 a 60 caracteres)."],
        ["pedidoCelular", PATRON_CELULAR.test(celular) ? "" : "Ingresa un celular boliviano válido de 8 dígitos (6 o 7 al inicio)."],
        ["pedidoUbicacion", ubicacion.length >= 2 ? "" : "Indica tu sala, PC o mesa."],
        ["pedidoEntrega", entrega ? "" : "Selecciona cómo deseas recibir el pedido."]
    ];

    validaciones.forEach(function(item) {
        mostrarError(item[0], item[1]);
        if (item[1]) correcto = false;
    });

    if (!carritoPedidos.length) {
        mostrarToast("Agrega al menos un producto antes de enviar.");
        correcto = false;
    }

    if (!correcto) {
        const primero = $(".pedido-checkout .invalid").first();
        if (primero.length) primero.trigger("focus");
    }
    return correcto;
}

function enviarPedidoWhatsApp() {
    if (!validarFormularioPedido()) return;

    const nombre = sanitizarTexto($("#pedidoNombre").val(), 60);
    const celular = sanitizarTexto($("#pedidoCelular").val(), 8);
    const ubicacion = sanitizarTexto($("#pedidoUbicacion").val(), 60);
    const entrega = $("#pedidoEntrega").val();
    const notas = sanitizarTexto($("#pedidoNotas").val(), 180);
    const detalle = carritoPedidos.map(function(item) {
        const precio = obtenerPrecioProducto(item.nombre);
        return "• " + item.nombre + " x" + item.cantidad + " — " + (precio * item.cantidad).toFixed(2) + " Bs";
    }).join("\n");

    const preciosPedido = JSON.parse(localStorage.getItem("nexusPrecios") || "{}");
    const totalPedido = carritoPedidos.reduce((sum,item)=>sum + item.cantidad * obtenerPrecioProducto(item.nombre),0);
    const mensaje = [
        "Hola, quiero realizar un pedido en " + NOMBRE_NEGOCIO + ".",
        "",
        "Nombre: " + nombre,
        "Celular: " + celular,
        "Ubicación: " + ubicacion,
        "Entrega: " + entrega,
        "",
        "PRODUCTOS:",
        detalle,
        "TOTAL ESTIMADO: " + totalPedido.toFixed(2) + " Bs",
        notas ? "\nIndicaciones: " + notas : "",
        "",
        "Quedo atento/a a la confirmación. ¡Gracias!"
    ].filter(Boolean).join("\n");

    const url = "https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(mensaje);
    const ventana = window.open(url, "_blank");
    if (!ventana) {
        mostrarToast("Tu navegador bloqueó la ventana. Permite las ventanas emergentes e inténtalo otra vez.");
        return;
    }

    ventana.opener = null;
    carritoPedidos = [];
    $("#pedidoForm")[0].reset();
    ["pedidoNombre", "pedidoCelular", "pedidoUbicacion", "pedidoEntrega"].forEach(function(id) {
        mostrarError(id, "");
    });
    renderizarPedidos();
    mostrarToast("Se abrió WhatsApp con tu pedido listo para enviar.");
}

function actualizarContadorPedidos() {
    renderizarPedidos();
}


function abrirZoom(imagen) {
    const origen = $(imagen);
    $("#lightboxImage").attr({
        src: origen.attr("src"),
        alt: origen.attr("alt") || "Imagen ampliada"
    });
    $("#lightboxCaption").text(origen.attr("alt") || "");
    $("#imageLightbox").addClass("visible").attr("aria-hidden", "false");
    $("body").addClass("lightbox-open");
    $("#closeLightbox").trigger("focus");
}

function cerrarZoom() {
    $("#imageLightbox").removeClass("visible").attr("aria-hidden", "true");
    $("#lightboxImage").attr("src", "");
    $("body").removeClass("lightbox-open");
}

function hidratarZoomImagenes() {
    delegar(document, "click", ".hero-image img, .room-card img, .producto-card img", function() {
        abrirZoom(this);
    });

    hidratar("#closeLightbox", {
        click: cerrarZoom
    });

    hidratar("#imageLightbox", {
        click: function(evento) {
            if (evento.target === this) cerrarZoom();
        }
    });
}

function formatearTiempo(restante) {
    const horas = Math.floor(restante / 3600000);
    const minutos = Math.floor((restante % 3600000) / 60000);
    const segundos = Math.floor((restante % 60000) / 1000);

    return String(horas).padStart(2, "0") + ":" + String(minutos).padStart(2, "0") + ":" + String(segundos).padStart(2, "0");
}

function iniciarTemporizadorPromo() {
    let fin = Number(localStorage.getItem(CLAVE_PROMO));

    if (!Number.isFinite(fin) || fin <= Date.now()) {
        fin = Date.now() + 30 * 60 * 1000;
        localStorage.setItem(CLAVE_PROMO, String(fin));
    }

    function actualizar() {
        const restante = Math.max(0, fin - Date.now());

        $("#promoTimer").text(formatearTiempo(restante));

        if (restante <= 0) {
            $(".promo-info p").text("La promoción ha finalizado.");
            clearInterval(intervaloPromo);
            intervaloPromo = null;
        }
    }

    clearInterval(intervaloPromo);
    actualizar();
    intervaloPromo = setInterval(actualizar, 1000);
}

function actualizarEstadoNegocio() {
    const ahora = new Date();
    const horario = horarioDelDia(formatearFecha(ahora));
    const minutos = ahora.getHours() * 60 + ahora.getMinutes();
    const abierto = minutos >= horario.apertura && minutos < horario.cierre;

    $("#businessStatus")
        .text(abierto ? "● Estamos abiertos" : "● Estamos cerrados")
        .toggleClass("status-open", abierto)
        .toggleClass("status-closed", !abierto);
}

function actualizarEstadoRed() {
    const enLinea = navigator.onLine;

    $("#estadoRed")
        .text(enLinea ? "En línea" : "Sin conexión")
        .toggleClass("offline", !enLinea);
}

function aplicarTema(claro) {
    $("body").toggleClass("light-mode", claro);
    $("#themeBtn").html(claro ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>');
}

function cargarTema() {
    aplicarTema(localStorage.getItem(CLAVE_TEMA) === "claro");
}

function hidratar(selector, eventos) {
    $(selector).each(function() {
        const elemento = $(this);

        if (elemento.attr("data-hidratado") === "true") return;

        $.each(eventos, function(nombres, funcion) {
            const conEspacio = nombres.split(" ").map(function(nombre) {
                return nombre + ".hidratacion";
            }).join(" ");

            elemento.off(conEspacio).on(conEspacio, funcion);
        });

        elemento.attr("data-hidratado", "true");
    });
}

function delegar(contenedor, evento, selector, funcion) {
    $(contenedor)
        .off(evento + ".delegado", selector)
        .on(evento + ".delegado", selector, funcion);
}

function hidratarNavegacion() {
    hidratar(".nav-btn", {
        click: function() {
            cambiarPagina($(this).attr("data-page"));
        }
    });

    hidratar("[data-go]", {
        click: function() {
            cambiarPagina($(this).attr("data-go"));
        }
    });

    hidratar("#menuToggle", {
        click: function() {
            const abierto = $("#navMenu").toggleClass("open").hasClass("open");

            $(this)
                .attr("aria-expanded", String(abierto))
                .attr("aria-label", abierto ? "Cerrar menú" : "Abrir menú")
                .html(abierto ? '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>');
        }
    });

    hidratar("#themeBtn", {
        click: function() {
            const claro = !$("body").hasClass("light-mode");

            localStorage.setItem(CLAVE_TEMA, claro ? "claro" : "oscuro");
            aplicarTema(claro);
        }
    });

    hidratar("#socialToggle", {
        click: function() {
            const visible = $("#socialLinks").stop(true, true).slideToggle(250).is(":visible");

            $(this).attr("aria-expanded", String(visible));
        }
    });
}

function hidratarCatalogo() {
    hidratar("#searchRoom", { input: debounce(mostrarSalas, 180) });
    hidratar("#categoryFilter", { change: mostrarSalas });

    delegar("#roomsGrid", "click", ".btn-reservar-sala", function() {
        seleccionarSala(Number($(this).attr("data-id")));
    });
}

function hidratarFormularioReserva() {
    hidratar("#nombre", {
        "input blur": function() {
            validarCampo("nombre");
        }
    });

    hidratar("#celular", {
        input: function() {
            const soloDigitos = $(this).val().replace(/\D/g, "").slice(0, 8);

            if ($(this).val() !== soloDigitos) $(this).val(soloDigitos);
            validarCampo("celular");
        },
        blur: function() {
            validarCampo("celular");
        }
    });

    hidratar("#roomSelect", {
        change: function() {
            actualizarResumen();
            validarCampo("roomSelect");
            revalidarHora();
        }
    });

    hidratar("#duracion", {
        change: function() {
            actualizarResumen();
            validarCampo("duracion");
            revalidarHora();
        }
    });

    hidratar("#fecha", {
        "input change blur": function() {
            validarCampo("fecha");
            revalidarHora();
        }
    });

    hidratar("#hora", {
        "input change blur": function() {
            validarCampo("hora");
        }
    });

    hidratar("#reserveForm", {
        submit: function(evento) {
            evento.preventDefault();

            if (!validarReserva()) return;

            reservaPendiente = crearReservaPendiente();
            abrirModal();
        }
    });

    delegar("#reservasLista", "click", ".btn-cancelar-reserva", function() {
        cancelarReserva(Number($(this).attr("data-id")));
    });
}

function hidratarModal() {
    hidratar("#confirmBtn", { click: confirmarReserva });

    hidratar("#cancelModal", {
        click: function() {
            cerrarModal();
            reservaPendiente = null;
            mostrarToast("Reserva cancelada.");
        }
    });

    $(document).off("keydown.global").on("keydown.global", function(evento) {
        if (evento.key !== "Escape") return;

        if ($("#confirmModal").is(":visible")) {
            cerrarModal();
            reservaPendiente = null;
            mostrarToast("Reserva cancelada.");
        }

        if ($("#imageLightbox").hasClass("visible")) cerrarZoom();
        cerrarMenu();
    });
}

function hidratarPedidos() {
    hidratar("#btnPedir", {
        click: function() {
            agregarPedido();
        }
    });

    hidratar(".chip", {
        click: function() {
            $(".chip").removeClass("active");
            $(this).addClass("active");
            mostrarProductos($(this).attr("data-cat"));
        }
    });

    delegar("#productosGrid", "click", ".btn-agregar-producto", function() {
        const id = Number($(this).attr("data-id"));
        const producto = productos.find(function(item) {
            return item.id === id;
        });
        if (producto) agregarPedido(producto.nombre);
    });

    hidratar("#inputPedido", {
        keydown: function(evento) {
            if (evento.key === "Enter") {
                evento.preventDefault();
                agregarPedido();
            }
        },
        input: function() {
            if ($("#error-inputPedido").text() !== "") mostrarError("inputPedido", "");
        }
    });

    delegar("#listaPedidos", "click", ".btn-cantidad-pedido, .btn-quitar-pedido", function() {
        const indice = Number($(this).attr("data-indice"));
        if (!Number.isInteger(indice) || !carritoPedidos[indice]) return;
        if ($(this).hasClass("btn-quitar-pedido")) {
            carritoPedidos.splice(indice, 1);
        } else if ($(this).attr("data-accion") === "mas") {
            carritoPedidos[indice].cantidad += 1;
        } else {
            carritoPedidos[indice].cantidad -= 1;
            if (carritoPedidos[indice].cantidad <= 0) carritoPedidos.splice(indice, 1);
        }
        renderizarPedidos();
    });

    hidratar("#pedidoForm", {
        submit: function(evento) {
            evento.preventDefault();
            enviarPedidoWhatsApp();
        }
    });

    hidratar("#pedidoCelular", {
        input: function() {
            const soloDigitos = $(this).val().replace(/\D/g, "").slice(0, 8);
            if ($(this).val() !== soloDigitos) $(this).val(soloDigitos);
            if ($("#error-pedidoCelular").text()) mostrarError("pedidoCelular", "");
        }
    });

    ["pedidoNombre", "pedidoUbicacion", "pedidoEntrega"].forEach(function(id) {
        hidratar("#" + id, {
            "input change": function() {
                if ($("#error-" + id).text()) mostrarError(id, "");
            }
        });
    });
}

function hidratarInterfaz() {
    hidratarNavegacion();
    hidratarCatalogo();
    hidratarFormularioReserva();
    hidratarModal();
    hidratarPedidos();
    hidratarZoomImagenes();

    $(window).off("online.red offline.red").on("online.red offline.red", actualizarEstadoRed);
}

function registrarServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    if (location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") return;

    function registrar() {
        navigator.serviceWorker.register("./sw.js").catch(function(error) {
            console.error("PWA: error al registrar el Service Worker:", error);
        });
    }

    if (document.readyState === "complete") registrar();
    else window.addEventListener("load", registrar);
}

$(function() {
    reservas = leerReservasGuardadas();

    $("#fecha").attr({ min: fechaLocal(0), max: fechaLocal(MAX_DIAS_ANTICIPACION) });

    cargarTema();
    cargarCatalogo();
    cargarProductos();
    mostrarReservas();
    actualizarContadorPedidos();
    iniciarTemporizadorPromo();
    actualizarEstadoNegocio();
    actualizarEstadoRed();
    hidratarInterfaz();

    // Simulación de selección encapsulada: cambia únicamente la tarjeta pulsada.
    $(document).on("click", ".btn-simular", function() {
        const card = this.closest(".card-item"); if (!card) return;
        const active = card.classList.toggle("card-item--activo");
        const state = card.querySelector(".card-item__estado");
        if (state) state.textContent = active ? "Estado: Seleccionado (Simulación)" : "Estado: Disponible";
        this.setAttribute("aria-pressed", String(active));
        this.textContent = active ? "Quitar selección" : "Simular selección";
    });
    $("#btnSimularVista").on("click", function() {
        const grid = $("#productosGrid"); grid.toggleClass("sim-movil");
        this.setAttribute("aria-pressed", String(grid.hasClass("sim-movil")));
    });


    setInterval(actualizarEstadoNegocio, 60000);

    registrarServiceWorker();
});


/* Módulo de roles, autenticación de demostración y paneles administrativos */
(() => {
  'use strict';
  const $ = (s, r=document) => r.querySelector(s);
  const read = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (error) { console.warn('No se pudo guardar en este dispositivo:', k); } };
  const USERS = { cliente:{password:'cliente123',role:'cliente'}, empleado:{password:'empleado123',role:'empleado'}, gerente:{password:'gerente123',role:'gerente'} };
  const DEFAULT_PRICES = {'Hamburguesa':28,'Papas fritas':12,'Pizza':35,'Gaseosa':8,'Energizante':15,'Agua mineral':5,'Mando adicional':10,'Audífonos':15};
  let prices = read('nexusPrecios', DEFAULT_PRICES);
  let orders = read('nexusPedidos', []);
  let audit = read('nexusAuditoria', []);
  let current = read('nexusSesion', null);
  const money = n => `${Number(n||0).toFixed(2)} Bs`;
  const log = action => { audit.unshift({at:new Date().toLocaleString('es-BO'),user:current?.user||'Visitante',role:current?.role||'sin sesión',action}); audit=audit.slice(0,300); write('nexusAuditoria',audit); };
  const tools=document.createElement('div'); tools.className='role-tools'; tools.innerHTML='<button type="button" class="role-btn" id="roleLogin">Iniciar sesión</button><button type="button" class="access-btn" id="contrastToggle" aria-pressed="false">Alto contraste</button><span id="roleLabel" aria-live="polite"></span>';
  const navbar=$('.navbar'); if(navbar) navbar.append(tools);
  const dashboard=document.createElement('section'); dashboard.id='roleDashboard'; dashboard.className='role-panel'; dashboard.hidden=true; const main=$('main'); if(main) main.prepend(dashboard);
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function loginUI(){
    const layer=document.createElement('div');layer.className='login-layer';layer.setAttribute('role','presentation');layer.innerHTML=`<form class="login-box" id="roleForm" role="dialog" aria-modal="true" aria-labelledby="loginTitle" aria-describedby="loginDescription">
      <button class="login-close" type="button" id="loginCancel" aria-label="Cerrar ventana">×</button>
      <div class="login-brand"><div class="login-logo" aria-hidden="true"><i class="fas fa-gamepad"></i></div><div><strong>NEXUS GAMING</strong><small>LOUNGE · ACCESO</small></div></div>
      <span class="login-eyebrow">ACCESO A TU CUENTA</span><h2 id="loginTitle">¡Bienvenido!</h2><p class="login-intro" id="loginDescription">Ingresa tus datos para continuar.</p>
      <label for="roleUser">Usuario</label><input id="roleUser" autocomplete="username" placeholder="Ej. gerente" required>
      <label for="rolePass">Contraseña</label><input id="rolePass" type="password" autocomplete="current-password" placeholder="Tu contraseña" required>
      <p id="loginError" role="alert"></p>
      <div class="login-actions"><button class="login-submit" type="submit"><i class="fas fa-right-to-bracket"></i> Ingresar</button><button class="login-cancel" type="button" id="loginCancelAlt">Cancelar</button></div>
      <details class="login-demo"><summary>Ver cuentas de demostración</summary><p><b>Cliente:</b> cliente / cliente123<br><b>Empleado:</b> empleado / empleado123<br><b>Gerente:</b> gerente / gerente123</p></details>
    </form>`;
    document.body.append(layer); $('#roleUser',layer).focus(); const close=()=>layer.remove(); $('#loginCancel',layer).onclick=close; $('#loginCancelAlt',layer).onclick=close; layer.addEventListener('click',e=>{if(e.target===layer)close();}); document.addEventListener('keydown',function escLogin(e){if(e.key==='Escape'&&document.body.contains(layer)){close();document.removeEventListener('keydown',escLogin);}}); $('#roleForm',layer).onsubmit=e=>{e.preventDefault();const u=$('#roleUser',layer).value.trim(),p=$('#rolePass',layer).value; if(!USERS[u]||USERS[u].password!==p){$('#loginError',layer).textContent='Usuario o contraseña incorrectos. Verifica tus datos.';return;} current={user:u,role:USERS[u].role};write('nexusSesion',current);log('Inicio de sesión');layer.remove();render();cambiarPagina('panelRol');};
  }
  function logout(){log('Cierre de sesión');current=null;localStorage.removeItem('nexusSesion');render();cambiarPagina('inicio');}
  function configurarMenuRol(){
    const nav=$('#navMenu');
    if(!nav)return;
    let roleButton=$('#rolePageButton',nav);
    if(current && current.role!=='cliente'){
      if(!roleButton){roleButton=document.createElement('button');roleButton.type='button';roleButton.id='rolePageButton';roleButton.className='nav-btn';roleButton.addEventListener('click',()=>cambiarPagina('panelRol'));nav.append(roleButton);}
      roleButton.dataset.page='panelRol';
      roleButton.innerHTML=current.role==='gerente'?'<i class="fas fa-sliders-h" aria-hidden="true"></i> Administración':'<i class="fas fa-clipboard-check" aria-hidden="true"></i> Operaciones';
      nav.querySelectorAll('.nav-btn:not(#rolePageButton)').forEach(btn=>btn.hidden=true);
      roleButton.hidden=false;
    }else{
      if(roleButton)roleButton.remove();
      nav.querySelectorAll('.nav-btn').forEach(btn=>btn.hidden=false);
    }
  }
  function render(){
    $('#roleLabel').textContent=current?`Sesión: ${current.user} (${current.role})`:'Modo visitante';
    $('#roleLogin').textContent=current?'Cerrar sesión':'Iniciar sesión';
    configurarMenuRol();
    dashboard.hidden=!current || current.role==='cliente';
    dashboard.classList.add('page');
    dashboard.id='panelRol';
    if(!current || current.role==='cliente'){
      dashboard.classList.remove('active');dashboard.innerHTML='';
      return;
    }
    const isManager=current.role==='gerente';
    const pending=orders.filter(o=>o.status==='Pendiente').length;
    let html='';
    if(!isManager){
      const reservations=read('nexusReservas',[]);
      html=`<span class="manager-kicker">ÁREA DE TRABAJO</span><h2>Panel de empleado</h2>
        <div class="role-grid"><div class="role-card"><strong>Pedidos registrados</strong><h3>${orders.length}</h3></div><div class="role-card"><strong>Pendientes</strong><h3>${pending}</h3></div><div class="role-card"><strong>Reservas registradas</strong><h3>${reservations.length}</h3></div></div>
        <h3>Gestión de pedidos</h3>`;
      if(!orders.length) html+='<p>Aún no hay pedidos registrados.</p>';
      else html+='<div class="role-table-wrap"><table><thead><tr><th>Cliente / ubicación</th><th>Detalle</th><th>Total</th><th>Estado</th></tr></thead><tbody>'+orders.map(o=>`<tr><td>${esc(o.name)}<br>Sala: ${esc(o.sala||o.location)}<br><small>${esc(o.phone)}</small></td><td>${(o.items||[]).map(i=>`${esc(i.name)} × ${i.qty} (${money(i.price||0)} c/u)`).join('<br>')}</td><td>${money(o.total)}</td><td><select class="status-select" data-order="${o.id}" aria-label="Estado del pedido"><option ${o.status==='Pendiente'?'selected':''}>Pendiente</option><option ${o.status==='Preparando'?'selected':''}>Preparando</option><option ${o.status==='Listo'?'selected':''}>Listo</option><option ${o.status==='Entregado'?'selected':''}>Entregado</option><option ${o.status==='Cancelado'?'selected':''}>Cancelado</option></select></td></tr>`).join('')+'</tbody></table></div>';
      html+='<h3>Reservas registradas</h3>';
      html+=reservations.length?'<div class="role-grid">'+reservations.map(r=>`<div class="role-card"><strong>${esc(r.nombre)}</strong><p>${esc(r.sala)} · ${esc(r.fecha)} ${esc(r.hora)}</p><p>${money(r.total)}</p></div>`).join('')+'</div>':'<p>No hay reservas guardadas.</p>';
    }else{
      const roomSettings=read('nexusSalas',{}); const discount=read('nexusDescuento',{horas:3,porcentaje:10});
      html=`<span class="manager-kicker">ACCESO EXCLUSIVO</span><h2>Administración</h2>
      <div class="role-grid"><div class="role-card"><strong>Pedidos registrados</strong><h3>${orders.length}</h3></div><div class="role-card"><strong>Pedidos pendientes</strong><h3>${pending}</h3></div><div class="role-card"><strong>Ventas registradas</strong><h3>${money(orders.filter(o=>o.status!=='Cancelado').reduce((s,o)=>s+Number(o.total||0),0))}</h3></div><div class="role-card"><strong>Acciones en bitácora</strong><h3>${audit.length}</h3></div></div>
      <section class="manager-section manager-admin-section"><div class="section-title-row"><div><span class="manager-kicker">CONFIGURACIÓN DEL NEGOCIO</span><h3><i class="fas fa-tags" aria-hidden="true"></i> Administrar precios</h3><p>Modifica los precios de productos y guarda los cambios.</p></div><span class="manager-section-icon"><i class="fas fa-sliders-h" aria-hidden="true"></i></span></div>
      <section class="manager-admin-block"><div class="price-editor">${Object.entries(prices).map(([name,price])=>`<div class="price-card"><div class="price-card-top"><span class="price-icon"><i class="fas fa-tag" aria-hidden="true"></i></span><span class="price-current">Actual: ${money(price)}</span></div><label for="price-${esc(name).replace(/[^a-z0-9]/gi,'-')}">${esc(name)}</label><div class="price-field"><input id="price-${esc(name).replace(/[^a-z0-9]/gi,'-')}" type="number" min="0" step="0.5" inputmode="decimal" data-price="${esc(name)}" value="${Number(price)}" aria-label="Nuevo precio de ${esc(name)}"><span>Bs</span></div></div>`).join('')}</div><div class="manager-save-row"><span>Los cambios se guardan en este dispositivo.</span><button class="role-btn price-save" id="savePrices"><i class="fas fa-floppy-disk" aria-hidden="true"></i> Guardar precios</button></div></section>
      <section class="manager-admin-block"><div class="section-title-row"><div><h4>Precios y disponibilidad de salas</h4><p>Actualiza el precio por hora y la disponibilidad.</p></div></div><div class="price-editor">${salas.map(r=>{const a=roomSettings[r.id]||{};return `<div class="price-card"><label for="room-price-${r.id}">${esc(r.nombre)}</label><div class="price-field"><input id="room-price-${r.id}" type="number" min="1" step="0.5" data-room-price="${r.id}" value="${Number(a.precio??r.precio)}"><span>Bs/h</span></div><label class="room-toggle"><input type="checkbox" data-room-active="${r.id}" ${a.disponible===false?'':'checked'}> Disponible para reservas</label></div>`}).join('')}</div><div class="manager-save-row"><span>Se aplica a las nuevas reservas.</span><button class="role-btn" id="saveRooms">Guardar salas</button></div></section>
      <section class="manager-admin-block"><div class="section-title-row"><div><h4>Promociones y descuentos</h4><p>Configura el descuento aplicado a las reservas.</p></div></div><div class="price-editor"><div class="price-card"><label for="discountHours">Desde cuántas horas</label><div class="price-field"><input id="discountHours" type="number" min="1" max="24" step="1" value="${Number(discount.horas||3)}"><span>horas</span></div></div><div class="price-card"><label for="discountPercent">Porcentaje de descuento</label><div class="price-field"><input id="discountPercent" type="number" min="0" max="90" step="1" value="${Number(discount.porcentaje||10)}"><span>%</span></div></div></div><div class="manager-save-row"><span>Se aplica automáticamente al calcular reservas.</span><button class="role-btn" id="saveDiscount">Guardar promoción</button></div></section>
      <section class="manager-admin-block audit-section"><div class="section-title-row"><div><h4>Bitácora de actividades</h4><p>Historial de acciones realizadas en NEXUS.</p></div><span class="audit-count">${audit.length} registros</span></div><div class="audit-table-wrap"><table class="audit-table"><thead><tr><th>Fecha y hora</th><th>Usuario</th><th>Rol</th><th>Actividad</th></tr></thead><tbody>${audit.slice(0,100).map(a=>`<tr><td>${esc(a.at)}</td><td><strong>${esc(a.user)}</strong></td><td><span class="role-pill">${esc(a.role)}</span></td><td>${esc(a.action)}</td></tr>`).join('')||'<tr><td colspan="4" class="audit-empty">Todavía no hay actividades registradas.</td></tr>'}</tbody></table></div></section></section>`;
    }
    dashboard.innerHTML=html;
    dashboard.classList.add('active');
    dashboard.querySelectorAll('[data-order]').forEach(sel=>sel.addEventListener('change',()=>{const o=orders.find(x=>String(x.id)===sel.dataset.order);if(o){o.status=sel.value;write('nexusPedidos',orders);log(`Pedido #${o.id}: ${o.status}`);render();}}));
    const save=$('#savePrices',dashboard);if(save)save.onclick=()=>{dashboard.querySelectorAll('[data-price]').forEach(inp=>{prices[inp.dataset.price]=Math.max(0,Number(inp.value)||0);});write('nexusPrecios',prices);log('Actualización de precios');alert('Precios guardados en este dispositivo.');if(typeof mostrarProductos==='function')mostrarProductos('todos');render();};
    const saveRooms=$('#saveRooms',dashboard);if(saveRooms)saveRooms.onclick=()=>{const cfg=read('nexusSalas',{});dashboard.querySelectorAll('[data-room-price]').forEach(inp=>{cfg[inp.dataset.roomPrice]={...(cfg[inp.dataset.roomPrice]||{}),precio:Math.max(1,Number(inp.value)||1)};});dashboard.querySelectorAll('[data-room-active]').forEach(inp=>{cfg[inp.dataset.roomActive]={...(cfg[inp.dataset.roomActive]||{}),disponible:inp.checked};});write('nexusSalas',cfg);log('Actualización de salas');alert('Salas actualizadas.');render();};
    const saveDiscount=$('#saveDiscount',dashboard);if(saveDiscount)saveDiscount.onclick=()=>{const cfg={horas:Math.max(1,Number($('#discountHours',dashboard).value)||1),porcentaje:Math.min(90,Math.max(0,Number($('#discountPercent',dashboard).value)||0))};write('nexusDescuento',cfg);log('Actualización de promociones');alert('Promoción guardada.');configuracionDescuento=cfg;render();};
  }
  $('#roleLogin').addEventListener('click',()=>current?logout():loginUI());
  window.addEventListener('nexus:reserva-creada',e=>{log(`Nueva reserva: ${e.detail.sala} · ${e.detail.fecha} ${e.detail.hora}`);if(current&&current.role!=='cliente')render();});
  window.addEventListener('nexus:reserva-cancelada',e=>{log(`Reserva cancelada: ${e.detail.sala} · ${e.detail.fecha}`);if(current&&current.role!=='cliente')render();});
  $('#contrastToggle').addEventListener('click',e=>{const active=document.body.classList.toggle('high-contrast');e.currentTarget.setAttribute('aria-pressed',String(active));});
  // Guardar una copia del pedido antes de que el formulario abra WhatsApp.
  const checkout=$('#pedidoForm');if(checkout)checkout.addEventListener('submit',()=>{const name=$('#pedidoNombre')?.value.trim()||'Cliente';const phone=$('#pedidoCelular')?.value.trim()||'';const location=$('#pedidoUbicacion')?.value.trim()||'Sin ubicación';const rows=[...document.querySelectorAll('#listaPedidos .pedido-item')];const items=rows.map(row=>{const text=row.querySelector('.pedido-texto')?.textContent||'Producto';const qty=Number((row.querySelector('small')?.textContent||'').replace(/\D/g,''))||1;return {name:text,qty,price:Number(prices[text]||0)};});if(!items.length)return;const total=items.reduce((s,i)=>s+i.qty*i.price,0);const order={id:Date.now(),name,phone,location,sala:location,items,total,status:'Pendiente',createdAt:new Date().toISOString()};orders.unshift(order);write('nexusPedidos',orders);log(`Nuevo pedido #${order.id}`);if(current&&current.role!=='cliente')render();},{capture:true});
  // Mejora de accesibilidad: texto alternativo en imágenes de catálogo y etiquetas de iconos.
  document.querySelectorAll('img:not([alt])').forEach(img=>img.alt=img.closest('figure')?'Imagen ampliada':'Imagen de NEXUS Gaming Lounge');
  document.querySelectorAll('button').forEach(btn=>{if(!btn.getAttribute('aria-label')&&!btn.textContent.trim()&&btn.querySelector('i'))btn.setAttribute('aria-label',btn.title||'Botón de acción');});
  log('Carga de la aplicación');render();if(current&&current.role!=='cliente')cambiarPagina('panelRol');
})();
