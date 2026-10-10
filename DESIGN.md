# Camisas IUB — Registro de ventas (Prototipo v3)

Portal → Tema visual · Dirección general del gris ("cool neutrals" industrial, nada de "AI beige") con
acento turquesa frío como único color de marca. Interfaz de datos densa pero ordenada: tablas en
escritorio, tarjetas en celular, cada pantalla con UNA acción principal.

## Instructions for the Coding Agent

- The single source of truth for values is `styles.css`. Do NOT invent hex values, radii, fonts, spacing
  or motion tokens that are not already declared. If you need a new shade, derive it from the tokens below
  and document the change in this file.
- `index.html` is the only runnable entry. Keep one entry; do not duplicate markup into separate files.
- Never change behavior. This file describes how to make the UI look and feel consistent; the business rules
  (estados por camisa, cuentas por contacto, abonos a Yesenia, liquidaciones mitad-mitad, papelera) live in
  `app.js` and are outside the design scope.
- Preserve the token names. Accessibility notes are embedded in the tokens: every color already meets
  WCAG 4.5:1 in its own theme, with the exact ratio written next to it.

## Visual Theme & Atmosphere

"Cuaderno de ventas" moderno: fondo frío y neutro, tarjetas blancas/gris pizarra, ONE saturated accent
(turquesa). No hay gradientes, ni beige, ni tipografía serif ni sombras dramáticas. La jerarquía viene del
tipo (tamaño + peso), del color del acento y del espacio — no de borde tras borde de tarjetas anidadas.

## Color Palette & Roles

### Light `:root, [data-theme="light"]`

| Token           | Value     | Role                                                        |
| --------------- | --------- | ----------------------------------------------------------- |
| `--bg`          | `#EEF1F5` | canvas frío (nunca beige)                                   |
| `--surface`     | `#FFFFFF` | tarjetas, inputs                                            |
| `--surface-2`   | `#F5F8FA` | filas hover, pistas, chips                                  |
| `--border`      | `#DCE3EA` | líneas suaves                                               |
| `--border-fuerte` | `#C4CFDA` | bordes de inputs y botones fantasma                       |
| `--ink`         | `#101A24` | texto principal                                             |
| `--ink-2`       | `#45566A` | texto secundario (≥4.5:1)                                   |
| `--ink-3`       | `#5D6B7C` | texto terciario (4.80:1)                                    |
| `--accent`      | `#0E7C86` | turquesa de marca — botón primario, nav activo              |
| `--accent-2`    | `#0B6B74` | hover/focus                                                 |
| `--accent-soft` | `#E1F0F1` | fondos tiza del acento                                      |
| `--positivo`    | `#166F41` | pagado (5.40:1 sobre `--positivo-soft`)                     |
| `--alerta`      | `#9A4A05` | demo-pill, notas de regla                                   |
| `--peligro`     | `#B4232A` | borrar, saldos en rojo                                      |
| `--focus`       | `#0E7C86` | anillo `:focus-visible`                                     |

Estado por camisa (badge): `--st-pedido #475569`, `--st-comprado #4338CA`, `--st-bordando #B45309`,
`--st-listo #0B6B74`, `--st-entregado #1B7F4B`, `--st-liquidado #334155`. Tinta del badge siempre `#FFFFFF`.

### Dark `[data-theme="dark"]` — casi negro neutro Bencho

| Token           | Value                     | Note                                        |
| --------------- | ------------------------- | ------------------------------------------- |
| `--bg`          | `#000000`                 | casi negro puro                            |
| `--surface`     | `#0F0F0F`                 |                                             |
| `--surface-2`   | `#181818`                 |                                             |
| `--surface-3`   | `#202020`                 |                                             |
| `--border`      | `rgba(255,255,255,.10)`   | líneas suaves                               |
| `--border-fuerte` | `rgba(255,255,255,.18)` | bordes de inputs y botones fantasma        |
| `--ink`         | `#FFFFFF`                 |                                             |
| `--ink-2`       | `#B4B4B4`                 |                                             |
| `--ink-3`       | `#9A9A9A`                 |                                             |
| `--accent`      | `#46CBD6`                 | turquesa claro (invertido, no más brillante)|
| `--accent-2`    | `#7FE3EA`                 | hover/focus                                 |
| `--accent-soft` | `rgba(70,203,214,.16)`    | fondos tiza del acento                      |
| `--accent-ink`  | `#06232A`                 | texto sobre acento: oscuro, no blanco       |
| `--positivo`    | `#5FD08A`                 | `--positivo-soft #123227`                   |
| `--alerta`      | `#FFB366`                 | `--alerta-soft #3A2A16`                     |
| `--peligro`     | `#FF7A80`                 | `--peligro-soft #3A1A1E`                    |
| `--focus`       | `#7FE3EA`                 | anillo `:focus-visible`                     |

Estado por camisa (oscuro): `--st-pedido #46566B` (ink `#EAF1F8`), `--st-comprado #6D74E8`
(ink `#0B1020`), `--st-bordando #E0952F` (ink `#20140A`), `--st-listo #35B8C4` (ink `#06232A`),
`--st-entregado #45C07C` (ink `#062418`), `--st-liquidado #64748B` (ink `#FFFFFF`, 4.76:1). Tinta clara
salvo en los tonos saturados donde el texto pasa a oscuro.

## Typography Rules

- Display/cabeceras: **Archivo** (`--fuente-display`, local `fonts/archivo-latin.woff2`), 400–700, `letter-spacing:-.01em`.
  Usar Solo para títulos y fechas en tarjetas de entrega.
- Cuerpo/UI: **Inter** (`--fuente-texto`), base 16px, line-height 1.55.
- Números/montos: **JetBrains Mono** (`--fuente-mono`) — TODO monto, contador, barra de gráfico, dígitos de fecha.
- Nunca tipografía serif ni script en ninguna parte (anti-slop: no "AI serif").
- Jerarquía por tamaño/peso: `h1` 28px/700, título de panel 16px/700, etiqueta de campo 13px/600, badges 12px/700.
- Copia corta y concreta. Sin encabezados vagos; cada título dice exactamente qué contiene.

## Component Stylings

### Botones
- **UNA acción primaria por pantalla**, solo una. En Registro es "Registrar pedido"; en Proveedor "Nueva visita";
  en Liquidaciones "Registrar pago"; en Reportes "Descargar Excel de compra". Las demás acciones son
  `.btn-fantasma` (superficie + borde) o `.btn-texto` (enlace dentro de paneles).
- `.btn` 44px mín, radio 10px, peso 600. En dark el primario usa `--accent` claro con tinta `#06232A`.
- Presionar "hunde" el botón: `transform: translateY(1px) scale(.985)`.
- Destructivo (`.btn-peligro`): solo para borrar; el nav badge de la papelera también va en `--peligro`.
- `.btn-mini` 36px para acciones dentro de filas de tabla (Abonar, Factura, Borrar).

### Campos
- Altura mín 44px, radio 10, fondo `--surface`, borde `--border-fuerte`.
- Focus: borde `--accent` + anillo `0 0 0 3px var(--accent-soft)`, sin `outline` nativo.
- Números con `font-family: var(--fuente-mono)`.
- El select se reconoce por la flecha de fondo (no por un borde decorativo), texto a 13px.
- Etiquetas 13px/600 `--ink-2`; el opcional se marca con `<small>` en `--ink-3`, el requerido con `.req` en `--peligro`.

### Paneles y tarjetas
- Superficie: `--surface`, borde `--border`, radio 14, `--sombra` sutil. Un solo nivel: NO tarjetas dentro
  de tarjetas (anti-slop "cards in cards").
- Un título por panel; a la derecha una nota (`.panel-nota` 12.5px `--ink-3`) y opcionalmente una acción.

### KPIs
- Grid 2 col en móvil, 4 en escritorio. `--surface` + borde; el destacado (primer KPI) invierte a `--accent`
  con tinta `--accent-ink`. El valor SIEMPRE en mono. Entrada en acordeón (320ms, delay 30ms por tarjeta).

### Badges y chips
- Estado del pedido: `.estado-badge` píldora 12px/700 con punto; color según estado (degradación natural
  azul→ambar→turquesa→verde→gris). Un badge por pedido puede convivir con los chips de camisa, pero no se
  crean "chip soups": cada píldora comunica un dato que se usa.
- Chips de camisa: color + talla + cantidad, para no romper el flujo de lectura.

### Tablas (≥1024px)
- Cabecera 12px/700 uppercase `--ink-3`, fondo `--surface-2`. Fila clickeable (abre detalle), hover `--surface-2`.
- Montos y cantidades en columna derecha (`text-align:right`, mono). Nunca mezclar números alineados con texto.

### Tarjetas (móvil)
- `.pedido-card` / `.cuenta-card`: texto a la izquierda, badge/monto a la derecha, divisor superior punteado
  para el pie. Una sola columna.

### Hojas (sheets) y diálogos
- Modal: `.capa` fija con fondo `rgba(6,12,20,.5)`, fade 170ms. En móvil la hoja sube 300ms y se apoya abajo
  (radio 20px arriba); en escritorio se centra con radio 14. Una acción primaria + cancelar en `.hoja-acciones`.

### Toasts
- Entrada: suben 240ms. Salida: fade + deslizamiento 180ms (`.saliendo`). Acción deshacer en `.toast-accion`
  (turquesa claro `#6FD9E2` en claro, `--accent-2` en dark). Duración 6.5s. `aria-live="polite"`.

### Navegación
- Móvil: dock flotante de cristal `.gnav` (pill `border-radius:999px`, elevado 14px sobre el borde inferior,
  `backdrop-filter: blur(18px) saturate(1.5)`, `fit-content` centrado). 3 destinos (Inicio, Pedidos,
  Registrar) + "Más". Un indicador `.nav-ind` se desliza bajo el destino activo (420ms spring, ancho
  variable 66px). El activo se pinta `--accent-2`.
- El destino "Registrar" es la ÚNICA acción primaria del nav: icono "+" en burbuja de acento (34px, 50%).
- Escritorio (≥1024px): el dock se convierte en barra lateral sticky (columna, `topbar-alto`); el "Más"
  desaparece y todas las vistas se listan una vez en `.nav-secundario` con etiquetas `.nav-grupo`
  (Principal / Socios / Datos / Sistema). Ítems en fila, hover `--surface`, activo `--accent-2`.
- Badges de conteo en `--accent`; el de papelera va en `--peligro`.

### Sesión y conexión
- Login obligatorio (v3): sin sesión, la app muestra el diálogo `.dialogo-login` (hoja centrada, máx 400px)
  y no expone el resto. Chip `.usuario` en la topbar abre el login; punto `--positivo` en sesión vs `--ink-3`
  invitado.
- Input de etiqueta flotante `.lbi` estilo Bencho: campo de 44px con anillo SVG `.lbi-ring` (trazo, no
  borde) que cambia a `--accent` al enfocar, banda `.lbi-band` que "abre" el anillo bajo la etiqueta y
  `lbi-hop` por letra al subir (focus). Botón ojo `.lbi-eye` alterna mostrar/ocultar contraseña.
- Banner `.banner-conexion` bajo la topbar: offline = `--peligro-soft`/`--peligro`, online (`.ok` reconecta)
  = `--accent-soft`/`--accent-2`. Oculta con `[hidden]`.

### Gráfico 7 días
- Barras `--accent` (hoy `--accent-2`), crecen 520ms desde la base con delay 34ms por columna, valor en mono
  pegado sobre la barra (nunca flotando en la fila de arriba). Altura fija 200px.

## Layout Principles

- Ritmo de 4px (tokens `--s1..s8`). Márgenes/paddings SIEMPRE con tokens, nunca valores sueltos.
- Radios: tarjetas/inputs 10 (`--radio-sm`), superficies grandes 14 (`--radio`), todo lo pequeño es píldora 999.
- Contenido máx 1180px. Topbar fija 60px, nav 64px (+ safe-area inferior en celular).
- Formulario de registro: rejilla de secciones (Cliente / Camisas / Entrega / Venta) y una barra de totales
  sticky sobre el nav. La sección Camisas es "de canto a canto" en escritorio (7 columnas).

## Depth & Elevation

- `--sombra`: claro `0 1px 2px rgba(16,26,36,.06) + 0 8px 24px rgba(16,26,36,.06)`; dark
  `0 1px 0 rgba(255,255,255,.04) + 0 12px 32px rgba(0,0,0,.6)`. Una sola sombra, discreta.
- `--sombra-hoja`: `0 24px 64px` (móvil, sheets) / `0 28px 72px` (dark).
- Topbar: `color-mix(var(--bg) 86%) + backdrop-filter: saturate(1.4) blur(10px)`. Elevación por
  "vidrio" frontal, no por sombra.

## Do's and Don'ts (anti-cliché checklist)

- DO usar el turquesa ÚNICAMENTE para acciones y el KPI destacado.
- DO un encabezado concreto por sección ("Lista de compra — Para llevar a la bodega").
- DO anclar los totales y montos a su etiqueta con mono.
- DON'T usar beige, degradados, glass coquetos, serif de display ni púrpura en ninguna parte.
- DON'T poner dos botones primarios en la misma pantalla.
- DON'T crear tarjetas dentro de tarjetas dentro de tarjetas.
- DON'T animar por decorar: el movimiento comunica (entrada, prensado, salida de toast) y respeta
  `prefers-reduced-motion` (todo se corta a .01ms).

## Responsive Behavior

| Breakpoint | Cambio                                                          |
| ---------- | --------------------------------------------------------------- |
| <640px     | 1-2 columnas, tablas ocultas → tarjetas, nav inferior           |
| ≥640px     | KPIs a 4 col, filtros en fila, demo-pill visible                |
| ≥1024px    | Sidebar 236px, tabla visible, rejilla registro 2 col            |

## Agent Prompt Guide

Cuando un agente de código trabaje sobre este prototipo, dale este archivo + `styles.css` y dile:

1. "NO cambies los tokens de `styles.css`; úsalos. Si necesitas algo, derivado de un token existente."
2. "Mantén UNA acción primaria por pantalla y respeta los estados hover/focus/active."
3. "Cualquier nuevo componente debe usar `--s1..--s8`, un radio de los tres tokens y una duración de los tres
   tokens de motion (`--dur-rapida 170ms`, `--dur 220ms`, `--dur-entrada 300ms`)."
4. "Valida contraste 4.5:1 en los dos temas antes de cerrar."
5. "Mismo idioma, tono y longitud: copia corta, en español, sin emojis."