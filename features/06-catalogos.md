# Feature 06 · Catálogos

## Historia de usuario

**Como** dueña de Pet Garden
**quiero** administrar los precios por raza, las guías de la máquina, los servicios con sus recordatorios y el logo
**para** que el sistema sugiera precios correctos, recuerde cuándo vuelve cada cliente y muestre la marca del negocio.

## Reglas de negocio

1. Pestañas: **Razas y precios**, **Guías**, **Servicios y recordatorios**, **Logo del negocio**.
2. En las tablas, **cada celda se guarda sola al cambiarla** (aviso "Guardado.").
3. Un campo de texto obligatorio no puede quedar vacío → "Este campo no puede quedar vacío." y se recarga el valor anterior.

### Razas y precios
4. Campos: Raza (obligatorio), Especie, Baño, Corte, Corte y baño, Recargo medicado.
5. La especie de una raza existente no se edita en la tabla.
6. Quitar una raza pide confirmación: "las mascotas que la tengan quedarán sin raza".
7. Raza repetida → mensaje de registro duplicado.

### Guías
8. Campos: Número de guía (obligatorio) y descripción (opcional). Son las opciones del desplegable "Guía usada".
9. Quitar una guía pide confirmación: "los servicios que la usaron quedarán sin guía".

### Servicios y recordatorios
10. **No se pueden renombrar** "Baño", "Corte" ni "Corte y baño" (campo deshabilitado): el precio sugerido depende de esos nombres.
11. Grupos de recordatorio: nombre y **días para volver** (número **mayor que 0**). Ej. *Spa* = 30 días.
12. Cada servicio pertenece a un grupo; los servicios de un mismo grupo cuentan igual para el recordatorio.

### Logo
13. Formatos: **PNG, JPG, WEBP, SVG**. Tamaño máximo **2 MB**.
14. Se sube al bucket `logo` como `logo-<timestamp>.<ext>` y se **borran los logos anteriores**.
15. Al subirlo se ve de inmediato en el menú y en el login.

## Escenarios

```gherkin
# language: es
Característica: Catálogos

  Antecedentes:
    Dado que inicié sesión
    Y estoy en "Catálogos"

  Escenario: Pestaña por defecto
    Entonces la pestaña "Razas y precios" está seleccionada

  # ---------- Razas ----------
  Escenario: Agregar una raza
    Cuando escribo raza "Schnauzer", especie "Perro", baño 35000, corte 40000, corte y baño 60000, recargo 8000
    Y presiono "Agregar raza"
    Entonces veo "Agregado." y "Schnauzer" aparece en la tabla

  Escenario: Raza repetida
    Dado que ya existe la raza "Schnauzer" para perro
    Cuando intento agregarla de nuevo
    Entonces veo un mensaje de registro duplicado

  Escenario: Editar un precio en la tabla
    Cuando cambio el precio de baño de "Criollo" a 32000 y salgo del campo
    Entonces veo "Guardado."
    Y al agendar un baño para un Criollo nuevo se sugiere $32.000

  Escenario: Nombre de raza vacío
    Cuando borro el nombre de una raza y salgo del campo
    Entonces veo "Este campo no puede quedar vacío."
    Y se recupera el nombre anterior

  Escenario: Quitar una raza
    Cuando presiono "Quitar" en una raza
    Entonces se pide confirmación indicando que las mascotas quedarán sin raza
    Cuando acepto
    Entonces veo "Eliminado."

  # ---------- Guías ----------
  Escenario: Agregar una guía
    Dado que estoy en la pestaña "Guías"
    Cuando escribo "#10" y la descripción "Máquina Andis"
    Y presiono "Agregar guía"
    Entonces "#10" aparece en la tabla
    Y aparece como opción en "Guía usada" al terminar una cita

  Escenario: Quitar una guía
    Cuando presiono "Quitar" en una guía y acepto
    Entonces la guía desaparece y los servicios que la usaron quedan sin guía

  # ---------- Servicios ----------
  Escenario: Servicios fijos no se pueden renombrar
    Dado que estoy en "Servicios y recordatorios"
    Entonces veo el aviso "No cambies el nombre de Baño, Corte, Corte y baño"
    Y los nombres "Baño", "Corte" y "Corte y baño" están deshabilitados

  Escenario: Agregar un grupo de recordatorio
    Cuando agrego el grupo "Desparasitación" con 90 días
    Entonces veo "Agregado." y el grupo aparece en la tabla

  Esquema del escenario: Días para volver inválidos
    Cuando cambio los días de un grupo a "<valor>"
    Entonces veo "Los días deben ser un número mayor que 0."

    Ejemplos:
      | valor |
      | 0     |
      | -5    |
      |       |

  Escenario: Agregar un servicio a un grupo
    Cuando agrego el servicio "Antipulgas" en el grupo "Desparasitación"
    Entonces aparece en la tabla de servicios
    Y está disponible al agendar una cita

  Escenario: Cambiar el grupo de un servicio
    Cuando cambio el grupo de un servicio en la tabla
    Entonces veo "Guardado."

  # ---------- Logo ----------
  Escenario: Subir logo válido
    Dado que estoy en "Logo del negocio"
    Cuando elijo un PNG de 500 KB y presiono "Subir logo"
    Entonces veo "Logo actualizado."
    Y veo el nuevo logo en el menú lateral
    Y los logos anteriores se eliminan del bucket

  Escenario: Formato de logo no permitido
    Cuando elijo un archivo GIF
    Entonces veo "Usa una imagen PNG, JPG, WEBP o SVG."

  Escenario: Logo demasiado pesado
    Cuando elijo una imagen de 3 MB
    Entonces veo "La imagen pesa más de 2 MB. Usa una más liviana."

  Escenario: Sin logo subido
    Dado que nunca he subido un logo
    Entonces veo "Todavía no has subido un logo."
```
