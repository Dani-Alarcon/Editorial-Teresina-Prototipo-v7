// ==========================================
// CONFIGURACIÓN DE SANITY
// ==========================================
const SANITY_PROJECT_ID = '1espt2y0';
const SANITY_DATASET = 'production';

// Mapa para traducir el valor interno de Sanity a un nombre visible bonito
const NOMBRES_COLECCIONES = {
    'clasicos-griegos': 'Clásicos Griegos',
    'clasicos-latinos': 'Clásicos Latinos',
    'pensamiento': 'Pensamiento',
    'nuevas-voces': 'Nuevas Voces',
    'literatura': 'Literatura',
    'poesia': 'Poesía',
    'universal': 'Universal',
    'otro': 'Otro'
};

// ==========================================
// 1. MENÚ DESPLEGABLE MÓVIL
// ==========================================
const botonHamburguesa = document.querySelector('.menu-btn');
const navBurguer = document.querySelector('nav');

if (botonHamburguesa && navBurguer) {
    botonHamburguesa.addEventListener('click', () => {
        const isOpen = navBurguer.classList.toggle('open');
        botonHamburguesa.setAttribute('aria-expanded', isOpen);
    });
}

// ==========================================
// 2. INTEGRACIÓN CON SANITY: AUTORES
// ==========================================
async function cargarAutores() {
    const container = document.getElementById('grid-autores');
    if (!container) return; // Si no estamos en autores.html, no hace nada

    const query = encodeURIComponent('*[_type in ["author", "autor"]]{ _id, name, bio, "imageUrl": photo.asset->url }');
    const url = `https://${SANITY_PROJECT_ID}.api.sanity.io/v2023-01-01/data/query/${SANITY_DATASET}?query=${query}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        const autores = data.result || [];

        if (autores.length === 0) {
            container.innerHTML = '<p class="muted">Próximamente añadiremos a nuestros autores.</p>';
            return;
        }

        container.innerHTML = autores.map(autor => `
            <article class="work-card">
                ${autor.imageUrl
                ? `<img src="${autor.imageUrl}" alt="${autor.name}" style="width:100%; height:200px; object-fit:cover; border-radius:4px; margin-bottom:12px;">`
                : `<div class="work-placeholder" style="aspect-ratio:16/9; margin-bottom:12px;">Sin foto</div>`
            }
                <h3>${autor.name}</h3>
                <p>${autor.bio || 'Autor publicado en Editorial Teresina.'}</p>
            </article>
        `).join('');

    } catch (error) {
        console.error('Error al cargar autores desde Sanity:', error);
        container.innerHTML = '<p class="muted">No se pudieron cargar los autores en este momento.</p>';
    }
}

// ==========================================
// 3. INTEGRACIÓN CON SANITY: CATÁLOGO DE LIBROS
// ==========================================
let coleccionLibros = [];

async function cargarLibros() {
    const container = document.getElementById('contenedor-libros');
    if (!container) return; // Si no estamos en catalogo.html, se detiene

    const query = encodeURIComponent(`
        *[_type in ["book", "libro"]] | order(title asc) {
            _id,
            title,
            slug,
            price,
            collection,
            status,
            "coverUrl": cover.asset->url,
            "authors": authors[]->{ name }
        }
    `);
    const url = `https://${SANITY_PROJECT_ID}.api.sanity.io/v2023-01-01/data/query/${SANITY_DATASET}?query=${query}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        coleccionLibros = data.result || [];

        if (coleccionLibros.length === 0) {
            container.innerHTML = '<p class="muted" style="grid-column: 1 / -1; text-align: center;">Actualmente no hay libros disponibles en el catálogo.</p>';
            return;
        }

        // 1. Inyectar las colecciones disponibles en el <select>
        poblarSelectColecciones(coleccionLibros);

        // 2. Leer la URL por si viene con ?coleccion=... desde colecciones.html
        aplicarFiltroDesdeURL();

        // 3. Configurar eventos de búsqueda y realizar el renderizado inicial filtrado
        configurarFiltrosYBusqueda();

    } catch (error) {
        console.error('Error al cargar el catálogo de Sanity:', error);
        container.innerHTML = '<p class="muted" style="grid-column: 1 / -1; text-align: center;">No se pudo cargar el catálogo de libros en este momento.</p>';
    }
}

function poblarSelectColecciones(libros) {
    const select = document.getElementById('filtro-coleccion');
    if (!select) return;

    // Extraer colecciones únicas presentes en los libros cargados
    const coleccionesUnicas = [...new Set(libros.map(libro => libro.collection))].filter(Boolean);

    // Reiniciar select con la opción por defecto
    select.innerHTML = '<option value="todas">Todas las colecciones</option>';

    coleccionesUnicas.forEach(coleccionSlug => {
        const option = document.createElement('option');
        option.value = coleccionSlug;
        option.textContent = NOMBRES_COLECCIONES[coleccionSlug] || coleccionSlug;
        select.appendChild(option);
    });
}

function aplicarFiltroDesdeURL() {
    const parametrosURL = new URLSearchParams(window.location.search);
    const coleccionURL = parametrosURL.get('coleccion');
    const select = document.getElementById('filtro-coleccion');

    if (coleccionURL && select) {
        for (let option of select.options) {
            if (option.value.toLowerCase() === coleccionURL.toLowerCase()) {
                select.value = option.value;
                break;
            }
        }
    }
}

function configurarFiltrosYBusqueda() {
    const selectColeccion = document.getElementById('filtro-coleccion');
    const inputBuscar = document.getElementById('buscar-libro');

    function aplicarFiltros() {
        const coleccionSeleccionada = selectColeccion ? selectColeccion.value : 'todas';
        const textoBusqueda = inputBuscar ? inputBuscar.value.toLowerCase().trim() : '';

        const librosFiltrados = coleccionLibros.filter(libro => {
            const coincideColeccion = coleccionSeleccionada === 'todas' || libro.collection === coleccionSeleccionada;
            const nombresAutores = libro.authors ? libro.authors.map(a => a.name.toLowerCase()).join(' ') : '';
            const coincideTexto = textoBusqueda === '' ||
                libro.title.toLowerCase().includes(textoBusqueda) ||
                nombresAutores.includes(textoBusqueda);

            return coincideColeccion && coincideTexto;
        });

        renderizarLibros(librosFiltrados);

        // Actualizar URL sin recargar la página
        const url = new URL(window.location);
        if (coleccionSeleccionada === 'todas') {
            url.searchParams.delete('coleccion');
        } else {
            url.searchParams.set('coleccion', coleccionSeleccionada);
        }
        window.history.replaceState({}, '', url);
    }

    if (selectColeccion) selectColeccion.addEventListener('change', aplicarFiltros);
    if (inputBuscar) inputBuscar.addEventListener('input', aplicarFiltros);

    // Ejecución inicial tras cargar los libros para aplicar el filtro de la URL
    aplicarFiltros();
}

function renderizarLibros(libros) {
    const container = document.getElementById('contenedor-libros');
    if (!container) return;

    if (libros.length === 0) {
        container.innerHTML = '<p class="muted" style="grid-column: 1 / -1; text-align: center;">No se encontraron libros que coincidan con la búsqueda.</p>';
        return;
    }

    container.innerHTML = libros.map(libro => {
        const nombresAutores = libro.authors && libro.authors.length > 0
            ? libro.authors.map(a => a.name).join(', ')
            : 'Autor no especificado';

        const precioFormateado = typeof libro.price === 'number'
            ? `${libro.price.toFixed(2).replace('.', ',')} €`
            : 'Consultar';

        const etiquetaColeccion = NOMBRES_COLECCIONES[libro.collection] || 'Catálogo';
        const libroSlug = libro.slug?.current || '';

        let botonPedidoHTML = '';
        if (libro.status === 'agotado') {
            botonPedidoHTML = `<button disabled class="btn" style="font-size: 0.9rem; padding: 0.5rem 0.75rem; opacity: 0.6; cursor: not-allowed;">Agotado</button>`;
        } else if (libro.status === 'preventa') {
            botonPedidoHTML = `<a href="pedido.html?slug=${libroSlug}" class="btn btn-dark" style="font-size: 0.9rem; padding: 0.5rem 0.75rem;">Reservar</a>`;
        } else {
            botonPedidoHTML = `<a href="pedido.html?slug=${libroSlug}" class="btn btn-dark" style="font-size: 0.9rem; padding: 0.5rem 0.75rem;">Hacer pedido</a>`;
        }

        const portadaHTML = libro.coverUrl
            ? `<img src="${libro.coverUrl}" alt="Portada de ${libro.title}" width="160" height="220" loading="lazy" style="object-fit: contain; max-width: 100%;">`
            : `<div style="width: 160px; height: 220px; background-color: #f8f9fa; border: 1px dashed #d1d5db; display: flex; align-items: center; justify-content: center; margin: 0 auto; border-radius: 4px; color: #9ca3af; font-size: 0.85rem; text-align: center; padding: 1rem;">
                 <span style="font-style: italic;">Portada en edición</span>
               </div>`;

        return `
            <article class="card book-card">
                <div class="book-cover-wrap" style="margin-bottom: 1rem; text-align: center;">
                    ${portadaHTML}
                </div>
                <p class="eyebrow">${etiquetaColeccion}</p>
                <h3>${libro.title}</h3>
                <p class="author"><strong>${nombresAutores}</strong></p>
                <p class="price" style="font-weight: bold; margin: 0.5rem 0;">${precioFormateado}</p>
                <div style="margin-top: auto; display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    ${botonPedidoHTML}
                    <a href="libro.html?slug=${libroSlug}" class="btn" style="font-size: 0.9rem; padding: 0.5rem 0.75rem;">Ver ficha</a>
                </div>
            </article>
        `;
    }).join('');
}

// ==========================================
// 4. INTEGRACIÓN CON SANITY: FICHA DEL LIBRO (libro.html)
// ==========================================
async function cargarDetalleLibro() {
    const container = document.getElementById('detalle-libro');
    if (!container) return; // Si no estamos en libro.html, se detiene

    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get('slug');

    if (!slug) {
        container.innerHTML = `
            <div class="container" style="padding: 3rem 0; text-align: center;">
                <p class="muted">No se ha especificado ningún libro. <a href="catalogo.html">Volver al catálogo</a>.</p>
            </div>`;
        return;
    }

    const query = encodeURIComponent(`
        *[_type in ["book", "libro"] && slug.current == "${slug}"][0]{
            title,
            price,
            collection,
            status,
            isbn,
            pages,
            binding,
            dimensions,
            publicationDate,
            synopsis,
            "coverUrl": cover.asset->url,
            "authors": authors[]->{ name }
        }
    `);
    const url = `https://${SANITY_PROJECT_ID}.api.sanity.io/v2023-01-01/data/query/${SANITY_DATASET}?query=${query}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        const libro = data.result;

        if (!libro) {
            container.innerHTML = `
                <div class="container" style="padding: 3rem 0; text-align: center;">
                    <p class="muted">El libro solicitado no existe o fue retirado. <a href="catalogo.html">Volver al catálogo</a>.</p>
                </div>`;
            return;
        }

        document.title = `${libro.title} | Editorial Teresina`;

        const nombresAutores = libro.authors && libro.authors.length > 0
            ? libro.authors.map(a => a.name).join(', ')
            : 'Autor no especificado';

        const precioFormateado = typeof libro.price === 'number'
            ? `${libro.price.toFixed(2).replace('.', ',')} €`
            : 'Consultar';

        const etiquetaColeccion = NOMBRES_COLECCIONES[libro.collection] || 'Catálogo';

        const estadoFormateado = libro.status
            ? libro.status.charAt(0).toUpperCase() + libro.status.slice(1)
            : 'Disponible';

        const fechaPublicacion = libro.publicationDate
            ? libro.publicationDate.split('-')[0]
            : '-';

        let botonesAccionHTML = '';
        if (libro.status === 'agotado') {
            botonesAccionHTML = `<button disabled class="btn" style="flex: 1; opacity: 0.6; cursor: not-allowed;">Agotado</button>`;
        } else if (libro.status === 'preventa') {
            botonesAccionHTML = `
                <a href="pedido.html?slug=${slug}" class="btn btn-dark" style="flex: 1; text-align: center; padding: 0.75rem 1rem;">Reservar en preventa</a>
                <a href="contacto.html" class="btn" style="padding: 0.75rem 1rem;">Dudas generales</a>
            `;
        } else {
            botonesAccionHTML = `
                <a href="pedido.html?slug=${slug}" class="btn btn-dark" style="flex: 1; text-align: center; padding: 0.75rem 1rem;">Hacer pedido</a>
                <a href="contacto.html" class="btn" style="padding: 0.75rem 1rem;">Dudas generales</a>
            `;
        }

        const portadaHTML = libro.coverUrl
            ? `<img src="${libro.coverUrl}" alt="Portada de ${libro.title}" width="260" height="360" style="object-fit: contain; max-width: 100%; height: auto; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">`
            : `<div style="width: 220px; height: 300px; background-color: #f8f9fa; border: 1px dashed #d1d5db; display: flex; align-items: center; justify-content: center; margin: 0 auto; border-radius: 4px; color: #9ca3af; font-size: 0.9rem; font-style: italic; text-align: center; padding: 1rem;">Portada en edición</div>`;

        let sinopsisHTML = '<p class="muted">Sinopsis no disponible.</p>';
        if (libro.synopsis && Array.isArray(libro.synopsis) && libro.synopsis.length > 0) {
            sinopsisHTML = libro.synopsis.map(b => {
                if (b._type === 'block' && b.children) {
                    return `<p style="margin-bottom: 1rem; line-height: 1.7;">${b.children.map(c => c.text).join('')}</p>`;
                }
                return '';
            }).join('');
        } else if (typeof libro.synopsis === 'string' && libro.synopsis.trim() !== '') {
            sinopsisHTML = `<p style="line-height: 1.7;">${libro.synopsis}</p>`;
        }

        container.innerHTML = `
            <div class="container">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 2.5rem; align-items: start; margin-bottom: 3rem;">
                    <div style="text-align: center; background-color: #f9fafb; padding: 1.5rem; border-radius: 8px; border: 1px solid #f3f4f6;">
                        ${portadaHTML}
                    </div>

                    <div>
                        <p class="eyebrow">${etiquetaColeccion}</p>
                        <h1 style="margin-top: 0.25rem; margin-bottom: 0.5rem; font-size: 2.25rem;">${libro.title}</h1>
                        <p class="author" style="font-size: 1.15rem; margin-bottom: 1.5rem;">
                            Por <strong>${nombresAutores}</strong>
                        </p>

                        <div style="background-color: #fafafa; border: 1px solid #eaeaea; padding: 1.25rem; border-radius: 6px; margin-bottom: 2rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                                <span style="font-size: 1.75rem; font-weight: bold;">${precioFormateado}</span>
                                <span style="font-size: 0.85rem; padding: 0.25rem 0.6rem; border-radius: 4px; background-color: #e5e7eb; color: #374151; font-weight: 500;">${estadoFormateado}</span>
                            </div>

                            <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                                ${botonesAccionHTML}
                            </div>
                        </div>

                        <p style="font-style: italic; color: #6b7280; font-size: 0.95rem;">
                            Envío gestionado bajo demanda directamente desde la imprenta hasta tu domicilio.
                        </p>
                    </div>
                </div>

                <div style="max-width: 800px; margin-bottom: 3rem;">
                    <h2 style="font-size: 1.5rem; margin-bottom: 1rem; border-bottom: 2px solid #f3f4f6; padding-bottom: 0.5rem;">Sinopsis</h2>
                    <div style="color: #374151;">
                        ${sinopsisHTML}
                    </div>
                </div>

                <div style="max-width: 800px;">
                    <h2 style="font-size: 1.5rem; margin-bottom: 1rem; border-bottom: 2px solid #f3f4f6; padding-bottom: 0.5rem;">Ficha técnica</h2>
                    
                    <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.95rem;">
                        <tbody>
                            <tr style="border-bottom: 1px solid #f3f4f6;">
                                <th scope="row" style="padding: 0.75rem 0; color: #6b7280; font-weight: 500; width: 40%;">ISBN</th>
                                <td style="padding: 0.75rem 0; font-weight: bold;">${libro.isbn || 'No asignado'}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #f3f4f6;">
                                <th scope="row" style="padding: 0.75rem 0; color: #6b7280; font-weight: 500;">Páginas</th>
                                <td style="padding: 0.75rem 0;">${libro.pages || '-'}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #f3f4f6;">
                                <th scope="row" style="padding: 0.75rem 0; color: #6b7280; font-weight: 500;">Encuadernación</th>
                                <td style="padding: 0.75rem 0;">${libro.binding || '-'}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #f3f4f6;">
                                <th scope="row" style="padding: 0.75rem 0; color: #6b7280; font-weight: 500;">Dimensiones</th>
                                <td style="padding: 0.75rem 0;">${libro.dimensions || '-'}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #f3f4f6;">
                                <th scope="row" style="padding: 0.75rem 0; color: #6b7280; font-weight: 500;">Fecha de publicación</th>
                                <td style="padding: 0.75rem 0;">${fechaPublicacion}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;

    } catch (error) {
        console.error('Error al cargar detalle del libro:', error);
        container.innerHTML = `
            <div class="container" style="padding: 3rem 0; text-align: center;">
                <p class="muted">Error al cargar la información del libro.</p>
            </div>`;
    }
}

// ==========================================
// 5. INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    cargarAutores();
    cargarLibros();
    cargarDetalleLibro();
});