# Editorial Teresina — paquete web v3

Sitio multipágina listo para subir a un hosting estático.

Pendiente antes de publicación real:
1. Dominio y alojamiento.
2. Correos corporativos.
3. Datos legales definitivos de Editorial Teresina SCP.
4. Conectar el formulario de manuscritos a un servicio/backend real.
5. Sustituir los títulos de muestra por el catálogo real.
6. Añadir condiciones de venta cuando se active tienda online.
7. Revisar privacidad/cookies según los servicios tecnológicos que finalmente se usen.


## Rediseño y tienda (noviembre de 2026)

- Diseño nuevo en todas las páginas (`assets/styles.css`), con ilustraciones de línea propias.
- El catálogo, las colecciones y la ficha (`libro.html?slug=…`) se cargan desde Sanity con `assets/tienda.js`. Si un libro no tiene cubierta definitiva (o usa la imagen provisional), se dibuja una portada con el color y el emblema de su colección.
- Un libro se puede comprar si su estado es `preventa` o `disponible` y su precio en Sanity es mayor que 0.
- Cesta en `cesta.html`. El pago se hace con Stripe Checkout mediante la función `api/checkout.js` (Vercel), que lee los precios de Sanity en el servidor.
- Mientras no esté configurada la clave de Stripe, el botón de pago muestra un formulario para enviar el pedido por correo (Web3Forms).

### Activar el pago con tarjeta (Vercel → Settings → Environment Variables)

| Variable | Obligatoria | Contenido |
|---|---|---|
| `STRIPE_SECRET_KEY` | Sí | Clave secreta de Stripe (`sk_live_…`). No se guarda en el repositorio ni se envía por correo. |
| `SHIPPING_RATES` | No | Tarifas de envío en céntimos, p. ej. `[{"name":"Envío península","amount":390,"min_days":2,"max_days":5}]` |
| `ALLOWED_COUNTRIES` | No | Países de envío separados por comas (por defecto `ES`). |
| `SITE_URL` | No | Por defecto `https://editorialteresina.es`. |
| `STRIPE_TERMS` | No | `1` para pedir en Stripe la aceptación de las condiciones. |

Después de guardar las variables, hay que volver a desplegar el proyecto en Vercel.
