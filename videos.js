"use strict";

/* =====================================================================
   VIDEOS: carrusel público (un video a la vez, con reproducción automática
   y pantalla completa), lista para deslizar y buscar, y administrador
   privado para subir, activar/desactivar y borrar videos.
   Los archivos se guardan en Supabase Storage (carpeta pública "videos").
   ===================================================================== */

const CARPETA_VIDEOS = "videos";
const MAX_VIDEO = 50 * 1024 * 1024; // 50 MB (límite del plan gratuito)
const TIPOS_VIDEO = { "video/mp4": "mp4", "video/webm": "webm" };

const estadoVideosInicial = () => ({
  todos: [], especie: null, categoria: null, indice: 0, sonido: true, editando: null, video: null, busqueda: "",
});
let V = estadoVideosInicial();

// Saca el código del video de cualquier tipo de enlace de YouTube.
function idYouTube(url) {
  const coincidencia = String(url ?? "").match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
  return coincidencia ? coincidencia[1] : null;
}

const urlVideo = (v) => db.storage.from(CARPETA_VIDEOS).getPublicUrl(v.archivo).data.publicUrl;
const nombreEspecie = (e = V.especie) => (e === "perro" ? "Perros" : "Gatos");
// Los clientes solo ven los videos activos (si la columna aún no existe, todos cuentan como activos).
const estaActivo = (v) => v.activo !== false;
const activos = () => V.todos.filter(estaActivo);
const listaActual = () => activos().filter((v) => v.especie === V.especie && v.categoria === V.categoria);

// Nombre de archivo sin tildes ni espacios (para guardarlo en la carpeta).
function nombreSeguro(titulo) {
  return String(titulo ?? "video").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "video";
}

/* ---------- Lista de videos para deslizar y buscar ---------- */
// Sin búsqueda muestra los videos del paso en el que estás; con búsqueda, todos los que coincidan.
function videosDeLaTira() {
  const termino = sinTildes(V.busqueda);
  if (termino) {
    return activos().filter((v) =>
      sinTildes(`${v.titulo} ${v.categoria} ${nombreEspecie(v.especie)}`).includes(termino));
  }
  if (V.especie && V.categoria) return listaActual();
  if (V.especie) return activos().filter((v) => v.especie === V.especie);
  return activos();
}

function miniatura(v) {
  if (v.archivo) {
    // #t=0.5 hace que el navegador muestre un cuadro del video como portada.
    return `<video src="${esc(urlVideo(v))}#t=0.5" preload="metadata" muted playsinline tabindex="-1" aria-hidden="true"></video>`;
  }
  const id = idYouTube(v.youtube_url);
  return id ? `<img src="https://i.ytimg.com/vi/${id}/mqdefault.jpg" alt="" loading="lazy">` : "<span>🎬</span>";
}

function htmlTira() {
  return `<div class="tira-bloque">
    <div class="tira-cabecera">
      <input type="search" id="v-buscar" value="${esc(V.busqueda)}" placeholder="Buscar un video (ej. pelota, comida)…" aria-label="Buscar video">
      <span class="suave" id="v-cuenta"></span>
    </div>
    <div class="tira" id="v-tira" role="list" aria-label="Lista de videos"></div>
  </div>`;
}

function pintarTira() {
  const tira = $("#v-tira");
  if (!tira) return;
  const lista = videosDeLaTira();
  const actual = V.categoria ? listaActual()[V.indice] : null;
  $("#v-cuenta").textContent = `${lista.length} ${lista.length === 1 ? "video" : "videos"} · desliza para ver más`;
  tira.innerHTML = lista.length ? lista.map((v) => `<button type="button" class="mini" role="listitem" data-video="${v.id}"
      ${actual && actual.id === v.id ? 'aria-current="true"' : ""}>
      <span class="mini-img">${miniatura(v)}</span>
      <span class="mini-titulo">${esc(v.titulo)}</span>
      <span class="mini-sub">${esc(nombreEspecie(v.especie))} · ${esc(v.categoria)}</span>
    </button>`).join("")
    : '<p class="suave">No encontré videos con ese nombre.</p>';
  $$("[data-video]", tira).forEach((b) => b.addEventListener("click", () => abrirVideoDeLaLista(Number(b.dataset.video))));
  centrarMarcado();
}

// Marca en la lista el video que se está viendo y lo centra (sin mover la página).
function marcarEnTira() {
  const actual = V.categoria ? listaActual()[V.indice] : null;
  $$("#v-tira .mini").forEach((b) => {
    if (actual && Number(b.dataset.video) === actual.id) b.setAttribute("aria-current", "true");
    else b.removeAttribute("aria-current");
  });
  centrarMarcado();
}
function centrarMarcado() {
  const tira = $("#v-tira"), marcado = tira && $('[aria-current="true"]', tira);
  if (marcado) tira.scrollLeft = marcado.offsetLeft - (tira.clientWidth - marcado.offsetWidth) / 2;
}

function abrirVideoDeLaLista(id) {
  const v = V.todos.find((x) => x.id === id);
  if (!v) return;
  const mismaLista = V.especie === v.especie && V.categoria === v.categoria && $("#visor");
  V.especie = v.especie;
  V.categoria = v.categoria;
  V.indice = Math.max(0, listaActual().findIndex((x) => x.id === id));
  if (mismaLista) mostrarVideo(); // no se redibuja el visor (no sale de pantalla completa)
  else pintarVideos();
  const visor = $("#visor");
  if (visor) visor.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------- Pantalla pública ---------- */
function enlazarNavegacion(caja) {
  $$("[data-especie]", caja).forEach((b) => b.addEventListener("click", () => {
    V.especie = b.dataset.especie; V.indice = 0; pintarVideos();
  }));
  $$("[data-categoria]", caja).forEach((b) => b.addEventListener("click", () => {
    V.categoria = b.dataset.categoria; V.indice = 0; pintarVideos();
  }));
  $$("[data-atras]", caja).forEach((b) => b.addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen();
    if (V.categoria) V.categoria = null; else V.especie = null;
    V.indice = 0;
    pintarVideos();
  }));
  const buscar = $("#v-buscar", caja);
  if (buscar) buscar.addEventListener("input", () => { V.busqueda = buscar.value; pintarTira(); });
}

function pintarVideos() {
  const caja = $("#v-publico");
  if (!caja) return;
  if (!V.especie) {
    caja.innerHTML = `<p class="suave">¿Para quién buscas?</p>
      <div class="grandes"><button data-especie="perro">Perro</button><button class="sol" data-especie="gato">Gato</button></div>
      ${htmlTira()}`;
  } else if (!V.categoria) {
    const categorias = [...new Set(activos().filter((v) => v.especie === V.especie).map((v) => v.categoria).filter(Boolean))].sort();
    caja.innerHTML = `<p class="suave">${nombreEspecie()}: ¿qué quieres ver?</p>` + (categorias.length
      ? `<div class="grandes">${categorias.map((c, i) => `<button class="${i % 2 ? "sol" : ""}" data-categoria="${esc(c)}">${esc(c)}</button>`).join("")}</div>`
      : '<p class="suave">Todavía no hay videos para esta opción.</p>') +
      `<p><button class="btn alt" data-atras>Volver</button></p>${htmlTira()}`;
  } else {
    pintarCarrusel(caja);
  }
  enlazarNavegacion(caja);
  pintarTira();
}

/* ---------- Carrusel: un video a la vez ---------- */
function etiquetaSonido() {
  const boton = $("#btn-sonido");
  if (boton) boton.textContent = V.sonido ? "🔊 Con sonido" : "🔇 Activar sonido";
}

function pasoVideo(paso) {
  const total = listaActual().length;
  if (!total) return;
  V.indice = (V.indice + paso + total) % total;
  mostrarVideo();
}

const enPantallaCompleta = () => document.fullscreenElement || document.webkitFullscreenElement;

function alternarPantallaCompleta() {
  const visor = $("#visor");
  if (enPantallaCompleta()) {
    (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  } else if (visor.requestFullscreen) {
    visor.requestFullscreen();
  } else if (visor.webkitRequestFullscreen) {
    visor.webkitRequestFullscreen(); // Safari
  }
}

function pintarCarrusel(caja) {
  const lista = listaActual();
  if (!lista.length) {
    caja.innerHTML = `<p class="suave">${nombreEspecie()} › ${esc(V.categoria)}</p>
      <p class="suave">Todavía no hay videos aquí.</p><p><button class="btn alt" data-atras>Volver</button></p>${htmlTira()}`;
    return;
  }
  caja.innerHTML = `<p class="suave">${nombreEspecie()} › ${esc(V.categoria)}</p>
    <div class="visor" id="visor">
      <div class="pantalla-video" id="pantalla-video"></div>
      ${lista.length > 1 ? `<button type="button" class="flecha izq" data-paso="-1" aria-label="Video anterior">‹</button>
      <button type="button" class="flecha der" data-paso="1" aria-label="Video siguiente">›</button>` : ""}
      <div class="barra-video">
        <div><strong id="titulo-video"></strong> <span class="suave" id="posicion-video"></span></div>
        <div class="controles-video">
          <button type="button" class="chip" id="btn-sonido"></button>
          <button type="button" class="chip" id="btn-completa">⛶ Pantalla completa</button>
        </div>
      </div>
    </div>
    <p><button class="btn alt" data-atras>Volver</button></p>
    ${htmlTira()}`;

  $$("[data-paso]", caja).forEach((b) => b.addEventListener("click", () => pasoVideo(Number(b.dataset.paso))));
  $("#btn-sonido").addEventListener("click", () => {
    V.sonido = !V.sonido;
    if (V.video) {
      V.video.muted = !V.sonido;
      if (V.sonido) V.video.play().catch(() => {});
    }
    etiquetaSonido();
  });
  $("#btn-completa").addEventListener("click", alternarPantallaCompleta);
  mostrarVideo();
}

// Cambia solo el video (el visor se queda, así la pantalla completa no se interrumpe).
function mostrarVideo() {
  const lista = listaActual();
  const marco = $("#pantalla-video");
  if (!marco || !lista.length) return;
  if (V.indice >= lista.length || V.indice < 0) V.indice = 0;
  const v = lista[V.indice];
  $("#titulo-video").textContent = v.titulo;
  $("#posicion-video").textContent = `${V.indice + 1} de ${lista.length}`;
  etiquetaSonido();
  marco.innerHTML = "";
  V.video = null;

  if (v.archivo) {
    const video = document.createElement("video");
    video.src = urlVideo(v);
    video.controls = true;
    video.playsInline = true;
    video.preload = "auto";
    video.loop = lista.length === 1;
    video.setAttribute("controlsList", "nofullscreen"); // se usa el botón "Pantalla completa" de abajo
    video.muted = !V.sonido;
    video.addEventListener("ended", () => { if (lista.length > 1) pasoVideo(1); });
    marco.appendChild(video);
    V.video = video;
    video.play().catch(() => {
      // El navegador no dejó empezar con sonido: se reproduce sin sonido.
      video.muted = true;
      V.sonido = false;
      etiquetaSonido();
      video.play().catch(() => {});
    });
  } else {
    const id = idYouTube(v.youtube_url);
    marco.innerHTML = id
      ? `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&rel=0&playsinline=1" title="${esc(v.titulo)}"
           allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`
      : '<p class="suave">Este video no tiene un enlace válido.</p>';
  }
  marcarEnTira();
}

if (typeof document.addEventListener === "function") {
  document.addEventListener("keydown", (evento) => {
    if (!$("#visor") || /^(INPUT|SELECT|TEXTAREA)$/.test(evento.target.tagName)) return;
    if (evento.key === "ArrowRight") pasoVideo(1);
    else if (evento.key === "ArrowLeft") pasoVideo(-1);
  });
}

/* ---------- Administrador (solo con sesión iniciada) ---------- */
function pintarAdminVideos() {
  const caja = $("#v-admin");
  if (!caja) return;
  const categorias = [...new Set(V.todos.map((v) => v.categoria).filter(Boolean))].sort();
  const e = V.editando;
  const inactivos = V.todos.filter((v) => !estaActivo(v)).length;
  caja.innerHTML = `<div class="tarjeta">
    <h2>Administrar videos</h2>
    <p class="suave">Sube tus videos en formato MP4 o WEBM (máximo 50 MB cada uno). Se reproducen solos en el carrusel.
    Si un producto se agota, <strong>desactiva</strong> su video: deja de verse para los clientes, pero no se borra.</p>
    <form id="form-video">
      <div class="dos">
        <div><label for="v-especie">Especie</label><select id="v-especie">
          <option value="perro"${e && e.especie === "perro" ? " selected" : ""}>Perro</option>
          <option value="gato"${e && e.especie === "gato" ? " selected" : ""}>Gato</option></select></div>
        <div><label for="v-cat">Categoría (ej. Comida, Juguetes)</label>
          <input id="v-cat" list="v-cats" value="${esc(e ? e.categoria : "")}" required>
          <datalist id="v-cats">${categorias.map((c) => `<option value="${esc(c)}">`).join("")}</datalist></div>
      </div>
      <label for="v-titulo">Título</label><input id="v-titulo" value="${esc(e ? e.titulo : "")}" required>
      <label for="v-archivo">Video (MP4 o WEBM)${e ? " — déjalo vacío para conservar el actual" : ""}</label>
      <input id="v-archivo" type="file" accept="video/mp4,video/webm">
      <label for="v-url">O enlace de YouTube (opcional)</label>
      <input id="v-url" value="${esc(e && e.youtube_url ? e.youtube_url : "")}" placeholder="https://www.youtube.com/watch?v=...">
      <label class="casilla"><input type="checkbox" id="v-activo"${!e || estaActivo(e) ? " checked" : ""}> Activo (los clientes lo ven)</label>
      <p id="v-error" class="error" role="alert"></p>
      <div class="acciones">
        ${e ? '<button type="button" class="btn alt" id="v-cancelar">Cancelar edición</button>' : ""}
        <button type="submit" class="btn">${e ? "Guardar cambios" : "Agregar video"}</button>
      </div>
    </form>
    <h3>Tus videos ${inactivos ? `<span class="suave">· ${inactivos} desactivado(s)</span>` : ""}</h3>
    <div id="v-tabla"></div></div>`;

  tablaInteractiva($("#v-tabla"), {
    id: "videos",
    filas: V.todos,
    vacio: "Todavía no hay videos.",
    columnas: [
      { titulo: "Estado", valor: (v) => (estaActivo(v) ? "Activo" : "Inactivo"), filtro: "lista" },
      { titulo: "Especie", valor: (v) => v.especie, filtro: "lista" },
      { titulo: "Categoría", valor: (v) => v.categoria, filtro: "lista" },
      { titulo: "Título", valor: (v) => v.titulo, filtro: "texto" },
      { titulo: "Origen", valor: (v) => (v.archivo ? "Archivo" : "YouTube"), filtro: "lista" },
      { titulo: "", valor: () => "", ordenable: false, filtro: false },
    ],
    fila: (v) => `<tr${estaActivo(v) ? "" : ' class="apagada"'}>
      <td><button type="button" class="interruptor" role="switch" aria-checked="${estaActivo(v)}" data-activar="${v.id}"
        title="${estaActivo(v) ? "Desactivar (ocultar a los clientes)" : "Activar (mostrar a los clientes)"}">
        <span class="perilla" aria-hidden="true"></span>${estaActivo(v) ? "Activo" : "Inactivo"}</button></td>
      <td>${esc(v.especie)}</td><td>${esc(v.categoria)}</td><td>${esc(v.titulo)}</td>
      <td>${v.archivo ? "Archivo" : "YouTube"}</td>
      <td class="acciones-fila"><button class="btn alt" data-editar="${v.id}">Editar</button>
      <button class="btn alt" data-borrar="${v.id}">Borrar</button></td></tr>`,
    alPintar: (tbody) => {
      $$("[data-activar]", tbody).forEach((b) => b.addEventListener("click", () => cambiarActivoVideo(Number(b.dataset.activar))));
      $$("[data-editar]", tbody).forEach((b) => b.addEventListener("click", () => {
        V.editando = V.todos.find((v) => v.id === Number(b.dataset.editar));
        pintarAdminVideos();
        $("#v-titulo").focus();
      }));
      $$("[data-borrar]", tbody).forEach((b) => b.addEventListener("click", async () => {
        const video = V.todos.find((v) => v.id === Number(b.dataset.borrar));
        if (!video || !window.confirm(`¿Borrar el video "${video.titulo}"?\n\nSi solo se agotó el producto, mejor desactívalo.`)) return;
        try {
          await q(db.from("videos").delete().eq("id", video.id));
          if (video.archivo) await db.storage.from(CARPETA_VIDEOS).remove([video.archivo]);
          aviso("Video borrado.");
          await recargarVideos();
        } catch (error) { aviso(mensajeError(error), true); }
      }));
    },
  });

  $("#form-video").addEventListener("submit", guardarVideo);
  const cancelar = $("#v-cancelar");
  if (cancelar) cancelar.addEventListener("click", () => { V.editando = null; pintarAdminVideos(); });
}

async function cambiarActivoVideo(id) {
  const video = V.todos.find((v) => v.id === id);
  if (!video) return;
  const nuevo = !estaActivo(video);
  try {
    await q(db.from("videos").update({ activo: nuevo }).eq("id", id));
    aviso(nuevo ? `"${video.titulo}" se muestra otra vez a los clientes.` : `"${video.titulo}" quedó oculto para los clientes.`);
    await recargarVideos();
  } catch (error) {
    aviso(mensajeError(error), true);
  }
}

async function guardarVideo(evento) {
  evento.preventDefault();
  const error = $("#v-error");
  error.textContent = "";
  const e = V.editando;
  const archivo = $("#v-archivo").files[0] || null;
  const url = $("#v-url").value.trim();
  if (!archivo && !url && !(e && e.archivo)) { error.textContent = "Sube un video o pega un enlace de YouTube."; return; }
  if (url && !idYouTube(url)) { error.textContent = "Ese enlace no parece ser de YouTube."; return; }
  let extension = null;
  if (archivo) {
    extension = TIPOS_VIDEO[archivo.type];
    if (!extension) { error.textContent = "Usa un video en formato MP4 o WEBM."; return; }
    if (archivo.size > MAX_VIDEO) { error.textContent = "El video pesa más de 50 MB. Comprímelo (por ejemplo con HandBrake) y vuelve a intentar."; return; }
  }
  const boton = $("button[type=submit]", evento.target);
  boton.disabled = true;
  boton.textContent = archivo ? "Subiendo… puede tardar unos minutos" : "Guardando…";
  try {
    const datos = {
      especie: $("#v-especie").value,
      categoria: $("#v-cat").value.trim(),
      titulo: $("#v-titulo").value.trim(),
      youtube_url: url || null,
      activo: $("#v-activo").checked,
    };
    let nuevoArchivo = null;
    if (archivo) {
      nuevoArchivo = `${Date.now()}-${nombreSeguro(datos.titulo)}.${extension}`;
      const { error: fallo } = await db.storage.from(CARPETA_VIDEOS)
        .upload(nuevoArchivo, archivo, { contentType: archivo.type, cacheControl: "31536000" });
      if (fallo) throw fallo;
      datos.archivo = nuevoArchivo;
    }
    if (e) {
      await q(db.from("videos").update(datos).eq("id", e.id));
      if (nuevoArchivo && e.archivo) await db.storage.from(CARPETA_VIDEOS).remove([e.archivo]);
    } else {
      await q(db.from("videos").insert(datos));
    }
    aviso(e ? "Video actualizado." : "Video agregado.");
    V.editando = null;
    await recargarVideos();
  } catch (fallo) {
    error.textContent = mensajeError(fallo);
    boton.disabled = false;
    boton.textContent = e ? "Guardar cambios" : "Agregar video";
  }
}

async function recargarVideos() {
  V.todos = await q(db.from("videos").select("*").order("id"));
  // Si el video que se estaba viendo se desactivó, se ajusta la posición.
  if (V.categoria && V.indice >= listaActual().length) V.indice = 0;
  pintarVideos();
  pintarAdminVideos();
}

PANTALLAS.videos = {
  html: () => `<h1>Videos de productos</h1>
    <div id="v-publico"><p class="suave">Cargando…</p></div>
    ${estado.sesion ? '<div id="v-admin"></div>' : ""}`,
  despues: async () => {
    V = estadoVideosInicial();
    try {
      await recargarVideos();
    } catch (error) {
      mostrarError($("#v-publico"), error);
    }
  },
};
