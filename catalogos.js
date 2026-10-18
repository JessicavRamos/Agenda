"use strict";

/* =====================================================================
   CATÁLOGOS: razas con precios, guías, servicios y logo del negocio
   ===================================================================== */

let pestanaCat = "razas";
const PESTANAS_CAT = {
  razas: "Razas y precios",
  guias: "Guías",
  servicios: "Servicios y recordatorios",
  negocio: "Logo del negocio",
};
const SERVICIOS_FIJOS = Object.keys(COLUMNA_PRECIO); // Baño, Corte, Corte y baño

// Guarda un solo campo editado en la tabla.
async function guardarCampo(tabla, id, entrada) {
  const campo = entrada.dataset.campo;
  let valor = entrada.value.trim();
  if (entrada.type === "number") {
    valor = valor === "" ? null : Number(valor);
    if (campo === "frecuencia_dias" && !(valor > 0)) {
      aviso("Los días deben ser un número mayor que 0.", true);
      return cargarCatalogos();
    }
  } else if (entrada.dataset.opcional !== undefined) {
    valor = valor === "" ? null : valor;
  } else if (valor === "") {
    aviso("Este campo no puede quedar vacío.", true);
    return cargarCatalogos();
  }
  if (campo === "grupo_id") valor = Number(valor);
  try {
    await q(db.from(tabla).update({ [campo]: valor }).eq("id", id));
    aviso("Guardado.");
  } catch (error) {
    aviso(mensajeError(error), true);
    await cargarCatalogos();
  }
}

// Conecta una tabla para guardar automáticamente cada cambio.
function conectarEdicion(contenedor, tabla) {
  contenedor.addEventListener("change", (evento) => {
    const entrada = evento.target;
    const fila = entrada.closest("tr[data-id]");
    if (fila && entrada.dataset.campo) guardarCampo(tabla, Number(fila.dataset.id), entrada);
  });
}

async function quitarFila(tabla, id, pregunta) {
  if (!window.confirm(pregunta)) return;
  try {
    await q(db.from(tabla).delete().eq("id", id));
    aviso("Eliminado.");
    cargarCatalogos();
  } catch (error) {
    aviso(mensajeError(error), true);
  }
}

async function agregar(tabla, datos, formulario) {
  const caja = $(".error", formulario);
  caja.textContent = "";
  try {
    await q(db.from(tabla).insert(datos));
    aviso("Agregado.");
    cargarCatalogos();
  } catch (error) {
    caja.textContent = mensajeError(error);
  }
}

const numeroONulo = (id) => ($(id).value === "" ? null : Number($(id).value));

/* ---------- Razas ---------- */
async function pestanaRazas(caja) {
  const razas = await q(db.from("razas").select("*").order("especie").order("nombre"));
  caja.innerHTML = `
    <p class="suave">Escribe aquí tus precios. Al cambiar una celda se guarda sola. El recargo medicado
    (por ejemplo $8.000 o $16.000 según el tamaño) se suma cuando marcas "baño medicado".</p>
    <form id="nueva-raza" class="fila-nueva">
      <div><label for="r-nombre">Raza</label><input id="r-nombre" required></div>
      <div><label for="r-especie">Especie</label><select id="r-especie"><option value="perro">Perro</option><option value="gato">Gato</option></select></div>
      <div><label for="r-bano">Baño</label><input id="r-bano" type="number" min="0" step="any"></div>
      <div><label for="r-corte">Corte</label><input id="r-corte" type="number" min="0" step="any"></div>
      <div><label for="r-cb">Corte y baño</label><input id="r-cb" type="number" min="0" step="any"></div>
      <div><label for="r-med">Recargo medicado</label><input id="r-med" type="number" min="0" step="any"></div>
      <div><button class="btn" type="submit">Agregar raza</button></div>
      <p class="error" role="alert"></p>
    </form>
    <div class="tabla-scroll"><table><thead><tr><th>Raza</th><th>Especie</th><th>Baño</th><th>Corte</th><th>Corte y baño</th><th>Recargo medicado</th><th></th></tr></thead>
    <tbody id="tabla-razas">${razas.map((r) => `<tr data-id="${r.id}">
      <td><input data-campo="nombre" value="${esc(r.nombre)}" aria-label="Nombre de la raza"></td>
      <td>${esc(r.especie)}</td>
      ${["precio_bano", "precio_corte", "precio_corte_bano", "recargo_medicado"].map((c) =>
        `<td><input data-campo="${c}" type="number" min="0" step="any" value="${esc(r[c])}" aria-label="${c}"></td>`).join("")}
      <td><button class="btn alt" data-quitar="${r.id}">Quitar</button></td></tr>`).join("")}</tbody></table></div>`;

  conectarEdicion($("#tabla-razas"), "razas");
  $$("[data-quitar]", caja).forEach((b) => b.addEventListener("click", () =>
    quitarFila("razas", Number(b.dataset.quitar), "¿Quitar esta raza? Las mascotas que la tengan quedarán sin raza.")));
  $("#nueva-raza").addEventListener("submit", (evento) => {
    evento.preventDefault();
    agregar("razas", {
      nombre: $("#r-nombre").value.trim(),
      especie: $("#r-especie").value,
      precio_bano: numeroONulo("#r-bano"),
      precio_corte: numeroONulo("#r-corte"),
      precio_corte_bano: numeroONulo("#r-cb"),
      recargo_medicado: numeroONulo("#r-med"),
    }, evento.target);
  });
}

/* ---------- Guías ---------- */
async function pestanaGuias(caja) {
  const guias = await q(db.from("guias").select("*").order("nombre"));
  caja.innerHTML = `
    <p class="suave">Estas son las opciones del desplegable "Guía usada" al terminar una cita.</p>
    <form id="nueva-guia" class="fila-nueva">
      <div><label for="g-nombre">Número de guía</label><input id="g-nombre" required></div>
      <div><label for="g-desc">Descripción (opcional)</label><input id="g-desc"></div>
      <div><button class="btn" type="submit">Agregar guía</button></div>
      <p class="error" role="alert"></p>
    </form>
    <div class="tabla-scroll"><table><thead><tr><th>Guía</th><th>Descripción</th><th></th></tr></thead>
    <tbody id="tabla-guias">${guias.map((g) => `<tr data-id="${g.id}">
      <td><input data-campo="nombre" value="${esc(g.nombre)}" aria-label="Número de guía"></td>
      <td><input data-campo="descripcion" data-opcional value="${esc(g.descripcion ?? "")}" aria-label="Descripción"></td>
      <td><button class="btn alt" data-quitar="${g.id}">Quitar</button></td></tr>`).join("")}</tbody></table></div>`;

  conectarEdicion($("#tabla-guias"), "guias");
  $$("[data-quitar]", caja).forEach((b) => b.addEventListener("click", () =>
    quitarFila("guias", Number(b.dataset.quitar), "¿Quitar esta guía? Los servicios que la usaron quedarán sin guía.")));
  $("#nueva-guia").addEventListener("submit", (evento) => {
    evento.preventDefault();
    agregar("guias", { nombre: $("#g-nombre").value.trim(), descripcion: $("#g-desc").value.trim() || null }, evento.target);
  });
}

/* ---------- Servicios y grupos de recordatorio ---------- */
async function pestanaServicios(caja) {
  const [grupos, tipos] = await Promise.all([
    q(db.from("grupos_recordatorio").select("*").order("id")),
    q(db.from("tipos_servicio").select("*").order("id")),
  ]);
  const opcionesGrupo = (actual) => grupos.map((g) =>
    `<option value="${g.id}"${g.id === actual ? " selected" : ""}>${esc(g.nombre)}</option>`).join("");

  caja.innerHTML = `
    <p class="aviso-fijo">No cambies el nombre de <strong>${SERVICIOS_FIJOS.join(", ")}</strong>: el precio sugerido por raza depende de esos nombres.</p>
    <h3>Grupos de recordatorio</h3>
    <p class="suave">Los servicios de un mismo grupo cuentan igual para avisarte cuándo debe volver el cliente.</p>
    <form id="nuevo-grupo" class="fila-nueva">
      <div><label for="gr-nombre">Nombre del grupo</label><input id="gr-nombre" required></div>
      <div><label for="gr-dias">Cada cuántos días</label><input id="gr-dias" type="number" min="1" required></div>
      <div><button class="btn" type="submit">Agregar grupo</button></div>
      <p class="error" role="alert"></p>
    </form>
    <div class="tabla-scroll"><table><thead><tr><th>Grupo</th><th>Días para volver</th></tr></thead>
    <tbody id="tabla-grupos">${grupos.map((g) => `<tr data-id="${g.id}">
      <td><input data-campo="nombre" value="${esc(g.nombre)}" aria-label="Nombre del grupo"></td>
      <td><input data-campo="frecuencia_dias" type="number" min="1" value="${esc(g.frecuencia_dias)}" aria-label="Días"></td></tr>`).join("")}</tbody></table></div>

    <h3>Servicios</h3>
    <form id="nuevo-tipo" class="fila-nueva">
      <div><label for="t-nuevo">Nombre del servicio</label><input id="t-nuevo" required></div>
      <div><label for="t-grupo">Grupo</label><select id="t-grupo">${opcionesGrupo(null)}</select></div>
      <div><button class="btn" type="submit">Agregar servicio</button></div>
      <p class="error" role="alert"></p>
    </form>
    <div class="tabla-scroll"><table><thead><tr><th>Servicio</th><th>Grupo</th></tr></thead>
    <tbody id="tabla-tipos">${tipos.map((t) => `<tr data-id="${t.id}">
      <td><input data-campo="nombre" value="${esc(t.nombre)}" aria-label="Nombre del servicio"${SERVICIOS_FIJOS.includes(t.nombre) ? " disabled" : ""}></td>
      <td><select data-campo="grupo_id" aria-label="Grupo">${opcionesGrupo(t.grupo_id)}</select></td></tr>`).join("")}</tbody></table></div>`;

  conectarEdicion($("#tabla-grupos"), "grupos_recordatorio");
  conectarEdicion($("#tabla-tipos"), "tipos_servicio");
  $("#nuevo-grupo").addEventListener("submit", (evento) => {
    evento.preventDefault();
    agregar("grupos_recordatorio", { nombre: $("#gr-nombre").value.trim(), frecuencia_dias: Number($("#gr-dias").value) }, evento.target);
  });
  $("#nuevo-tipo").addEventListener("submit", (evento) => {
    evento.preventDefault();
    agregar("tipos_servicio", { nombre: $("#t-nuevo").value.trim(), grupo_id: Number($("#t-grupo").value) }, evento.target);
  });
}

/* ---------- Logo del negocio ---------- */
const TIPOS_LOGO = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" };

async function subirLogo(evento) {
  evento.preventDefault();
  const error = $("#l-error");
  error.textContent = "";
  const archivo = $("#l-archivo").files[0];
  if (!archivo) return;
  const extension = TIPOS_LOGO[archivo.type];
  if (!extension) { error.textContent = "Usa una imagen PNG, JPG, WEBP o SVG."; return; }
  if (archivo.size > 2 * 1024 * 1024) { error.textContent = "La imagen pesa más de 2 MB. Usa una más liviana."; return; }
  const boton = $("button[type=submit]", evento.target);
  boton.disabled = true;
  boton.textContent = "Subiendo…";
  try {
    const nombre = `logo-${Date.now()}.${extension}`;
    const { error: fallo } = await db.storage.from("logo")
      .upload(nombre, archivo, { contentType: archivo.type, cacheControl: "31536000" });
    if (fallo) throw fallo;
    // Se borran los logos anteriores para no acumular archivos.
    const { data } = await db.storage.from("logo").list("", { limit: 100 });
    const viejos = (data || []).map((f) => f.name).filter((n) => /^logo-/.test(n) && n !== nombre);
    if (viejos.length) await db.storage.from("logo").remove(viejos);
    await cargarLogo();
    aviso("Logo actualizado.");
    pintar();
  } catch (fallo) {
    error.textContent = mensajeError(fallo);
    boton.disabled = false;
    boton.textContent = "Subir logo";
  }
}

async function pestanaNegocio(caja) {
  caja.innerHTML = `
    <p class="suave">Sube el logo de ${esc(NOMBRE_NEGOCIO)}. Se verá en la pantalla de entrada y en el menú.
    Funciona mejor una imagen cuadrada o redonda, con fondo transparente (PNG).</p>
    <div class="logo-vista">${estado.logoUrl
      ? `<img src="${esc(estado.logoUrl)}" alt="Logo actual">`
      : '<p class="suave">Todavía no has subido un logo.</p>'}</div>
    <form id="form-logo">
      <label for="l-archivo">Imagen (PNG, JPG, WEBP o SVG; máximo 2 MB)</label>
      <input id="l-archivo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" required>
      <p id="l-error" class="error" role="alert"></p>
      <button class="btn" type="submit">Subir logo</button>
    </form>`;
  $("#form-logo").addEventListener("submit", subirLogo);
}

const CARGADORES_CAT = { razas: pestanaRazas, guias: pestanaGuias, servicios: pestanaServicios, negocio: pestanaNegocio };

async function cargarCatalogos() {
  const caja = $("#cat-contenido");
  if (!caja) return;
  try {
    await CARGADORES_CAT[pestanaCat](caja);
  } catch (error) {
    mostrarError(caja, error);
  }
}

PANTALLAS.catalogos = {
  html: () => `<h1>Catálogos</h1>
    <p class="suave">Tu lista de precios por raza, las guías de la máquina, los servicios y el logo.</p>
    <div class="tarjeta">
      <div class="filtros">${Object.entries(PESTANAS_CAT).map(([clave, texto]) =>
        `<button class="chip" data-pestana="${clave}" aria-pressed="${clave === pestanaCat}">${texto}</button>`).join("")}</div>
      <div id="cat-contenido"><p class="suave">Cargando…</p></div>
    </div>`,
  despues: async () => {
    $$("[data-pestana]").forEach((b) => b.addEventListener("click", () => {
      pestanaCat = b.dataset.pestana;
      montarPantalla("catalogos");
    }));
    await cargarCatalogos();
  },
};