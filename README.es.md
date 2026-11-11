<p align="center">
  <img src="docs/assets/hero-icon.png" width="96" height="96" alt="GOG Enhancer logo" />
</p>

<h1 align="center">GOG Enhancer</h1>

<p align="center">
  <a href="https://github.com/DrummingBird1/GOGEnhancer/blob/main/extension/manifest.json"><img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FDrummingBird1%2FGOGEnhancer%2Fmain%2Fextension%2Fmanifest.json&query=%24.version&label=version&color=c64fff" alt="version" /></a>
  <img src="https://img.shields.io/badge/manifest-v3-00f0ff" alt="Manifest V3" />
  <a href="https://github.com/DrummingBird1/GOGEnhancer/actions/workflows/test.yml"><img src="https://img.shields.io/github/actions/workflow/status/DrummingBird1/GOGEnhancer/test.yml?branch=main&label=tests&color=7fffa6" alt="tests" /></a>
  <a href="https://github.com/DrummingBird1/GOGEnhancer/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-ff6b9d" alt="MIT license" /></a>
</p>

<p align="center">Chromium-based browsers (Chrome, Edge, Brave, Opera)</p>

<p align="center"><a href="README.md">English</a> · <a href="README.he.md">עברית</a> · <a href="README.ru.md">Русский</a> · <a href="README.pl.md">Polski</a> · <a href="README.de.md">Deutsch</a> · <a href="README.fr.md">Français</a> · <a href="README.es.md">Español</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.pt-BR.md">Português (Brasil)</a></p>

Una extensión de terceros no oficial para GOG.com: conversión de divisas con tipos en vivo, historial de precios, comparación con otras tiendas, etiquetas personales, una mejora visual completa, hebreo + RTL — sin Google Fonts y sin analítica.

> **Aviso legal:** esta es una extensión de terceros no oficial. No está afiliada a GOG sp. z o.o. ni a CD Projekt S.A., ni cuenta con su respaldo o patrocinio. El nombre «GOG» se usa solo para designar la tienda con la que funciona la extensión.

---

## 📂 Contenido del repositorio

| Archivo / carpeta | Finalidad |
|---|---|
| **`extension/`** | **La extensión que se distribuye** — `manifest.json` más `background/`, `content/`, `lib/`, `popup/`, `options/`, `onboarding/`, `tags/`, `tour/`, `icons/`. Es la carpeta que cargas con «Cargar descomprimida» y la que se empaqueta en el zip. |
| **`store/`** | Material para la tienda que **no forma parte** de la extensión: `STORE_LISTING.md` (textos para el panel), `listings/` (descripción de la tienda, un archivo por idioma), `screenshots/` (diez por idioma, generadas por `e2e/store-screenshots.mjs`), `brand/` (logotipo e imágenes promocionales), `release-images/` (banners de versión, véase `CLAUDE.md`). Se sube aparte y nunca se incluye en el zip. |
| **`docs/`** | El sitio web de la extensión en GitHub Pages — página de inicio, guía, política de privacidad, registro de cambios. |
| `PRIVACY.md` | Política de privacidad (también disponible en una dirección pública: `docs/privacy.html`) |
| `README.he.md`, `README.ru.md`, `README.pl.md`, `README.de.md`, `README.fr.md`, `README.es.md`, `README.zh-CN.md`, `README.pt-BR.md` | Traducciones completas de este archivo, una por idioma de interfaz |
| `LICENSE` | Licencia MIT |
| `build.ps1` | Script de compilación — empaqueta `extension/` en `dist/gog-enhancer-webstore.zip` (`node scripts/build-firefox.mjs` genera el zip experimental para Firefox) |
| `scripts/`, `e2e/` | Script de publicación (`release.mjs`), la compilación para Firefox y las herramientas de extremo a extremo: la suite de Playwright (fixtures, sitio real, con sesión iniciada), un presupuesto de rendimiento, un registrador de estructura, regresión de capturas, un recolector de textos para las traducciones y el generador de capturas para la tienda. Solo en local; nada de esto se distribuye. |
| `dist/` | Resultados de compilación (ignorados por git). Los regenera `build.ps1` |
| `tests/`, `package.json`, `vitest.config.js`, `eslint.config.js` | Vitest y ESLint para los módulos de utilidad puros. No se incluyen en el zip de la extensión. |
| `.github/workflows/` | GitHub Actions: `test.yml` ejecuta lint y pruebas en cada push/PR, `release.yml` genera el zip y publica una versión al subir una etiqueta `v*.*.*`, `canary.yml` es una comprobación programada del sitio real |
| `CLAUDE.md` | Notas del proyecto para asistentes de IA |
| `README.md` | Versión en inglés de este archivo |

---

## ✨ Resumen de funciones

### Arquitectura
- **Una capa de almacenamiento unificada** — preferencias en `storage.sync` (ligero, sincronizado entre dispositivos), datos más pesados (etiquetas, historial, cachés) en `storage.local`. No se supera ninguna cuota.
- **Versionado y migración de ajustes** — al actualizar desde la v1, las etiquetas y notas pasan automáticamente de sync a local.
- **Solo fuentes del sistema** — sin dependencia de Google Fonts, sin código remoto, sin analítica.
- **Una sola capa de red** (`lib/net.js`) — toda petición de la extensión pasa por ella: lista de cinco hosts permitidos, sin cookies, sin referer, con tiempo de espera y un registro local de «host + ruta» (nunca la consulta) que muestra la página de ajustes avanzados. Una prueba rompe la compilación si cambia un permiso o un host sin que lo digan los documentos de privacidad.
- **Un solo adaptador del sitio** (`content/gog-dom.js`) — cada búsqueda en el marcado de gog.com (tarjetas, precios, título, posición del panel) prueba varias estrategias, de modo que un rediseño degrada las funciones con elegancia en lugar de romperlas en silencio. «Comprobar esta página» en los ajustes avanzados muestra qué búsquedas siguen funcionando.
- **`MutationObserver` enfocado** en el contenido de la página con antirrebote; el ruido de la cabecera se filtra y se detecta si se sustituye `<main>`.
- **Cada función se ejecuta aislada** — si una búsqueda falla tras un cambio del sitio, solo esa función se apaga y el resto sigue; «Comprobar esta página» lista lo que falló.
- **Solo aprende de las páginas que abres** — la propiedad de juegos, las valoraciones, los idiomas y los datos de precio se leen de páginas que visitas tú y se guardan en local. La extensión no descarga nada adicional.

### Funciones
- 💱 **Tipos de cambio en vivo para 24 divisas** — el shéquel, el euro, la libra, el esloti, el rublo, el real, el yen, el yuan y más, descargados automáticamente de `api.frankfurter.dev` cada 12 horas. Se pueden editar a mano.
- 📈 **Seguimiento de precios** — cada visita a la página de un juego guarda una muestra. Un panel de estadísticas en la página del juego muestra el precio actual, el mínimo histórico y la media, además de un veredicto «¿Vale la pena esperar?».
- 🔍 **Comparar en IsThereAnyDeal** — un botón en la página del juego busca el mismo título en Steam / Epic / Humble / Fanatical.
- 🏷️ **Panel de etiquetas completo** — una página aparte con búsqueda, filtrado, contador por etiqueta y exportación a CSV. Autocompletado de etiquetas existentes.
- 🔔 **Alertas y ofertas de la lista de deseos** — una insignia en el icono de la barra cuenta los juegos rebajados de la lista; la ventana muestra tus tres mayores bajadas de precio seguidas.
- 🛡️ **Banner DRM-free** — un banner sólido con icono de escudo y una píldora «GOG+» con degradado.
- 🎨 **Mejora visual de las tarjetas** — según el juego: «Good Old Game» recibe un sutil efecto CRT y un halo dorado; los títulos de Cyberpunk/Witcher, un resplandor neón cian/magenta.
- 🪟 **Descripciones emergentes con estilo** — sustituyen las del navegador, con encabezados, contenido enriquecido y colocación automática.
- 📋 **Lista de mods dinámica** — se obtiene automáticamente de `gog.com/en/mods` cada 24 horas.
- 🌍 **Detección automática de la divisa de la página** — si GOG ya muestra EUR (usuarios de la UE), la extensión no vuelve a convertir.
- 🎯 **RTL correcto** — `inline-start`/`end` en lugar de `left`/`right`, y `unicode-bidi: isolate` para los precios.
- ⌨️ **Atajos de teclado** — `Alt+G` abre la ventana, `Alt+Shift+G` activa/desactiva la extensión, `Alt+Shift+H` alterna el hebreo; `Ctrl/Cmd+K` abre una paleta de comandos para todo lo demás.
- 🧙 **Asistente de primera vez** — 4 pasos (divisa, región, funciones, tema), se abre automáticamente en la primera instalación.
- ☁️ **Sincronización entre dispositivos mediante una carpeta que elijas** (Dropbox, OneDrive, Google Drive, Syncthing…) — fusiona etiquetas, notas, estado, compras, alertas e historial de precios por registro, con cifrado opcional. Nada nuestro de por medio. Chrome / Edge / Brave.
- 🔎 **Búsqueda en la biblioteca desde la barra de direcciones** — escribe `gog` + Tab y luego un nombre de juego, `tag:rpg` o `status:backlog`.
- 🎨 **Tema «Native»** — toma los colores y la fuente del propio gog.com, de modo que lo añadido se integra con el aspecto que tenga el sitio.
- ⌨️ **Navegación con teclado** (opcional) — `J`/`K` se mueven entre juegos de un listado, `T` etiqueta el seleccionado.
- 📅 **Archivos de calendario (`.ics`)** para los plazos de reembolso y las fechas de lanzamiento de juegos de la lista de deseos, y 📝 **exportaciones a Markdown / Obsidian / CSV** desde el panel de etiquetas — todo se crea en tu dispositivo.
- 🌍 **Nueve idiomas de interfaz** — el panel de etiquetas, los ajustes avanzados, la ventana, el asistente y los textos propios de la extensión en gog.com en inglés, hebreo (de derecha a izquierda), ruso, polaco, alemán, francés, español, chino simplificado y portugués de Brasil. Lo que escribes tú (nombres de etiquetas, notas) nunca se traduce.
- 🔒 **Panel de privacidad** en los ajustes avanzados — cada dirección que contactó la extensión, qué guarda en tu dispositivo y cuánto, qué acceso extra a sitios le concedió Chrome, y borrado con un clic.
- 🩺 **Informe de fallos** — cuando una función deja de funcionar tras un cambio del sitio, la ventana ofrece un informe con un clic, sin direcciones web ni datos personales («Informar en GitHub» solo abre una página con el texto rellenado).
- 🖥️ **Comprobación del sistema** en las páginas de juegos — compara el requisito de RAM del juego con lo que informa tu navegador (los navegadores no ven tu CPU ni tu GPU). Describe tu equipo en los ajustes avanzados y los requisitos de RAM y de espacio libre en disco se comparan con él; el sistema operativo, el procesador y la tarjeta gráfica se muestran junto al requisito pero no se juzgan — es una estimación.

#### Ofertas y precios (v4)
- 💸 **«¿Es real el descuento?»** — compara el precio base con el mínimo de 30 días de GOG y con tu historial; ⏳ **cuenta atrás de la oferta** en la página del juego, en las tarjetas y en el resumen.
- **Precio por hora de juego**, **precio en varias divisas** a la vez, un **ritmo de rebajas** por juego, un **gráfico comparativo** de 2–3 juegos, totales de **«cuánto he ahorrado»** y **ajustes de IVA** nacionales (DE, FR, ES, IT, NL, RU).

#### Lista de deseos y catálogo (v4)
- 💖 **Lista de deseos inteligente** — orden por descuento / distancia al mínimo / precio convertido / fecha de adición, filtros «cerca del mínimo» y «termina pronto», un total en vivo, agrupación por etiqueta o estado, exportación a CSV / Markdown / `.ics`.
- 🗂️ **Herramientas de catálogo** — una barra sobre la cuadrícula: atenuar u ocultar los juegos que ya tienes, **no me interesa** (reversible), orden local de la página, densidad compacta / lista, filtros guardados, etiquetado y seguimiento en bloque, comparación lado a lado.
- ♾️ **Desplazamiento infinito** (opcional, desactivado por defecto) — al llegar al final de una página del catálogo, se añade la siguiente debajo, desde la API de catálogo de GOG (`catalog.gog.com`, la misma llamada que hace el sitio).

#### Página del juego y biblioteca (v4)
- 🎮 **Comprobación de idiomas**, **qué cambió desde tu última visita**, filtro de reseñas, **juegos similares que ya tienes**, **qué contiene realmente un pack** (leído de la página del propio pack, o de la API de productos de GOG una vez por página de juego — solo se envía un id numérico) con un aviso si se solapa con lo que posees, enlaces «abrir en» a Steam / IsThereAnyDeal / PCGamingWiki / HowLongToBeat / SteamDB y los atajos `W` / `N` / `A`.
- 📚 **Aprende tu biblioteca mientras navegas** (a partir de la etiqueta «IN LIBRARY» del propio sitio), lo que permite ocultar lo que ya tienes, estadísticas reales de la biblioteca, una ruleta ponderada de pendientes, un objetivo mensual de «juegos por terminar» y **tarjetas Wrapped / de coleccionista** que puedes guardar como PNG.
- 📝 **Historial de versiones de las notas**, una exportación a **bóveda de Obsidian** (`.zip`) y exportaciones CSV / por líneas para **Notion, Google Sheets y Trello**.
- 🏆 **36 logros** en tres niveles (algunos ocultos), una **racha** de días de navegación y tres **desafíos mensuales** — todo en local.
- ♿ **Un panel utilizable con el teclado** — un enlace para saltar al contenido, etiquetas reordenadas con `Alt`+`↑`/`↓`, menús y diálogos que retienen el foco y anuncios hablados de los cambios para lectores de pantalla.

#### Sincronización, notificaciones y aspecto (v4)
- 🔄 **Sincronización automática de carpeta** (cada 30 minutos y al abrir el panel, cuando el navegador aún recuerda el permiso de la carpeta y el archivo no está cifrado con contraseña), una lista de conflictos y copias de seguridad con fecha en la carpeta (como máximo una al día, al abrir el panel).
- 🔔 **Horas de silencio y días de la semana en silencio**, un modo de **un resumen al día**, umbrales, **alertas por etiqueta**, un **radar de temporadas** opcional, un resumen semanal más completo que puedes guardar como página web, una tarjeta de la lista de deseos que puedes guardar como PNG — y un **webhook opcional a una dirección tuya** (véase la tabla de permisos).
- 🎨 **Plegar / acoplar / reordenar** el panel del juego, **modo tranquilo**, un **aspecto simple** con un clic, paletas para daltonismo, escala del texto, perfiles de ajustes y un breve **recorrido** tras la actualización.

### Módulo de mejora visual
Se activa con el interruptor «Design injection» de la ventana. Cuando está activado:
- Los precios usan en todas partes una fuente monoespaciada (`ui-monospace` / Cascadia / JetBrains) con cifras tabulares.
- Tarjetas según la época: líneas de escaneo para los clásicos, resplandor neón para los títulos de la era cyberpunk.
- Profundidad y sombras sutiles, un fondo con degradado, microinteracciones al pasar el cursor.
- La píldora «Good Old Game» recibe un degradado dorado metálico en lugar de un morado plano.
- Cargadores esqueleto con animación de brillo en lugar de marcadores `{{ product.title }}` a la vista.
- Diseño limpio: oculta las promociones caducadas de años anteriores.
- Once temas (Neon, Classic GOG, CRT Green, Sunset, Light, AMOLED, Amber, High contrast, Custom, Auto, Native) — Auto sigue la preferencia claro/oscuro del sistema; Native sigue el aspecto de gog.com.

### Privacidad sin rodeos
- **Solo cinco dominios** (más la única dirección de webhook que puedes escribir tú, solo si lo activas) reciben peticiones de red — y cada petición aparece en los ajustes avanzados (Privacidad y transparencia):
  1. `www.gog.com` — para leer el contenido de las páginas e insertar la interfaz, y la lista pública de mods una vez al día.
  2. `api.frankfurter.dev` — para los tipos de cambio (sin clave de API, sin seguimiento).
  3. `www.cheapshark.com` — la tabla opcional de comparación de precios en las páginas de juegos (gratuita, sin clave; se desactiva en la ventana).
  4. `api.gog.com` — la API de productos de GOG, consultada una vez por página de juego para saber qué juegos contiene un pack (solo se envía su id numérico; activada por defecto, se desactiva en *Catálogo, lista de deseos y biblioteca*).
  5. `catalog.gog.com` — la API de catálogo de GOG, usada solo si activas el desplazamiento infinito (desactivado por defecto).

  Las dos últimas no figuran en la tabla de permisos porque se llaman desde la página con las propias reglas cross-origin de GOG — las mismas llamadas que hace el sitio —, así que Chrome no muestra ninguna advertencia adicional al instalar.
- **La sincronización de carpeta no hace ninguna petición de red por sí misma** — lee y escribe un archivo en la carpeta que elijas; de subirlo se encarga tu propio cliente de nube.
- **El webhook es opcional y es tuyo** — no se pide nada al instalar. Si escribes tu propia dirección `https://` en los ajustes avanzados, el navegador te pregunta una vez si permites ese único origen; solo se le envía el texto de la notificación, y la dirección nunca sale de tu dispositivo por exportaciones ni sincronización.
- **Cero analítica, cero gtag, cero Google Fonts.**
- **Etiquetas, notas e historial viven en tu dispositivo** mediante `chrome.storage.local`. Nada sale de él.
- **Código abierto** — cada línea de código está en este repositorio.

---

## 🚀 Instalación

1. Descarga `gog-enhancer-webstore.zip` de la página de [Releases](https://github.com/DrummingBird1/GOGEnhancer/releases) y descomprímelo donde quieras (o, si clonaste el repositorio, usa directamente la carpeta `extension/`).
2. Abre Chrome y ve a `chrome://extensions/`.
3. Activa el **Modo de desarrollador** (esquina superior derecha).
4. Haz clic en **Cargar descomprimida** y elige la carpeta descomprimida (o `extension/`).
5. El asistente de primera vez se abre solo en una pestaña nueva. Sigue los pasos.
6. Entra en [gog.com](https://www.gog.com) — la extensión está activa.

---

## 🌐 Compatibilidad con navegadores

| Navegador | Estado |
|---|---|
| **Chrome** | ✅ Totalmente compatible — es el objetivo principal. |
| **Edge, Brave, Opera** (basados en Chromium) | ✅ Funciona igual que Chrome — mismo motor, mismos pasos de «Cargar descomprimida». |
| **Firefox** | ⚠️ Experimental / sin verificar. `node scripts/build-firefox.mjs` genera una variante para Firefox (una página en segundo plano en lugar del service worker, un id de complemento, una declaración de «no recoge nada») limpia bajo `web-ext lint`, y el zip se adjunta a cada versión de GitHub — pero **nunca se ha ejecutado en un Firefox real**, y la sincronización de carpeta necesita una API que Firefox no tiene. La vía de instalación compatible es la ficha de Chrome Web Store; los usuarios de Edge pueden instalar de ahí la misma extensión o usar «Cargar descomprimida» (Edge Add-ons aún no tiene ficha). |

---

## ⌨️ Atajos de teclado

| Atajo | Acción |
|---|---|
| `Alt+G` | Abrir la ventana |
| `Alt+Shift+G` | Activar/desactivar GOG Enhancer |
| `Alt+Shift+H` | Activar/desactivar las traducciones al hebreo |
| `Ctrl/Cmd+K` (en gog.com) | Abrir la paleta de comandos |
| `J` / `K` / `T` (en listados de juegos, opcional) | Juego anterior/siguiente, etiquetar el juego seleccionado |
| `W` / `N` / `A` (en la página de un juego, opcional) | `W` pulsa el botón de lista de deseos del sitio (alterna), `N` salta al cuadro de notas, `A` al de alerta de precio; `?` lista las teclas |
| `gog` + `Tab` (barra de direcciones) | Buscar en tu propia biblioteca |

Los atajos se pueden cambiar en `chrome://extensions/shortcuts`.

---

## ⚙️ Permisos explicados

| Permiso | Para qué |
|---|---|
| `storage` | Guardar preferencias, etiquetas e historial |
| `alarms` | Programar las actualizaciones en segundo plano de tipos de cambio, mods y lista de deseos |
| `notifications` | Solo si lo activas — avisos de escritorio de plazos de reembolso y ofertas de la lista de deseos |
| Host: `www.gog.com` | Insertar la interfaz en las páginas de GOG |
| Host: `api.frankfurter.dev` | Obtener los tipos de cambio |
| Sin permiso: `www.cheapshark.com` | Comparación opcional de precios entre tiendas en las páginas de juegos — CheapShark permite lecturas cross-origin, así que no se declara permiso de host |
| Host opcional: cualquier origen `https://` | **Nunca se concede en la instalación.** Se solicita en tiempo de ejecución, para un solo origen, si escribes tu propia dirección de webhook en los ajustes avanzados; solo se le envía el texto de la notificación |

No hace falta ningún permiso para la sincronización de carpeta (concedes una carpeta cada vez, con un clic) ni para la palabra clave de la barra de direcciones.

---

## 🛠️ Limitaciones conocidas

- **La adaptación al rediseño se comprobó en el sitio real, pero gog.com sigue cambiando** — la página de inicio, el catálogo y la página de juego se inspeccionaron y probaron de extremo a extremo (sin iniciar sesión) el 2026-10-02; las páginas de cuenta (lista de deseos, biblioteca, carrito) requieren iniciar sesión y solo se inspeccionaron estructuralmente. El sitio mezcla ahora dos generaciones de marcado, así que espera más cambios. Si algo deja de funcionar tras una actualización de gog.com, usa *Ajustes avanzados → Comprobar esta página*.
- **La sincronización de carpeta resuelve los conflictos por el reloj de cada dispositivo** — gana la última edición de cada registro (los registros sobrescritos se listan en la página de ajustes), así que relojes muy desajustados pueden elegir al ganador equivocado. Necesita la File System Access API (Chrome, Edge, Brave; no Firefox), y el acceso a la carpeta debe volver a concederse de vez en cuando desde la página de ajustes. La tarea en segundo plano no puede pedir permiso ni contraseña, así que si falta alguno omite la sincronización en silencio hasta que abras el panel. Se ha probado con una carpeta local, no con un cliente real de sincronización en la nube.
- **No todo lo de la v4 pudo verificarse en el sitio real** — las funciones que dependen de haber iniciado sesión (filas de la lista de deseos, propiedad de la biblioteca, qué juegos solapa un pack) se construyeron a partir de la *estructura* grabada de las páginas y de pruebas unitarias y de extremo a extremo, no con una cuenta real. El webhook no se ha probado contra un punto final real, y Firefox no está probado.
- **El desplazamiento infinito necesita que la API de catálogo de GOG siga como está** — solo continúa una lista que pueda emparejar con la de la pantalla, usando la consulta que el propio sitio pasó a la página. Si GOG restringe esa API, la función simplemente deja de añadir juegos; nada más se ve afectado. Las entradas del calendario de lanzamientos solo existen para los juegos cuya página has abierto (la propia lista de deseos solo muestra un año).
- **Las traducciones no están revisadas** — los ocho idiomas de interfaz distintos del inglés se escribieron sin revisión de hablantes nativos; un proyecto que empezó por el hebreo, así que el hebreo ha recibido más atención. Los textos que aparecen solo tras una acción (algunos diálogos y mensajes de error) están cubiertos, pero todo lo nuevo sin traducción simplemente se queda en inglés.
- **No construido:** un detector de carrito y regalos, un panel lateral y menús contextuales (cada uno necesitaría un permiso nuevo).
- **Obtención de la lista de mods** — depende de que `gog.com/en/mods` conserve una estructura parecida. Si falla, fuerza la actualización en los ajustes avanzados.
- **Contador de la insignia de la lista de deseos** — se basa en un recuento en vivo del DOM al visitar `/account/wishlist` (validez de 24 h). Si no has entrado hace poco, la insignia queda vacía hasta tu próxima visita — la descripción del icono sugerirá entrar.
- **El temporizador de reembolso depende de una fecha escrita a mano** — GOG no expone la fecha de compra en ningún DOM público, así que la cuenta atrás de 30 días depende de una fecha que escribes en el panel. Sin fecha, sin cuenta atrás.
- **La detección de géneros es parcialmente automática (desde la v2.6.0)** — Horror/Role-playing/Strategy se leen del campo real «Genre:» de la página del juego y se guardan en caché por slug (`gameGenres`) en la primera visita. Sci-fi e Indie siguen basándose en la coincidencia de títulos conocidos mediante expresiones regulares — en GOG parecen estar en la nube más amplia de «Tags» y no en «Genre:», y esa estructura no está del todo verificada. Hasta que se visita un juego concreto, los cinco grupos de géneros recurren a la expresión regular.
- **La conversión entre divisas siempre pasa por USD** — si falta en `rates` el tipo de alguno de los dos pares, no se convierte. Todos los tipos se descargan automáticamente cada 12 horas de frankfurter.dev.
- **Las alertas de precio de toda la lista de deseos, las ofertas de la lista y el valor de la lista solo cubren los juegos que has visitado** — los tres dependen de `priceHistory`, que solo se construye visitando la página de un juego. Un juego de la lista que nunca visitaste no tiene datos con los que comparar, así que no aparecerá en las alertas, en las «Ofertas de la lista de deseos» de la ventana ni en la estadística «Valor de la lista de deseos», aunque su precio haya bajado.

---

## 📜 Registro de cambios

El historial completo de versiones está en la [página de Releases de GitHub](https://github.com/DrummingBird1/GOGEnhancer/releases) — cada versión tiene su propia página, con su propio banner — y en la [página del registro de cambios](https://drummingbird1.github.io/GOGEnhancer/changelog.html) del sitio de la extensión.

---

## 🧑‍💻 Pensada primero para el mercado israelí

Originalmente hecha a medida para usuarios israelíes (ILS, IVA del 18 %, hebreo) — pero funciona igual de bien con cualquiera de las 24 divisas admitidas. Todos los campos son editables.

---

## ☕ Apoyo

GOG Enhancer es gratuito, de código abierto, sin anuncios y no recoge datos. Si te ahorra dinero o tiempo y quieres apoyar su desarrollo, puedes hacerte mecenas en cualquiera de estas plataformas:

- **[Ko-fi](https://ko-fi.com/idanlights)**
- **[Buy Me a Coffee](https://buymeacoffee.com/solvaris)**
- **[Patreon](https://www.patreon.com/c/Solvaris)**

Totalmente opcional — todas las funciones siguen siendo gratuitas para todos pase lo que pase.
