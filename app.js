"use strict";

/* =====================================================================
   Pet Garden SPA · NÚCLEO: utilidades, login, menú y navegación
   ===================================================================== */

/* ---------- Utilidades generales ---------- */
const $ = (selector, raiz = document) => raiz.querySelector(selector);
const $$ = (selector, raiz = document) => Array.from(raiz.querySelectorAll(selector));

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
// Siempre se escapa el texto que viene de la base antes de mostrarlo.
const esc = (texto) => String(texto ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);

const dinero = (n) =>
  n === null || n === undefined || n === "" ? "—" : "$" + Number(n).toLocaleString("es-CO");

const limpiarTelefono = (t) => String(t ?? "").replace(/[^\d+]/g, "");
const terminoSeguro = (t) => String(t ?? "").replace(/[,()*%\\"]/g, " ").trim();

function debounce(funcion, espera = 300) {
  let temporizador;
  return (...argumentos) => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => funcion(...argumentos), espera);
  };
}

/* ---------- Fechas (siempre en hora de Bogotá) ---------- */
const ZONA = "America/Bogota";
const hoyISO = () => new Date().toLocaleDateString("en-CA", { timeZone: ZONA }); // AAAA-MM-DD

function sumarDias(fechaISO, dias) {
  const [a, m, d] = fechaISO.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}
const diasEntre = (desde, hasta) =>
  Math.round((Date.parse(hasta + "T00:00:00Z") - Date.parse(desde + "T00:00:00Z")) / 86400000);
const inicioDiaBogota = (fechaISO) => new Date(fechaISO + "T00:00:00-05:00").toISOString();
const bogotaAISO = (valor) => new Date(valor + ":00-05:00").toISOString(); // de <input datetime-local>

const fechaTexto = (f) =>
  f ? new Date(f + "T12:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" }) : "—";
const fechaHoraTexto = (f) =>
  new Date(f).toLocaleString("es-CO", { timeZone: ZONA, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const horaTexto = (f) =>
  new Date(f).toLocaleTimeString("es-CO", { timeZone: ZONA, hour: "numeric", minute: "2-digit" });
const fechaLarga = () =>
  new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: ZONA });

/* ---------- Precios y WhatsApp ---------- */
// El precio sugerido depende de estos tres nombres de servicio. No los renombres.
const COLUMNA_PRECIO = { "Baño": "precio_bano", "Corte": "precio_corte", "Corte y baño": "precio_corte_bano" };
function precioRaza(raza, servicio) {
  const columna = COLUMNA_PRECIO[servicio];
  return raza && columna ? (raza[columna] ?? null) : null;
}

function enlaceWhatsApp(telefono, mensaje) {
  let numero = String(telefono ?? "").replace(/\D/g, "");
  if (numero.length === 10) numero = "57" + numero; // indicativo de Colombia
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}

/* ---------- Avisos y errores ---------- */
let temporizadorAviso;
function aviso(mensaje, esError = false) {
  const caja = $("#aviso");
  caja.textContent = mensaje;
  caja.className = "visible" + (esError ? " error" : "");
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => { caja.className = ""; }, 3800);
}

function mensajeError(error) {
  const texto = (error && error.message) || String(error);
  if (/invalid login credentials/i.test(texto)) return "Correo o contraseña incorrectos.";
  if (/failed to fetch|networkerror|load failed/i.test(texto))
    return "No hay conexión con la base de datos. Revisa tu internet y los datos de config.js.";
  if (/email not confirmed/i.test(texto))
    return "Tu correo aún no está confirmado. Confírmalo en Supabase (Authentication > Users).";
  if (/jwt expired/i.test(texto)) return "Tu sesión venció. Vuelve a iniciar sesión.";
  if (/permission denied|row-level security/i.test(texto))
    return "No tienes permiso para hacer esto. Inicia sesión de nuevo.";
  if (/duplicate key|unique constraint/i.test(texto))
    return "Ya existe un registro con ese dato (por ejemplo, otro cliente con ese teléfono o una raza repetida).";
  if (/foreign key/i.test(texto)) return "No se puede completar: este dato está en uso en otro lugar.";
  return texto;
}

function mostrarError(caja, error) {
  if (caja) caja.innerHTML = `<p class="mal">✖ ${esc(mensajeError(error))}</p>`;
}

/* ---------- Conexión con Supabase ---------- */
const configurado =
  typeof SUPABASE_URL === "string" && typeof SUPABASE_ANON_KEY === "string" &&
  !SUPABASE_URL.includes("PEGA_AQUI") && !SUPABASE_ANON_KEY.includes("PEGA_AQUI");

const db = configurado && typeof supabase !== "undefined"
  ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// Ejecuta una consulta y devuelve los datos (o lanza el error).
async function q(consulta) {
  const { data, error } = await consulta;
  if (error) throw error;
  return data;
}
// Ejecuta una consulta de conteo y devuelve el número.
async function contar(consulta) {
  const { count, error } = await consulta;
  if (error) throw error;
  return count ?? 0;
}

/* ---------- Cuadro de diálogo (ventana emergente) ---------- */
function abrirDialogo(html) {
  let dialogo = $("#dialogo");
  if (!dialogo) {
    dialogo = document.createElement("dialog");
    dialogo.id = "dialogo";
    document.body.appendChild(dialogo);
  }
  dialogo.innerHTML = html;
  if (!dialogo.open) dialogo.showModal();
  return dialogo;
}
function cerrarDialogo() {
  const dialogo = $("#dialogo");
  if (dialogo && dialogo.open) dialogo.close();
}

/* ---------- Estado, menú y pantallas ---------- */
const estado = { sesion: null, usuarioId: null, busqueda: "", agendarPrefill: null };

const MENU = [
  { clave: "hoy", titulo: "Hoy", publica: false },
  { clave: "agendar", titulo: "Agendar", publica: false },
  { clave: "agenda", titulo: "Agenda", publica: false },
  { clave: "clientes", titulo: "Clientes y mascotas", publica: false },
  { clave: "catalogos", titulo: "Configuración", publica: false },
  { clave: "videos", titulo: "Videos", publica: true }, // se ve sin iniciar sesión
];

// Cada archivo de pantalla agrega la suya aquí: PANTALLAS.hoy = { html, despues }
const PANTALLAS = {};

function claveActual() {
  const hash = location.hash.replace(/^#\/?/, "");
  return MENU.some((m) => m.clave === hash) ? hash : "hoy";
}

/* ---------- Estructuras de página ---------- */
function htmlConfiguracion() {
  return `<main class="login"><div class="tarjeta">
    <h1>Falta un paso</h1>
    <p>Abre el archivo <strong>config.js</strong> y pega tu URL y tu clave pública de Supabase
    (Project Settings &gt; API). Después guarda el archivo y recarga esta página.</p>
    <p class="suave">Si ya lo hiciste y ves este mensaje, revisa tu internet: la librería de Supabase no se pudo cargar.</p>
  </div></main>`;
}

function htmlLogin() {
  return `<main class="login"><form id="form-login" class="tarjeta">
    <h1> Pet Garden SPA</h1>
    <p class="suave">Entra para ver tu panel.</p>
    <label for="correo">Correo</label>
    <input id="correo" type="email" autocomplete="username" required>
    <label for="clave">Contraseña</label>
    <input id="clave" type="password" autocomplete="current-password" required>
    <p id="error-login" class="error" role="alert"></p>
    <button class="btn grande" type="submit">Entrar</button>
    <p class="suave"><a href="#/videos">Ver videos de productos</a></p>
  </form></main>`;
}

function htmlPublico() {
  return `<div class="publico">
    <header class="cabecera"><span class="logo">Pet Garden SPA</span>
      <a class="btn alt" href="#/hoy">Entrar al panel</a></header>
    <main class="contenido"><section id="pantalla" tabindex="-1"></section></main>
  </div>`;
}

function htmlPanel(clave) {
  const enlaces = MENU.map((m) =>
    `<a href="#/${m.clave}"${m.clave === clave ? ' aria-current="page"' : ""}>${esc(m.titulo)}</a>`).join("");
  return `<div class="app">
    <aside class="lateral">
      <div class="logo">Pet Garden SPA</div>
      <nav aria-label="Secciones">${enlaces}</nav>
      <div class="pie">
        <span class="suave">${esc(estado.sesion.user.email)}</span>
        <button id="salir" class="btn alt">Cerrar sesión</button>
      </div>
    </aside>
    <div class="principal">
      <div class="barra">
        <input id="buscador" type="search" placeholder="Buscar mascota, dueño o teléfono… (Enter)" aria-label="Búsqueda general">
        <span class="suave">${esc(fechaLarga())}</span>
      </div>
      <section id="pantalla" tabindex="-1"></section>
    </div>
  </div>`;
}

/* ---------- Dibujar la página ---------- */
function montarPantalla(clave) {
  const pantalla = PANTALLAS[clave];
  $("#pantalla").innerHTML = pantalla.html();
  if (pantalla.despues) {
    Promise.resolve(pantalla.despues()).catch((error) => {
      const caja = $("#pantalla");
      if (caja) caja.insertAdjacentHTML("beforeend", `<p class="mal">✖ ${esc(mensajeError(error))}</p>`);
    });
  }
}

function montarLogin() {
  const formulario = $("#form-login");
  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const boton = $("button[type=submit]", formulario);
    const caja = $("#error-login");
    caja.textContent = "";
    boton.disabled = true;
    boton.textContent = "Entrando…";
    try {
      const { error } = await db.auth.signInWithPassword({
        email: $("#correo").value.trim(),
        password: $("#clave").value,
      });
      if (error) throw error;
      // Si todo sale bien, onAuthStateChange vuelve a dibujar la página.
    } catch (error) {
      caja.textContent = mensajeError(error);
      boton.disabled = false;
      boton.textContent = "Entrar";
    }
  });
  $("#correo").focus();
}

function montarPanel() {
  $("#salir").addEventListener("click", async () => {
    await db.auth.signOut();
    location.hash = "#/hoy";
  });
  $("#buscador").addEventListener("keydown", (evento) => {
    if (evento.key !== "Enter") return;
    estado.busqueda = evento.target.value.trim();
    if (claveActual() === "clientes") montarPantalla("clientes");
    else location.hash = "#/clientes";
  });
}

function pintar() {
  cerrarDialogo();
  const raiz = $("#raiz");
  if (!configurado || !db) {
    raiz.innerHTML = htmlConfiguracion();
    return;
  }
  const clave = claveActual();
  const meta = MENU.find((m) => m.clave === clave);

  if (!estado.sesion) {
    if (meta.publica) {
      raiz.innerHTML = htmlPublico();
      montarPantalla(clave);
    } else {
      raiz.innerHTML = htmlLogin();
      montarLogin();
    }
    return;
  }
  raiz.innerHTML = htmlPanel(clave);
  montarPanel();
  montarPantalla(clave);
}

/* ---------- Arranque (se llama desde index.html al final) ---------- */
async function iniciar() {
  if (configurado && db) {
    try {
      const { data } = await db.auth.getSession();
      estado.sesion = data.session;
      estado.usuarioId = data.session ? data.session.user.id : null;
    } catch (error) {
      aviso(mensajeError(error), true);
    }
    db.auth.onAuthStateChange((_evento, sesion) => {
      const nuevoId = sesion ? sesion.user.id : null;
      estado.sesion = sesion;
      // Solo se vuelve a dibujar si entró o salió alguien (no al renovar el token).
      if (nuevoId !== estado.usuarioId) {
        estado.usuarioId = nuevoId;
        setTimeout(pintar, 0);
      }
    });
  }
  window.addEventListener("hashchange", pintar);
  pintar();
}