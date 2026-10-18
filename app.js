"use strict";

/* =====================================================================
   Pet Garden · NÚCLEO: utilidades, login, menú y navegación
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

// Filtro para buscar por mascota, dueño o CUALQUIERA de los dos teléfonos.
function filtroBusqueda(termino) {
  const t = terminoSeguro(termino);
  const digitos = limpiarTelefono(t);
  const tel = digitos.length >= 3 ? digitos : t;
  return `mascota.ilike.*${t}*,cliente.ilike.*${t}*,telefono.ilike.*${tel}*,telefono2.ilike.*${tel}*`;
}

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
const bogotaAISO = (valor) => new Date(valor + ":00-05:00").toISOString(); // "AAAA-MM-DDTHH:MM"

const diaDe = (f) => new Date(f).toLocaleDateString("en-CA", { timeZone: ZONA });
const horaDe = (f) =>
  new Date(f).toLocaleTimeString("en-GB", { timeZone: ZONA, hour: "2-digit", minute: "2-digit" });
const diaTexto = (fechaISO) =>
  new Date(fechaISO + "T12:00:00").toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
const fechaTexto = (f) =>
  f ? new Date(f + "T12:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" }) : "—";
const fechaHoraTexto = (f) =>
  new Date(f).toLocaleString("es-CO", { timeZone: ZONA, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const horaTexto = (f) =>
  new Date(f).toLocaleTimeString("es-CO", { timeZone: ZONA, hour: "numeric", minute: "2-digit" });
const fechaLarga = () =>
  new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: ZONA });

// Lista de horas cada 30 minutos (7:00 a. m. a 8:00 p. m.) para elegir sin escribir.
function opcionesHora(seleccionada = "10:00") {
  const horas = [];
  for (let h = 7; h <= 20; h++) {
    for (const m of ["00", "30"]) {
      if (h === 20 && m === "30") continue;
      horas.push(`${String(h).padStart(2, "0")}:${m}`);
    }
  }
  if (seleccionada && !horas.includes(seleccionada)) {
    horas.push(seleccionada);
    horas.sort();
  }
  return horas.map((v) => {
    const [h, m] = v.split(":").map(Number);
    return `<option value="${v}"${v === seleccionada ? " selected" : ""}>${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "a. m." : "p. m."}</option>`;
  }).join("");
}

/* ---------- Precios, baño medicado y WhatsApp ---------- */
// El precio sugerido depende de estos tres nombres de servicio. No los renombres.
const COLUMNA_PRECIO = { "Baño": "precio_bano", "Corte": "precio_corte", "Corte y baño": "precio_corte_bano" };
const SERVICIOS_CON_BANO = ["Baño", "Corte y baño"]; // los únicos que pueden ser medicados
function precioRaza(raza, servicio) {
  const columna = COLUMNA_PRECIO[servicio];
  return raza && columna ? (raza[columna] ?? null) : null;
}

// Casilla "baño medicado" con su recargo (+$8.000 / +$16.000 según el tamaño).
function htmlMedicado(p, medicado = false, recargo = "") {
  return `<div class="medicado" id="${p}-bloque">
    <label class="casilla"><input type="checkbox" id="${p}-medicado"${medicado ? " checked" : ""}> Baño medicado (otro champú)</label>
    <div id="${p}-recargo-caja"${medicado ? "" : " hidden"}>
      <label for="${p}-recargo">Recargo por champú medicado</label>
      <div class="fila-recargo">
        <input id="${p}-recargo" type="number" min="0" step="any" value="${esc(recargo)}">
        <button type="button" class="chip" data-recargo="${p}" data-valor="8000">+$8.000</button>
        <button type="button" class="chip" data-recargo="${p}" data-valor="16000">+$16.000</button>
      </div>
      <p class="suave">Según el tamaño del perro. Se suma al precio.</p>
    </div></div>`;
}

// Conecta la casilla con el campo de precio: al marcarla suma el recargo y al
// desmarcarla lo resta. Devuelve { fijar(n) } para avisar cuánto recargo ya incluye el precio.
function conectarMedicado(p, idPrecio, alCambiar) {
  const casilla = $(`#${p}-medicado`), recargo = $(`#${p}-recargo`), precio = $(idPrecio);
  let aplicado = casilla.checked ? (Number(recargo.value) || 0) : 0;
  const ajustar = () => {
    const nuevo = casilla.checked ? (Number(recargo.value) || 0) : 0;
    if (precio && precio.value !== "") precio.value = Math.max(0, Number(precio.value) - aplicado + nuevo);
    aplicado = nuevo;
    $(`#${p}-recargo-caja`).hidden = !casilla.checked;
    if (alCambiar) alCambiar();
  };
  casilla.addEventListener("change", ajustar);
  recargo.addEventListener("input", ajustar);
  $$(`[data-recargo="${p}"]`).forEach((b) => b.addEventListener("click", () => {
    recargo.value = b.dataset.valor;
    casilla.checked = true;
    ajustar();
  }));
  return { fijar: (n) => { aplicado = n; } };
}

function enlaceWhatsApp(telefono, mensaje) {
  let numero = String(telefono ?? "").replace(/\D/g, "");
  if (numero.length === 10) numero = "57" + numero; // indicativo de Colombia
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}

/* ---------- Avisos y errores ---------- */
let temporizadorAviso;
// accion (opcional): { texto: "Deshacer", alHacer: () => … } muestra un botón dentro del aviso.
function aviso(mensaje, esError = false, accion = null) {
  const caja = $("#aviso");
  caja.textContent = mensaje;
  caja.className = "visible" + (esError ? " error" : "") + (accion ? " con-accion" : "");
  if (accion) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.textContent = accion.texto;
    boton.addEventListener("click", () => { caja.className = ""; accion.alHacer(); });
    caja.append(" ", boton);
  }
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => { caja.className = ""; }, accion ? 7000 : 3800);
}

function mensajeError(error) {
  const texto = (error && error.message) || String(error);
  if (/invalid login credentials/i.test(texto)) return "Correo o contraseña incorrectos.";
  if (/rate limit|too many requests|security purposes/i.test(texto))
    return "Se enviaron demasiados correos seguidos. Espera unos minutos e intenta de nuevo.";
  if (/should be different from the old password/i.test(texto))
    return "La nueva contraseña debe ser diferente a la anterior.";
  if (/password should be at least/i.test(texto)) return "La contraseña debe tener al menos 6 caracteres.";
  if (/does not exist|could not find the table|schema cache|column .* not found/i.test(texto))
    return "Falta actualizar la base de datos: ejecuta en Supabase el SQL de esta versión.";
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

const configurado =
  typeof SUPABASE_URL === "string" && typeof SUPABASE_ANON_KEY === "string" &&
  typeof NOMBRE_NEGOCIO === "string" &&
  !SUPABASE_URL.includes("PEGA_AQUI") && !SUPABASE_ANON_KEY.includes("PEGA_AQUI");

// ¿Se abrió la página desde el enlace del correo "recuperar contraseña"?
// Se revisa ANTES de crear el cliente de Supabase, que es quien lee y limpia ese enlace.
const RECUPERACION = (() => {
  const h = location.hash;
  if (/type=recovery/.test(h)) return { modo: "nueva" };
  if (/error_code=|error_description=/.test(h)) {
    return {
      modo: "error",
      texto: /otp_expired|expired/i.test(h)
        ? "El enlace para cambiar la contraseña venció o ya se usó. Pide uno nuevo."
        : "El enlace para cambiar la contraseña no es válido. Pide uno nuevo.",
    };
  }
  return null;
})();

const db = configurado && typeof supabase !== "undefined"
  ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

/* ---------- Tablas con orden y filtro por columna ---------- */
const sinTildes = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const ESTADO_TABLAS = {}; // recuerda orden y filtros de cada tabla mientras la página esté abierta

function comparar(a, b) {
  const vacioA = a === null || a === undefined || a === "", vacioB = b === null || b === undefined || b === "";
  if (vacioA || vacioB) return vacioA === vacioB ? 0 : vacioA ? 1 : -1; // los vacíos siempre al final
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "es", { sensitivity: "base", numeric: true });
}

/* columnas: [{ titulo, valor: (fila) => lo que se ordena,
                texto: (fila) => lo que se filtra (si no, se usa valor),
                filtro: "texto" | "lista" | false, ordenable: true|false, clase }]
   fila: (fila) => "<tr>…</tr>"     alPintar: (tbody, filasVisibles) => conectar botones */
function tablaInteractiva(caja, { id, columnas, filas, fila, alPintar, vacio = "No hay datos para mostrar." }) {
  const st = ESTADO_TABLAS[id] || (ESTADO_TABLAS[id] = { orden: null, dir: 1, filtros: {} });
  const textoDe = (c, r) => sinTildes(c.texto ? c.texto(r) : c.valor ? c.valor(r) : "");
  const opciones = (c) => [...new Map(filas.map((r) => {
    const original = String((c.texto ? c.texto(r) : c.valor(r)) ?? "").trim();
    return [sinTildes(original), original];
  }).filter(([clave]) => clave)).entries()].sort((a, b) => comparar(a[1], b[1]));
  // Si un filtro de lista quedó con un valor que ya no existe (por ejemplo, se borró la fila), se limpia.
  columnas.forEach((c, i) => {
    if (c.filtro === "lista" && st.filtros[i] && !opciones(c).some(([clave]) => clave === st.filtros[i])) delete st.filtros[i];
  });

  caja.innerHTML = `<div class="tabla-scroll"><table class="interactiva">
    <thead><tr>${columnas.map((c, i) => `<th${c.clase ? ` class="${c.clase}"` : ""}>${c.ordenable === false
      ? esc(c.titulo)
      : `<button type="button" class="orden" data-col="${i}" title="Ordenar por ${esc(c.titulo)}">${esc(c.titulo)} <span class="flecha-orden" aria-hidden="true"></span></button>`}</th>`).join("")}</tr>
    <tr class="fila-filtros">${columnas.map((c, i) => `<th>${c.filtro === "lista"
      ? `<select data-filtro-col="${i}" aria-label="Filtrar ${esc(c.titulo)}"><option value="">Todos</option>${opciones(c).map(([clave, original]) =>
          `<option value="${esc(clave)}"${st.filtros[i] === clave ? " selected" : ""}>${esc(original)}</option>`).join("")}</select>`
      : c.filtro === "texto"
        ? `<input type="search" data-filtro-col="${i}" value="${esc(st.filtros[i] ?? "")}" placeholder="Filtrar…" aria-label="Filtrar ${esc(c.titulo)}">`
        : ""}</th>`).join("")}</tr></thead>
    <tbody></tbody></table></div>
    <p class="suave conteo" aria-live="polite"></p>`;

  const tbody = $("tbody", caja), conteo = $(".conteo", caja);
  function pintarCuerpo() {
    let lista = filas.filter((r) => columnas.every((c, i) => {
      const f = st.filtros[i];
      if (!f) return true;
      return c.filtro === "lista" ? textoDe(c, r) === f : textoDe(c, r).includes(sinTildes(f));
    }));
    if (st.orden !== null && columnas[st.orden]) {
      const c = columnas[st.orden];
      lista = lista.slice().sort((a, b) => comparar(c.valor(a), c.valor(b)) * st.dir);
    }
    tbody.innerHTML = lista.length ? lista.map(fila).join("")
      : `<tr><td colspan="${columnas.length}" class="suave">${esc(vacio)}</td></tr>`;
    conteo.textContent = lista.length === filas.length
      ? `${filas.length} ${filas.length === 1 ? "registro" : "registros"}`
      : `Mostrando ${lista.length} de ${filas.length} registros`;
    $$("button.orden", caja).forEach((b) => {
      const activa = Number(b.dataset.col) === st.orden;
      b.closest("th").setAttribute("aria-sort", activa ? (st.dir === 1 ? "ascending" : "descending") : "none");
      $(".flecha-orden", b).textContent = activa ? (st.dir === 1 ? "▲" : "▼") : "↕";
    });
    if (alPintar) alPintar(tbody, lista);
  }
  $$("button.orden", caja).forEach((b) => b.addEventListener("click", () => {
    const col = Number(b.dataset.col);
    if (st.orden !== col) { st.orden = col; st.dir = 1; }
    else if (st.dir === 1) st.dir = -1;
    else st.orden = null; // tercer clic: sin orden
    pintarCuerpo();
  }));
  $$("[data-filtro-col]", caja).forEach((entrada) => entrada.addEventListener("input", () => {
    st.filtros[Number(entrada.dataset.filtroCol)] = entrada.value;
    pintarCuerpo();
  }));
  pintarCuerpo();
}

// Trae TODAS las filas de una consulta (Supabase entrega máximo 1.000 por vez).
async function traerTodo(crearConsulta) {
  const tam = 1000;
  let desde = 0, todo = [];
  for (;;) {
    const filas = await q(crearConsulta().range(desde, desde + tam - 1));
    todo = todo.concat(filas);
    if (filas.length < tam) return todo;
    desde += tam;
  }
}

// Carga un script externo solo cuando se necesita (por ejemplo, la librería de Excel).
const scriptsCargados = {};
function cargarScript(url) {
  if (!scriptsCargados[url]) {
    scriptsCargados[url] = new Promise((resolver, rechazar) => {
      const s = document.createElement("script");
      s.src = url;
      s.onload = resolver;
      s.onerror = () => { delete scriptsCargados[url]; rechazar(new Error("No se pudo descargar la librería. Revisa tu internet.")); };
      document.head.appendChild(s);
    });
  }
  return scriptsCargados[url];
}

/* ---------- WhatsApp: avisar que ya puede recoger la mascota ---------- */
function mensajeRecoger(cliente, mascota) {
  return `¡Hola, ${cliente}! 💚

${mascota} ya está listo y súper consentido 🐾✨

Ya puedes pasar a recogerlo en ${NOMBRE_NEGOCIO}. ¡Te esperamos! 🛁🌿`;
}

function abrirAvisoRecoger(cita) {
  const telefono = cita.telefono || cita.telefono2;
  abrirDialogo(`<div>
    <h2>✔ Servicio terminado</h2>
    <p><strong>${esc(cita.mascota)}</strong> quedó registrado en el historial.</p>
    ${telefono
      ? `<p class="suave">¿Le avisas a ${esc(cita.cliente)} que ya puede recogerlo?</p>`
      : '<p class="suave">Este cliente no tiene teléfono guardado.</p>'}
    <div class="acciones">
      <button type="button" class="btn alt" id="r-cerrar">Cerrar</button>
      ${telefono ? '<button type="button" class="btn" id="r-whatsapp">📲 Avisar por WhatsApp</button>' : ""}
    </div></div>`);
  $("#r-cerrar").addEventListener("click", () => cerrarDialogo());
  const boton = $("#r-whatsapp");
  if (boton) boton.addEventListener("click", () => {
    window.open(enlaceWhatsApp(telefono, mensajeRecoger(cita.cliente, cita.mascota)), "_blank", "noopener");
    cerrarDialogo();
  });
}

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

/* ---------- Cuadros de diálogo (ventanas emergentes) ---------- */
function abrirDialogo(html, id = "dialogo") {
  let dialogo = document.getElementById(id);
  if (!dialogo) {
    dialogo = document.createElement("dialog");
    dialogo.id = id;
    document.body.appendChild(dialogo);
  }
  dialogo.innerHTML = html;
  if (!dialogo.open) dialogo.showModal();
  return dialogo;
}
function cerrarDialogo(id = "dialogo") {
  const dialogo = document.getElementById(id);
  if (dialogo && dialogo.open) dialogo.close();
}

/* ---------- Estado, logo, usuario, menú y pantallas ---------- */
const estado = { sesion: null, usuarioId: null, busqueda: "", agendarPrefill: null, logoUrl: null, recuperacion: RECUPERACION };

// El logo vive en Supabase Storage (bucket público "logo"). Se usa el más reciente.
async function cargarLogo() {
  try {
    const { data, error } = await db.storage.from("logo")
      .list("", { limit: 10, sortBy: { column: "created_at", order: "desc" } });
    const archivo = !error && data ? data.find((f) => /^logo-/.test(f.name)) : null;
    estado.logoUrl = archivo ? db.storage.from("logo").getPublicUrl(archivo.name).data.publicUrl : null;
  } catch (error) {
    estado.logoUrl = null;
  }
}
const htmlLogo = (clase) => estado.logoUrl
  ? `<img class="${clase}" src="${esc(estado.logoUrl)}" alt="Logo de ${esc(NOMBRE_NEGOCIO)}">`
  : `<span class="${clase} sin-logo" aria-hidden="true">🐾</span>`;

function nombreUsuario() {
  const u = estado.sesion && estado.sesion.user;
  const meta = (u && u.user_metadata) || {};
  return meta.nombre || meta.full_name || meta.name || "";
}

function pedirNombre() {
  abrirDialogo(`<form id="form-nombre">
    <h2>¿Cómo te llamas?</h2>
    <p class="suave">Este nombre aparece en la parte de abajo del menú.</p>
    <label for="n-nombre">Nombre</label>
    <input id="n-nombre" value="${esc(nombreUsuario())}" maxlength="60" required>
    <p id="n-error" class="error" role="alert"></p>
    <div class="acciones">
      <button type="button" class="btn alt" id="n-volver">Volver</button>
      <button type="submit" class="btn">Guardar</button>
    </div></form>`);
  $("#n-volver").addEventListener("click", () => cerrarDialogo());
  $("#form-nombre").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    try {
      const { data, error } = await db.auth.updateUser({ data: { nombre: $("#n-nombre").value.trim() } });
      if (error) throw error;
      estado.sesion = { ...estado.sesion, user: data.user };
      cerrarDialogo();
      pintar();
    } catch (error) {
      $("#n-error").textContent = mensajeError(error);
    }
  });
}

const MENU = [
  { clave: "hoy", titulo: "Hoy", publica: false },
  { clave: "agendar", titulo: "Agendar", publica: false },
  { clave: "agenda", titulo: "Agenda", publica: false },
  { clave: "clientes", titulo: "Clientes y mascotas", publica: false },
  { clave: "reportes", titulo: "Reportes", publica: false },
  { clave: "catalogos", titulo: "Catálogos", publica: false },
  { clave: "videos", titulo: "Videos", publica: true }, // se ve sin iniciar sesión
];

// Cada archivo de pantalla agrega la suya aquí: PANTALLAS.hoy = { html, despues }
const PANTALLAS = {};

function claveActual() {
  const hash = location.hash.replace(/^#\/?/, "");
  return MENU.some((m) => m.clave === hash) ? hash : "hoy";
}

function htmlConfiguracion() {
  return `<main class="login"><div class="tarjeta">
    <h1>Falta un paso</h1>
    <p>Abre el archivo <strong>config.js</strong> y revisa que tenga tres datos: la URL de Supabase,
    tu clave pública y el nombre de tu negocio (<strong>NOMBRE_NEGOCIO</strong>). Después guarda el archivo y recarga esta página.</p>
    <p class="suave">Si ya lo hiciste y ves este mensaje, revisa tu internet: la librería de Supabase no se pudo cargar.</p>
  </div></main>`;
}

function htmlLogin() {
  return `<main class="acceso">
    <div class="acceso-caja">
      <section class="acceso-marca">
        <div class="acceso-logo">${htmlLogo("logo-login")}</div>
        <h1>${esc(NOMBRE_NEGOCIO)}</h1>
        <p>Panel de administración</p>
      </section>
      <section class="acceso-form">
        <form id="form-login">
          <h2>Bienvenida</h2>
          <p class="suave">Entra para ver tu panel.</p>
          <label for="correo">Correo</label>
          <input id="correo" type="email" autocomplete="username" required>
          <label for="clave">Contraseña</label>
          <input id="clave" type="password" autocomplete="current-password" required>
          <p id="error-login" class="error" role="alert"></p>
          <button class="btn grande" type="submit">Entrar</button>
          <p class="suave centrado"><button type="button" class="enlace pequeno" id="olvide">¿Olvidaste tu contraseña?</button></p>
          <p class="suave centrado"><a href="#/videos">Ver videos de productos</a></p>
        </form>
      </section>
    </div>
  </main>`;
}

// Pantalla para escribir la contraseña nueva (se llega desde el enlace del correo).
function htmlNuevaClave() {
  return `<main class="acceso">
    <div class="acceso-caja">
      <section class="acceso-marca">
        <div class="acceso-logo">${htmlLogo("logo-login")}</div>
        <h1>${esc(NOMBRE_NEGOCIO)}</h1>
        <p>Crea tu nueva contraseña</p>
      </section>
      <section class="acceso-form">
        <form id="form-clave">
          <h2>Nueva contraseña</h2>
          <p class="suave">Escríbela dos veces. Debe tener al menos 6 caracteres.</p>
          <label for="nueva-clave">Nueva contraseña</label>
          <input id="nueva-clave" type="password" autocomplete="new-password" minlength="6" required>
          <label for="nueva-clave2">Repite la contraseña</label>
          <input id="nueva-clave2" type="password" autocomplete="new-password" minlength="6" required>
          <label class="casilla"><input type="checkbox" id="ver-clave"> Mostrar contraseña</label>
          <p id="error-clave" class="error" role="alert"></p>
          <button class="btn grande" type="submit">Guardar contraseña</button>
          <p class="suave centrado"><button type="button" class="enlace pequeno" id="cancelar-clave">Cancelar</button></p>
        </form>
      </section>
    </div>
  </main>`;
}

function montarNuevaClave() {
  const formulario = $("#form-clave");
  $("#ver-clave").addEventListener("change", (e) => {
    $("#nueva-clave").type = $("#nueva-clave2").type = e.target.checked ? "text" : "password";
  });
  $("#cancelar-clave").addEventListener("click", async () => {
    estado.recuperacion = null;
    await db.auth.signOut();
    pintar();
  });
  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const caja = $("#error-clave"), boton = $("button[type=submit]", formulario);
    const clave = $("#nueva-clave").value, repetida = $("#nueva-clave2").value;
    caja.textContent = "";
    if (clave.length < 6) { caja.textContent = "La contraseña debe tener al menos 6 caracteres."; return; }
    if (clave !== repetida) { caja.textContent = "Las dos contraseñas no son iguales."; return; }
    boton.disabled = true;
    boton.textContent = "Guardando…";
    try {
      const { error } = await db.auth.updateUser({ password: clave });
      if (error) throw error;
      estado.recuperacion = null;
      history.replaceState(null, "", location.pathname + location.search + "#/hoy");
      pintar();
      aviso("¡Listo! Tu contraseña quedó actualizada.");
    } catch (error) {
      caja.textContent = mensajeError(error);
      boton.disabled = false;
      boton.textContent = "Guardar contraseña";
    }
  });
  $("#nueva-clave").focus();
}

// Ventana "¿Olvidaste tu contraseña?": envía el correo con el enlace.
function pedirRecuperacion() {
  abrirDialogo(`<form id="form-olvide">
    <h2>Recuperar contraseña</h2>
    <p class="suave">Escribe tu correo. Te enviaremos un enlace para crear una contraseña nueva.</p>
    <label for="o-correo">Correo</label>
    <input id="o-correo" type="email" autocomplete="username" value="${esc($("#correo") ? $("#correo").value.trim() : "")}" required>
    <p id="o-mensaje" class="error" role="alert"></p>
    <div class="acciones">
      <button type="button" class="btn alt" id="o-volver">Volver</button>
      <button type="submit" class="btn">Enviar enlace</button>
    </div></form>`);
  $("#o-volver").addEventListener("click", () => cerrarDialogo());
  $("#form-olvide").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const caja = $("#o-mensaje"), boton = $("button[type=submit]", evento.target);
    caja.className = "error";
    caja.textContent = "";
    boton.disabled = true;
    boton.textContent = "Enviando…";
    try {
      const { error } = await db.auth.resetPasswordForEmail($("#o-correo").value.trim(), {
        redirectTo: location.origin + location.pathname,
      });
      if (error) throw error;
      caja.className = "bien";
      caja.textContent = "Si el correo está registrado, te llegará un enlace en unos minutos. Revisa también la carpeta de spam.";
      boton.textContent = "Enviado";
    } catch (error) {
      caja.textContent = mensajeError(error);
      boton.disabled = false;
      boton.textContent = "Enviar enlace";
    }
  });
  $("#o-correo").focus();
}

function htmlPublico() {
  return `<div class="publico">
    <header class="cabecera"><span class="marca-lateral">${htmlLogo("logo-menu")}<span>${esc(NOMBRE_NEGOCIO)}</span></span>
      <a class="btn alt" href="#/hoy">Entrar al panel</a></header>
    <main class="contenido"><section id="pantalla" tabindex="-1"></section></main>
  </div>`;
}

function htmlPanel(clave) {
  const enlaces = MENU.map((m) =>
    `<a href="#/${m.clave}"${m.clave === clave ? ' aria-current="page"' : ""}>${esc(m.titulo)}</a>`).join("");
  const nombre = nombreUsuario();
  return `<div class="app">
    <aside class="lateral">
      <div class="marca-lateral">${htmlLogo("logo-menu")}<span>${esc(NOMBRE_NEGOCIO)}</span></div>
      <nav aria-label="Secciones">${enlaces}</nav>
      <div class="pie">
        <button id="perfil" class="usuario" title="Cambiar mi nombre">${nombre ? "👤 " + esc(nombre) : "👤 Escribe tu nombre"}</button>
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
  $("#olvide").addEventListener("click", pedirRecuperacion);
  // Si el enlace del correo falló o venció, se avisa aquí.
  if (estado.recuperacion) {
    $("#error-login").textContent = estado.recuperacion.texto ||
      "El enlace para cambiar la contraseña no es válido o venció. Pide uno nuevo.";
    estado.recuperacion = null;
  }
  $("#correo").focus();
}

function montarPanel() {
  $("#salir").addEventListener("click", async () => {
    await db.auth.signOut();
    location.hash = "#/hoy";
  });
  $("#perfil").addEventListener("click", pedirNombre);
  $("#buscador").addEventListener("keydown", (evento) => {
    if (evento.key !== "Enter") return;
    estado.busqueda = evento.target.value.trim();
    if (claveActual() === "clientes") montarPantalla("clientes");
    else location.hash = "#/clientes";
  });
}

function pintar() {
  cerrarDialogo();
  cerrarDialogo("dialogo-ficha");
  const raiz = $("#raiz");
  if (!configurado || !db) {
    raiz.innerHTML = htmlConfiguracion();
    return;
  }
  // Llegó desde el enlace del correo: primero se pide la contraseña nueva.
  if (estado.recuperacion && estado.recuperacion.modo === "nueva" && estado.sesion) {
    raiz.innerHTML = htmlNuevaClave();
    montarNuevaClave();
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
  if (typeof NOMBRE_NEGOCIO === "string") document.title = NOMBRE_NEGOCIO;
  if (configurado && db) {
    // El logo se busca antes de dibujar (máximo 2,5 segundos de espera).
    await Promise.race([cargarLogo(), new Promise((resolver) => setTimeout(resolver, 2500))]);
    try {
      const { data } = await db.auth.getSession();
      estado.sesion = data.session;
      estado.usuarioId = data.session ? data.session.user.id : null;
    } catch (error) {
      aviso(mensajeError(error), true);
    }
    // Se limpia el enlace del correo de la barra de direcciones (ya lo leyó Supabase).
    if (RECUPERACION) history.replaceState(null, "", location.pathname + location.search + "#/hoy");
    db.auth.onAuthStateChange((evento, sesion) => {
      const nuevoId = sesion ? sesion.user.id : null;
      estado.sesion = sesion;
      if (evento === "PASSWORD_RECOVERY") {
        estado.recuperacion = { modo: "nueva" };
        estado.usuarioId = nuevoId;
        setTimeout(pintar, 0);
        return;
      }
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