"use strict";

/* =====================================================================
   VIDEOS: pantalla pública con botones grandes + administrador privado
   ===================================================================== */

let V = { todos: [], especie: null, categoria: null, editando: null };

// Saca el código del video de cualquier tipo de enlace de YouTube.
function idYouTube(url) {
  const coincidencia = String(url ?? "").match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
  return coincidencia ? coincidencia[1] : null;
}

function pintarVideos() {
  const caja = $("#v-publico");
  if (!caja) return;
  const nombreEspecie = V.especie === "perro" ? "Perros" : "Gatos";
  let h = "";

  if (!V.especie) {
    h = `<p class="suave">¿Para quién buscas?</p>
      <div class="grandes"><button data-especie="perro">Perro</button><button class="sol" data-especie="gato">Gato</button></div>`;
  } else if (!V.categoria) {
    const categorias = [...new Set(V.todos.filter((v) => v.especie === V.especie).map((v) => v.categoria).filter(Boolean))].sort();
    h = `<p class="suave">${nombreEspecie}: ¿qué quieres ver?</p>` + (categorias.length
      ? `<div class="grandes">${categorias.map((c, i) => `<button class="${i % 2 ? "sol" : ""}" data-categoria="${esc(c)}">${esc(c)}</button>`).join("")}</div>`
      : '<p class="suave">Todavía no hay videos para esta opción.</p>') +
      `<p><button class="btn alt" data-atras>Volver</button></p>`;
  } else {
    const lista = V.todos.filter((v) => v.especie === V.especie && v.categoria === V.categoria);
    h = `<p class="suave">${nombreEspecie} › ${esc(V.categoria)}</p><div class="videos">` + lista.map((v) => {
      const id = idYouTube(v.youtube_url);
      return `<div class="tarjeta"><h2>${esc(v.titulo)}</h2>` + (id
        ? `<div class="marco"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="${esc(v.titulo)}" loading="lazy" allowfullscreen
             allow="accelerometer; encrypted-media; picture-in-picture"></iframe></div>`
        : "") + `<p><a href="${esc(v.youtube_url)}" target="_blank" rel="noopener">Abrir en YouTube</a></p></div>`;
    }).join("") + `</div><p><button class="btn alt" data-atras>Volver</button></p>`;
  }
  caja.innerHTML = h;
  $$("[data-especie]", caja).forEach((b) => b.addEventListener("click", () => { V.especie = b.dataset.especie; pintarVideos(); }));
  $$("[data-categoria]", caja).forEach((b) => b.addEventListener("click", () => { V.categoria = b.dataset.categoria; pintarVideos(); }));
  $$("[data-atras]", caja).forEach((b) => b.addEventListener("click", () => {
    if (V.categoria) V.categoria = null; else V.especie = null;
    pintarVideos();
  }));
}

/* ---------- Administrador (solo con sesión iniciada) ---------- */
function pintarAdminVideos() {
  const caja = $("#v-admin");
  if (!caja) return;
  const categorias = [...new Set(V.todos.map((v) => v.categoria).filter(Boolean))].sort();
  const e = V.editando;
  caja.innerHTML = `<div class="tarjeta">
    <h2>Administrar videos</h2>
    <p class="suave">Sube tus videos a YouTube como "no listados" y pega aquí el enlace.</p>
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
      <label for="v-url">Enlace de YouTube</label><input id="v-url" value="${esc(e ? e.youtube_url : "")}" required>
      <p id="v-error" class="error" role="alert"></p>
      <div class="acciones">
        ${e ? '<button type="button" class="btn alt" id="v-cancelar">Cancelar edición</button>' : ""}
        <button type="submit" class="btn">${e ? "Guardar cambios" : "Agregar video"}</button>
      </div>
    </form>
    <div class="tabla-scroll"><table><thead><tr><th>Especie</th><th>Categoría</th><th>Título</th><th></th></tr></thead>
    <tbody>${V.todos.map((v) => `<tr><td>${esc(v.especie)}</td><td>${esc(v.categoria)}</td><td>${esc(v.titulo)}</td>
      <td class="acciones-fila"><button class="btn alt" data-editar="${v.id}">Editar</button>
      <button class="btn alt" data-borrar="${v.id}">Borrar</button></td></tr>`).join("")}</tbody></table></div></div>`;

  $("#form-video").addEventListener("submit", guardarVideo);
  const cancelar = $("#v-cancelar");
  if (cancelar) cancelar.addEventListener("click", () => { V.editando = null; pintarAdminVideos(); });
  $$("[data-editar]", caja).forEach((b) => b.addEventListener("click", () => {
    V.editando = V.todos.find((v) => v.id === Number(b.dataset.editar));
    pintarAdminVideos();
    $("#v-titulo").focus();
  }));
  $$("[data-borrar]", caja).forEach((b) => b.addEventListener("click", async () => {
    if (!window.confirm("¿Borrar este video de la lista?")) return;
    try {
      await q(db.from("videos").delete().eq("id", Number(b.dataset.borrar)));
      aviso("Video borrado.");
      await recargarVideos();
    } catch (error) { aviso(mensajeError(error), true); }
  }));
}

async function guardarVideo(evento) {
  evento.preventDefault();
  const error = $("#v-error");
  error.textContent = "";
  const url = $("#v-url").value.trim();
  if (!idYouTube(url)) { error.textContent = "Pega un enlace de YouTube válido (youtube.com o youtu.be)."; return; }
  const datos = {
    especie: $("#v-especie").value,
    categoria: $("#v-cat").value.trim(),
    titulo: $("#v-titulo").value.trim(),
    youtube_url: url,
  };
  try {
    if (V.editando) await q(db.from("videos").update(datos).eq("id", V.editando.id));
    else await q(db.from("videos").insert(datos));
    aviso(V.editando ? "Video actualizado." : "Video agregado.");
    V.editando = null;
    await recargarVideos();
  } catch (fallo) {
    error.textContent = mensajeError(fallo);
  }
}

async function recargarVideos() {
  V.todos = await q(db.from("videos").select("*").order("titulo"));
  pintarVideos();
  pintarAdminVideos();
}

PANTALLAS.videos = {
  html: () => `<h1>Videos de productos</h1>
    <div id="v-publico"><p class="suave">Cargando…</p></div>
    ${estado.sesion ? '<div id="v-admin"></div>' : ""}`,
  despues: async () => {
    V = { todos: [], especie: null, categoria: null, editando: null };
    try {
      await recargarVideos();
    } catch (error) {
      mostrarError($("#v-publico"), error);
    }
  },
};