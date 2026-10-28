# Kickboxing Espinoza (KBE)

Sitio web estático de la Academia Kickboxing Espinoza, ubicada en San Miguel, Santiago de Chile. Presenta la academia y sus entrenamientos, publica los horarios disponibles y facilita el contacto por WhatsApp e Instagram.

## Contenido del sitio

| Página | Contenido |
| --- | --- |
| `index.html` | Inicio, resumen de la academia, accesos a entrenamientos y horarios, ubicación y contacto. |
| `academia.html` | Presentación de la academia y del profesor/equipo. |
| `entrenamientos.html` | Kick boxing, preparación física y Muay Thai. |
| `horarios.html` | Horarios de mañana y tarde/noche, además de información sobre planes. |
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
├── components.js
├── script.js
├── styles.css
├── README.md
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
- Componentes web reutilizables para la navegación, el pie de página y el acceso flotante a WhatsApp.
- Selector de modo oscuro/claro en la navegación; la preferencia se guarda en el navegador.
- Fuentes Barlow Condensed e Inter cargadas desde Google Fonts.

## Contacto y privacidad

El formulario no envía ni almacena información en un servidor. Al enviarlo, prepara un mensaje y abre WhatsApp para que la persona lo revise y decida si lo envía. Los enlaces directos a WhatsApp e Instagram también están disponibles.

Los horarios muestran las horas de las clases; consulta a la academia para confirmar los días, los cupos y los valores vigentes antes de asistir o inscribirte.
