"use strict";

/* =====================================================================
   HOY: citas del día y a quién buscar
   (NOMBRE_NEGOCIO se define en app.js)
   ===================================================================== */

// "Descartar" quita a la mascota de "A quién buscar" solo para ESTE ciclo:
// cuando tenga un servicio nuevo, la próxima vez que le toque vuelve a aparecer.
let verDescartados = false;
const claveDescarte = (x) => `${x.mascota_id}|${x.grupo}|${x.ultima_fecha}`;

async function descartarPendiente(p) {
  try {
    const filas = await q(db.from("pendientes_descartados")
      .insert({ mascota_id: p.mascota_id, grupo: p.grupo, ultima_fecha: p.ultima_fecha }).select("id"));
    await cargarHoy();
    aviso(`${p.mascota} salió de la lista hasta su próximo servicio.`, false, {
      texto: "Deshacer",
      alHacer: () => restaurarPendiente(filas[0].id),
    });
  } catch (error) {
    aviso(mensajeError(error), true);
  }
}

async function restaurarPendiente(idDescarte) {
  try {
    await q(db.from("pendientes_descartados").delete().eq("id", idDescarte));
    await cargarHoy();
  } catch (error) {
    aviso(mensajeError(error), true);
  }
}

async function cargarHoy() {
  const hoy = hoyISO();
  const mes = hoy.slice(0, 8) + "01";
  let citas, todosPendientes, serviciosMes, descartes = [];
  try {
    [citas, todosPendientes, serviciosMes] = await Promise.all([
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
  try {
    descartes = await q(db.from("pendientes_descartados").select("id,mascota_id,grupo,ultima_fecha"));
  } catch (error) { /* si la tabla aún no existe, se muestran todos */ }
  if (!$("#h-citas")) return; // cambiaste de pantalla

  const idDescarte = new Map(descartes.map((d) => [claveDescarte(d), d.id]));
  const pendientes = todosPendientes.filter((p) => !idDescarte.has(claveDescarte(p)));
  const descartados = todosPendientes.filter((p) => idDescarte.has(claveDescarte(p)));

  const clientesPorBuscar = new Set(pendientes.map((p) => p.cliente_id)).size;
  $("#h-stats").innerHTML = `
    <div class="stat"><b>${citas.length}</b>Citas de hoy</div>
    <div class="stat"><b>${clientesPorBuscar}</b>Clientes por buscar</div>
    <div class="stat"><b>${serviciosMes}</b>Servicios este mes</div>`;

  $("#h-citas").innerHTML = citas.length ? citas.map((c) => `<div class="item">
      <div><strong>${esc(horaTexto(c.fecha_hora))} ·</strong>
        <button class="enlace" data-ficha="${c.mascota_id}" title="Ver ficha e historial">${esc(c.mascota)}</button>
        <span class="suave">${esc(c.cliente)}</span>
        <div class="suave">${esc(c.servicio ?? "sin servicio")}${c.medicado ? " (medicado)" : ""} · ${dinero(c.estado === "realizada" ? c.precio_cobrado : (c.precio_acordado ?? c.precio))}</div></div>
      <div class="acciones-fila">${c.estado === "pendiente"
        ? `<button class="btn" data-terminar="${c.id}">Terminar</button>`
        : `<span class="etiqueta ok">${esc(c.estado)}</span>
           <button class="btn alt" data-recoger="${c.id}" title="Avisar por WhatsApp que ya puede recogerlo">📲 Avisar</button>`}</div>
    </div>`).join("") : '<p class="suave">No tienes citas para hoy.</p>';

  $$("[data-terminar]", $("#h-citas")).forEach((b) => b.addEventListener("click", () =>
    abrirTerminarCita(citas.find((c) => c.id === Number(b.dataset.terminar)), cargarHoy)));
  $$("[data-recoger]", $("#h-citas")).forEach((b) => b.addEventListener("click", () =>
    abrirAvisoRecoger(citas.find((c) => c.id === Number(b.dataset.recoger)))));

  $("#h-pendientes").innerHTML = pendientes.length ? pendientes.map((p, i) => {
    const retraso = p.dias_de_retraso;
    return `<div class="item">
      <div><button class="enlace" data-ficha="${p.mascota_id}" title="Ver ficha e historial">${esc(p.mascota)}</button>
        <span class="suave">${esc(p.cliente)}</span>
        <div class="suave">${esc(p.grupo)} · último: ${esc(fechaTexto(p.ultima_fecha))}</div></div>
      <div class="acciones-fila">
        <span class="etiqueta ${retraso > 0 ? "atrasada" : ""}">${retraso <= 0 ? "Toca hoy" : `Hace ${retraso} ${retraso === 1 ? "día" : "días"}`}</span>
        <button class="btn" data-whatsapp="${i}">WhatsApp</button>
        <button class="btn alt" data-agendar="${i}">Agendar</button>
        <button class="btn alt" data-descartar="${i}" title="Quitar de esta lista hasta su próximo servicio">Descartar</button>
      </div></div>`;
  }).join("") : '<p class="suave">Nadie por buscar por ahora.</p>';

  // Descartados: se pueden ver y volver a poner en la lista.
  $("#h-descartados").innerHTML = descartados.length ? `
    <label class="casilla"><input type="checkbox" id="h-ver-descartados"${verDescartados ? " checked" : ""}>
      Ver descartados (${descartados.length})</label>
    ${verDescartados ? descartados.map((p) => `<div class="item descartado">
      <div><button class="enlace" data-ficha="${p.mascota_id}">${esc(p.mascota)}</button>
        <span class="suave">${esc(p.cliente)} · último: ${esc(fechaTexto(p.ultima_fecha))}</span></div>
      <button class="btn alt" data-restaurar="${idDescarte.get(claveDescarte(p))}">Volver a la lista</button></div>`).join("") : ""}` : "";
  const casillaDescartados = $("#h-ver-descartados");
  if (casillaDescartados) casillaDescartados.addEventListener("change", (e) => { verDescartados = e.target.checked; cargarHoy(); });
  $$("[data-restaurar]", $("#h-descartados")).forEach((b) => b.addEventListener("click", () =>
    restaurarPendiente(Number(b.dataset.restaurar))));
  $$("[data-descartar]", $("#h-pendientes")).forEach((b) => b.addEventListener("click", () =>
    descartarPendiente(pendientes[Number(b.dataset.descartar)])));

  $$("[data-ficha]", $("#pantalla")).forEach((b) => b.addEventListener("click", () =>
    abrirFichaEnDialogo(Number(b.dataset.ficha), cargarHoy)));

  $$("[data-whatsapp]", $("#h-pendientes")).forEach((b) => b.addEventListener("click", () => {
    const p = pendientes[Number(b.dataset.whatsapp)];
    const mensaje = `¡Hola, ${p.cliente}! 💚

Recibe un cordial saludo de parte de ${NOMBRE_NEGOCIO} 🐾

Queremos agradecerte por permitirnos cuidar y consentir a ${p.mascota} en su última visita el ${fechaTexto(p.ultima_fecha)}. ¡Fue un placer atenderlos! ✨

Nos encantaría volver a recibir a tu peludito para su próximo servicio de ${p.grupo.toLowerCase()} 🛁🌿.

Esperamos verlos muy pronto y seguir compartiendo momentos especiales con ustedes 🐶😸

¿Te gustaría agendar una cita para esta semana? 💚`;
    window.open(enlaceWhatsApp(p.telefono, mensaje), "_blank", "noopener");
  }));

  $$("[data-agendar]", $("#h-pendientes")).forEach((b) => b.addEventListener("click", () => {
    const p = pendientes[Number(b.dataset.agendar)];
    estado.agendarPrefill = { mascota: p.mascota, telefono: p.telefono };
    location.hash = "#/agendar";
  }));
}

PANTALLAS.hoy = {
  html: () => `<h1>Hoy</h1>
    <p class="suave">Lo que tienes que hacer y a quién escribirle. Haz clic en el nombre de una mascota para ver su ficha.</p>
    <div class="stats" id="h-stats"></div>
    <div class="columnas">
      <div class="tarjeta"><h2>Citas de hoy</h2><div id="h-citas"><p class="suave">Cargando…</p></div></div>
      <div class="tarjeta"><h2>A quién buscar hoy</h2><div id="h-pendientes"><p class="suave">Cargando…</p></div>
        <div id="h-descartados" class="descartados"></div></div>
    </div>`,
  despues: cargarHoy,
};