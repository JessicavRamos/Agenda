# Feature 01 · Login, navegación y perfil

## Historia de usuario

**Como** dueña o empleada de Pet Garden
**quiero** entrar al panel con mi correo y contraseña
**para** gestionar citas, clientes y catálogos de forma privada, mientras los videos de productos siguen siendo públicos.

## Reglas de negocio

1. Si `config.js` no tiene `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `NOMBRE_NEGOCIO` (o contienen `PEGA_AQUI`), se muestra la pantalla **"Falta un paso"**.
2. El título de la pestaña del navegador es el valor de `NOMBRE_NEGOCIO`.
3. Todas las secciones son privadas **excepto Videos**, que se ve sin iniciar sesión.
4. El logo se toma del bucket `logo` (el archivo `logo-*` más reciente). Si no hay logo se muestra 🐾. La espera máxima para cargarlo es de 2,5 s.
5. El menú lateral tiene: Hoy, Agendar, Agenda, Clientes y mascotas, Reportes, Catálogos, Videos.
6. Una ruta desconocida redirige a **Hoy**.
7. Abajo del menú se muestra el **nombre** del usuario (no el correo). Si no tiene, aparece "👤 Escribe tu nombre".
8. El buscador general busca al presionar **Enter** y lleva a "Clientes y mascotas" con el término cargado.
9. Los errores técnicos se traducen a mensajes amigables (tabla abajo).

### Mensajes de error

| Error técnico | Mensaje mostrado |
|---------------|------------------|
| `invalid login credentials` | Correo o contraseña incorrectos. |
| `failed to fetch` / sin red | No hay conexión con la base de datos. Revisa tu internet y los datos de config.js. |
| `email not confirmed` | Tu correo aún no está confirmado. Confírmalo en Supabase (Authentication > Users). |
| `jwt expired` | Tu sesión venció. Vuelve a iniciar sesión. |
| `permission denied` / RLS | No tienes permiso para hacer esto. Inicia sesión de nuevo. |
| `duplicate key` | Ya existe un registro con ese dato (por ejemplo, otro cliente con ese teléfono o una raza repetida). |
| `foreign key` | No se puede completar: este dato está en uso en otro lugar. |
| `rate limit` | Se enviaron demasiados correos seguidos. Espera unos minutos e intenta de nuevo. |
| `should be different from the old password` | La nueva contraseña debe ser diferente a la anterior. |
| `password should be at least` | La contraseña debe tener al menos 6 caracteres. |
| tabla/columna inexistente | Falta actualizar la base de datos: ejecuta en Supabase el SQL de esta versión. |

## Escenarios

```gherkin
# language: es
Característica: Inicio de sesión y navegación del panel

  Antecedentes:
    Dado que config.js tiene la URL, la clave pública y NOMBRE_NEGOCIO = "Pet Garden"

  Escenario: Login exitoso
    Dado que estoy en la pantalla de entrada
    Cuando escribo un correo y una contraseña válidos
    Y presiono "Entrar"
    Entonces veo el panel con el menú lateral
    Y la pantalla "Hoy" se muestra por defecto

  Escenario: Login con credenciales incorrectas
    Dado que estoy en la pantalla de entrada
    Cuando escribo una contraseña incorrecta
    Y presiono "Entrar"
    Entonces veo el mensaje "Correo o contraseña incorrectos."
    Y el botón vuelve a decir "Entrar" y está habilitado

  Escenario: El botón se deshabilita mientras inicia sesión
    Cuando presiono "Entrar"
    Entonces el botón muestra "Entrando…" y queda deshabilitado hasta recibir respuesta

  Escenario: Correo sin confirmar
    Dado un usuario cuyo correo no está confirmado en Supabase
    Cuando intento iniciar sesión
    Entonces veo "Tu correo aún no está confirmado. Confírmalo en Supabase (Authentication > Users)."

  Escenario: Configuración incompleta
    Dado que config.js todavía tiene "PEGA_AQUI" en la URL o la clave
    Cuando abro el sitio
    Entonces veo la pantalla "Falta un paso" con instrucciones para completar config.js

  Escenario: Ver videos sin iniciar sesión
    Dado que no he iniciado sesión
    Cuando hago clic en "Ver videos de productos"
    Entonces veo la pantalla pública de videos con el botón "Entrar al panel"
    Y no veo el administrador de videos

  Esquema del escenario: Las secciones privadas piden login
    Dado que no he iniciado sesión
    Cuando navego a "<ruta>"
    Entonces veo el formulario de login

    Ejemplos:
      | ruta        |
      | #/hoy       |
      | #/agendar   |
      | #/agenda    |
      | #/clientes  |
      | #/catalogos |

  Escenario: Ruta desconocida
    Dado que inicié sesión
    Cuando navego a "#/no-existe"
    Entonces veo la pantalla "Hoy"

  Escenario: Logo en login y menú
    Dado que hay un logo subido en el bucket "logo"
    Cuando abro el sitio
    Entonces veo el logo en la pantalla de entrada
    Y después de iniciar sesión lo veo junto al nombre del negocio en el menú lateral

  Escenario: Sin logo
    Dado que no hay ningún logo subido
    Entonces se muestra el ícono 🐾 en lugar del logo

  Escenario: Guardar mi nombre
    Dado que inicié sesión y no tengo nombre guardado
    Y abajo del menú veo "👤 Escribe tu nombre"
    Cuando hago clic, escribo "Jessica" y presiono "Guardar"
    Entonces abajo del menú veo "👤 Jessica"

  Escenario: Buscador general
    Dado que estoy en la pantalla "Hoy"
    Cuando escribo "Luna" en el buscador superior y presiono Enter
    Entonces voy a "Clientes y mascotas" con "Luna" en el campo de búsqueda
    Y si hay una sola coincidencia se abre su ficha automáticamente

  Escenario: Cerrar sesión
    Dado que inicié sesión
    Cuando presiono "Cerrar sesión"
    Entonces vuelvo a la pantalla de login
```

## Recuperar contraseña (v3)

### Reglas
1. En el login hay un enlace **"¿Olvidaste tu contraseña?"** que abre una ventana para escribir el correo (viene lleno con el del login).
2. Se llama a `resetPasswordForEmail` con `redirectTo` = dirección actual del sitio. Por seguridad el mensaje es el mismo exista o no el correo.
3. Al abrir el enlace del correo se muestra la pantalla **"Nueva contraseña"** (dos campos, mínimo 6 caracteres, opción "Mostrar contraseña").
4. Al guardar se llama a `updateUser({ password })`, se limpia el enlace de la barra de direcciones y se entra al panel.
5. Si el enlace venció o ya se usó, el login muestra el aviso y se puede pedir otro.
6. Requisito en Supabase: la dirección del sitio debe estar en *Authentication → URL Configuration* (Site URL y Redirect URLs).

```gherkin
# language: es
Característica: Recuperar contraseña

  Escenario: Pedir el enlace
    Dado que estoy en el login y escribí "jessica@correo.com"
    Cuando presiono "¿Olvidaste tu contraseña?"
    Entonces se abre la ventana con el correo ya escrito
    Cuando presiono "Enviar enlace"
    Entonces veo "Si el correo está registrado, te llegará un enlace en unos minutos. Revisa también la carpeta de spam."

  Escenario: Demasiados intentos
    Dado que pedí varios enlaces seguidos
    Cuando pido otro
    Entonces veo "Se enviaron demasiados correos seguidos. Espera unos minutos e intenta de nuevo."

  Escenario: Crear la nueva contraseña
    Dado que abrí el enlace del correo
    Entonces veo la pantalla "Nueva contraseña"
    Cuando escribo "Garden2026" en los dos campos y presiono "Guardar contraseña"
    Entonces veo "¡Listo! Tu contraseña quedó actualizada."
    Y entro al panel en la pantalla "Hoy"
    Y la barra de direcciones ya no muestra el enlace del correo

  Esquema del escenario: Validaciones de la nueva contraseña
    Cuando escribo "<clave>" y repito "<repetida>"
    Y presiono "Guardar contraseña"
    Entonces veo "<mensaje>"

    Ejemplos:
      | clave      | repetida   | mensaje                                         |
      | abc        | abc        | La contraseña debe tener al menos 6 caracteres. |
      | Garden2026 | Garden2027 | Las dos contraseñas no son iguales.             |

  Escenario: Misma contraseña anterior
    Cuando escribo la misma contraseña que tenía
    Entonces veo "La nueva contraseña debe ser diferente a la anterior."

  Escenario: Enlace vencido
    Dado un enlace de recuperación vencido o ya usado
    Cuando lo abro
    Entonces veo el login con "El enlace para cambiar la contraseña venció o ya se usó. Pide uno nuevo."

  Escenario: Cancelar el cambio
    Dado que estoy en la pantalla "Nueva contraseña"
    Cuando presiono "Cancelar"
    Entonces se cierra la sesión y vuelvo al login
```

## Listas desplegables (v3)

```gherkin
# language: es
Característica: Color de las listas desplegables

  Escenario: Mismo color que los demás campos
    Cuando abro cualquier lista desplegable (especie, raza, servicio, hora, guía)
    Entonces su fondo y su texto son iguales a los de los campos de texto
    Y en modo oscuro también se ven con los colores del tema oscuro
```
