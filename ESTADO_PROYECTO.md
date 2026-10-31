# Estado del proyecto KBE — Sistema de reservas

Resumen de contexto para continuar el trabajo en este repositorio.

## Resumen ejecutivo

El proyecto es un sitio estático existente de Kickboxing Espinoza, hecho con HTML, CSS y JavaScript sin build. Se conservaron las páginas y el diseño, y se añadieron los cimientos de un MVP de reservas con Supabase: esquema SQL/RLS, reservas públicas desde la página de horarios y un panel privado del profesor.

Las fases 1 a 4 están implementadas en el código. Se añadieron pruebas unitarias, herramientas de prueba de integración condicionadas a variables de entorno, una demo sin conexión y mejoras al panel. El sistema **no está listo para producción**: no hay proyecto Supabase conectado, la migración no se ha aplicado en un backend real y no se han ejecutado pruebas de integración, RLS o concurrencia contra Supabase.

## Arquitectura

- Frontend: HTML/CSS/JavaScript estático existente.
- Hosting previsto: GitHub Pages.
- Backend y datos: Supabase PostgreSQL, Auth y RPC.
- En el navegador solo se usa la clave pública anon; no se debe poner la clave de servicio en ningún archivo público.
- La reserva se procesa con la función SQL transaccional `public.book_class(...)`.
- Zona horaria de presentación: `America/Santiago`.

## Archivos relevantes

- `horarios.html`: listado público de clases y formulario para reservar.
- `admin.html`: login y panel privado del profesor.
- `demo.html` / `demo.js`: demostración con nombres y teléfonos ficticios, solo en memoria; no autentica ni conecta a Supabase.
- `script.js`: integración de Supabase, renderizado de clases, reserva, autenticación y operaciones administrativas.
- `reservation-utils.js`: validación, formateo, filtros y resumen diario compartidos y testeables.
- `tests/reservation-utils.test.js`: pruebas unitarias locales.
- `tests/supabase-concurrency.test.js`: pruebas de integración opcionales con proyecto aislado configurado por variables de entorno.
- `styles.css`: estilos de las nuevas vistas.
- `supabase/migrations/20261030_000001_initial_reservation_system.sql`: tablas, índices, vista pública, RLS, triggers de capacidad y actualización, y RPC.
- `supabase/tests/verification.sql`: verificación transaccional de SQL y guía de comprobaciones API/RLS.
- `README.md`: configuración y despliegue.
- `.env.example`: referencia de nombres de configuración. No existe un build que cargue este archivo.

## Funcionalidad implementada

### Pública

- Consulta clases desde `published_classes_public`.
- Presenta fecha/hora en horario de Chile y cupos disponibles.
- Mantiene clases completas visibles, pero no seleccionables para reservar.
- Requiere OTP por SMS mediante Supabase Auth; la RPC compara el teléfono confirmado de la sesión con el número de la reserva.
- Envía reservas mediante `book_class`, disponible solo para authenticated.
- Incluye estados de carga y mensajes para falta de cupos, duplicados y otros errores.
- Evita el doble envío del formulario mientras la solicitud está en curso.

### Panel del profesor

- Inicio/cierre de sesión con Supabase Auth.
- Comprobación de perfil con rol `admin`.
- Crear, editar, publicar y cancelar clases.
- Revisar clases y reservas.
- Ver resumen de reservas/clases/ocupación de hoy.
- Buscar reservas y filtrar por fecha/estado.
- Cancelar reservas para liberar cupos, con confirmación previa.
- La autorización real depende de RLS en PostgreSQL; ocultar el panel no es la medida de seguridad.

### Seguridad

- Anon consulta solo la vista pública allowlist; las tablas base están cerradas a lectura anónima y el acceso autenticado a clases queda limitado a admins.
- La RPC de reserva valida entradas y teléfono confirmado, bloquea la fila de clase y devuelve solo el identificador de la reserva propia.
- RLS limita reservas y perfiles; índices/trigger protegen duplicados, cupos y cambios de capacidad.
- La mitigación de reservas con números ficticios requiere habilitar Phone Auth, configurar un proveedor SMS y revisar límites/costos antes de producción.

## Pasos pendientes para habilitarlo

1. Crear un proyecto Supabase.
2. Aplicar todas las migraciones SQL en orden.
3. Habilitar Phone Auth en Supabase y configurar un proveedor SMS con límites apropiados.
4. Crear manualmente el usuario del profesor en Supabase Auth.
5. Insertar el UUID del profesor en `public.profiles` con rol `admin`.
6. Configurar `window.KBE_SUPABASE_CONFIG` en `horarios.html` y `admin.html` con Project URL y clave anon.
7. Desplegar la raíz estática con GitHub Pages.
8. Probar OTP, reserva verificada, acceso de no-admin y panel admin.
9. Probar concurrencia con un único cupo disponible y dos usuarios de teléfono verificados distintos.

No usar `service_role` en el frontend. La clave anon es pública; RLS debe mantenerse activa.

## Verificaciones realizadas

- `npm test`: 12 pruebas unitarias pasaron; 4 pruebas de integración quedaron omitidas por falta de configuración Supabase.
- `node --check` pasó para los JavaScript del frontend y pruebas.
- Se probó en navegador local la demo: reserva ficticia, búsqueda, cancelación que libera cupo y diseño adaptable sin overflow horizontal a viewport efectivo de 450px.
- La página pública de horarios mostró correctamente el estado sin configuración y deshabilitó la reserva.
- Revisiones previas comprobaron que no se añadieron claves reales ni referencias de implementación a la clave de servicio.
- No se pudo validar la migración mediante PostgreSQL/Supabase en este entorno.
- No se probaron el flujo de Auth, las políticas RLS ni la concurrencia contra un backend configurado.
- La mitigación OTP está implementada en frontend y SQL, pero no se ha aplicado/probado contra un proyecto Supabase. Configuración de proveedor SMS, ACL/RLS y envío real quedan pendientes.

## Decisiones y límites del MVP

- No se inventan horarios, precios, duración de clases ni reglas de cancelación.
- Las clases son ocurrencias individuales; no se implementan recurrencias.
- El correo del alumno es opcional.
- No se implementan pagos, membresías, lista de espera ni notificaciones.
- El `.env.example` no se carga automáticamente en GitHub Pages; el sitio actual requiere completar el bloque de configuración en los HTML.

## Notas para el siguiente agente

- Antes de afirmar que el MVP está probado, ejecutar la migración y validar RLS/RPC con roles anon y authenticated en un proyecto de prueba.
- Revisar `supabase/tests/verification.sql`: contiene ejemplos/manuales y requiere sustituir IDs de clase; ejecutar desde SQL Editor como propietario no valida RLS porque ese rol puede omitirla.
- Si se añade un proceso de build para inyectar configuración, actualizar README y quitar la duplicación del bloque de configuración en ambos HTML.
- No desplegar ni modificar un proyecto Supabase real sin autorización explícita.
