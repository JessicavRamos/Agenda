# Feature 04 · Agenda

## Historia de usuario

**Como** dueña de Pet Garden
**quiero** ver mis citas filtradas y cambiar su estado desde la misma lista
**para** registrar el servicio con un solo paso (marcar la cita como realizada) sin llenar dos formularios.

## Reglas de negocio

1. Filtros: **Hoy** (por defecto), **Próximos 7 días**, **Pendientes**, **Todas (últimas 100)**.
   - Hoy, 7 días y Pendientes: orden por fecha ascendente.
   - Todas: las 100 más recientes, orden descendente.
2. Columnas: Fecha y hora, Mascota (enlace a ficha), Dueño + teléfonos, Servicio (+ etiqueta "medicado" y guía), Precio, Estado, Acciones.
3. Acciones según el estado:

   | Estado | Acciones |
   |--------|----------|
   | pendiente | Terminar · Editar · Cancelar · Eliminar |
   | realizada | Corregir servicio · 📲 Avisar · Eliminar |
   | cancelada | Eliminar |

4. **Terminar cita**:
   - La guía viene preseleccionada con la última usada en esa mascota.
   - Precio cobrado = precio acordado o, si no hay, el sugerido (editable).
   - Baño medicado solo si el servicio es Baño o Corte y baño.
   - Notas del servicio: máx. 300 caracteres.
   - Se hace **una sola actualización** a `citas` con `estado = realizada`; la base de datos crea el servicio en el historial.
5. **Editar cita** (solo pendientes): día, hora, servicio, precio acordado, baño medicado y motivo.
6. **Cancelar**: pide confirmación y cambia el estado a `cancelada` (no borra la cita).
7. **Corregir servicio**: abre el editor del servicio creado por esa cita. Si no existe → "Esta cita no tiene un servicio asociado."

## Escenarios

```gherkin
# language: es
Característica: Agenda de citas

  Antecedentes:
    Dado que inicié sesión
    Y estoy en la pantalla "Agenda"

  Escenario: Filtro por defecto
    Entonces el filtro "Hoy" está seleccionado
    Y veo solo las citas de hoy ordenadas por hora

  Esquema del escenario: Filtros de la agenda
    Cuando selecciono el filtro "<filtro>"
    Entonces veo <resultado>

    Ejemplos:
      | filtro              | resultado                                              |
      | Próximos 7 días     | las citas desde hoy hasta dentro de 7 días             |
      | Pendientes          | solo citas en estado pendiente, de cualquier fecha     |
      | Todas (últimas 100) | máximo 100 citas, de la más reciente a la más antigua |

  Escenario: Sin citas para el filtro
    Dado que no hay citas pendientes
    Cuando selecciono "Pendientes"
    Entonces veo "No hay citas para este filtro."

  Esquema del escenario: Acciones según el estado
    Dado una cita en estado "<estado>"
    Entonces veo las acciones "<acciones>"

    Ejemplos:
      | estado    | acciones                                |
      | pendiente | Terminar, Editar, Cancelar, Eliminar    |
      | realizada | Corregir servicio, 📲 Avisar, Eliminar   |
      | cancelada | Eliminar                                |

  Escenario: Terminar una cita
    Dado una cita pendiente de "Toby" (Baño) con precio acordado $30.000
    Y la última guía usada en "Toby" fue la "#7"
    Cuando presiono "Terminar"
    Entonces la guía "#7" viene seleccionada con el texto "(viene la de la última vez)"
    Y el precio cobrado es $30.000
    Cuando escribo la nota "Se portó muy bien" y presiono "Marcar como realizada"
    Entonces se abre la ventana "✔ Servicio terminado"
    Y la cita aparece como "realizada"
    Y el servicio aparece en el historial de "Toby"

  Escenario: Terminar con baño medicado
    Dado una cita pendiente de "Baño" con precio $30.000
    Cuando presiono "Terminar" y marco "Baño medicado" con "+$8.000"
    Entonces el precio cobrado pasa a $38.000
    Y el servicio queda guardado como medicado con recargo $8.000

  Escenario: Terminar un corte no muestra medicado
    Dado una cita pendiente de "Corte"
    Cuando presiono "Terminar"
    Entonces no veo la casilla "Baño medicado"

  Escenario: Volver sin terminar
    Cuando abro "Terminar" y presiono "Volver"
    Entonces la ventana se cierra y la cita sigue pendiente

  Escenario: Editar una cita pendiente
    Dado una cita pendiente para mañana a las 10:00 a. m.
    Cuando presiono "Editar", cambio la hora a "3:30 p. m." y el servicio a "Corte y baño"
    Y presiono "Guardar cambios"
    Entonces veo "Cita actualizada."
    Y la cita se muestra a las 3:30 p. m. con servicio "Corte y baño"

  Escenario: Cancelar una cita
    Dado una cita pendiente de "Luna"
    Cuando presiono "Cancelar"
    Entonces se pide confirmación "¿Cancelar la cita de Luna?"
    Cuando acepto
    Entonces veo "Cita cancelada." y la cita queda en estado "cancelada"

  Escenario: No confirmar la cancelación
    Cuando presiono "Cancelar" y no acepto la confirmación
    Entonces la cita sigue pendiente

  Escenario: Corregir el servicio de una cita realizada
    Dado una cita realizada con precio cobrado $30.000
    Cuando presiono "Corregir servicio" y cambio el precio a $32.000
    Entonces veo "Servicio actualizado."
    Y el historial muestra $32.000

  Escenario: Cita realizada sin servicio asociado
    Dado una cita realizada que no tiene servicio en el historial
    Cuando presiono "Corregir servicio"
    Entonces veo el aviso de error "Esta cita no tiene un servicio asociado."

  Escenario: Abrir ficha desde la agenda
    Cuando hago clic en el nombre de la mascota de una cita
    Entonces se abre la ficha con su historial en una ventana
    Y al cerrarla la agenda se recarga
```

## Novedades v3

### Reglas
1. La tabla se puede **ordenar y filtrar por columna** (ver README). Filtros de texto: fecha, mascota, dueño/teléfonos. Filtros de lista: servicio y estado.
2. **WhatsApp al terminar**: después de "Marcar como realizada" se abre "✔ Servicio terminado" con **📲 Avisar por WhatsApp**. El mensaje dice que la mascota ya está lista para recoger e incluye el nombre del negocio. Si el cliente no tiene teléfono, solo aparece "Cerrar".
3. **Eliminar cita** (cualquier estado): pide confirmación. Si estaba **realizada**, también borra su servicio del historial: deja de contar como servicio realizado, en reportes y en recordatorios.
4. Si la base de datos no deja borrar (faltan permisos), se muestra el mensaje de permisos y no se borra nada.

```gherkin
# language: es
Característica: Agenda v3

  Antecedentes:
    Dado que inicié sesión y estoy en "Agenda"

  Escenario: Avisar por WhatsApp al terminar
    Dado una cita pendiente de "Luna" (dueña Ana, 3001234567)
    Cuando la marco como realizada
    Entonces veo "✔ Servicio terminado" y "¿Le avisas a Ana que ya puede recogerlo?"
    Cuando presiono "📲 Avisar por WhatsApp"
    Entonces se abre "https://wa.me/573001234567?text=..." con un mensaje que incluye "Ana", "Luna" y "Pet Garden"

  Escenario: Cerrar sin avisar
    Cuando termino una cita y presiono "Cerrar"
    Entonces no se abre WhatsApp y la cita queda realizada

  Escenario: Cliente sin teléfono
    Dado una cita cuyo dueño no tiene teléfono
    Cuando la termino
    Entonces veo "Este cliente no tiene teléfono guardado." y solo el botón "Cerrar"

  Escenario: Eliminar una cita pendiente
    Cuando presiono "Eliminar" en una cita pendiente y confirmo
    Entonces veo "Cita eliminada." y la cita desaparece

  Escenario: Eliminar una cita realizada
    Dado una cita realizada de "Rocky" por $35.000
    Cuando presiono "Eliminar"
    Entonces la confirmación avisa que también se borrará el servicio del historial
    Cuando confirmo
    Entonces la cita desaparece
    Y el servicio ya no está en el historial de "Rocky"
    Y "Servicios este mes" y los reportes ya no lo cuentan

  Escenario: No confirmar la eliminación
    Cuando presiono "Eliminar" y no confirmo
    Entonces la cita sigue igual
```
