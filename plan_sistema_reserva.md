Implementación MVP — Sistema de reservas Kickboxing Espinoza
Objetivo
Convertir el sitio web existente en una aplicación sencilla para que los alumnos consulten clases y reserven cupos, y para que el profesor pueda administrar horarios, cupos y reservas.

Prioridad: mantener el frontend actual, minimizar costos y evitar infraestructura que haya que mantener.
1. Arquitectura decidida
- Frontend: conservar el proyecto actual (HTML, CSS y JavaScript, salvo que el repositorio ya use otro framework).
- Hosting frontend: GitHub Pages.
- Backend y base de datos: Supabase (PostgreSQL, Auth y funciones SQL/RPC).
- Integración: cliente JavaScript oficial de Supabase desde el frontend.
- No implementar FastAPI ni contratar un servidor Python en esta primera versión. Supabase puede validar y procesar reservas mediante funciones SQL transaccionales. Python puede utilizarse más adelante para tareas auxiliares, pero no es necesario para el MVP.
Documentación oficial:
- https://supabase.com/docs
- https://supabase.com/docs/reference/javascript
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/database/functions
2. Restricciones importantes
1. Antes de modificar archivos, inspecciona el repositorio y comprende su estructura, diseño, navegación y componentes existentes.
2. No reemplaces ni rediseñes el sitio completo. Integra las funcionalidades nuevas respetando su identidad visual.
3. No inventes horarios, precios, direcciones, políticas ni datos del profesor. Si falta información, deja datos de ejemplo claramente identificados o solicita la decisión.
4. No incluyas secretos en el frontend.
5. La clave service_role de Supabase nunca debe aparecer en el repositorio ni en el navegador. El frontend puede usar la clave anon/publishable, siempre con RLS correctamente configurado.
6. No confíes en validaciones JavaScript para asegurar cupos. La validación definitiva debe ejecutarse en PostgreSQL.
7. Usa la zona horaria America/Santiago para mostrar fechas y horarios.
8. No agregues pagos, mensualidades, membresías, asistencia biométrica, notificaciones pagadas ni funcionalidades fuera del MVP.
9. No despliegues ni ejecutes cambios destructivos en un proyecto Supabase real sin autorización explícita.
10. No publiques credenciales ni datos personales reales en commits, capturas o archivos de ejemplo.
3. Alcance funcional del MVP
A. Vista pública de clases
- Mostrar próximas clases disponibles.
- Mostrar fecha, hora, duración (si está definida), cupos disponibles y estado.
- No mostrar información personal de alumnos ni listados de reservas.
- Permitir iniciar una reserva desde una clase.
B. Reserva de cupo
Formulario mínimo:
- Nombre del alumno (obligatorio).
- Teléfono (obligatorio).
- Correo electrónico (opcional, salvo que el proyecto existente o el profesor justifique hacerlo obligatorio).
- Clase seleccionada.
Al enviar:
- Validar campos en el frontend para mejorar la experiencia.
- Enviar la solicitud a una función RPC de Supabase.
- La base de datos debe comprobar que la clase existe, está publicada, no ha comenzado y tiene cupos.
- Evitar que el mismo teléfono reserve dos veces la misma clase.
- Crear la reserva de forma atómica.
- Mostrar confirmación o un mensaje claro si ya no hay cupos.
No permitir que el navegador consulte todas las reservas ni datos personales.
C. Panel privado del profesor
- Inicio de sesión mediante Supabase Auth.
- Listado de clases próximas.
- Ver reservas de cada clase (nombre y teléfono; correo si existe).
- Crear, editar, publicar y cancelar clases.
- Definir fecha, hora y capacidad de cada clase.
- Capacidad predeterminada sugerida: 25, pero editable.
- Cancelar una reserva desde el panel.
- Mostrar cupos ocupados y disponibles.
No habilitar registro público de cuentas administrativas. La cuenta del profesor debe crearse manualmente desde el panel de Supabase o mediante un procedimiento administrativo seguro.
D. Fuera de alcance por ahora
- Pagos online.
- Cobro de mensualidades.
- Planes y membresías.
- Lista de espera automática.
- Recordatorios por WhatsApp/SMS.
- Aplicación móvil.
- Reportería avanzada.
- Múltiples sedes o profesores, salvo que el repositorio ya lo requiera.
4. Modelo de datos propuesto
Crear migraciones SQL versionadas en el repositorio, por ejemplo en supabase/migrations/.
profiles
- id uuid primary key references auth.users(id)
- role text not null check (role in ('admin'))
- created_at timestamptz not null default now()
Solo el administrador debe poder leer su perfil. No permitir que un usuario público se otorgue el rol de administrador.
classes
- id uuid primary key default gen_random_uuid()
- title text not null
- starts_at timestamptz not null
- ends_at timestamptz (nullable si no se conoce duración)
- capacity integer not null default 25 check (capacity > 0)
- status text not null default 'published' check (status in ('draft','published','cancelled'))
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()
No asumir que todas las clases son iguales ni inventar recurrencias. Cada ocurrencia del calendario es una fila independiente. Si el profesor necesita horarios recurrentes, diseñar esa función en una etapa posterior.
reservations
- id uuid primary key default gen_random_uuid()
- class_id uuid not null references classes(id)
- student_name text not null
- phone text not null
- email text (nullable)
- status text not null default 'confirmed' check (status in ('confirmed','cancelled'))
- created_at timestamptz not null default now()
Agregar una restricción/índice único para impedir dos reservas activas del mismo teléfono en la misma clase. Normalizar el teléfono antes de guardarlo (trim y formato consistente). Si se implementa índice parcial, debe cubrir solo reservas confirmed.

Considerar índices para classes(starts_at, status) y reservations(class_id, status).
5. Validación segura y concurrencia
La reserva debe ejecutarse mediante una función PostgreSQL (RPC), por ejemplo book_class(...).

La función debe:
1. Validar y normalizar los datos recibidos.
2. Obtener la clase y bloquear su fila con SELECT ... FOR UPDATE.
3. Rechazar clases inexistentes, no publicadas, canceladas o que ya comenzaron.
4. Comprobar si el teléfono ya tiene una reserva confirmada para esa clase.
5. Contar las reservas confirmadas.
6. Rechazar la operación si el total ya alcanzó la capacidad.
7. Insertar la reserva y devolver un resultado mínimo (por ejemplo, éxito y código de confirmación).
El bloqueo de fila debe asegurar que dos solicitudes simultáneas no puedan ocupar el último cupo a la vez. La operación debe ejecutarse en una sola transacción.

La función expuesta al rol anon debe tener permisos mínimos, validar todas las entradas y usar SECURITY DEFINER solo si es necesario. Si se usa SECURITY DEFINER, fijar explícitamente un search_path seguro, calificar nombres de tablas y revocar permisos innecesarios. No devolver datos de otras reservas.

El panel administrativo debe usar autenticación y políticas RLS para que solo el usuario autorizado pueda leer y modificar datos privados.
6. Seguridad y RLS
Activar RLS en todas las tablas expuestas por la API.

Política general:
- Público (anon): solo puede leer los datos públicos necesarios de clases publicadas y futuras, idealmente mediante una vista con columnas explícitas.
- Público (anon): no puede listar, leer, actualizar ni borrar reservas.
- Público (anon): solo puede solicitar una reserva a través de la función RPC controlada.
- Administrador autenticado: puede gestionar clases y consultar/gestionar reservas.
- Ningún usuario puede modificar su propio rol para convertirse en administrador.
No usar SELECT * en vistas públicas si eso puede exponer columnas futuras. No exponer teléfonos, correos ni nombres de alumnos en endpoints públicos.

Documentar las políticas y probarlas con roles anon y authenticated.
7. Experiencia de usuario
- Diseño responsive, usable desde teléfono.
- Estados de carga al consultar clases y enviar una reserva.
- Evitar doble envío del formulario.
- Mensajes claros: reserva confirmada, clase llena, clase no disponible, datos inválidos o error temporal.
- No mostrar una reserva como confirmada hasta recibir la respuesta satisfactoria de la base de datos.
- En el panel, confirmar acciones destructivas como cancelar una clase.
- Mantener accesibilidad básica: etiquetas, foco visible y mensajes de error asociados a campos.
8. Configuración y despliegue
Crear un .env.example sin credenciales reales, con las variables necesarias para el proyecto. Para frontend estático, documentar cómo inyectar la URL del proyecto y la clave pública de Supabase según el mecanismo de build existente. Si no hay build, explicar la configuración sin incluir secretos.

Configurar GitHub Pages para servir el frontend. Crear el proyecto Supabase manualmente y aplicar las migraciones SQL. Documentar:
- cómo crear el proyecto;
- dónde obtener Project URL y clave pública;
- cómo aplicar migraciones;
- cómo crear la cuenta del profesor;
- cómo configurar GitHub Pages;
- cómo probar el sistema localmente.
No asumir que GitHub Pages ejecuta Python, procesos en segundo plano o código de servidor.
9. Pruebas obligatorias
Funcionales
- Una clase con 25 cupos permite exactamente 25 reservas activas.
- La reserva número 26 se rechaza.
- Una persona no puede reservar dos veces la misma clase.
- Una clase cancelada o iniciada no acepta reservas.
- Cancelar una reserva libera un cupo.
- El profesor puede crear y cancelar clases.
Concurrencia
- Simular varias solicitudes simultáneas cuando queda un solo cupo.
- Verificar que exactamente una reserva se confirme y las demás se rechacen.
- No basta con deshabilitar el botón en JavaScript.
Seguridad
- Un visitante anónimo no puede consultar nombres, teléfonos o correos de reservas.
- Un visitante anónimo no puede modificar clases.
- Un usuario no administrador no puede acceder al panel ni administrar datos.
- La clave service_role no aparece en archivos del frontend ni en Git.
10. Fases de implementación
Fase 0 — Inspección
- Revisar estructura y tecnologías del sitio actual.
- Identificar navegación, estilos, componentes y forma de despliegue.
- Informar qué archivos se modificarán antes de hacer cambios grandes.
Fase 1 — Base de datos
- Crear migraciones.
- Crear tablas, índices, restricciones, vista pública y RPC.
- Configurar RLS.
- Probar reglas y concurrencia.
Fase 2 — Integración pública
- Configurar cliente Supabase.
- Mostrar próximas clases.
- Implementar formulario y confirmación de reserva.
- Manejar errores y estados de carga.
Fase 3 — Panel administrativo
- Implementar login.
- Crear gestión de clases.
- Crear listado privado de reservas y acciones de cancelación.
- Restringir rutas y datos mediante RLS; ocultar una pantalla en frontend no es una medida de seguridad.
Fase 4 — Verificación y documentación
- Ejecutar pruebas funcionales, de concurrencia y seguridad.
- Probar en móvil.
- Actualizar README con configuración y despliegue.
- Entregar un resumen de cambios, archivos, migraciones, pruebas realizadas y pasos pendientes.
11. Criterios de aceptación
El MVP se considera listo cuando:
- Un alumno puede ver clases y reservar desde el teléfono.
- Una clase nunca supera su capacidad, incluso con solicitudes simultáneas.
- No se permiten reservas duplicadas de la misma persona para la misma clase.
- El profesor puede iniciar sesión, crear clases y revisar/cancelar reservas.
- Los datos personales no son accesibles públicamente.
- El sitio actual sigue funcionando y conserva su diseño.
- La aplicación puede desplegarse en GitHub Pages con Supabase sin servidor propio.
12. Instrucción final para el agente
Implementa por etapas, no de una sola vez. Primero inspecciona el repositorio y presenta un diagnóstico breve de su estructura y del plan de integración. Después implementa la Fase 1 y verifica SQL/RLS antes de avanzar. No inventes decisiones del negocio: cuando una decisión necesaria no esté definida (por ejemplo, duración de clases, política de cancelación o si el correo será obligatorio), deja una configuración razonable claramente marcada o pregunta antes de imponerla.

Prioriza seguridad, simplicidad, bajo costo y reutilización del frontend existente. No añadas dependencias innecesarias ni conviertas el proyecto en una aplicación más compleja de lo que requiere una escuela con aproximadamente 60 alumnos diarios y clases de hasta 25 personas.