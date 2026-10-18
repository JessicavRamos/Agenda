# Features · Pet Garden SPA

Documentación funcional del panel de administración de **Pet Garden** (pet shop y spa).
Cada archivo describe un módulo con: historia de usuario, reglas de negocio y escenarios en Gherkin (español).

| # | Archivo | Módulo | Acceso |
|---|---------|--------|--------|
| 01 | [01-login-y-navegacion.md](01-login-y-navegacion.md) | Login, menú, buscador general y perfil | Público / privado |
| 02 | [02-hoy.md](02-hoy.md) | Citas del día y "A quién buscar hoy" (recordatorios + WhatsApp) | Privado |
| 03 | [03-agendar-cita.md](03-agendar-cita.md) | Agendar cita con autocompletado, precio sugerido y baño medicado | Privado |
| 04 | [04-agenda.md](04-agenda.md) | Agenda: filtros, terminar, editar, cancelar y corregir servicio | Privado |
| 05 | [05-clientes-y-mascotas.md](05-clientes-y-mascotas.md) | Búsqueda, ficha, edición e historial | Privado |
| 06 | [06-catalogos.md](06-catalogos.md) | Razas y precios, guías, servicios/recordatorios y logo | Privado |
| 07 | [07-videos.md](07-videos.md) | Carrusel público, lista para deslizar, activar/desactivar y administrador | Público / privado |
| 08 | [08-reportes.md](08-reportes.md) | Resumen por fechas y descarga de Excel | Privado |

## Contexto técnico

- **Frontend:** HTML + JavaScript puro (sin framework), navegación por hash (`#/hoy`, `#/agendar`, …).
- **Backend:** Supabase (Auth, base de datos Postgres, Storage).
- **Configuración:** `config.js` → `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `NOMBRE_NEGOCIO`.
- **Zona horaria:** todas las fechas se calculan en `America/Bogota`.
- **Moneda:** pesos colombianos, formato `es-CO` (ej. `$30.000`).

### Objetos de base de datos que usa el frontend

| Tipo | Nombre | Uso |
|------|--------|-----|
| Tabla | `clientes`, `mascotas`, `citas`, `servicios` | Datos principales |
| Tabla | `razas`, `guias`, `tipos_servicio`, `grupos_recordatorio`, `videos` (con `activo`) | Catálogos |
| Tabla | `pendientes_descartados` | Mascotas descartadas de "A quién buscar" en el ciclo actual |
| Vista | `agenda` | Citas con datos de mascota, cliente y servicio |
| Vista | `pendientes` | Mascotas que ya deben volver (con `dias_de_retraso`) |
| Vista | `mascotas_resumen` | Mascota + cliente + teléfonos + visitas + última visita |
| Vista | `historial` | Servicios realizados |
| Vista | `ultima_guia` | Última guía usada por mascota |
| Vista | `precios_sugeridos` | Precio habitual de la mascota o de la raza |
| RPC | `registrar_cita` | Crea la cita y, si no existen, el cliente y la mascota |
| Trigger | (en `citas`) | Al pasar la cita a `realizada` crea el servicio en el historial |
| Storage | `logo`, `videos` | Buckets públicos |

## Comportamiento común: tablas con orden y filtro

Las tablas de Agenda, Clientes y mascotas, Reportes y el administrador de Videos comparten este comportamiento:

```gherkin
# language: es
Característica: Ordenar y filtrar tablas por columna

  Escenario: Ordenar por una columna
    Cuando hago clic en el encabezado "Mascota"
    Entonces las filas se ordenan de A a Z y el encabezado muestra ▲
    Cuando vuelvo a hacer clic
    Entonces se ordenan de Z a A y muestra ▼
    Cuando hago clic una tercera vez
    Entonces vuelve al orden original y muestra ↕

  Escenario: Los vacíos van al final
    Cuando ordeno por "Última visita"
    Entonces las mascotas sin visitas aparecen al final en ambos sentidos

  Escenario: Filtrar por texto (sin importar tildes ni mayúsculas)
    Cuando escribo "simon" en el filtro de "Mascota"
    Entonces veo "Simón"
    Y debajo de la tabla dice "Mostrando 1 de N registros"

  Escenario: Filtrar por lista
    Cuando elijo "cancelada" en el filtro de "Estado"
    Entonces solo veo citas canceladas

  Escenario: El filtro se limpia si su valor desaparece
    Dado que filtré por estado "cancelada"
    Cuando elimino la única cita cancelada
    Entonces el filtro vuelve a "Todos"

  Escenario: Orden y filtros se recuerdan
    Dado que ordené la Agenda por "Mascota"
    Cuando cambio de pantalla y vuelvo
    Entonces la tabla sigue ordenada por "Mascota"
```

## Glosario

- **Guía:** número de la máquina usada para peluquear; se guarda para repetir el corte.
- **Baño medicado:** baño con otro champú; suma un recargo (normalmente $8.000 o $16.000 según el tamaño).
- **Grupo de recordatorio:** servicios que cuentan igual para calcular cuándo vuelve el cliente (ej. *Spa*: Baño, Corte, Corte y baño → 30 días).
- **Cliente inactivo:** no aparece en "A quién buscar", pero conserva su historial.

## Historial de versiones

- **v3:** recuperar contraseña, descartar pendientes, avisar recogida por WhatsApp, eliminar citas/servicios, tablas ordenables y filtrables, historial en Agendar, lista y activación de videos, pantalla completa sin recortes, Reportes con Excel, colores de listas desplegables.

## Próximas mejoras (aún no implementadas)

- Renombrar "Catálogos" a "Configuración" en el menú.
- Cambiar el texto del recordatorio de WhatsApp por el mensaje oficial de Pet Garden (grupo *Spa*).
