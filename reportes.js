"use strict";

/* =====================================================================
   REPORTES: resumen por fechas en pantalla y descarga de Excel con
   historial, mascotas, dueños, citas, totales por servicio y por mes.
   La librería de Excel (SheetJS) se descarga solo al pedir el archivo.
   ===================================================================== */

const URL_EXCEL = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
const FORMATO_DINERO = '"$"#,##0';
const FORMATO_FECHA = "dd/mm/yyyy";

const RANGOS = {
  mes: "Este mes",
  pasado: "Mes pasado",
  tres: "Últimos 3 meses",
  anio: "Este año",
  todo: "Todo",
};
let rangoReporte = "mes";
let fechasReporte = null; // { desde, hasta } elegidas (se recuerdan al volver a la pantalla)
let datosReporte = null; // lo último que se calculó (para el Excel)

function fechasDeRango(clave) {
  const hoy = hoyISO();
  const [a, m] = hoy.split("-").map(Number);
  const inicioMes = (anio, mes) => new Date(Date.UTC(anio, mes - 1, 1)).toISOString().slice(0, 10);
  if (clave === "mes") return { desde: inicioMes(a, m), hasta: hoy };
  if (clave === "pasado") return { desde: inicioMes(a, m - 1), hasta: sumarDias(inicioMes(a, m), -1) };
  if (clave === "tres") return { desde: inicioMes(a, m - 2), hasta: hoy };
  if (clave === "anio") return { desde: `${a}-01-01`, hasta: hoy };
  return { desde: "", hasta: "" };
}

const nombreMes = (aaaamm) => {
  const [a, m] = aaaamm.split("-").map(Number);
  const texto = new Date(Date.UTC(a, m - 1, 15)).toLocaleDateString("es-CO", { month: "long", year: "numeric", timeZone: "UTC" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};
const numero = (n) => Number(n) || 0;
const textoRango = (d, h) => (d || h) ? `${d ? fechaTexto(d) : "el inicio"} a ${h ? fechaTexto(h) : "hoy"}` : "Todo el historial";

/* ---------- Traer y calcular ---------- */
async function calcularReporte(desde, hasta) {
  const [historial, mascotas, clientes, citas] = await Promise.all([
    traerTodo(() => {
      let c = db.from("historial").select("*").order("fecha", { ascending: false }).order("id", { ascending: false });
      if (desde) c = c.gte("fecha", desde);
      if (hasta) c = c.lte("fecha", hasta);
      return c;
    }),
    traerTodo(() => db.from("mascotas_resumen").select("*").order("mascota").order("mascota_id")),
    traerTodo(() => db.from("clientes").select("id,nombre,telefono,telefono2,notas,activo").order("nombre").order("id")),
    traerTodo(() => {
      let c = db.from("agenda").select("*").order("fecha_hora", { ascending: false }).order("id", { ascending: false });
      if (desde) c = c.gte("fecha_hora", inicioDiaBogota(desde));
      if (hasta) c = c.lt("fecha_hora", inicioDiaBogota(sumarDias(hasta, 1)));
      return c;
    }),
  ]);

  const mascotaPorId = new Map(mascotas.map((m) => [m.mascota_id, m]));
  const filasHist = historial.map((f) => {
    const m = mascotaPorId.get(f.mascota_id) || {};
    return {
      fecha: f.fecha, mascota: f.mascota ?? m.mascota ?? "", mascota_id: f.mascota_id,
      cliente_id: f.cliente_id ?? m.cliente_id, especie: m.especie ?? "", raza: m.raza ?? "",
      cliente: m.cliente ?? "", telefono: m.telefono ?? "", servicio: f.servicio ?? "",
      medicado: !!f.medicado, recargo: f.recargo_medicado ?? null, guia: f.guia ?? "",
      precio: numero(f.precio_cobrado), notas: f.notas ?? "",
    };
  });

  // Totales por mascota y por dueño (en el período elegido)
  const porMascota = new Map(), porCliente = new Map();
  for (const f of filasHist) {
    const pm = porMascota.get(f.mascota_id) || { servicios: 0, total: 0, ultima: "" };
    pm.servicios++; pm.total += f.precio; if (f.fecha > pm.ultima) pm.ultima = f.fecha;
    porMascota.set(f.mascota_id, pm);
    const pc = porCliente.get(f.cliente_id) || { servicios: 0, total: 0 };
    pc.servicios++; pc.total += f.precio;
    porCliente.set(f.cliente_id, pc);
  }
  const filasMascotas = mascotas.map((m) => {
    const t = porMascota.get(m.mascota_id) || { servicios: 0, total: 0 };
    return { ...m, servicios_periodo: t.servicios, total_periodo: t.total };
  }).sort((a, b) => b.total_periodo - a.total_periodo || comparar(a.mascota, b.mascota));

  const mascotasDeCliente = new Map();
  for (const m of mascotas) {
    if (!mascotasDeCliente.has(m.cliente_id)) mascotasDeCliente.set(m.cliente_id, []);
    mascotasDeCliente.get(m.cliente_id).push(m.mascota);
  }
  const filasClientes = clientes.map((c) => {
    const t = porCliente.get(c.id) || { servicios: 0, total: 0 };
    const nombres = mascotasDeCliente.get(c.id) || [];
    return { ...c, num_mascotas: nombres.length, mascotas: nombres.join(", "), servicios_periodo: t.servicios, total_periodo: t.total };
  }).sort((a, b) => b.total_periodo - a.total_periodo || comparar(a.nombre, b.nombre));

  const agrupar = (clave) => {
    const mapa = new Map();
    for (const f of filasHist) {
      const k = clave(f);
      const g = mapa.get(k) || { nombre: k, cantidad: 0, total: 0 };
      g.cantidad++; g.total += f.precio;
      mapa.set(k, g);
    }
    return [...mapa.values()];
  };
  const porServicio = agrupar((f) => f.servicio || "(sin servicio)").sort((a, b) => b.total - a.total);
  const porMes = agrupar((f) => (f.fecha || "").slice(0, 7)).sort((a, b) => comparar(a.nombre, b.nombre))
    .map((g) => ({ ...g, nombre: g.nombre ? nombreMes(g.nombre) : "(sin fecha)" }));

  const ingresos = filasHist.reduce((s, f) => s + f.precio, 0);
  const resumen = {
    ingresos,
    servicios: filasHist.length,
    promedio: filasHist.length ? Math.round(ingresos / filasHist.length) : 0,
    medicados: filasHist.filter((f) => f.medicado).length,
    mascotasAtendidas: porMascota.size,
    clientesAtendidos: porCliente.size,
    mascotasRegistradas: mascotas.length,
    clientesRegistrados: clientes.length,
    clientesActivos: clientes.filter((c) => c.activo !== false).length,
    citas: citas.length,
    citasRealizadas: citas.filter((c) => c.estado === "realizada").length,
    citasPendientes: citas.filter((c) => c.estado === "pendiente").length,
    citasCanceladas: citas.filter((c) => c.estado === "cancelada").length,
  };
  return { desde, hasta, resumen, filasHist, filasMascotas, filasClientes, citas, porServicio, porMes };
}

/* ---------- Pantalla ---------- */
function htmlTablaSimple(titulo, grupos) {
  const total = grupos.reduce((s, g) => s + g.total, 0), cant = grupos.reduce((s, g) => s + g.cantidad, 0);
  return `<div class="tarjeta"><h2>${esc(titulo)}</h2>${grupos.length ? `<div class="tabla-scroll"><table>
    <thead><tr><th></th><th class="num">Cantidad</th><th class="num">Total</th></tr></thead>
    <tbody>${grupos.map((g) => `<tr><td>${esc(g.nombre)}</td><td class="num">${g.cantidad}</td><td class="num">${dinero(g.total)}</td></tr>`).join("")}</tbody>
    <tfoot><tr><th>Total</th><th class="num">${cant}</th><th class="num">${dinero(total)}</th></tr></tfoot></table></div>`
    : '<p class="suave">Sin servicios en este período.</p>'}</div>`;
}

function pintarReporte(d) {
  const r = d.resumen;
  $("#rep-resultado").innerHTML = `
    <p class="suave">Período: <strong>${esc(textoRango(d.desde, d.hasta))}</strong></p>
    <div class="stats stats-4">
      <div class="stat"><b>${dinero(r.ingresos)}</b>Ingresos por servicios</div>
      <div class="stat"><b>${r.servicios}</b>Servicios realizados</div>
      <div class="stat"><b>${dinero(r.promedio)}</b>Valor promedio por servicio</div>
      <div class="stat"><b>${r.mascotasAtendidas}</b>Mascotas atendidas</div>
      <div class="stat"><b>${r.clientesAtendidos}</b>Clientes atendidos</div>
      <div class="stat"><b>${r.medicados}</b>Baños medicados</div>
      <div class="stat"><b>${r.mascotasRegistradas}</b>Mascotas registradas (total)</div>
      <div class="stat"><b>${r.clientesRegistrados}</b>Clientes registrados (${r.clientesActivos} activos)</div>
    </div>
    <p class="suave">Citas del período: ${r.citas} · ${r.citasRealizadas} realizadas · ${r.citasPendientes} pendientes · ${r.citasCanceladas} canceladas</p>
    <div class="columnas">${htmlTablaSimple("Por servicio", d.porServicio)}${htmlTablaSimple("Por mes", d.porMes)}</div>
    <div class="tarjeta"><h2>Dueños</h2><p class="suave">Suma de lo que se le cobró a todas sus mascotas en el período.</p><div id="rep-clientes"></div></div>
    <div class="tarjeta"><h2>Mascotas</h2><p class="suave">Todas las mascotas registradas, con lo cobrado en el período.</p><div id="rep-mascotas"></div></div>`;

  tablaInteractiva($("#rep-clientes"), {
    id: "rep-clientes",
    filas: d.filasClientes,
    columnas: [
      { titulo: "Dueño", valor: (c) => c.nombre, filtro: "texto" },
      { titulo: "Teléfonos", valor: (c) => c.telefono, texto: (c) => [c.telefono, c.telefono2].join(" "), filtro: "texto" },
      { titulo: "Mascotas", valor: (c) => c.num_mascotas, texto: (c) => c.mascotas, filtro: "texto" },
      { titulo: "Servicios", valor: (c) => c.servicios_periodo, filtro: false, clase: "num" },
      { titulo: "Total", valor: (c) => c.total_periodo, filtro: false, clase: "num" },
    ],
    fila: (c) => `<tr><td>${esc(c.nombre)}${c.activo === false ? ' <span class="suave">· inactivo</span>' : ""}</td>
      <td>${esc([c.telefono, c.telefono2].filter(Boolean).join(" / "))}</td>
      <td>${c.num_mascotas}<div class="suave">${esc(c.mascotas)}</div></td>
      <td class="num">${c.servicios_periodo}</td><td class="num"><strong>${dinero(c.total_periodo)}</strong></td></tr>`,
  });
  tablaInteractiva($("#rep-mascotas"), {
    id: "rep-mascotas",
    filas: d.filasMascotas,
    columnas: [
      { titulo: "Mascota", valor: (m) => m.mascota, filtro: "texto" },
      { titulo: "Especie", valor: (m) => m.especie, filtro: "lista" },
      { titulo: "Raza", valor: (m) => m.raza ?? "", filtro: "lista" },
      { titulo: "Dueño", valor: (m) => m.cliente, filtro: "texto" },
      { titulo: "Última visita", valor: (m) => m.ultima_visita ?? "", filtro: false },
      { titulo: "Servicios", valor: (m) => m.servicios_periodo, filtro: false, clase: "num" },
      { titulo: "Total", valor: (m) => m.total_periodo, filtro: false, clase: "num" },
    ],
    fila: (m) => `<tr><td>${esc(m.mascota)}</td><td>${esc(m.especie)}</td><td>${esc(m.raza ?? "—")}</td>
      <td>${esc(m.cliente)}</td><td>${esc(fechaTexto(m.ultima_visita))}</td>
      <td class="num">${m.servicios_periodo}</td><td class="num"><strong>${dinero(m.total_periodo)}</strong></td></tr>`,
  });
}

async function cargarReporte() {
  const caja = $("#rep-resultado");
  if (!caja) return;
  const desde = $("#rep-desde").value, hasta = $("#rep-hasta").value;
  fechasReporte = { desde, hasta };
  if (desde && hasta && desde > hasta) {
    caja.innerHTML = '<p class="mal">✖ La fecha "desde" no puede ser posterior a la fecha "hasta".</p>';
    return;
  }
  caja.innerHTML = '<p class="suave">Calculando…</p>';
  $("#rep-excel").disabled = true;
  try {
    const d = await calcularReporte(desde, hasta);
    if (!$("#rep-resultado")) return;
    datosReporte = d;
    pintarReporte(d);
    $("#rep-excel").disabled = false;
  } catch (error) {
    mostrarError(caja, error);
  }
}

/* ---------- Excel ---------- */
const aFecha = (iso) => {
  if (!iso) return null;
  const [a, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return new Date(a, m - 1, d);
};

// Crea una hoja con encabezados, formato de dinero/fecha, filtros y una fila de totales.
function hojaExcel(encabezados, filas, { dinero: colsDinero = [], fecha: colsFecha = [], anchos = [], totales = null } = {}) {
  const XLSX = window.XLSX;
  const datos = [encabezados, ...filas];
  const hoja = XLSX.utils.aoa_to_sheet(datos, { cellDates: true });
  const ultimaFila = filas.length + 1; // número de fila en Excel (con encabezado)
  for (let r = 1; r <= filas.length; r++) {
    colsDinero.forEach((c) => { const cel = hoja[XLSX.utils.encode_cell({ r, c })]; if (cel && cel.t === "n") cel.z = FORMATO_DINERO; });
    colsFecha.forEach((c) => { const cel = hoja[XLSX.utils.encode_cell({ r, c })]; if (cel) cel.z = FORMATO_FECHA; });
  }
  if (filas.length) hoja["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: filas.length, c: encabezados.length - 1 } }) };
  if (totales && filas.length) {
    const r = filas.length + 1;
    XLSX.utils.sheet_add_aoa(hoja, [[totales.etiqueta]], { origin: { r, c: 0 } });
    (totales.sumar || []).forEach((c) => {
      const letra = XLSX.utils.encode_col(c);
      const valor = filas.reduce((s, f) => s + (Number(f[c]) || 0), 0);
      hoja[XLSX.utils.encode_cell({ r, c })] = {
        t: "n", v: valor, f: `SUM(${letra}2:${letra}${ultimaFila})`, z: colsDinero.includes(c) ? FORMATO_DINERO : "0",
      };
    });
    hoja["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c: encabezados.length - 1 } });
  }
  hoja["!cols"] = encabezados.map((e, i) => ({ wch: anchos[i] || Math.max(10, String(e).length + 2) }));
  return hoja;
}

async function descargarExcel() {
  const d = datosReporte;
  if (!d) return;
  const boton = $("#rep-excel");
  boton.disabled = true;
  boton.textContent = "Preparando Excel…";
  try {
    await cargarScript(URL_EXCEL);
    const XLSX = window.XLSX;
    const libro = XLSX.utils.book_new();
    const r = d.resumen;
    const siNo = (b) => (b ? "Sí" : "No");

    const resumen = XLSX.utils.aoa_to_sheet([
      [`Reporte de ${NOMBRE_NEGOCIO}`],
      ["Período", textoRango(d.desde, d.hasta)],
      ["Generado", new Date().toLocaleString("es-CO", { timeZone: ZONA })],
      [],
      ["Indicador", "Valor"],
      ["Ingresos por servicios", r.ingresos],
      ["Servicios realizados", r.servicios],
      ["Valor promedio por servicio", r.promedio],
      ["Baños medicados", r.medicados],
      ["Mascotas atendidas en el período", r.mascotasAtendidas],
      ["Clientes atendidos en el período", r.clientesAtendidos],
      ["Mascotas registradas (total)", r.mascotasRegistradas],
      ["Clientes registrados (total)", r.clientesRegistrados],
      ["Clientes activos", r.clientesActivos],
      ["Citas del período", r.citas],
      ["Citas realizadas", r.citasRealizadas],
      ["Citas pendientes", r.citasPendientes],
      ["Citas canceladas", r.citasCanceladas],
    ]);
    ["B6", "B8"].forEach((ref) => { resumen[ref].z = FORMATO_DINERO; });
    resumen["!cols"] = [{ wch: 34 }, { wch: 28 }];
    XLSX.utils.book_append_sheet(libro, resumen, "Resumen");

    XLSX.utils.book_append_sheet(libro, hojaExcel(
      ["Fecha", "Mascota", "Especie", "Raza", "Dueño", "Teléfono", "Servicio", "Medicado", "Recargo medicado", "Guía", "Precio cobrado", "Notas"],
      d.filasHist.map((f) => [aFecha(f.fecha), f.mascota, f.especie, f.raza, f.cliente, f.telefono, f.servicio,
        siNo(f.medicado), f.recargo === null ? null : numero(f.recargo), f.guia, f.precio, f.notas]),
      { dinero: [8, 10], fecha: [0], anchos: [12, 16, 9, 16, 22, 14, 16, 10, 12, 8, 14, 30],
        totales: { etiqueta: `Total (${d.filasHist.length} servicios)`, sumar: [8, 10] } },
    ), "Historial");

    XLSX.utils.book_append_sheet(libro, hojaExcel(
      ["Mascota", "Especie", "Raza", "Dueño", "Teléfono", "Teléfono 2", "Cliente activo", "Descripción del corte", "Visitas (total)", "Última visita", "Servicios en el período", "Total en el período"],
      d.filasMascotas.map((m) => [m.mascota, m.especie, m.raza ?? "", m.cliente, m.telefono ?? "", m.telefono2 ?? "",
        siNo(m.activo !== false), m.descripcion_corte ?? "", numero(m.visitas), aFecha(m.ultima_visita), m.servicios_periodo, m.total_periodo]),
      { dinero: [11], fecha: [9], anchos: [16, 9, 16, 22, 14, 14, 10, 30, 10, 12, 12, 14],
        totales: { etiqueta: `Total (${d.filasMascotas.length} mascotas)`, sumar: [10, 11] } },
    ), "Mascotas");

    XLSX.utils.book_append_sheet(libro, hojaExcel(
      ["Dueño", "Teléfono", "Teléfono 2", "Activo", "Cantidad de mascotas", "Mascotas", "Servicios en el período", "Total en el período", "Notas"],
      d.filasClientes.map((c) => [c.nombre, c.telefono ?? "", c.telefono2 ?? "", siNo(c.activo !== false),
        c.num_mascotas, c.mascotas, c.servicios_periodo, c.total_periodo, c.notas ?? ""]),
      { dinero: [7], anchos: [22, 14, 14, 8, 10, 30, 12, 14, 30],
        totales: { etiqueta: `Total (${d.filasClientes.length} dueños)`, sumar: [4, 6, 7] } },
    ), "Dueños");

    XLSX.utils.book_append_sheet(libro, hojaExcel(
      ["Fecha", "Hora", "Mascota", "Dueño", "Teléfono", "Servicio", "Medicado", "Estado", "Precio acordado", "Precio cobrado", "Motivo"],
      d.citas.map((c) => [aFecha(diaDe(c.fecha_hora)), horaTexto(c.fecha_hora), c.mascota, c.cliente, c.telefono ?? "",
        c.servicio ?? "", siNo(c.medicado), c.estado,
        c.precio_acordado === null || c.precio_acordado === undefined ? null : numero(c.precio_acordado),
        c.precio_cobrado === null || c.precio_cobrado === undefined ? null : numero(c.precio_cobrado), c.motivo ?? ""]),
      { dinero: [8, 9], fecha: [0], anchos: [12, 10, 16, 22, 14, 16, 10, 11, 14, 14, 30],
        totales: { etiqueta: `Total (${d.citas.length} citas)`, sumar: [9] } },
    ), "Citas");

    XLSX.utils.book_append_sheet(libro, hojaExcel(
      ["Servicio", "Cantidad", "Total"], d.porServicio.map((g) => [g.nombre, g.cantidad, g.total]),
      { dinero: [2], anchos: [22, 10, 14], totales: { etiqueta: "Total", sumar: [1, 2] } },
    ), "Por servicio");

    XLSX.utils.book_append_sheet(libro, hojaExcel(
      ["Mes", "Cantidad", "Total"], d.porMes.map((g) => [g.nombre, g.cantidad, g.total]),
      { dinero: [2], anchos: [20, 10, 14], totales: { etiqueta: "Total", sumar: [1, 2] } },
    ), "Por mes");

    const negocio = nombreSeguroArchivo(NOMBRE_NEGOCIO);
    const periodo = d.desde || d.hasta ? `${d.desde || "inicio"}_a_${d.hasta || hoyISO()}` : "todo";
    XLSX.writeFile(libro, `${negocio}-reporte-${periodo}.xlsx`, { compression: true });
    aviso("Excel descargado.");
  } catch (error) {
    aviso(mensajeError(error), true);
  } finally {
    boton.disabled = false;
    boton.textContent = "⬇ Descargar Excel";
  }
}

const nombreSeguroArchivo = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "") || "reporte";

PANTALLAS.reportes = {
  html: () => {
    const { desde, hasta } = fechasReporte || fechasDeRango(rangoReporte);
    return `<h1>Reportes</h1>
    <p class="suave">Elige el período. El resumen se calcula solo y puedes descargar todo en Excel
    (historial, mascotas, dueños, citas, totales por servicio y por mes).</p>
    <div class="tarjeta">
      <div class="filtros">${Object.entries(RANGOS).map(([clave, texto]) =>
        `<button class="chip" data-rango="${clave}" aria-pressed="${clave === rangoReporte}">${texto}</button>`).join("")}</div>
      <div class="fila-nueva">
        <div><label for="rep-desde">Desde</label><input id="rep-desde" type="date" value="${desde}"></div>
        <div><label for="rep-hasta">Hasta</label><input id="rep-hasta" type="date" value="${hasta}"></div>
        <div><button class="btn" id="rep-excel" type="button" disabled>⬇ Descargar Excel</button></div>
      </div>
    </div>
    <div id="rep-resultado"><p class="suave">Calculando…</p></div>`;
  },
  despues: async () => {
    $$("[data-rango]").forEach((b) => b.addEventListener("click", () => {
      rangoReporte = b.dataset.rango;
      const { desde, hasta } = fechasDeRango(rangoReporte);
      $("#rep-desde").value = desde;
      $("#rep-hasta").value = hasta;
      $$("[data-rango]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      cargarReporte();
    }));
    const alCambiarFecha = () => {
      rangoReporte = "personalizado";
      $$("[data-rango]").forEach((x) => x.setAttribute("aria-pressed", "false"));
      cargarReporte();
    };
    $("#rep-desde").addEventListener("change", alCambiarFecha);
    $("#rep-hasta").addEventListener("change", alCambiarFecha);
    $("#rep-excel").addEventListener("click", descargarExcel);
    await cargarReporte();
  },
};
