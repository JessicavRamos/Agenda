"use strict";

/* =====================================================================
   AGENDA y cuadro "Terminar cita" (también lo usa la pantalla Hoy)
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

  abrirDialogo(`<form id="form-terminar">
    <h2>Terminar cita</h2>
    <p><strong>${esc(cita.mascota)}</strong> · ${esc(cita.servicio ?? "sin servicio")} · ${esc(fechaHoraTexto(cita.fecha_hora))}</p>
    <label for="t-guia">Guía usada${guiaPrevia ? " (viene la de la última vez)" : ""}</label>
    <select id="t-guia"><option value="">(sin guía)</option>${guias.map((g) =>
      `<option value="${g.id}"${g.id === guiaPrevia ? " selected" : ""}>${esc(g.nombre)}</option>`).join("")}</select>
    <label for="t-precio">Precio cobrado</label>
    <input id="t-precio" type="number" min="0" step="any" value="${esc(precio)}">
    <label for="t-notas">Notas del servicio</label>
    <input id="t-notas" maxlength="300">
    <p id="t-error" class="error" role="alert"></p>
    <div class="acciones">
      <button type="button" class="btn alt" id="t-volver">Volver</button>
      <button type="submit" class="btn">Marcar como realizada</button>
    </div>
  </form>`);

  $("#t-volver").addEventListener("click", cerrarDialogo);
  $("#form-terminar").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const boton = $("button[type=submit]", evento.target);
    boton.disabled = true;
    try {
      await q(db.from("citas").update({
        estado: "realizada",
        guia_id: $("#t-guia").value ? Number($("#t-guia").value) : null,
        precio_cobrado: $("#t-precio").value === "" ? null : Number($("#t-precio").value),
        notas_servicio: $("#t-notas").value.trim() || null,
      }).eq("id", cita.id));
      cerrarDialogo();
      aviso("Cita realizada: el servicio quedó en el historial.");
      if (alGuardar) alGuardar();
    } catch (error) {
      $("#t-error").textContent = mensajeError(error);
      boton.disabled = false;
    }
  });
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
    caja.innerHTML = `<div class="tabla-scroll"><table>
      <thead><tr><th>Fecha y hora</th><th>Mascota</th><th>Dueño</th><th>Servicio</th><th>Precio</th><th>Estado</th><th></th></tr></thead>
      <tbody>${citas.map(filaCita).join("")}</tbody></table></div>`;

    $$("[data-terminar]", caja).forEach((b) => b.addEventListener("click", () =>
      abrirTerminarCita(citas.find((c) => c.id === Number(b.dataset.terminar)), cargarAgenda)));
    $$("[data-cancelar]", caja).forEach((b) => b.addEventListener("click", () =>
      cancelarCita(citas.find((c) => c.id === Number(b.dataset.cancelar)))));
  } catch (error) {
    mostrarError(caja, error);
  }
}

function filaCita(c) {
  const precio = c.estado === "realizada" ? c.precio_cobrado : (c.precio_acordado ?? c.precio);
  const clase = { pendiente: "", realizada: "ok", cancelada: "gris" }[c.estado] ?? "";
  const acciones = c.estado === "pendiente"
    ? `<button class="btn" data-terminar="${c.id}">Terminar</button>
       <button class="btn alt" data-cancelar="${c.id}">Cancelar</button>`
    : "";
  return `<tr>
    <td>${esc(fechaHoraTexto(c.fecha_hora))}</td>
    <td><strong>${esc(c.mascota)}</strong></td>
    <td>${esc(c.cliente)}<div class="suave">${esc(c.telefono ?? "")}</div></td>
    <td>${esc(c.servicio ?? "—")}${c.guia ? `<div class="suave">guía ${esc(c.guia)}</div>` : ""}</td>
    <td>${dinero(precio)}</td>
    <td><span class="etiqueta ${clase}">${esc(c.estado)}</span></td>
    <td class="acciones-fila">${acciones}</td>
  </tr>`;
}

PANTALLAS.agenda = {
  html: () => `<h1>Agenda</h1>
    <p class="suave">Cambia el estado de la cita aquí. Al marcarla como realizada, el servicio queda en el historial.</p>
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