"use strict";

/* =====================================================================
   AGENDAR CITA: reconoce si la mascota ya vino, sugiere el precio y
   guarda sola al cliente y a la mascota si son nuevos.
   ===================================================================== */

let A = null; // estado de esta pantalla

function llenarRazas(forzada) {
  const especie = $("#a-especie").value;
  const actual = forzada !== undefined ? forzada : ($("#a-raza").value ? Number($("#a-raza").value) : null);
  $("#a-raza").innerHTML = '<option value="">(sin raza definida)</option>' +
    A.razas.filter((r) => r.especie === especie)
      .map((r) => `<option value="${r.id}"${r.id === actual ? " selected" : ""}>${esc(r.nombre)}</option>`).join("");
}

function pintarFicha() {
  const caja = $("#a-ficha");
  if (!caja) return;
  let h = "";
  if (A.sel) {
    const m = A.sel;
    h += `<div class="bien">✔ ${esc(m.mascota)} ya vino antes</div>
      <div class="suave">${esc(m.raza ?? "Sin raza")} · ${m.visitas} visita(s) · última: ${esc(fechaTexto(m.ultima_visita))}${m.activo ? "" : " · cliente inactivo (se reactivará al agendar)"}</div>`;
    if (m.descripcion_corte) h += `<p><strong>Corte:</strong> ${esc(m.descripcion_corte)}</p>`;
    if (A.guia) h += `<p><strong>Última guía:</strong> ${esc(A.guia.guia)} (${esc(fechaTexto(A.guia.fecha))})</p>`;
  } else {
    h += `<strong>Mascota nueva</strong><div class="suave">Se guardará sola (dueño y mascota) al agendar.</div>`;
  }

  const p = A.precio;
  if (p && p.valor !== null && p.valor !== undefined) {
    h += `<div class="bloque-precio"><div class="suave">${p.origen === "mascota"
      ? "Precio habitual de esta mascota" : "Precio sugerido por su raza"}</div>
      <div class="precio">${dinero(p.valor)}</div>`;
    if (p.origen === "mascota" && p.deRaza !== null && p.deRaza !== p.valor)
      h += `<div class="suave">La raza cuesta ${dinero(p.deRaza)}, pero a esta mascota le cobras ${dinero(p.valor)}.</div>`;
    h += `<div class="suave">Puedes cambiarlo antes de agendar.</div></div>`;
  } else {
    h += `<p class="suave">Sin precio sugerido: elige una raza con precio (Configuración) o escríbelo tú.</p>`;
  }

  if (A.sel && A.historial.length) {
    h += `<h3>Historial reciente</h3>` + A.historial.map((f) =>
      `<div class="item"><div>${esc(f.servicio)}<div class="suave">${esc(fechaTexto(f.fecha))}${f.guia ? " · guía " + esc(f.guia) : ""}</div></div><strong>${dinero(f.precio_cobrado)}</strong></div>`).join("");
  }
  caja.innerHTML = h;
}

let tokenPrecio = 0;
async function actualizarPrecio() {
  const token = ++tokenPrecio;
  const tipoId = Number($("#a-servicio").value);
  const tipo = A.tipos.find((t) => t.id === tipoId);
  const razaElegida = A.razas.find((r) => r.id === Number($("#a-raza").value));
  const deRaza = precioRaza(razaElegida, tipo && tipo.nombre);
  let valor = null, origen = null;

  if (A.sel) {
    try {
      const filas = await q(db.from("precios_sugeridos").select("precio_sugerido,origen")
        .eq("mascota_id", A.sel.mascota_id).eq("tipo_id", tipoId));
      if (filas[0]) { valor = filas[0].precio_sugerido; origen = filas[0].origen; }
    } catch (error) { /* si falla, se usa el precio de la raza */ }
  }
  if (token !== tokenPrecio || !$("#a-precio")) return; // llegó una respuesta vieja
  if (valor === null && deRaza !== null) { valor = deRaza; origen = "raza"; }
  A.precio = { valor, origen, deRaza };
  if (!A.precioEditado) $("#a-precio").value = valor ?? "";
  pintarFicha();
}

async function elegir(m) {
  A.sel = m;
  A.precioEditado = false;
  A.historial = [];
  A.guia = null;
  $("#a-mascota").value = m.mascota;
  $("#a-telefono").value = m.telefono ?? "";
  $("#a-dueno").value = m.cliente;
  $("#a-especie").value = m.especie;
  llenarRazas(m.raza_id);
  $("#a-sugerencias").innerHTML = "";
  try {
    const [historial, guia] = await Promise.all([
      q(db.from("historial").select("*").eq("mascota_id", m.mascota_id).order("fecha", { ascending: false }).limit(5)),
      q(db.from("ultima_guia").select("guia,fecha").eq("mascota_id", m.mascota_id)),
    ]);
    A.historial = historial;
    A.guia = guia[0] ?? null;
  } catch (error) { aviso(mensajeError(error), true); }
  await actualizarPrecio();
}

function quitarSeleccion() {
  if (!A.sel) return;
  A.sel = null;
  A.historial = [];
  A.guia = null;
  A.precioEditado = false;
  actualizarPrecio();
}

async function buscarCoincidencias(termino) {
  const caja = $("#a-sugerencias");
  if (!caja) return;
  const t = terminoSeguro(termino);
  if (t.length < 2) { caja.innerHTML = ""; return; }
  try {
    const filas = await q(db.from("mascotas_resumen").select("*")
      .or(`mascota.ilike.*${t}*,telefono.ilike.*${t}*,cliente.ilike.*${t}*`)
      .order("mascota").limit(6));
    if (!$("#a-sugerencias")) return;
    A.coincidencias = filas;
    caja.innerHTML = filas.map((m, i) => `<button type="button" role="option" data-i="${i}">
      <strong>${esc(m.mascota)}</strong> · ${esc(m.raza ?? m.especie)} — ${esc(m.cliente)} · ${esc(m.telefono ?? "")}
      <span class="suave">· ${plural(m.visitas)}</span></button>`).join("");
    $$("button", caja).forEach((b) => b.addEventListener("click", () => elegir(A.coincidencias[Number(b.dataset.i)])));

    // Si el nombre y el teléfono coinciden exactamente con una mascota, se elige sola.
    const nombre = $("#a-mascota").value.trim().toLowerCase();
    const tel = limpiarTelefono($("#a-telefono").value);
    const exacta = filas.find((m) => m.mascota.toLowerCase() === nombre && limpiarTelefono(m.telefono) === tel);
    if (exacta && (!A.sel || A.sel.mascota_id !== exacta.mascota_id)) await elegir(exacta);
  } catch (error) { /* la búsqueda es una ayuda: si falla no se interrumpe */ }
}
const plural = (n) => (n === 1 ? "1 visita" : `${n} visitas`);
const buscarConPausa = debounce(buscarCoincidencias, 300);

async function enviarAgendar(evento) {
  evento.preventDefault();
  const error = $("#a-error");
  error.textContent = "";
  const boton = $("button[type=submit]", evento.target);
  const datos = {
    p_cliente_nombre: $("#a-dueno").value.trim(),
    p_telefono: limpiarTelefono($("#a-telefono").value),
    p_mascota_nombre: $("#a-mascota").value.trim(),
    p_especie: $("#a-especie").value,
    p_raza_id: $("#a-raza").value ? Number($("#a-raza").value) : null,
    p_tipo_id: Number($("#a-servicio").value),
    p_fecha_hora: $("#a-fecha").value ? bogotaAISO($("#a-fecha").value) : null,
    p_precio: $("#a-precio").value === "" ? null : Number($("#a-precio").value),
    p_motivo: $("#a-motivo").value.trim() || null,
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
    <p class="suave">Si la mascota ya vino, se completan sus datos y se sugiere su precio. Si es nueva, se guarda sola.</p>
    <div class="columnas derecha">
      <form id="form-agendar" class="tarjeta" autocomplete="off">
        <div class="dos">
          <div><label for="a-mascota">Mascota *</label><input id="a-mascota" required></div>
          <div><label for="a-telefono">Teléfono del dueño *</label><input id="a-telefono" inputmode="tel" required></div>
        </div>
        <div id="a-sugerencias" class="sugerencias" role="listbox" aria-label="Coincidencias"></div>
        <div class="dos">
          <div><label for="a-dueno">Nombre del dueño *</label><input id="a-dueno" required></div>
          <div><label for="a-especie">Especie *</label>
            <select id="a-especie"><option value="perro">Perro</option><option value="gato">Gato</option></select></div>
          <div><label for="a-raza">Raza</label><select id="a-raza"></select></div>
          <div><label for="a-servicio">Servicio *</label><select id="a-servicio"></select></div>
          <div><label for="a-fecha">Fecha y hora *</label><input id="a-fecha" type="datetime-local" required></div>
          <div><label for="a-precio">Precio acordado</label><input id="a-precio" type="number" min="0" step="any"></div>
        </div>
        <label for="a-motivo">Motivo (opcional)</label>
        <input id="a-motivo" maxlength="200">
        <p id="a-error" class="error" role="alert"></p>
        <button class="btn grande" type="submit">Agendar cita</button>
      </form>
      <div id="a-ficha" class="ficha"></div>
    </div>`,

  despues: async () => {
    A = { razas: [], tipos: [], sel: null, historial: [], guia: null, precio: null, precioEditado: false, coincidencias: [] };
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
    const corteBano = A.tipos.find((t) => t.nombre === "Corte y baño");
    if (corteBano) $("#a-servicio").value = corteBano.id;
    $("#a-fecha").value = sumarDias(hoyISO(), 1) + "T10:00";
    llenarRazas();
    pintarFicha();

    for (const id of ["#a-mascota", "#a-telefono"]) {
      $(id).addEventListener("input", (evento) => {
        quitarSeleccion();
        buscarConPausa(evento.target.value);
      });
    }
    $("#a-especie").addEventListener("change", () => { llenarRazas(); A.precioEditado = false; actualizarPrecio(); });
    $("#a-raza").addEventListener("change", () => { A.precioEditado = false; actualizarPrecio(); });
    $("#a-servicio").addEventListener("change", () => { A.precioEditado = false; actualizarPrecio(); });
    $("#a-precio").addEventListener("input", () => { A.precioEditado = true; });
    $("#form-agendar").addEventListener("submit", enviarAgendar);

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