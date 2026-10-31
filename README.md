# Kickboxing Espinoza (KBE)

Sitio web estático de la Academia Kickboxing Espinoza, ubicada en San Miguel, Santiago de Chile. Presenta la academia y sus entrenamientos, publica los horarios disponibles y facilita el contacto por WhatsApp e Instagram.

## Contenido del sitio

| Página | Contenido |
| --- | --- |
| `index.html` | Inicio, resumen de la academia, accesos a entrenamientos y horarios, ubicación y contacto. |
| `academia.html` | Presentación de la academia y del profesor/equipo. |
| `entrenamientos.html` | Kick boxing, preparación física y Muay Thai. |
| `horarios.html` | Horarios de mañana y tarde/noche, además de información sobre planes. |
| `demo.html` | Demostración local con datos ficticios en memoria; no se conecta a Supabase ni autentica. |
| `admin.html` | Panel privado del profesor (requiere Supabase configurado). |
| `contacto.html` | Orientación para empezar y formulario que prepara un mensaje para WhatsApp. |
| `tienda.html` | Catálogo de equipamiento Gradivus con precios y enlaces para consultar por WhatsApp. |

## Estructura

```text
.
├── index.html
├── academia.html
├── entrenamientos.html
├── horarios.html
├── contacto.html
├── tienda.html
├── admin.html
├── demo.html
├── components.js
├── script.js
├── demo.js
├── reservation-utils.js
├── styles.css
├── README.md
├── ESTADO_PROYECTO.md
├── package.json
├── tests/
├── supabase/
    ├── migrations/
    └── tests/
└── assets/
    ├── catalogo/
    │   ├── bucal.png
    │   ├── cabezal.png
    │   ├── canilleras.png
    │   ├── shorts.png
    │   ├── thai pads.png
    │   └── vendas.png
    └── images/
        ├── kbe.png
        ├── kickboxing.jpg
        └── muaythai.jpg
```

### Recursos visuales

- `assets/images/kbe.png`: logo utilizado en la navegación, la portada y como favicon.
- `assets/images/kickboxing.jpg` y `assets/images/muaythai.jpg`: imágenes de las tarjetas de esas modalidades.
- `assets/catalogo/`: fotografías de los seis productos Gradivus publicados en la tienda.
- La imagen de preparación física y el fondo de la portada se cargan desde Unsplash. Requieren conexión a internet.


## Tecnologías

- HTML para las páginas y su contenido.
- CSS en `styles.css` para la presentación y el diseño adaptable.
- JavaScript sin dependencias externas en `components.js` y `script.js`.
- Helpers y pruebas automatizadas sin dependencias npm en `reservation-utils.js` y `tests/`.
- Componentes web reutilizables para la navegación, el pie de página y el acceso flotante a WhatsApp.
- Selector de modo oscuro/claro en la navegación; la preferencia se guarda en el navegador.
- Fuentes Barlow Condensed e Inter cargadas desde Google Fonts.

## Diagnóstico inicial

El repositorio es un sitio estático HTML/CSS/JS sin backend ni build pipeline. Mantiene la identidad visual existente y usa navegación y componentes reutilizables. Por eso, para el MVP de reservas se decidió conservar el frontend actual y conectar la lógica con Supabase desde JavaScript, dejando el sitio en GitHub Pages sin servidor propio.

Para un resumen de estado, archivos principales y próximos pasos dirigido al siguiente agente, consulta `ESTADO_PROYECTO.md`.

## Fase 1 implementada: base de datos Supabase

Se añadió la infraestructura inicial del modelo de reservas en `supabase/migrations/20261030_000001_initial_reservation_system.sql`.

Incluye:

- tabla `profiles` con rol restringido a `admin`;
- tabla `classes` con estado, capacidad, fecha y horario;
- tabla `reservations` con restricción de cupos y índice único para evitar reservas duplicadas del mismo teléfono por clase;
- vista pública `published_classes_public` para exponer solo clases publicadas y futuras;
- política RLS que bloquea acceso público a reservas y protege la administración;
- función `book_class(...)` como RPC transaccional con validación de cupos, bloqueo de fila, prevención de duplicados y requisito de teléfono confirmado por OTP;
- migración posterior que revoca la ejecución de la RPC para `anon` y exige que el teléfono de la reserva coincida con el teléfono Auth confirmado;
- trigger de `updated_at` para clases.

## Configuración recomendada

1. Crea un proyecto Supabase y copia la URL del proyecto y la clave pública anon.
2. Aplica en orden todas las migraciones de `supabase/migrations/` desde SQL Editor. Para usar Supabase CLI, primero inicializa y vincula un proyecto Supabase al repositorio; luego ejecuta `supabase db push`.
3. En Supabase Auth, habilita Phone y configura un proveedor SMS, sus credenciales y límites de envío. La entrega de SMS puede tener costos del proveedor.
4. En `horarios.html` y `admin.html`, reemplaza los valores vacíos de `window.KBE_SUPABASE_CONFIG` por la URL del proyecto y la clave pública anon.
5. Crea la cuenta del profesor en Auth y asígnale el perfil administrador siguiendo los pasos de abajo.

La reserva pública requiere un código SMS. El OTP verifica el control del número; el usuario Auth resultante no recibe permisos de administrador por registrarse. Configura límites de OTP/abuso en Supabase y en el proveedor SMS antes de publicar.

El archivo `.env.example` documenta los nombres de las variables públicas, pero el sitio no tiene proceso de build ni carga `.env` en el navegador. No copies credenciales reales a `.env` esperando que GitHub Pages las inyecte.

## Variables de entorno

El archivo `.env.example` contiene:

```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu_clave_publica_de_supabase
```

No se debe incluir nunca la clave de servicio de Supabase en el frontend ni en Git.

### Configuración del frontend estático

Para activar la reserva y el panel, el navegador necesita la URL del proyecto y la clave pública anon. En un sitio estático sin build, configura el bloque `window.KBE_SUPABASE_CONFIG` presente en `horarios.html` y `admin.html` antes de cargar `script.js`:

```html
<script>
  window.KBE_SUPABASE_CONFIG = {
    url: "https://tu-proyecto.supabase.co",
    anonKey: "tu_clave_publica_de_supabase"
  };
</script>
```

También se aceptan `window.SUPABASE_URL` y `window.SUPABASE_ANON_KEY` si se prefieren variables globales.

## Crear cuenta del profesor

La cuenta administrativa no debe registrarse desde un formulario público. Se debe crear manualmente desde Supabase (o mediante un proceso administrativo seguro) y luego insertar el perfil correspondiente en `public.profiles` usando el UUID del usuario autenticado:

```sql
insert into public.profiles (id, role)
values ('<uuid-del-usuario-auth>', 'admin');
```

Esto evita que un usuario público se otorgue permisos de administrador.

## Panel privado del profesor

Se añadió una vista administrativa en `admin.html` para autenticar al profesor y gestionar clases, reservas y estados. El acceso se habilita solo con una cuenta de Supabase autenticada con perfil `admin` y políticas RLS activas.

Para usarla:

1. crea o identifica la cuenta del profesor en Supabase Auth;
2. inserta el UUID de esa cuenta en `public.profiles` con rol `admin`;
3. abre la ruta `admin.html` del sitio y usa el formulario de login;
4. desde el panel podrás crear, editar, publicar y cancelar clases, además de cancelar reservas.

El resumen del día incluye todas las clases de hoy, incluso las ya iniciadas. Las listas administrativas consultan los registros por páginas para evitar el límite de filas por respuesta de Supabase.

## Despliegue en GitHub Pages

1. Sube el sitio al repositorio GitHub sin archivos `.env` ni claves privadas.
2. En la configuración del repositorio, habilita Pages desde la rama y carpeta raíz que contienen los archivos HTML.
3. Configura URL y clave anon en `horarios.html` y `admin.html`, y confirma que Phone Auth/SMS esté habilitado en Supabase.
4. Espera el despliegue y verifica las rutas `horarios.html` y `admin.html`, incluido el envío/verificación de un OTP con un número de prueba.

La clave anon es pública por diseño: la protección de datos y operaciones depende de las políticas RLS y las funciones SQL. Nunca se debe publicar la clave de servicio.

No se requiere Python, backend ni procesos en segundo plano para el MVP.

## Instalación y prueba local

Se requiere Node.js 20 o superior para ejecutar las pruebas integradas de Node. Para servir el sitio estático, basta con Python ya instalado o cualquier servidor estático local:

```powershell
python -m http.server 8000
```

Luego abre:

- `http://127.0.0.1:8000/demo.html` para probar clases, cupos, reservas, filtros y cancelación con datos ficticios;
- `http://127.0.0.1:8000/horarios.html` para ver la reserva desactivada hasta configurar Supabase.

La demo no requiere credenciales, no persiste cambios y no utiliza la autenticación real. No la uses para administrar reservas reales.

## Pruebas

Pruebas unitarias locales, sin servicios externos:

```powershell
npm test
```

Incluyen validación y normalización de teléfonos, mapeo de errores, disponibilidad, paginación, filtros por alumno/fecha/estado y resumen diario en `America/Santiago`.

La prueba de integración/concurrencia se ejecuta solo con Supabase de prueba preparado:

```powershell
$env:KBE_RUN_SUPABASE_INTEGRATION = "true"
$env:SUPABASE_URL = "https://tu-proyecto-de-prueba.supabase.co"
$env:SUPABASE_ANON_KEY = "clave-publica-de-prueba"
$env:KBE_TEST_CLASS_ID = "uuid-de-clase-publicada-con-un-solo-cupo-libre"
$env:KBE_TEST_ADMIN_ACCESS_TOKEN = "jwt-temporal-de-usuario-admin"
$env:KBE_UNVERIFIED_ACCESS_TOKEN = "jwt-temporal-de-usuario-sin-telefono-confirmado"
$env:KBE_TEST_PHONE_1_ACCESS_TOKEN = "jwt-temporal-de-telefono-verificado-1"
$env:KBE_TEST_PHONE_2_ACCESS_TOKEN = "jwt-temporal-de-telefono-verificado-2"
npm run test:integration
```

Los dos JWT `KBE_TEST_PHONE_*` deben pertenecer a cuentas con teléfonos distintos y confirmados por SMS. `KBE_UNVERIFIED_ACCESS_TOKEN` debe ser de una cuenta autenticada sin teléfono confirmado. La clase de prueba debe ser futura, publicada, tener exactamente un cupo libre, no tener reservas confirmadas de esos teléfonos y no recibir reservas externas durante la prueba. El test comprueba el rechazo anónimo/no verificado y de teléfono distinto, envía dos reservas concurrentes con los usuarios verificados y elimina las reservas sintéticas mediante el JWT de un usuario administrador. No usa `service_role`. No ejecutar contra producción.

No se ejecutaron pruebas de integración, RLS o concurrencia contra Supabase porque aún no hay backend configurado.

## Seguridad

- RLS está habilitado en `profiles`, `classes` y `reservations`.
- Anon solo tiene lectura de la vista pública con columnas explícitas; no puede ejecutar la RPC de reserva.
- Anon no tiene privilegios directos sobre tablas de clases, perfiles o reservas.
- `book_class` solo es ejecutable por usuarios autenticados con teléfono confirmado; la función compara ese teléfono con el número de la reserva. Usa `SECURITY DEFINER`, `search_path` restringido (`pg_catalog, public`), tablas cualificadas, permisos explícitos y bloqueo `SELECT ... FOR UPDATE`.
- Los índices únicos impiden teléfonos duplicados activos por clase. Las reservas concurrentes se serializan sobre la fila de clase.
- El panel requiere Auth y perfil admin; RLS sigue siendo la autorización real.
- Un trigger impide bajar capacidad por debajo de reservas confirmadas.
- Nunca incluir la clave de servicio en archivos frontend; la clave anon es pública.
- La vista pública revela horario/capacidad/ocupación, pero no nombres, teléfonos ni correos.
- La reserva requiere OTP telefónico con Supabase Auth. Su protección depende de la configuración segura de Phone Auth, límites de envío y proveedor SMS; este proyecto no configura el proveedor ni acredita costos o límites.

La auditoría local confirmó el riesgo previo de reservas con números no verificados; el código ahora exige OTP y coincidencia de teléfono en la RPC. La ACL final, configuración Phone Auth/SMS y comportamiento RLS deben validarse en el proyecto Supabase real antes de producción.

## Manual breve del profesor

1. Abrir `admin.html` e iniciar sesión con la cuenta administrativa creada en Supabase.
2. Revisar el resumen de hoy (reservas, clases y ocupación).
3. Crear una clase o seleccionar una futura para editarla. La fecha/hora del formulario se interpreta en `America/Santiago`.
4. Publicar una clase para que aparezca en `horarios.html`; borrador y cancelada no se ofrecen para reservar.
5. Buscar reservas por nombre, teléfono, correo o clase, y filtrar por fecha de clase y estado.
6. Cancelar reservas para liberar cupo. Cancelar una clase requiere confirmación.

## Verificación SQL y RLS

El archivo `supabase/tests/verification.sql` contiene una prueba transaccional de la RPC que revierte sus datos de ejemplo y una lista de chequeos de rol que deben correrse mediante la API con JWT anon/authenticated. Las consultas desde SQL Editor como propietario no prueban RLS.

- visibilidad pública de clases;
- rechazo de acceso anónimo a reservas;
- acceso restringido para usuarios no administradores;
- flujo de reserva, validación de cupos y duplicados;
- cancelación que libera un cupo;
- clases canceladas y reducción de capacidad;
- concurrencia en el último cupo (prueba Node con backend);
- restricción para que nadie se otorgue rol de administrador.

Antes de producción:

1. crear el proyecto Supabase y aplicar la migración SQL;
2. crear la cuenta del profesor en Auth;
3. asignar el UUID del usuario a `public.profiles` con rol `admin`;
4. probar el envío y la verificación OTP, y reservar con el teléfono verificado;
5. verificar la carga de clases y la cancelación de reservas desde `admin.html`;
6. confirmar que el sitio sigue funcionando en GitHub Pages sin dependencias de servidor.

## Contacto y privacidad

El formulario existente no envía ni almacena información en un servidor. Al enviarlo, prepara un mensaje y abre WhatsApp para que la persona lo revise y decida si lo envía. Los enlaces directos a WhatsApp e Instagram también están disponibles.

Al reservar, el nombre, teléfono verificado y correo opcional se envían a Supabase para gestionar el cupo. Supabase Auth y el proveedor SMS configurado procesan el teléfono para verificarlo; revisa sus políticas de privacidad y costos antes de habilitar reservas.

Los horarios muestran las horas de las clases; consulta a la academia para confirmar los días, los cupos y los valores vigentes antes de asistir o inscribirte.
