# Feature 03 · Agendar cita

## Historia de usuario

**Como** dueña de Pet Garden
**quiero** agendar una cita escribiendo solo el nombre de la mascota o un teléfono
**para** que el sistema reconozca si ya vino, complete sus datos, me sugiera el precio y guarde solo al cliente y la mascota si son nuevos.

## Reglas de negocio

### Formulario
1. Campos obligatorios (*): **Mascota, Teléfono del dueño, Nombre del dueño, Especie, Servicio, Día**. Opcionales: segundo teléfono, raza, precio, motivo (máx. 200 caracteres).
2. Valores por defecto: servicio **Baño** (para perro y gato), día **mañana**, hora **10:00 a. m.**
3. La hora se elige de una lista cada 30 minutos de **7:00 a. m. a 8:00 p. m.**
4. Botones rápidos de día: **Hoy, Mañana, Pasado mañana**. Debajo se muestra el día en texto y las citas ya agendadas ese día (sin canceladas).
5. La lista de razas se filtra según la especie elegida.
6. Los teléfonos se guardan solo con dígitos y `+`.

### Reconocimiento de la mascota
7. La búsqueda se activa con **2 o más caracteres**, espera 300 ms y busca por mascota, dueño, teléfono o segundo teléfono (máx. 6 sugerencias).
8. Si el **nombre y un teléfono coinciden exactamente** con una mascota, se elige sola.
9. Al elegir una mascota se llenan: teléfonos, dueño, especie y raza; y se muestran la descripción del corte, la última guía y el historial de servicios terminados (ver "Historial en Agendar").
10. "Ya vino antes" solo si tiene **servicios terminados** (`visitas > 0`); si no, "Primera vez de …".
11. Si el cliente estaba **inactivo**, se avisa que se reactivará al agendar.
12. Si cambio el nombre o el teléfono después de elegir, se quita la selección (se trata como posible mascota nueva).

### Precio
13. Prioridad del precio sugerido: **último precio cobrado a esa mascota** para ese servicio → si no hay, **precio de la raza** para ese servicio.
14. Columnas de precio por servicio: Baño → `precio_bano`, Corte → `precio_corte`, Corte y baño → `precio_corte_bano`.
15. Si el precio habitual de la mascota es distinto al de la raza, se muestra la diferencia.
16. El precio es editable. Si lo edito a mano, ya no se sobrescribe al cambiar raza/servicio… hasta que cambie especie, raza o servicio (se reinicia).
17. Sin raza con precio → "Sin precio sugerido: elige una raza con precio (Catálogos) o escríbelo tú."

### Baño medicado
18. La casilla **Baño medicado** solo aparece para **Baño** y **Corte y baño**. Si cambio a "Corte", se desmarca y se resta el recargo.
19. Al marcarla se propone el recargo de la raza (o el último de la mascota). Botones rápidos **+$8.000** y **+$16.000**.
20. El recargo se **suma** al precio al marcar y se **resta** al desmarcar.
21. Si la última visita fue medicada, se muestra el aviso amarillo **"⚠ La última vez fue con baño medicado"** (solo el texto, sin fecha ni botón).

### Guardar
22. Se llama a la RPC `registrar_cita`. El aviso indica si se creó cliente nuevo y/o mascota nueva.
23. Si la mascota existente no tenía raza y se eligió una, se actualiza la raza de la mascota.

## Escenarios

```gherkin
# language: es
Característica: Agendar cita

  Antecedentes:
    Dado que inicié sesión
    Y estoy en la pantalla "Agendar cita"
    Y la raza "Criollo" (perro) tiene precio de baño $30.000 y recargo medicado $8.000

  Escenario: Valores por defecto
    Entonces el servicio seleccionado es "Baño"
    Y el día es mañana
    Y la hora es "10:00 a. m."

  Escenario: Agendar una mascota nueva
    Cuando escribo mascota "Rocky", teléfono "3105556677" y dueño "Carlos"
    Y elijo especie "Perro" y raza "Criollo"
    Entonces la ficha dice "Mascota nueva" y el precio sugerido es $30.000
    Cuando presiono "Agendar cita"
    Entonces veo el aviso "Cita agendada · se guardó: cliente nuevo y mascota nueva"
    Y el formulario queda limpio

  Escenario: Faltan datos obligatorios
    Cuando dejo vacío el nombre del dueño
    Y presiono "Agendar cita"
    Entonces veo "Faltan datos obligatorios (los marcados con *)."
    Y no se crea la cita

  Escenario: Reconocer mascota que ya vino por teléfono
    Dado que "Luna" de "Ana" tiene teléfono "3001234567" y 4 visitas
    Cuando escribo "300123" en el teléfono
    Entonces veo a "Luna" en las sugerencias
    Cuando la elijo
    Entonces se llenan el dueño, la especie y la raza
    Y veo "✔ Luna ya vino antes" con el número de visitas y la última fecha
    Y veo el historial reciente y la última guía

  Escenario: Reconocer por el segundo teléfono
    Dado que "Luna" tiene segundo teléfono "3159998877"
    Cuando escribo "3159998877" en el campo teléfono
    Entonces "Luna" aparece en las sugerencias

  Escenario: Selección automática por coincidencia exacta
    Cuando escribo mascota "Luna" y teléfono "3001234567"
    Entonces "Luna" se elige sola sin hacer clic en la sugerencia

  Escenario: No buscar con menos de 2 caracteres
    Cuando escribo "L" en mascota
    Entonces no aparecen sugerencias

  Escenario: Mascota registrada sin servicios terminados
    Dado que "Max" existe pero tiene 0 visitas
    Cuando lo elijo
    Entonces veo "🐾 Primera vez de Max"

  Escenario: Cliente inactivo
    Dado que el dueño de "Max" está inactivo
    Cuando lo elijo
    Entonces veo "cliente inactivo (se reactivará al agendar)"

  Escenario: Precio habitual de la mascota tiene prioridad sobre la raza
    Dado que a "Toby" (Criollo) la última vez le cobré $40.000 por baño
    Cuando elijo a "Toby" con servicio "Baño"
    Entonces el precio es $40.000 con el texto "Precio habitual de esta mascota"
    Y veo "La raza cuesta $30.000, pero a esta mascota le cobras $40.000."

  Escenario: Cambiar el precio sugerido
    Dado que el precio sugerido es $30.000
    Cuando escribo $35.000 en "Precio acordado"
    Y agendo la cita
    Entonces la cita queda con precio acordado $35.000

  Escenario: Raza sin precio
    Cuando elijo una raza sin precio para el servicio
    Entonces veo "Sin precio sugerido: elige una raza con precio (Catálogos) o escríbelo tú."

  Escenario: Las razas dependen de la especie
    Cuando cambio la especie a "Gato"
    Entonces la lista de razas solo muestra razas de gato

  Esquema del escenario: Casilla de baño medicado según el servicio
    Cuando elijo el servicio "<servicio>"
    Entonces la casilla "Baño medicado" está <visible>

    Ejemplos:
      | servicio     | visible   |
      | Baño         | visible   |
      | Corte y baño | visible   |
      | Corte        | oculta    |

  Escenario: Marcar baño medicado suma el recargo
    Dado servicio "Baño" con precio $30.000
    Cuando marco "Baño medicado"
    Entonces el recargo propuesto es $8.000
    Y el precio pasa a $38.000

  Escenario: Botón rápido de recargo
    Dado servicio "Baño" con precio $30.000
    Cuando presiono "+$16.000"
    Entonces la casilla queda marcada y el precio pasa a $46.000

  Escenario: Desmarcar baño medicado resta el recargo
    Dado que el precio es $38.000 con recargo de $8.000
    Cuando desmarco "Baño medicado"
    Entonces el precio vuelve a $30.000

  Escenario: Cambiar a Corte quita el medicado
    Dado servicio "Baño" con medicado marcado y precio $38.000
    Cuando cambio el servicio a "Corte"
    Entonces la casilla se desmarca y se oculta
    Y el recargo se resta del precio

  Escenario: Aviso de baño medicado anterior
    Dado que la última visita de "Luna" fue con baño medicado
    Cuando la elijo
    Entonces veo exactamente "⚠ La última vez fue con baño medicado"
    Y no veo fecha ni botón dentro del aviso
    Y la casilla "Baño medicado" sigue sin marcar

  Escenario: Botones rápidos de día
    Cuando presiono "Hoy"
    Entonces el día es la fecha de hoy y el botón queda resaltado
    Y veo las citas que ya tengo ese día o "Ese día no tienes citas todavía."

  Escenario: Completar la raza de una mascota que no la tenía
    Dado que "Max" existe sin raza
    Cuando lo elijo, selecciono raza "Criollo" y agendo
    Entonces "Max" queda guardado con raza "Criollo"

  Escenario: Llegar desde "A quién buscar"
    Dado que presioné "Agendar" en un pendiente de "Luna"
    Entonces la mascota y el teléfono vienen llenos
    Y "Luna" queda reconocida con sus datos completos
```

## Historial en Agendar (v3)

### Reglas
1. Al elegir una mascota existente, a la derecha aparece **"Servicios terminados"**: solo servicios del historial (citas realizadas).
2. Cada fila es compacta: **fecha · hora**, servicio y **valor cobrado**. La hora sale de la cita de la que nació el servicio.
3. Se muestran los **5 más recientes**; **"Ver más (N más)"** muestra la lista completa y **"Ver menos"** la recoge.
4. Casilla **"Incluir las demás mascotas de {dueño}"**: suma los servicios de todas sus mascotas y muestra el nombre de cada una.
5. Al final: cantidad de servicios y **total cobrado**.

```gherkin
# language: es
Característica: Historial en la pantalla Agendar

  Antecedentes:
    Dado que "Luna" tiene 12 servicios terminados y "Simba" (mismo dueño) tiene 2
    Y estoy en "Agendar cita"

  Escenario: Últimos 5 servicios
    Cuando elijo a "Luna"
    Entonces veo 5 servicios del más reciente al más antiguo
    Y cada uno muestra fecha, hora y valor cobrado
    Y veo "Ver más (7 más)" y "12 servicios · Total $488.000"

  Escenario: Ver la lista completa
    Cuando presiono "Ver más (7 más)"
    Entonces veo los 12 servicios
    Y el enlace cambia a "Ver menos"

  Escenario: Incluir las demás mascotas del dueño
    Cuando marco "Incluir las demás mascotas de Ana"
    Entonces veo los servicios de "Luna" y "Simba" con el nombre de cada mascota
    Y el total dice "14 servicios · Total $578.000"

  Escenario: Solo servicios terminados
    Dado que "Luna" tiene una cita pendiente para mañana
    Entonces esa cita no aparece en "Servicios terminados"

  Escenario: Mascota sin servicios terminados
    Cuando elijo a "Rocky", que nunca ha terminado un servicio
    Entonces veo "Todavía no tiene servicios terminados."
```
