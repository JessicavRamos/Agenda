# Feature 07 · Videos de productos

## Historia de usuario

**Como** cliente que visita Pet Garden
**quiero** ver videos de productos eligiendo con botones grandes (perro/gato → categoría)
**para** conocer comida, juguetes y otros productos sin ayuda.

**Como** dueña de Pet Garden
**quiero** subir, editar y borrar esos videos
**para** mantener el catálogo audiovisual actualizado.

## Reglas de negocio

### Vista pública (no requiere login)
1. Navegación en 3 pasos: **Especie** (Perro / Gato) → **Categoría** → **Carrusel**.
2. Las categorías se generan de los videos existentes para esa especie, en orden alfabético.
3. Sin categorías → "Todavía no hay videos para esta opción."
4. El carrusel muestra **un video a la vez**, con título y posición ("2 de 5").
5. **Reproducción automática** con sonido; si el navegador lo bloquea, se reproduce **sin sonido** y el botón cambia a "🔇 Activar sonido".
6. Al terminar un video pasa al siguiente (en bucle). Si hay un solo video, se repite.
7. Navegación: flechas ‹ › (solo si hay más de un video), teclas ← → y la **lista de videos** de abajo.
8. Botón **⛶ Pantalla completa** (compatible con Safari). Cambiar de video no saca de pantalla completa. El video se ve **entero**, sin recortes ni deformación: verticales (TikTok) y horizontales (YouTube) se ajustan con franjas negras.
9. **Volver** retrocede un paso (categoría → especie) y sale de pantalla completa.
10. Videos antiguos con enlace de YouTube se muestran embebidos (silenciados).

### Administrador (solo con sesión)
11. Campos: Especie, Categoría (con sugerencias de las existentes), Título, Archivo de video **o** enlace de YouTube.
12. Formatos permitidos: **MP4 y WEBM**, máximo **50 MB**.
13. Se debe subir un archivo o pegar un enlace de YouTube válido.
14. Al editar, si no subo archivo se conserva el actual; si subo uno nuevo, se borra el anterior del bucket.
15. Borrar pide confirmación y elimina el registro y el archivo del bucket `videos`.

## Escenarios

```gherkin
# language: es
Característica: Videos de productos

  # ---------- Vista pública ----------
  Escenario: Elegir especie y categoría
    Dado que estoy en "Videos" sin iniciar sesión
    Entonces veo "¿Para quién buscas?" con los botones "Perro" y "Gato"
    Cuando presiono "Perro"
    Entonces veo "Perros: ¿qué quieres ver?" con las categorías disponibles
    Cuando presiono "Comida"
    Entonces veo el carrusel con el primer video de "Perros › Comida"

  Escenario: Especie sin videos
    Dado que no hay videos para gatos
    Cuando presiono "Gato"
    Entonces veo "Todavía no hay videos para esta opción."

  Escenario: Reproducción automática
    Cuando entro a una categoría con videos
    Entonces el primer video empieza a reproducirse solo
    Y veo su título y "1 de N"

  Escenario: El navegador bloquea el sonido
    Dado que el navegador no permite reproducir con sonido
    Cuando se carga el video
    Entonces el video se reproduce sin sonido
    Y el botón dice "🔇 Activar sonido"
    Cuando lo presiono
    Entonces el video suena y el botón dice "🔊 Con sonido"

  Escenario: Pasar al siguiente video al terminar
    Dado una categoría con 3 videos y estoy viendo el 3
    Cuando el video termina
    Entonces se reproduce el video 1

  Escenario: Un solo video se repite
    Dado una categoría con un solo video
    Entonces no veo flechas
    Y el video se repite al terminar

  Esquema del escenario: Navegar entre videos
    Dado una categoría con 3 videos y estoy viendo el 1
    Cuando <accion>
    Entonces veo el video <destino>

    Ejemplos:
      | accion                           | destino |
      | presiono la flecha ›             | 2       |
      | presiono la flecha ‹             | 3       |
      | presiono la tecla →              | 2       |
      | presiono la tecla ←              | 3       |
      | toco el tercer video de la lista | 3       |

  Escenario: Pantalla completa
    Cuando presiono "⛶ Pantalla completa"
    Entonces el visor ocupa toda la pantalla
    Y al cambiar de video sigo en pantalla completa

  Escenario: Volver
    Dado que estoy en el carrusel de "Perros › Comida"
    Cuando presiono "Volver"
    Entonces veo las categorías de perros
    Cuando presiono "Volver" otra vez
    Entonces veo "¿Para quién buscas?"

  # ---------- Administrador ----------
  Escenario: El administrador solo se ve con sesión
    Dado que no he iniciado sesión
    Entonces no veo "Administrar videos"
    Dado que inicié sesión
    Entonces veo "Administrar videos" debajo del carrusel

  Escenario: Subir un video
    Dado que inicié sesión y estoy en "Videos"
    Cuando elijo especie "Perro", categoría "Juguetes", título "Pelota mordedora"
    Y adjunto un MP4 de 20 MB
    Y presiono "Agregar video"
    Entonces el botón muestra "Subiendo… puede tardar unos minutos"
    Y luego veo "Video agregado." y el video aparece en la tabla con origen "Archivo"

  Escenario: Sin archivo ni enlace
    Cuando presiono "Agregar video" sin archivo ni enlace
    Entonces veo "Sube un video o pega un enlace de YouTube."

  Escenario: Formato no permitido
    Cuando adjunto un archivo .mov
    Entonces veo "Usa un video en formato MP4 o WEBM."

  Escenario: Video demasiado pesado
    Cuando adjunto un MP4 de 80 MB
    Entonces veo "El video pesa más de 50 MB. Comprímelo (por ejemplo con HandBrake) y vuelve a intentar."

  Escenario: Enlace que no es de YouTube
    Cuando pego "https://vimeo.com/123" en el enlace
    Entonces veo "Ese enlace no parece ser de YouTube."

  Escenario: Editar sin cambiar el archivo
    Cuando presiono "Editar" en un video y cambio solo el título
    Y presiono "Guardar cambios"
    Entonces veo "Video actualizado." y se conserva el mismo archivo

  Escenario: Reemplazar el archivo
    Cuando edito un video y adjunto un archivo nuevo
    Entonces el archivo anterior se borra del bucket "videos"

  Escenario: Cancelar edición
    Cuando presiono "Editar" y luego "Cancelar edición"
    Entonces el formulario vuelve a "Agregar video" vacío

  Escenario: Borrar un video
    Cuando presiono "Borrar" en "Pelota mordedora"
    Entonces se pide confirmación "¿Borrar el video "Pelota mordedora"?"
    Cuando acepto
    Entonces veo "Video borrado." y el archivo se elimina del bucket
```

## Novedades v3

### Reglas
1. **Lista de videos** debajo de los botones o del carrusel: miniaturas que se **deslizan hacia los lados**, con título, especie y categoría.
   - Sin búsqueda muestra los videos del paso actual: todos al inicio, los de la especie elegida, o los de la categoría en el carrusel.
   - El **buscador** busca entre todos los videos activos por título, categoría o especie, sin importar tildes.
   - Tocar una miniatura abre ese video en el carrusel. El video que se está viendo queda resaltado y centrado en la lista.
2. **Activar / desactivar**: en el administrador cada video tiene un interruptor **Activo / Inactivo**. Los inactivos **no se muestran a los clientes** (carrusel, categorías ni lista), pero no se borran.
3. El formulario tiene la casilla **"Activo (los clientes lo ven)"**, marcada por defecto.
4. La tabla del administrador se puede ordenar y filtrar (Estado, Especie, Categoría, Título, Origen).
5. Si una categoría queda sin videos activos, deja de aparecer como botón.
6. **Pantalla completa**: el visor ocupa toda la pantalla. El video usa todo el espacio menos la barra de controles, sin cortarse arriba ni abajo.

```gherkin
# language: es
Característica: Videos v3

  Escenario: Deslizar la lista
    Dado que estoy en "Videos" sin iniciar sesión
    Entonces debajo de "Perro" y "Gato" veo la lista de todos los videos activos
    Y puedo deslizarla hacia los lados

  Escenario: Buscar un video
    Cuando escribo "pelota" en el buscador
    Entonces la lista muestra solo "Pelota mordedora" y dice "1 video"
    Cuando la toco
    Entonces se abre en el carrusel de "Perros › Juguetes"

  Escenario: Buscar sin tildes
    Cuando escribo "jugueton"
    Entonces encuentro "Juguetón"

  Escenario: Sin resultados
    Cuando busco "zzz"
    Entonces veo "No encontré videos con ese nombre."

  Escenario: Video actual resaltado
    Dado que estoy viendo el video 2 de una categoría
    Entonces su miniatura está resaltada y centrada en la lista
    Cuando paso al siguiente con la flecha ›
    Entonces se resalta la miniatura del video 3

  Escenario: Desactivar un video agotado
    Dado que inicié sesión
    Cuando presiono el interruptor "Activo" de "Snack dental"
    Entonces cambia a "Inactivo" y veo que quedó oculto para los clientes
    Y en la vista pública "Snack dental" no aparece en categorías, carrusel ni lista

  Escenario: Reactivar
    Cuando presiono el interruptor "Inactivo" de "Snack dental"
    Entonces vuelve a mostrarse a los clientes

  Escenario: Categoría sin videos activos
    Dado que todos los videos de "Arena" están inactivos
    Entonces el botón "Arena" no aparece para los clientes

  Esquema del escenario: Pantalla completa sin recortes
    Dado un video <formato>
    Cuando presiono "⛶ Pantalla completa"
    Entonces el video se ve completo, de borde a borde en su lado más largo
    Y no se corta arriba ni abajo
    Y la barra con título y botones queda visible abajo

    Ejemplos:
      | formato                    |
      | vertical 9:16 (TikTok)     |
      | horizontal 16:9 (YouTube)  |
```
