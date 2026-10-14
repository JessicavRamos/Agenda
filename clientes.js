"use strict";

/* =====================================================================
   CLIENTES Y MASCOTAS: búsqueda, ficha, historial y correcciones
   ===================================================================== */

let C = null; // estado de esta pantalla

async function listarClientes() {
  const lista = $("#c-lista");
  if (!lista) return;
  const t = terminoSeguro($("#c-buscar").value);
  try {
    let consulta = db.from("mascotas_resumen").select("*").order("mascota").limit(100);
    if (!$("#c-inactivos").checked) consulta = consulta.eq("activo", true);
    if (t) consulta = consulta.or(`mascota.ilike.*${t}*,cliente.ilike.*${t}*,telefono.ilike.*${t}*`);
    C.filas = await q(consulta);
    if (!$("#c-lista")) return;
    if (!C.filas.length) {
      lista.innerHTML = '<p class="suave">No encontré coincidencias.</p>';
      return;
    }
    lista.innerHTML = `<table><thead><tr><th>Mascota</th><th>Dueño</th><th>Teléfono</th><th>Visitas</th><th>Última visita</th></tr></thead>
      <tbody>${C.filas.map((f) => `<tr${C.sel && C.sel.m.mascota_id === f.mascota_id ? ' class="activa"' : ""}>
        <td><button class="enlace" data-id="${f.mascota_id}">${esc(f.mascota)}</button>
          <div class="suave">${esc(f.raza ?? f.especie)}${f.activo ? "" : " · inactivo"}</div></td>
        <td>${esc(f.cliente)}</td><td>${esc(f.telefono ?? "")}</td><td>${f.visitas}</td><td>${esc(fechaTexto(f.ultima_visita))}</td></tr>`).join("")}</tbody></table>`;
    $$("button[data-id]", lista).forEach((b) => b.addEventListener("click", () => abrirFicha(Number(b.dataset.id))));
  } catch (error) {
    mostrarError(lista, error);
  }
}

async function abrirFicha(mascotaId) {
  const ficha = $("#c-ficha");
  const m = C.filas.find((f) => f.mascota_id === mascotaId);
  if (!m) return;
  ficha.innerHTML = '<p class="suave">Cargando…</p>';
  try {
    const cliente = await q(db.from("clientes").select("id,nombre,telefono,notas,activo").eq("id", m.cliente_id).single());
    C.sel = { m, cliente };
    pintarFichaCliente();
    await cargarHistorialCliente();
    listarClientes(); // para resaltar la fila elegida
  } catch (error) {
    mostrarError(ficha, error);
  }
}

function pintarFichaCliente() {
  const { m, cliente } = C.sel;
  $("#c-ficha").innerHTML = `
    <h2>${esc(m.mascota)} <span class="suave">${esc(m.especie)}</span></h2>
    <div class="suave">${esc(cliente.nombre)} · ${esc(cliente.telefono ?? "")} ·
      <span class="etiqueta ${cliente.activo ? "ok" : "gris"}">${cliente.activo ? "cliente activo" : "cliente inactivo"}</span></div>
    <form id="f-form">
      <div class="dos">
        <div><label for="f-mascota">Nombre de la mascota</label><input id="f-mascota" value="${esc(m.mascota)}" required></div>
        <div><label for="f-raza">Raza</label><select id="f-raza"></select></div>
      </div>
      <label for="f-corte">Descripción del corte (cómo le gusta al cliente)</label>
      <input id="f-corte" value="${esc(m.descripcion_corte ?? "")}">
      <div class="dos">
        <div><label for="f-dueno">Dueño</label><input id="f-dueno" value="${esc(cliente.nombre)}" required></div>
        <div><label for="f-tel">Teléfono</label><input id="f-tel" value="${esc(cliente.telefono ?? "")}" inputmode="tel" required></div>
      </div>
      <label for="f-notas">Notas del cliente</label>
      <input id="f-notas" value="${esc(cliente.notas ?? "")}">
      <p id="f-error" class="error" role="alert"></p>
      <div class="acciones">
        <button type="button" class="btn alt" id="f-activo">${cliente.activo ? "Marcar cliente inactivo" : "Reactivar cliente"}</button>
        <button type="submit" class="btn">Guardar cambios</button>
      </div>
    </form>
    <h3>Historial</h3>
    <label class="casilla"><input type="checkbox" id="f-todas"${C.todas ? " checked" : ""}> Incluir las demás mascotas del cliente</label>
    <div id="f-historial"><p class="suave">Cargando…</p></div>`;

  $("#f-raza").innerHTML = '<option value="">(sin raza definida)</option>' + C.razas
    .filter((r) => r.especie === m.especie)
    .map((r) => `<option value="${r.id}"${r.id === m.raza_id ? " selected" : ""}>${esc(r.nombre)}</option>`).join("");

  $("#f-form").addEventListener("submit", guardarFicha);
  $("#f-activo").addEventListener("click", cambiarActivo);
  $("#f-todas").addEventListener("change", (e) => { C.todas = e.target.checked; cargarHistorialCliente(); });
}

async function guardarFicha(evento) {
  evento.preventDefault();
  const { m, cliente } = C.sel;
  const error = $("#f-error");
  error.textContent = "";
  const telefono = limpiarTelefono($("#f-tel").value);
  if (!telefono) { error.textContent = "El teléfono es obligatorio."; return; }
  try {
    await q(db.from("clientes").update({
      nombre: $("#f-dueno").value.trim(),
      telefono,
      notas: $("#f-notas").value.trim() || null,
    }).eq("id", cliente.id));
    await q(db.from("mascotas").update({
      nombre: $("#f-mascota").value.trim(),
      raza_id: $("#f-raza").value ? Number($("#f-raza").value) : null,
      descripcion_corte: $("#f-corte").value.trim() || null,
    }).eq("id", m.mascota_id));
    aviso("Cambios guardados.");
    await listarClientes();
    await abrirFicha(m.mascota_id);
  } catch (fallo) {
    error.textContent = mensajeError(fallo);
  }
}

async function cambiarActivo() {
  const { m, cliente } = C.sel;
  const desactivar = cliente.activo;
  const pregunta = desactivar
    ? `¿Marcar a ${cliente.nombre} como inactivo? Dejará de salir en "a quién buscar", pero su historial se conserva.`
    : `¿Reactivar a ${cliente.nombre}?`;
  if (!window.confirm(pregunta)) return;
  try {
    await q(db.from("clientes").update({ activo: !desactivar }).eq("id", cliente.id));
    aviso(desactivar ? "Cliente marcado como inactivo." : "Cliente reactivado.");
    await listarClientes();
    await abrirFicha(m.mascota_id);
  } catch (error) {
    aviso(mensajeError(error), true);
  }
}

async function cargarHistorialCliente() {
  const caja = $("#f-historial");
  if (!caja || !C.sel) return;
  const { m } = C.sel;
  try {
    let consulta = db.from("historial").select("*").order("fecha", { ascending: false }).limit(60);
    consulta = C.todas ? consulta.eq("cliente_id", m.cliente_id) : consulta.eq("mascota_id", m.mascota_id);
    const filas = await q(consulta);
    if (!$("#f-historial")) return;
    caja.innerHTML = filas.length ? filas.map((f) => `<div class="item">
      <div><strong>${esc(f.servicio)}</strong>${C.todas ? ` · ${esc(f.mascota)}` : ""}
        <div class="suave">${esc(fechaTexto(f.fecha))}${f.guia ? " · guía " + esc(f.guia) : ""}${f.notas ? " · " + esc(f.notas) : ""}</div></div>
      <div class="acciones-fila"><strong>${dinero(f.precio_cobrado)}</strong>
        <button class="btn alt" data-corregir="${f.id}">Corregir</button></div></div>`).join("")
      : '<p class="suave">Todavía no tiene servicios registrados.</p>';
    $$("[data-corregir]", caja).forEach((b) => b.addEventListener("click", () => editarServicio(Number(b.dataset.corregir))));
  } catch (error) {
    mostrarError(caja, error);
  }
}

// Las correcciones de un servicio ya hecho se hacen aquí.
async function editarServicio(id) {
  let servicio, guias;
  try {
    [servicio, guias] = await Promise.all([
      q(db.from("servicios").select("*").eq("id", id).single()),
      q(db.from("guias").select("id,nombre").order("nombre")),
    ]);
  } catch (error) {
    aviso(mensajeError(error), true);
    return;
  }
  abrirDialogo(`<form id="form-servicio">
    <h2>Corregir servicio</h2>
    <label for="s-fecha">Fecha</label><input id="s-fecha" type="date" value="${esc(servicio.fecha)}" required>
    <label for="s-guia">Guía usada</label>
    <select id="s-guia"><option value="">(sin guía)</option>${guias.map((g) =>
      `<option value="${g.id}"${g.id === servicio.guia_id ? " selected" : ""}>${esc(g.nombre)}</option>`).join("")}</select>
    <label for="s-precio">Precio cobrado</label>
    <input id="s-precio" type="number" min="0" step="any" value="${esc(servicio.precio_cobrado)}">
    <label for="s-notas">Notas</label><input id="s-notas" value="${esc(servicio.notas ?? "")}" maxlength="300">
    <p id="s-error" class="error" role="alert"></p>
    <div class="acciones">
      <button type="button" class="btn alt" id="s-volver">Volver</button>
      <button type="submit" class="btn">Guardar</button>
    </div></form>`);
  $("#s-volver").addEventListener("click", cerrarDialogo);
  $("#form-servicio").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    try {
      await q(db.from("servicios").update({
        fecha: $("#s-fecha").value,
        guia_id: $("#s-guia").value ? Number($("#s-guia").value) : null,
        precio_cobrado: $("#s-precio").value === "" ? null : Number($("#s-precio").value),
        notas: $("#s-notas").value.trim() || null,
      }).eq("id", id));
      cerrarDialogo();
      aviso("Servicio corregido.");
      cargarHistorialCliente();
    } catch (error) {
      $("#s-error").textContent = mensajeError(error);
    }
  });
}

PANTALLAS.clientes = {
  html: () => `<h1>Clientes y mascotas</h1>
    <p class="suave">Busca por mascota, dueño o teléfono y abre la ficha para ver y corregir su historial.</p>
    <div class="columnas derecha">
      <div class="tarjeta">
        <label for="c-buscar">Buscar</label>
        <input id="c-buscar" type="search" placeholder="Mascota, dueño o teléfono">
        <label class="casilla"><input type="checkbox" id="c-inactivos"> Mostrar clientes inactivos</label>
        <div id="c-lista" class="tabla-scroll"><p class="suave">Cargando…</p></div>
      </div>
      <div id="c-ficha" class="ficha"><span class="suave">Elige una mascota de la lista para ver su ficha.</span></div>
    </div>`,
  despues: async () => {
    C = { sel: null, filas: [], razas: [], todas: false };
    C.razas = await q(db.from("razas").select("id,nombre,especie").order("nombre"));
    const buscar = $("#c-buscar");
    buscar.value = estado.busqueda;
    estado.busqueda = "";
    buscar.addEventListener("input", debounce(listarClientes, 300));
    $("#c-inactivos").addEventListener("change", listarClientes);
    await listarClientes();
    if (C.filas.length === 1 && buscar.value) abrirFicha(C.filas[0].mascota_id);
  },
};