"use strict";

/* =====================================================================
   AGENDA, "Terminar cita" y "Editar cita" (también se usan desde Hoy)
   ===================================================================== */

// Cambiar el estado de la cita a "realizada" es UNA sola actualización:
// la base de datos crea sola el servicio en el historial.
async function abrirTerminarCita(cita, alGuardar) {
  let guias, ultima;
  try {
    [guias, ultima] = await Promise.all([
      q(db.from("guias").select("id,nombre").order("nombre")),
      q(db.from("ultima_guia").select("guia_id").eq("mascota_id", cita.mascota_id)),
    ]);
  } catch (error) {
    aviso(mensajeError(error), true);
    return;
  }
  const guiaPrevia = ultima.length ? ultima[0].guia_id : null;
  const precio = cita.precio_acordado ?? cita.precio ?? "";
  const bano = SERVICIOS_CON_BANO.includes(cita.servicio);

  abrirDialogo(`<form id="form-terminar">
    <h2>Terminar cita</h2>
    <p><strong>${esc(cita.mascota)}</strong> · ${esc(cita.servicio ?? "sin servicio")} · ${esc(fechaHoraTexto(cita.fecha_hora))}</p>
    <label for="t-guia">Guía usada${guiaPrevia ? " (viene la de la última vez)" : ""}</label>
    <select id="t-guia"><option value="">(sin guía)</option>${guias.map((g) =>
      `<option value="${g.id}"${g.id === guiaPrevia ? " selected" : ""}>${esc(g.nombre)}</option>`).join("")}</select>
    <label for="t-precio">Precio cobrado</label>
    <input id="t-precio" type="number" min="0" step="any" value="${esc(precio)}">
    ${bano ? htmlMedicado("t", cita.medicado, cita.recargo_medicado ?? "") : ""}
    <label for="t-notas">Notas del servicio</label>
    <input id="t-notas" maxlength="300">
    <p id="t-error" class="error" role="alert"></p>
    <div class="acciones">
      <button type="button" class="btn alt" id="t-volver">Volver</button>
      <button type="submit" class="btn">Marcar como realizada</button>
    </div>
  </form>`);

  if (bano) conectarMedicado("t", "#t-precio");
  $("#t-volver").addEventListener("click", () => cerrarDialogo());
  $("#form-terminar").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const boton = $("button[type=submit]", evento.target);
    boton.disabled = true;
    const medicado = bano && $("#t-medicado").checked;
    try {
      await q(db.from("citas").update({
        estado: "realizada",
        guia_id: $("#t-guia").value ? Number($("#t-guia").value) : null,
        precio_cobrado: $("#t-precio").value === "" ? null : Number($("#t-precio").value),
        notas_servicio: $("#t-notas").value.trim() || null,
        medicado,
        recargo_medicado: medicado && $("#t-recargo").value !== "" ? Number($("#t-recargo").value) : null,
      }).eq("id", cita.id));
      cerrarDialogo();
      if (alGuardar) alGuardar();
      // Ventana para avisarle al dueño por WhatsApp que ya puede recoger la mascota.
      abrirAvisoRecoger(cita);
    } catch (error) {
      $("#t-error").textContent = mensajeError(error);
      boton.disabled = false;
    }
  });
}

// Cambiar día, hora, servicio, precio o baño medicado de una cita pendiente.
async function editarCita(cita, alGuardar) {
  let tipos;
  try {
    tipos = await q(db.from("tipos_servicio").select("id,nombre").order("id"));
  } catch (error) {
    aviso(mensajeError(error), true);
    return;
  }
  const esBano = () => {
    const t = tipos.find((x) => x.id === Number($("#e-servicio").value));
    return !!t && SERVICIOS_CON_BANO.includes(t.nombre);
  };

  abrirDialogo(`<form id="form-cita">
    <h2>Editar cita</h2>
    <p><strong>${esc(cita.mascota)}</strong> · ${esc(cita.cliente)}</p>
    <div class="dos">
      <div><label for="e-dia">Día</label><input id="e-dia" type="date" value="${diaDe(cita.fecha_hora)}" required></div>
      <div><label for="e-hora">Hora</label><select id="e-hora">${opcionesHora(horaDe(cita.fecha_hora))}</select></div>
    </div>
    <label for="e-servicio">Servicio</label>
    <select id="e-servicio">${tipos.map((t) =>
      `<option value="${t.id}"${t.id === cita.tipo_id ? " selected" : ""}>${esc(t.nombre)}</option>`).join("")}</select>
    <label for="e-precio">Precio acordado</label>
    <input id="e-precio" type="number" min="0" step="any" value="${esc(cita.precio_acordado ?? "")}">
    ${htmlMedicado("e", cita.medicado, cita.recargo_medicado ?? "")}
    <label for="e-motivo">Motivo</label>
    <input id="e-motivo" value="${esc(cita.motivo ?? "")}" maxlength="200">
    <p id="e-error" class="error" role="alert"></p>
    <div class="acciones">
      <button type="button" class="btn alt" id="e-volver">Volver</button>
      <button type="submit" class="btn">Guardar cambios</button>
    </div>
  </form>`);

  $("#e-bloque").hidden = !esBano();
  conectarMedicado("e", "#e-precio");
  $("#e-servicio").addEventListener("change", () => {
    const si = esBano();
    $("#e-bloque").hidden = !si;
    if (!si && $("#e-medicado").checked) {
      $("#e-medicado").checked = false;
      $("#e-medicado").dispatchEvent(new Event("change"));
    }
  });
  $("#e-volver").addEventListener("click", () => cerrarDialogo());
  $("#form-cita").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const medicado = esBano() && $("#e-medicado").checked;
    try {
      await q(db.from("citas").update({
        tipo_id: Number($("#e-servicio").value),
        fecha_hora: bogotaAISO(`${$("#e-dia").value}T${$("#e-hora").value}`),
        precio_acordado: $("#e-precio").value === "" ? null : Number($("#e-precio").value),
        motivo: $("#e-motivo").value.trim() || null,
        medicado,
        recargo_medicado: medicado && $("#e-recargo").value !== "" ? Number($("#e-recargo").value) : null,
      }).eq("id", cita.id));
      cerrarDialogo();
      aviso("Cita actualizada.");
      if (alGuardar) alGuardar();
    } catch (error) {
      $("#e-error").textContent = mensajeError(error);
    }
  });
}

// Corregir el servicio que nació de una cita ya realizada.
async function corregirServicioDeCita(cita, alGuardar) {
  try {
    const filas = await q(db.from("servicios").select("id").eq("cita_id", cita.id));
    if (!filas.length) { aviso("Esta cita no tiene un servicio asociado.", true); return; }
    editarServicio(filas[0].id, alGuardar);
  } catch (error) {
    aviso(mensajeError(error), true);
  }
}

// Eliminar una cita. Si ya estaba realizada, también se borra su servicio del historial
// (así deja de contar como servicio realizado y para los recordatorios).
async function eliminarCita(cita, alGuardar) {
  const pregunta = cita.estado === "realizada"
    ? `¿Eliminar la cita de ${cita.mascota}?\n\nTambién se borrará su servicio del historial y dejará de contar como servicio realizado. Esto no se puede deshacer.`
    : `¿Eliminar la cita de ${cita.mascota}? Esto no se puede deshacer.`;
  if (!window.confirm(pregunta)) return;
  try {
    await q(db.from("servicios").delete().eq("cita_id", cita.id));
    const borradas = await q(db.from("citas").delete().eq("id", cita.id).select("id"));
    if (!borradas.length) throw new Error("permission denied");
    aviso("Cita eliminada.");
    if (alGuardar) alGuardar();
  } catch (error) {
    aviso(mensajeError(error), true);
  }
}

async function cancelarCita(cita) {
  if (!window.confirm(`¿Cancelar la cita de ${cita.mascota}?`)) return;
  try {
    await q(db.from("citas").update({ estado: "cancelada" }).eq("id", cita.id));
    aviso("Cita cancelada.");
    cargarAgenda();
  } catch (error) {
    aviso(mensajeError(error), true);
  }
}

/* ---------- Pantalla Agenda ---------- */
const FILTROS_AGENDA = {
  hoy: "Hoy",
  semana: "Próximos 7 días",
  pendientes: "Pendientes",
  todas: "Todas (últimas 100)",
};
let filtroAgenda = "hoy";

async function cargarAgenda() {
  const caja = $("#lista-agenda");
  if (!caja) return;
  try {
    const hoy = hoyISO();
    let consulta = db.from("agenda").select("*");
    if (filtroAgenda === "hoy") {
      consulta = consulta.gte("fecha_hora", inicioDiaBogota(hoy)).lt("fecha_hora", inicioDiaBogota(sumarDias(hoy, 1)));
    } else if (filtroAgenda === "semana") {
      consulta = consulta.gte("fecha_hora", inicioDiaBogota(hoy)).lt("fecha_hora", inicioDiaBogota(sumarDias(hoy, 7)));
    } else if (filtroAgenda === "pendientes") {
      consulta = consulta.eq("estado", "pendiente");
    }
    consulta = filtroAgenda === "todas"
      ? consulta.order("fecha_hora", { ascending: false }).limit(100)
      : consulta.order("fecha_hora", { ascending: true });

    const citas = await q(consulta);
    if (!$("#lista-agenda")) return;
    if (!citas.length) {
      caja.innerHTML = '<p class="suave">No hay citas para este filtro.</p>';
      return;
    }
    const buscar = (b, atributo) => citas.find((c) => c.id === Number(b.dataset[atributo]));
    tablaInteractiva(caja, {
      id: "agenda",
      filas: citas,
      fila: filaCita,
      vacio: "Ninguna cita coincide con los filtros.",
      columnas: [
        { titulo: "Fecha y hora", valor: (c) => c.fecha_hora, texto: (c) => fechaHoraTexto(c.fecha_hora), filtro: "texto" },
        { titulo: "Mascota", valor: (c) => c.mascota, filtro: "texto" },
        { titulo: "Dueño", valor: (c) => c.cliente, texto: (c) => [c.cliente, c.telefono, c.telefono2].join(" "), filtro: "texto" },
        { titulo: "Servicio", valor: (c) => c.servicio ?? "", filtro: "lista" },
        { titulo: "Precio", valor: (c) => precioCita(c) === null || precioCita(c) === undefined ? null : Number(precioCita(c)), filtro: false },
        { titulo: "Estado", valor: (c) => c.estado, filtro: "lista" },
        { titulo: "", valor: () => "", ordenable: false, filtro: false },
      ],
      alPintar: (tbody) => {
        $$("[data-ficha]", tbody).forEach((b) => b.addEventListener("click", () =>
          abrirFichaEnDialogo(Number(b.dataset.ficha), cargarAgenda)));
        $$("[data-terminar]", tbody).forEach((b) => b.addEventListener("click", () =>
          abrirTerminarCita(buscar(b, "terminar"), cargarAgenda)));
        $$("[data-editar]", tbody).forEach((b) => b.addEventListener("click", () =>
          editarCita(buscar(b, "editar"), cargarAgenda)));
        $$("[data-corregir]", tbody).forEach((b) => b.addEventListener("click", () =>
          corregirServicioDeCita(buscar(b, "corregir"), cargarAgenda)));
        $$("[data-recoger]", tbody).forEach((b) => b.addEventListener("click", () =>
          abrirAvisoRecoger(buscar(b, "recoger"))));
        $$("[data-cancelar]", tbody).forEach((b) => b.addEventListener("click", () =>
          cancelarCita(buscar(b, "cancelar"))));
        $$("[data-eliminar]", tbody).forEach((b) => b.addEventListener("click", () =>
          eliminarCita(buscar(b, "eliminar"), cargarAgenda)));
      },
    });
  } catch (error) {
    mostrarError(caja, error);
  }
}

const precioCita = (c) => (c.estado === "realizada" ? c.precio_cobrado : (c.precio_acordado ?? c.precio));

function filaCita(c) {
  const clase = { pendiente: "", realizada: "ok", cancelada: "gris" }[c.estado] ?? "";
  let acciones = "";
  if (c.estado === "pendiente") {
    acciones = `<button class="btn" data-terminar="${c.id}">Terminar</button>
      <button class="btn alt" data-editar="${c.id}">Editar</button>
      <button class="btn alt" data-cancelar="${c.id}">Cancelar</button>`;
  } else if (c.estado === "realizada") {
    acciones = `<button class="btn alt" data-corregir="${c.id}">Corregir servicio</button>
      <button class="btn alt" data-recoger="${c.id}" title="Avisar por WhatsApp que ya puede recogerlo">📲 Avisar</button>`;
  }
  acciones += `<button class="btn peligro" data-eliminar="${c.id}" title="Eliminar cita">Eliminar</button>`;
  return `<tr>
    <td>${esc(fechaHoraTexto(c.fecha_hora))}</td>
    <td><button class="enlace" data-ficha="${c.mascota_id}" title="Ver ficha e historial">${esc(c.mascota)}</button></td>
    <td>${esc(c.cliente)}<div class="suave">${esc([c.telefono, c.telefono2].filter(Boolean).join(" / "))}</div></td>
    <td>${esc(c.servicio ?? "—")}${c.medicado ? ' <span class="etiqueta">medicado</span>' : ""}${c.guia ? `<div class="suave">guía ${esc(c.guia)}</div>` : ""}</td>
    <td>${dinero(precioCita(c))}</td>
    <td><span class="etiqueta ${clase}">${esc(c.estado)}</span></td>
    <td class="acciones-fila">${acciones}</td>
  </tr>`;
}

PANTALLAS.agenda = {
  html: () => `<h1>Agenda</h1>
    <p class="suave">Haz clic en el nombre de la mascota para ver su ficha e historial. Haz clic en un encabezado para ordenar y usa la fila de filtros para buscar.</p>
    <div class="tarjeta">
      <div class="filtros">${Object.entries(FILTROS_AGENDA).map(([clave, texto]) =>
        `<button class="chip" data-filtro="${clave}" aria-pressed="${clave === filtroAgenda}">${texto}</button>`).join("")}</div>
      <div id="lista-agenda"><p class="suave">Cargando…</p></div>
    </div>`,
  despues: async () => {
    $$("[data-filtro]").forEach((b) => b.addEventListener("click", () => {
      filtroAgenda = b.dataset.filtro;
      montarPantalla("agenda");
    }));
    await cargarAgenda();
  },
};