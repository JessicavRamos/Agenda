"use strict";

/* =====================================================================
   CLIENTES Y MASCOTAS: búsqueda, ficha, historial y correcciones.
   La ficha también se abre desde Hoy y Agenda (en una ventana).
   ===================================================================== */

let C = null; // estado de esta pantalla

// ¿La ficha está abierta en una ventana (desde Hoy o Agenda)?
const enDialogo = () => {
  const d = document.getElementById("dialogo-ficha");
  return !!d && d.open;
};

async function listarClientes() {
  const lista = $("#c-lista");
  if (!lista) return;
  const t = terminoSeguro($("#c-buscar").value);
  try {
    let consulta = db.from("mascotas_resumen").select("*").order("mascota").limit(1000);
    if (!$("#c-inactivos").checked) consulta = consulta.eq("activo", true);
    if (t) consulta = consulta.or(filtroBusqueda(t));
    const filas = await q(consulta);
    if (!$("#c-lista")) return;
    if (!filas.length) {
      lista.innerHTML = '<p class="suave">No encontré coincidencias.</p>';
      return;
    }
    tablaInteractiva(lista, {
      id: "clientes",
      filas,
      vacio: "Ninguna mascota coincide con los filtros.",
      columnas: [
        { titulo: "Mascota", valor: (f) => f.mascota, filtro: "texto" },
        { titulo: "Especie", valor: (f) => f.especie, filtro: "lista" },
        { titulo: "Raza", valor: (f) => f.raza ?? "", filtro: "lista" },
        { titulo: "Dueño", valor: (f) => f.cliente, filtro: "texto" },
        { titulo: "Teléfonos", valor: (f) => f.telefono, texto: (f) => [f.telefono, f.telefono2].join(" "), filtro: "texto" },
        { titulo: "Visitas", valor: (f) => Number(f.visitas) || 0, filtro: false },
        { titulo: "Última visita", valor: (f) => f.ultima_visita ?? "", filtro: false },
      ],
      fila: (f) => `<tr${C.sel && C.sel.m.mascota_id === f.mascota_id ? ' class="activa"' : ""}>
        <td><button class="enlace" data-id="${f.mascota_id}">${esc(f.mascota)}</button>${f.activo ? "" : ' <span class="suave">· inactivo</span>'}</td>
        <td>${esc(f.especie)}</td><td>${esc(f.raza ?? "—")}</td>
        <td>${esc(f.cliente)}</td><td>${esc([f.telefono, f.telefono2].filter(Boolean).join(" / "))}</td>
        <td>${f.visitas}</td><td>${esc(fechaTexto(f.ultima_visita))}</td></tr>`,
      alPintar: (tbody) => $$("button[data-id]", tbody).forEach((b) =>
        b.addEventListener("click", () => abrirFicha(Number(b.dataset.id)))),
    });
    C.unica = filas.length === 1 ? filas[0].mascota_id : null;
  } catch (error) {
    mostrarError(lista, error);
  }
}

// Abre la ficha dentro de la pantalla Clientes (o dentro de una ventana).
async function abrirFicha(mascotaId) {
  const ficha = $("#c-ficha");
  if (!ficha) return;
  ficha.innerHTML = '<p class="suave">Cargando…</p>';
  try {
    const m = await q(db.from("mascotas_resumen").select("*").eq("mascota_id", mascotaId).single());
    const cliente = await q(db.from("clientes")
      .select("id,nombre,telefono,telefono2,notas,activo").eq("id", m.cliente_id).single());
    C.sel = { m, cliente };
    pintarFichaCliente();
    await cargarHistorialCliente();
    listarClientes(); // resalta la fila elegida (si la lista está en pantalla)
  } catch (error) {
    mostrarError(ficha, error);
  }
}

// Ficha en una ventana emergente (para Hoy y Agenda).
async function abrirFichaEnDialogo(mascotaId, alCerrar) {
  try {
    C = { sel: null, razas: await q(db.from("razas").select("id,nombre,especie").order("nombre")), todas: false, unica: null };
  } catch (error) {
    aviso(mensajeError(error), true);
    return;
  }
  const dialogo = abrirDialogo(`<button type="button" class="cerrar" id="ficha-cerrar" aria-label="Cerrar">✕</button>
    <div id="c-ficha" class="ficha"></div>`, "dialogo-ficha");
  dialogo.classList.add("ancho");
  $("#ficha-cerrar").addEventListener("click", () => cerrarDialogo("dialogo-ficha"));
  dialogo.addEventListener("close", () => { if (alCerrar) alCerrar(); }, { once: true });
  await abrirFicha(mascotaId);
}

function opcionesRaza(especie, actual) {
  return '<option value="">(sin raza definida)</option>' + C.razas
    .filter((r) => r.especie === especie)
    .map((r) => `<option value="${r.id}"${r.id === actual ? " selected" : ""}>${esc(r.nombre)}</option>`).join("");
}

function pintarFichaCliente() {
  const { m, cliente } = C.sel;
  $("#c-ficha").innerHTML = `
    <h2>${esc(m.mascota)} <span class="suave">${esc(m.especie)}</span></h2>
    <div class="suave">${esc(cliente.nombre)} · ${esc([cliente.telefono, cliente.telefono2].filter(Boolean).join(" / "))} ·
      <span class="etiqueta ${cliente.activo ? "ok" : "gris"}">${cliente.activo ? "cliente activo" : "cliente inactivo"}</span></div>
    <form id="f-form">
      <h3>Mascota</h3>
      <div class="dos">
        <div><label for="f-mascota">Nombre</label><input id="f-mascota" value="${esc(m.mascota)}" required></div>
        <div><label for="f-especie">Especie</label>
          <select id="f-especie"><option value="perro"${m.especie === "perro" ? " selected" : ""}>Perro</option>
          <option value="gato"${m.especie === "gato" ? " selected" : ""}>Gato</option></select></div>
        <div><label for="f-raza">Raza</label><select id="f-raza">${opcionesRaza(m.especie, m.raza_id)}</select></div>
        <div><label for="f-corte">Descripción del corte</label><input id="f-corte" value="${esc(m.descripcion_corte ?? "")}" placeholder="Cómo le gusta al cliente"></div>
      </div>
      <h3>Dueño</h3>
      <div class="dos">
        <div><label for="f-dueno">Nombre</label><input id="f-dueno" value="${esc(cliente.nombre)}" required></div>
        <div><label for="f-tel">Teléfono</label><input id="f-tel" value="${esc(cliente.telefono ?? "")}" inputmode="tel" required></div>
        <div><label for="f-tel2">Segundo teléfono</label><input id="f-tel2" value="${esc(cliente.telefono2 ?? "")}" inputmode="tel"></div>
        <div><label for="f-notas">Notas del cliente</label><input id="f-notas" value="${esc(cliente.notas ?? "")}"></div>
      </div>
      <p id="f-error" class="error" role="alert"></p>
      <div class="acciones">
        <button type="button" class="btn alt" id="f-activo">${cliente.activo ? "Marcar cliente inactivo" : "Reactivar cliente"}</button>
        <button type="submit" class="btn">Guardar cambios</button>
      </div>
    </form>
    <h3>Historial</h3>
    <label class="casilla"><input type="checkbox" id="f-todas"${C.todas ? " checked" : ""}> Incluir las demás mascotas del cliente</label>
    <div id="f-historial"><p class="suave">Cargando…</p></div>`;

  $("#f-especie").addEventListener("change", (e) => { $("#f-raza").innerHTML = opcionesRaza(e.target.value, null); });
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
      telefono2: limpiarTelefono($("#f-tel2").value) || null,
      notas: $("#f-notas").value.trim() || null,
    }).eq("id", cliente.id));
    await q(db.from("mascotas").update({
      nombre: $("#f-mascota").value.trim(),
      especie: $("#f-especie").value,
      raza_id: $("#f-raza").value ? Number($("#f-raza").value) : null,
      descripcion_corte: $("#f-corte").value.trim() || null,
    }).eq("id", m.mascota_id));
        aviso("Cambios guardados.");
    if (enDialogo()) { cerrarDialogo("dialogo-ficha"); return; } // se cierra la ventana
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
    if (enDialogo()) { cerrarDialogo("dialogo-ficha"); return; }
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
    const total = filas.reduce((suma, f) => suma + (Number(f.precio_cobrado) || 0), 0);
    caja.innerHTML = filas.length ? `<p class="hist-total">${filas.length} ${filas.length === 1 ? "servicio" : "servicios"} · Total ${dinero(total)}</p>` + filas.map((f) => `<div class="item">
      <div><strong>${esc(f.servicio)}</strong>${f.medicado ? ' <span class="etiqueta">medicado</span>' : ""}${C.todas ? ` · ${esc(f.mascota)}` : ""}
        <div class="suave">${esc(fechaTexto(f.fecha))}${f.guia ? " · guía " + esc(f.guia) : ""}${f.notas ? " · " + esc(f.notas) : ""}</div></div>
      <div class="acciones-fila"><strong>${dinero(f.precio_cobrado)}</strong>
        <button class="btn alt" data-corregir="${f.id}">Editar</button></div></div>`).join("")
      : '<p class="suave">Todavía no tiene servicios registrados.</p>';
    $$("[data-corregir]", caja).forEach((b) => b.addEventListener("click", () =>
      editarServicio(Number(b.dataset.corregir), cargarHistorialCliente)));
  } catch (error) {
    mostrarError(caja, error);
  }
}

// Edita todo lo de un servicio ya hecho: tipo, fecha, guía, precio, medicado y notas.
async function editarServicio(id, alGuardar) {
  let servicio, guias, tipos;
  try {
    [servicio, guias, tipos] = await Promise.all([
      q(db.from("servicios").select("*").eq("id", id).single()),
      q(db.from("guias").select("id,nombre").order("nombre")),
      q(db.from("tipos_servicio").select("id,nombre").order("id")),
    ]);
  } catch (error) {
    aviso(mensajeError(error), true);
    return;
  }
  const esBano = () => {
    const t = tipos.find((x) => x.id === Number($("#s-tipo").value));
    return !!t && SERVICIOS_CON_BANO.includes(t.nombre);
  };
  abrirDialogo(`<form id="form-servicio">
    <h2>Editar servicio</h2>
    <label for="s-tipo">Servicio</label>
    <select id="s-tipo">${tipos.map((t) =>
      `<option value="${t.id}"${t.id === servicio.tipo_id ? " selected" : ""}>${esc(t.nombre)}</option>`).join("")}</select>
    <label for="s-fecha">Fecha</label><input id="s-fecha" type="date" value="${esc(servicio.fecha)}" required>
    <label for="s-guia">Guía usada</label>
    <select id="s-guia"><option value="">(sin guía)</option>${guias.map((g) =>
      `<option value="${g.id}"${g.id === servicio.guia_id ? " selected" : ""}>${esc(g.nombre)}</option>`).join("")}</select>
    <label for="s-precio">Precio cobrado</label>
    <input id="s-precio" type="number" min="0" step="any" value="${esc(servicio.precio_cobrado)}">
    ${htmlMedicado("s", servicio.medicado, servicio.recargo_medicado ?? "")}
    <label for="s-notas">Notas</label><input id="s-notas" value="${esc(servicio.notas ?? "")}" maxlength="300">
    <p id="s-error" class="error" role="alert"></p>
    <div class="acciones separadas">
      <button type="button" class="btn peligro" id="s-eliminar">Eliminar servicio</button>
      <span class="acciones-fila">
        <button type="button" class="btn alt" id="s-volver">Volver</button>
        <button type="submit" class="btn">Guardar</button>
      </span>
    </div></form>`);

  $("#s-bloque").hidden = !esBano();
  conectarMedicado("s", "#s-precio");
  $("#s-tipo").addEventListener("change", () => {
    const si = esBano();
    $("#s-bloque").hidden = !si;
    if (!si && $("#s-medicado").checked) {
      $("#s-medicado").checked = false;
      $("#s-medicado").dispatchEvent(new Event("change"));
    }
  });
  $("#s-volver").addEventListener("click", () => cerrarDialogo());
  // Eliminar: deja de contar como servicio realizado (historial, reportes y recordatorios).
  // Si nació de una cita, la cita también se borra para que no quede como "realizada".
  $("#s-eliminar").addEventListener("click", async () => {
    const pregunta = servicio.cita_id
      ? "¿Eliminar este servicio?\n\nDejará de contar como servicio realizado y también se borrará la cita de la que salió. Esto no se puede deshacer."
      : "¿Eliminar este servicio?\n\nDejará de contar como servicio realizado. Esto no se puede deshacer.";
    if (!window.confirm(pregunta)) return;
    try {
      const borrados = await q(db.from("servicios").delete().eq("id", id).select("id"));
      if (!borrados.length) throw new Error("permission denied");
      if (servicio.cita_id) await q(db.from("citas").delete().eq("id", servicio.cita_id));
      cerrarDialogo();
      aviso("Servicio eliminado.");
      if (alGuardar) alGuardar();
    } catch (error) {
      $("#s-error").textContent = mensajeError(error);
    }
  });
  $("#form-servicio").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const medicado = esBano() && $("#s-medicado").checked;
    try {
      await q(db.from("servicios").update({
        tipo_id: Number($("#s-tipo").value),
        fecha: $("#s-fecha").value,
        guia_id: $("#s-guia").value ? Number($("#s-guia").value) : null,
        precio_cobrado: $("#s-precio").value === "" ? null : Number($("#s-precio").value),
        medicado,
        recargo_medicado: medicado && $("#s-recargo").value !== "" ? Number($("#s-recargo").value) : null,
        notas: $("#s-notas").value.trim() || null,
      }).eq("id", id));
      cerrarDialogo();
      aviso("Servicio actualizado.");
      if (alGuardar) alGuardar();
    } catch (error) {
      $("#s-error").textContent = mensajeError(error);
    }
  });
}

PANTALLAS.clientes = {
  html: () => `<h1>Clientes y mascotas</h1>
    <p class="suave">Busca por mascota, dueño o cualquiera de los dos teléfonos, y abre la ficha para ver y editar todo. Haz clic en un encabezado para ordenar.</p>
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
    C = { sel: null, razas: [], todas: false, unica: null };
    C.razas = await q(db.from("razas").select("id,nombre,especie").order("nombre"));
    const buscar = $("#c-buscar");
    buscar.value = estado.busqueda;
    estado.busqueda = "";
    buscar.addEventListener("input", debounce(listarClientes, 300));
    $("#c-inactivos").addEventListener("change", listarClientes);
    await listarClientes();
    if (C.unica && buscar.value) abrirFicha(C.unica);
  },
};