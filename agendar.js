"use strict";

/* =====================================================================
   AGENDAR CITA: reconoce si la mascota ya vino (por cualquiera de los dos
   teléfonos), sugiere el precio y guarda sola al cliente y la mascota.
   ===================================================================== */

let A = null; // estado de esta pantalla

const necesitaBano = () => {
  const tipo = A.tipos.find((t) => t.id === Number($("#a-servicio").value));
  return !!tipo && SERVICIOS_CON_BANO.includes(tipo.nombre);
};
const recargoActual = () => (necesitaBano() && $("#a-medicado").checked ? (Number($("#a-recargo").value) || 0) : 0);

function reiniciarPrecio() {
  A.precioEditado = false;
  A.recargoEditado = false;
}

function llenarRazas(forzada) {
  const especie = $("#a-especie").value;
  const actual = forzada !== undefined ? forzada : ($("#a-raza").value ? Number($("#a-raza").value) : null);
  $("#a-raza").innerHTML = '<option value="">(sin raza definida)</option>' +
    A.razas.filter((r) => r.especie === especie)
      .map((r) => `<option value="${r.id}"${r.id === actual ? " selected" : ""}>${esc(r.nombre)}</option>`).join("");
}

function ajustarBloqueMedicado() {
  const si = necesitaBano();
  $("#a-bloque").hidden = !si;
  const casilla = $("#a-medicado");
  if (!si && casilla.checked) {
    casilla.checked = false;
    casilla.dispatchEvent(new Event("change")); // resta el recargo del precio
  }
}

/* ---------- Día y hora ---------- */
async function pintarDia() {
  const dia = $("#a-dia").value;
  $$("[data-dia]").forEach((b) =>
    b.setAttribute("aria-pressed", String(sumarDias(hoyISO(), Number(b.dataset.dia)) === dia)));
  $("#a-dia-texto").textContent = dia ? diaTexto(dia) : "";
  if (!dia) return;
  try {
    const citas = await q(db.from("agenda").select("fecha_hora,mascota")
      .gte("fecha_hora", inicioDiaBogota(dia)).lt("fecha_hora", inicioDiaBogota(sumarDias(dia, 1)))
      .neq("estado", "cancelada").order("fecha_hora"));
    if (!$("#a-dia") || $("#a-dia").value !== dia) return;
    $("#a-ocupadas").textContent = citas.length
      ? "Ese día ya tienes: " + citas.map((c) => `${horaTexto(c.fecha_hora)} ${c.mascota}`).join(" · ")
      : "Ese día no tienes citas todavía.";
  } catch (error) { /* es solo una ayuda */ }
}

function pintarFicha() {
  const caja = $("#a-ficha");
  if (!caja) return;
  let h = "";
  if (A.sel) {
    const m = A.sel;
    const telefonos = [m.telefono, m.telefono2].filter(Boolean).join(" · ");
    // "Ya vino" solo cuenta si hay servicios TERMINADOS (visitas > 0).
    const resumen = m.visitas > 0
      ? `${m.visitas} visita(s) · última: ${fechaTexto(m.ultima_visita)}`
      : "aún sin servicios terminados";
    h += m.visitas > 0
      ? `<div class="bien">✔ ${esc(m.mascota)} ya vino antes</div>`
      : `<div class="bien">🐾 Primera vez de ${esc(m.mascota)}</div>`;
    h += `<div class="suave">${esc(m.raza ?? "Sin raza")} · ${esc(resumen)}${m.activo ? "" : " · cliente inactivo (se reactivará al agendar)"}</div>
      <div class="suave">${esc(m.cliente)} · ${esc(telefonos)}</div>`;
    if (m.descripcion_corte) h += `<p><strong>Corte:</strong> ${esc(m.descripcion_corte)}</p>`;
    if (A.guia) h += `<p><strong>Última guía:</strong> ${esc(A.guia.guia)} (${esc(fechaTexto(A.guia.fecha))})</p>`;
    const ultima = A.historial.find((f) => f.mascota_id === m.mascota_id);
    if (ultima && ultima.medicado) h += `<div class="alerta-medicado">⚠ La última vez fue con baño medicado</div>`;
  } else {
    h += `<strong>Mascota nueva</strong><div class="suave">Se guardará sola (dueño y mascota) al agendar.</div>`;
  }

  const p = A.precio;
  if (p && p.valor !== null && p.valor !== undefined) {
    const recargo = recargoActual();
    h += `<div class="bloque-precio"><div class="suave">${p.origen === "mascota"
      ? "Precio habitual de esta mascota" : "Precio sugerido por su raza"}</div>
      <div class="precio">${dinero(p.valor)}</div>`;
    if (recargo) h += `<div class="suave">+ baño medicado ${dinero(recargo)} = <strong>${dinero(p.valor + recargo)}</strong></div>`;
    if (p.origen === "mascota" && p.deRaza !== null && p.deRaza !== p.valor)
      h += `<div class="suave">La raza cuesta ${dinero(p.deRaza)}, pero a esta mascota le cobras ${dinero(p.valor)}.</div>`;
    h += `<div class="suave">Puedes cambiarlo antes de agendar.</div></div>`;
  } else {
    h += `<p class="suave">Sin precio sugerido: elige una raza con precio (Catálogos) o escríbelo tú.</p>`;
  }

  if (A.sel) h += htmlHistorialAgendar();
  caja.innerHTML = h;
}
/* ---------- Historial de servicios terminados (columna derecha) ---------- */
const HIST_INICIAL = 5;

function htmlHistorialAgendar() {
  const filas = A.historial;
  const visibles = A.verTodo ? filas : filas.slice(0, HIST_INICIAL);
  const total = filas.reduce((suma, f) => suma + (Number(f.precio_cobrado) || 0), 0);
  let h = `<div class="hist-agendar"><div class="hist-cabecera"><h3>Servicios terminados</h3>
    <label class="casilla pequena"><input type="checkbox" id="a-hist-todas"${A.histTodas ? " checked" : ""}>
      Incluir las demás mascotas de ${esc(A.sel.cliente)}</label></div>`;
  if (!filas.length) return h + '<p class="suave">Todavía no tiene servicios terminados.</p></div>';
  h += `<ul class="hist-lista">${visibles.map((f) => `<li>
      <span class="hist-fecha">${esc(fechaTexto(f.fecha))}${f.hora ? ` · ${esc(f.hora)}` : ""}</span>
      <span class="hist-detalle">${esc(f.servicio ?? "")}${f.medicado ? " · medicado" : ""}${A.histTodas ? ` · <strong>${esc(f.mascota ?? "")}</strong>` : ""}</span>
      <span class="hist-valor">${dinero(f.precio_cobrado)}</span></li>`).join("")}</ul>`;
  if (filas.length > HIST_INICIAL) {
    h += `<button type="button" class="enlace pequeno" data-hist-mas>${A.verTodo ? "Ver menos" : `Ver más (${filas.length - HIST_INICIAL} más)`}</button>`;
  }
  return h + `<p class="hist-total">${filas.length} ${filas.length === 1 ? "servicio" : "servicios"} · Total ${dinero(total)}</p></div>`;
}

// Trae los servicios terminados (de la mascota o de todas las del dueño) con su hora.
async function cargarHistorialAgendar() {
  const sel = A.sel;
  if (!sel) return;
  let consulta = db.from("historial").select("*").order("fecha", { ascending: false }).limit(500);
  consulta = A.histTodas ? consulta.eq("cliente_id", sel.cliente_id) : consulta.eq("mascota_id", sel.mascota_id);
  const filas = await q(consulta);
  // La hora sale de la cita de la que nació cada servicio.
  try {
    const ids = filas.map((f) => f.id);
    if (ids.length) {
      const servicios = await q(db.from("servicios").select("id,cita_id").in("id", ids));
      const idsCita = servicios.map((x) => x.cita_id).filter(Boolean);
      const citas = idsCita.length ? await q(db.from("citas").select("id,fecha_hora").in("id", idsCita)) : [];
      const horaCita = new Map(citas.map((c) => [c.id, c.fecha_hora]));
      const horaServicio = new Map(servicios.map((x) => [x.id, horaCita.get(x.cita_id)]));
      filas.forEach((f) => {
        const fh = horaServicio.get(f.id);
        f.hora = fh ? horaTexto(fh) : "";
        f.orden = (f.fecha ?? "") + (fh ? horaDe(fh) : "");
      });
      filas.sort((a, b) => comparar(b.orden, a.orden));
    }
  } catch (error) { /* sin hora: se muestra solo la fecha */ }
  if (A.sel !== sel) return; // cambiaste de mascota mientras cargaba
  A.historial = filas;
}

/* ---------- Precio ---------- */
let tokenPrecio = 0;
async function actualizarPrecio() {
  const token = ++tokenPrecio;
  const tipoId = Number($("#a-servicio").value);
  const tipo = A.tipos.find((t) => t.id === tipoId);
  const razaElegida = A.razas.find((r) => r.id === Number($("#a-raza").value));
  const deRaza = precioRaza(razaElegida, tipo && tipo.nombre);
  let valor = null, origen = null;
  let recargoRaza = razaElegida ? (razaElegida.recargo_medicado ?? null) : null;

  if (A.sel) {
    try {
      const filas = await q(db.from("precios_sugeridos").select("precio_sugerido,origen,recargo_medicado")
        .eq("mascota_id", A.sel.mascota_id).eq("tipo_id", tipoId));
      if (filas[0]) {
        valor = filas[0].precio_sugerido;
        origen = filas[0].origen;
        if (filas[0].recargo_medicado !== null) recargoRaza = filas[0].recargo_medicado;
      }
    } catch (error) { /* si falla, se usa el precio de la raza */ }
  }
  if (token !== tokenPrecio || !$("#a-precio")) return; // llegó una respuesta vieja
  if (valor === null && deRaza !== null) { valor = deRaza; origen = "raza"; }
  A.precio = { valor, origen, deRaza };
  A.recargoRaza = recargoRaza;

  if (necesitaBano() && $("#a-medicado").checked && !A.recargoEditado) $("#a-recargo").value = recargoRaza ?? "";
  if (!A.precioEditado) {
    const recargo = recargoActual();
    $("#a-precio").value = valor === null ? "" : valor + recargo;
    A.med.fijar(recargo);
  }
  pintarFicha();
}

/* ---------- Elegir una mascota existente ---------- */
async function elegir(m) {
  A.sel = m;
  reiniciarPrecio();
  A.historial = [];
  A.verTodo = false;
  A.histTodas = false;
  A.guia = null;
  $("#a-mascota").value = m.mascota;
  $("#a-telefono").value = m.telefono ?? "";
  $("#a-telefono2").value = m.telefono2 ?? "";
  $("#a-dueno").value = m.cliente;
  $("#a-especie").value = m.especie;
  llenarRazas(m.raza_id);
  $("#a-sugerencias").innerHTML = "";
  try {
    const [, guia] = await Promise.all([
      cargarHistorialAgendar(),
      q(db.from("ultima_guia").select("guia,fecha").eq("mascota_id", m.mascota_id)),
    ]);
    A.guia = guia[0] ?? null;
  } catch (error) { aviso(mensajeError(error), true); }
  await actualizarPrecio();
}

function quitarSeleccion() {
  if (!A.sel) return;
  A.sel = null;
  A.historial = [];
  A.guia = null;
  reiniciarPrecio();
  actualizarPrecio();
}

async function buscarCoincidencias(termino) {
  const caja = $("#a-sugerencias");
  if (!caja) return;
  const t = terminoSeguro(termino);
  if (t.length < 2) { caja.innerHTML = ""; return; }
  try {
    const filas = await q(db.from("mascotas_resumen").select("*")
      .or(filtroBusqueda(t)).order("mascota").limit(6));
    if (!$("#a-sugerencias")) return;
    A.coincidencias = filas;
    caja.innerHTML = filas.map((m, i) => `<button type="button" role="option" data-i="${i}">
      <strong>${esc(m.mascota)}</strong> · ${esc(m.raza ?? m.especie)} — ${esc(m.cliente)} · ${esc([m.telefono, m.telefono2].filter(Boolean).join(" / "))}
      <span class="suave">· ${plural(m.visitas)}</span></button>`).join("");
    $$("button", caja).forEach((b) => b.addEventListener("click", () => elegir(A.coincidencias[Number(b.dataset.i)])));

    // Si el nombre y un teléfono coinciden exactamente con una mascota, se elige sola.
    const nombre = $("#a-mascota").value.trim().toLowerCase();
    const tel = limpiarTelefono($("#a-telefono").value);
    const exacta = tel && filas.find((m) => m.mascota.toLowerCase() === nombre &&
      [limpiarTelefono(m.telefono), limpiarTelefono(m.telefono2)].includes(tel));
    if (exacta && (!A.sel || A.sel.mascota_id !== exacta.mascota_id)) await elegir(exacta);
  } catch (error) { /* la búsqueda es una ayuda: si falla no se interrumpe */ }
}
const plural = (n) => (n === 1 ? "1 visita" : `${n} visitas`);
const buscarConPausa = debounce(buscarCoincidencias, 300);

/* ---------- Guardar ---------- */
async function enviarAgendar(evento) {
  evento.preventDefault();
  const error = $("#a-error");
  error.textContent = "";
  const boton = $("button[type=submit]", evento.target);
  const dia = $("#a-dia").value, hora = $("#a-hora").value;
  const medicado = necesitaBano() && $("#a-medicado").checked;
  const datos = {
    p_cliente_nombre: $("#a-dueno").value.trim(),
    p_telefono: limpiarTelefono($("#a-telefono").value),
    p_mascota_nombre: $("#a-mascota").value.trim(),
    p_especie: $("#a-especie").value,
    p_raza_id: $("#a-raza").value ? Number($("#a-raza").value) : null,
    p_tipo_id: Number($("#a-servicio").value),
    p_fecha_hora: dia && hora ? bogotaAISO(`${dia}T${hora}`) : null,
    p_precio: $("#a-precio").value === "" ? null : Number($("#a-precio").value),
    p_motivo: $("#a-motivo").value.trim() || null,
    p_telefono2: limpiarTelefono($("#a-telefono2").value) || null,
    p_medicado: medicado,
    p_recargo: medicado && $("#a-recargo").value !== "" ? Number($("#a-recargo").value) : null,
  };
  if (!datos.p_cliente_nombre || !datos.p_telefono || !datos.p_mascota_nombre || !datos.p_fecha_hora) {
    error.textContent = "Faltan datos obligatorios (los marcados con *).";
    return;
  }
  boton.disabled = true;
  boton.textContent = "Agendando…";
  try {
    const filas = await q(db.rpc("registrar_cita", datos));
    const r = filas[0];
    if (A.sel && !A.sel.raza_id && datos.p_raza_id) {
      await q(db.from("mascotas").update({ raza_id: datos.p_raza_id }).eq("id", A.sel.mascota_id));
    }
    const nuevos = [r.o_cliente_nuevo ? "cliente nuevo" : null, r.o_mascota_nueva ? "mascota nueva" : null].filter(Boolean);
    aviso("Cita agendada" + (nuevos.length ? " · se guardó: " + nuevos.join(" y ") : ""));
    montarPantalla("agendar");
  } catch (fallo) {
    error.textContent = mensajeError(fallo);
    boton.disabled = false;
    boton.textContent = "Agendar cita";
  }
}

PANTALLAS.agendar = {
  html: () => `<h1>Agendar cita</h1>
    <p class="suave">Escribe el nombre o cualquiera de los dos teléfonos: si la mascota ya vino, se completan sus datos. Si es nueva, se guarda sola.</p>
    <div class="columnas derecha">
      <form id="form-agendar" class="tarjeta" autocomplete="off">
        <div class="dos">
          <div><label for="a-mascota">Mascota *</label><input id="a-mascota" required></div>
          <div><label for="a-telefono">Teléfono del dueño *</label><input id="a-telefono" inputmode="tel" required></div>
        </div>
        <div id="a-sugerencias" class="sugerencias" role="listbox" aria-label="Coincidencias"></div>
        <div class="dos">
          <div><label for="a-dueno">Nombre del dueño *</label><input id="a-dueno" required></div>
          <div><label for="a-telefono2">Segundo teléfono (opcional)</label><input id="a-telefono2" inputmode="tel"></div>
          <div><label for="a-especie">Especie *</label>
            <select id="a-especie"><option value="perro">Perro</option><option value="gato">Gato</option></select></div>
          <div><label for="a-raza">Raza</label><select id="a-raza"></select></div>
          <div><label for="a-servicio">Servicio *</label><select id="a-servicio"></select></div>
          <div><label for="a-precio">Precio acordado</label><input id="a-precio" type="number" min="0" step="any"></div>
        </div>
        ${htmlMedicado("a")}
        <div class="fecha-bloque">
          <label>¿Cuándo? *</label>
          <div class="filtros">
            <button type="button" class="chip" data-dia="0">Hoy</button>
            <button type="button" class="chip" data-dia="1">Mañana</button>
            <button type="button" class="chip" data-dia="2">Pasado mañana</button>
          </div>
          <div class="dos">
            <div><label for="a-dia">Día</label><input id="a-dia" type="date" required></div>
            <div><label for="a-hora">Hora</label><select id="a-hora">${opcionesHora("10:00")}</select></div>
          </div>
          <p id="a-dia-texto" class="dia-texto"></p>
          <p id="a-ocupadas" class="suave"></p>
        </div>
        <label for="a-motivo">Motivo (opcional)</label>
        <input id="a-motivo" maxlength="200">
        <p id="a-error" class="error" role="alert"></p>
        <button class="btn grande" type="submit">Agendar cita</button>
      </form>
      <div id="a-ficha" class="ficha"></div>
    </div>`,

  despues: async () => {
    A = { razas: [], tipos: [], sel: null, historial: [], verTodo: false, histTodas: false, guia: null, precio: null, recargoRaza: null,
          precioEditado: false, recargoEditado: false, coincidencias: [], med: { fijar() {} } };
    try {
      [A.razas, A.tipos] = await Promise.all([
        q(db.from("razas").select("*").order("nombre")),
        q(db.from("tipos_servicio").select("id,nombre").order("id")),
      ]);
    } catch (error) {
      mostrarError($("#a-ficha"), error);
      return;
    }
    $("#a-servicio").innerHTML = A.tipos.map((t) => `<option value="${t.id}">${esc(t.nombre)}</option>`).join("");
    const bano = A.tipos.find((t) => t.nombre === "Baño");
    if (bano) $("#a-servicio").value = bano.id; // predeterminado: Baño, para perros y gatos
    $("#a-dia").value = sumarDias(hoyISO(), 1);
    llenarRazas();
    ajustarBloqueMedicado();
    pintarDia();
    pintarFicha();

    for (const id of ["#a-mascota", "#a-telefono"]) {
      $(id).addEventListener("input", (evento) => {
        quitarSeleccion();
        buscarConPausa(evento.target.value);
      });
    }
    $("#a-telefono2").addEventListener("input", (evento) => { if (!A.sel) buscarConPausa(evento.target.value); });
    $("#a-especie").addEventListener("change", () => { llenarRazas(); reiniciarPrecio(); actualizarPrecio(); });
    $("#a-raza").addEventListener("change", () => { reiniciarPrecio(); actualizarPrecio(); });
    $("#a-servicio").addEventListener("change", () => { ajustarBloqueMedicado(); reiniciarPrecio(); actualizarPrecio(); });
    $("#a-precio").addEventListener("input", () => { A.precioEditado = true; A.med.fijar(recargoActual()); });

    // Baño medicado: al marcarlo se propone el recargo de la raza.
    $("#a-medicado").addEventListener("change", () => {
      const recargo = $("#a-recargo");
      if ($("#a-medicado").checked && recargo.value === "" && A.recargoRaza != null) recargo.value = A.recargoRaza;
    });
    $("#a-recargo").addEventListener("input", () => { A.recargoEditado = true; });
    A.med = conectarMedicado("a", "#a-precio", pintarFicha);

    // Día y hora
    $$("[data-dia]").forEach((b) => b.addEventListener("click", () => {
      $("#a-dia").value = sumarDias(hoyISO(), Number(b.dataset.dia));
      pintarDia();
    }));
    $("#a-dia").addEventListener("change", pintarDia);

    $("#form-agendar").addEventListener("submit", enviarAgendar);

    // Historial de la derecha: "Ver más" y "Incluir las demás mascotas".
    $("#a-ficha").addEventListener("click", (evento) => {
      if (!evento.target.closest("[data-hist-mas]")) return;
      A.verTodo = !A.verTodo;
      pintarFicha();
    });
    $("#a-ficha").addEventListener("change", async (evento) => {
      if (evento.target.id !== "a-hist-todas") return;
      A.histTodas = evento.target.checked;
      A.verTodo = false;
      try { await cargarHistorialAgendar(); } catch (error) { aviso(mensajeError(error), true); }
      pintarFicha();
    });

    // Si vienes desde "A quién buscar hoy", se rellena sola la mascota.
    const previo = estado.agendarPrefill;
    estado.agendarPrefill = null;
    if (previo) {
      $("#a-mascota").value = previo.mascota;
      $("#a-telefono").value = previo.telefono ?? "";
      await buscarCoincidencias(previo.telefono || previo.mascota);
    } else {
      await actualizarPrecio();
    }
    $("#a-mascota").focus();
  },
};