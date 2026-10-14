"use strict";

/* =====================================================================
   HOY: citas del día y a quién buscar
   ===================================================================== */

async function cargarHoy() {
  const hoy = hoyISO();
  const mes = hoy.slice(0, 8) + "01";
  let citas, pendientes, serviciosMes;
  try {
    [citas, pendientes, serviciosMes] = await Promise.all([
      q(db.from("agenda").select("*")
        .gte("fecha_hora", inicioDiaBogota(hoy)).lt("fecha_hora", inicioDiaBogota(sumarDias(hoy, 1)))
        .neq("estado", "cancelada").order("fecha_hora")),
      q(db.from("pendientes").select("*").order("dias_de_retraso", { ascending: false })),
      contar(db.from("servicios").select("id", { count: "exact", head: true }).gte("fecha", mes)),
    ]);
  } catch (error) {
    mostrarError($("#h-citas"), error);
    return;
  }
  if (!$("#h-citas")) return; // cambiaste de pantalla

  const clientesPorBuscar = new Set(pendientes.map((p) => p.cliente_id)).size;
  $("#h-stats").innerHTML = `
    <div class="stat"><b>${citas.length}</b>Citas de hoy</div>
    <div class="stat"><b>${clientesPorBuscar}</b>Clientes por buscar</div>
    <div class="stat"><b>${serviciosMes}</b>Servicios este mes</div>`;

  $("#h-citas").innerHTML = citas.length ? citas.map((c) => `<div class="item">
      <div><strong>${esc(horaTexto(c.fecha_hora))} · ${esc(c.mascota)}</strong> <span class="suave">${esc(c.cliente)}</span>
        <div class="suave">${esc(c.servicio ?? "sin servicio")} · ${dinero(c.estado === "realizada" ? c.precio_cobrado : (c.precio_acordado ?? c.precio))}</div></div>
      <div>${c.estado === "pendiente"
      ? `<button class="btn" data-terminar="${c.id}">Terminar</button>`
      : `<span class="etiqueta ok">${esc(c.estado)}</span>`}</div>
    </div>`).join("") : '<p class="suave">No tienes citas para hoy.</p>';

  $$("[data-terminar]", $("#h-citas")).forEach((b) => b.addEventListener("click", () =>
    abrirTerminarCita(citas.find((c) => c.id === Number(b.dataset.terminar)), cargarHoy)));

  $("#h-pendientes").innerHTML = pendientes.length ? pendientes.map((p, i) => {
    const retraso = p.dias_de_retraso;
    const mensaje = `¡Hola ${p.cliente}! 

Recibe un cordial saludo de parte de Pet Garden SPA

Queremos agradecerte por permitirnos cuidar y consentir a ${p.mascota} en su última visita el ${fechaTexto(p.ultima_fecha)}. ¡Fue un placer atenderlos! 

Nos encantaría volver a recibir a tu bebé para su próximo servicio de ${p.grupo.toLowerCase()}.

Esperamos verlos muy pronto y seguir compartiendo momentos especiales con ustedes.

¿Te gustaría agendar una cita para esta semana? `;
    return `<div class="item">
      <div><strong>${esc(p.mascota)}</strong> <span class="suave">${esc(p.cliente)}</span>
        <div class="suave">${esc(p.grupo)} · último: ${esc(fechaTexto(p.ultima_fecha))}</div></div>
      <div class="acciones-fila">
        <span class="etiqueta ${retraso > 0 ? "atrasada" : ""}">${retraso <= 0 ? "Toca hoy" : `Hace ${retraso} ${retraso === 1 ? "día" : "días"}`}</span>
        <a class="btn" target="_blank" rel="noopener" href="${esc(enlaceWhatsApp(p.telefono, mensaje))}">WhatsApp</a>
        <button class="btn alt" data-agendar="${i}">Agendar</button>
      </div></div>`;
  }).join("") : '<p class="suave">Nadie por buscar por ahora.</p>';

  $$("[data-agendar]", $("#h-pendientes")).forEach((b) => b.addEventListener("click", () => {
    const p = pendientes[Number(b.dataset.agendar)];
    estado.agendarPrefill = { mascota: p.mascota, telefono: p.telefono };
    location.hash = "#/agendar";
  }));
}

PANTALLAS.hoy = {
  html: () => `<h1>Hoy</h1>
    <p class="suave">Lo que tienes que hacer y a quién escribirle.</p>
    <div class="stats" id="h-stats"></div>
    <div class="columnas">
      <div class="tarjeta"><h2>Citas de hoy</h2><div id="h-citas"><p class="suave">Cargando…</p></div></div>
      <div class="tarjeta"><h2>A quién buscar hoy</h2><div id="h-pendientes"><p class="suave">Cargando…</p></div></div>
    </div>`,
  despues: cargarHoy,
};