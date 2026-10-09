# Camisas IUB — Registro de ventas (Prototipo v3)

Aplicación web responsive para el registro de ventas de camisas de Samir y Valentina
(Camisas IUB): captura de pedidos por prenda, estados por camisa, cuentas por cliente
con abonos, abonos del proveedor (Yesenia, bordado), liquidaciones 50/50, historial,
resúmenes, reportes y gestión de usuarios. Conecta a la base real Supabase.

## URL en vivo

Hosteado en GitHub Pages (público, sin necesidad de servidor local):

**https://samirpxrreo.github.io/camisas-iub/**

El login es obligatorio (usa una cuenta real del proyecto Supabase). Cada push a `main`
redespliega automáticamente.

## Cómo ejecutar el prototipo

Requisitos: Node.js ≥ 14 (opcional, solo para el servidor local).

- **Opción A (recomendada):** `node server.js` y abre `http://localhost:8080/`.
  El servidor sirve el proyecto sin dependencias y expone `0.0.0.0:8080` para probar
  desde el celular en la misma red.
- **Opción B:** abre `index.html` directamente en el navegador (las fuentes son locales,
  en `fonts/`; el login y Supabase requieren conexión a internet).
- **Opción C:** `python -m http.server 8080` y abre `http://localhost:8080/`.

> **Login obligatorio.** Sin sesión iniciada la app muestra la pantalla de inicio de
> sesión y no deja usar el resto. Usa una cuenta existente del proyecto Supabase.

## Conexión a la base (Supabase)

Proyecto: `https://ifdbpaduvpadotpmojas.supabase.co`
Clave anónima (publishable, segura de exponer en el cliente):
`sb_publishable_GnC8zI1oNOWrRTxO8iVqEA_E-yf68uq`
SDK: `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2` (cargado con `defer`;
`app.js` tolera su ausencia y degrada a modo local).

- RLS activo en todas las tablas: leer y escribir requiere una sesión de auth válida.
- **Escrituras reales solo con sesión iniciada.** Sin sesión o sin red, la app opera en
  modo local y jamás escribe en la base.
- Auth por correo + contraseña (`signInWithPassword` / `signOut` / `getSession`).
- Realtime: canal `avisos-camisas-iub` — avisa y refresca cuando otra persona guarda.

### Esquema

| Tabla | Columnas clave |
|---|---|
| `ventas` | `id`, `cliente_nombre/telefono/programa`, `modelo`, `genero`, `color`, `talla`, `cantidad`, `precio_unitario`, `costo_unitario`, `abono`, `estado`, `vendedor`, `entrega_por`, `fecha`, `fecha_entrega`, `lugar_entrega`, `nota`, `items_camisa` (JSON), `comprado_at`, `updated_at`, `eliminado_at`, `finalizado`, `compra_id`, `abono_yesenia` |
| `usuarios` | `id`, `nombre`, `correo`, `rol` |
| `liquidaciones` | `id`, `venta_id`, `fecha`, `pagador`, `receptor`, `monto`, `nota`, `hora` |
| `compras_proveedor` | `id`, `fecha`, `comprador`, `proveedor` ('Yesenia'), `observaciones`, `total`, `hora` |
| `compra_pedidos` | `compra_id`, `venta_id`, `monto` |
| `compra_aportes` | `compra_id`, `persona`, `monto`, `fecha`, `observacion` |

RPC: `guardar_abono_yesenia(p_compra, p_desvincular, p_pedidos, p_aporte)`
(transaccional; si no existe, se usan varias escrituras como fallback).

### Roles

- `admin` — ve todo y gestiona usuarios.
- `vendedor` — solo registra y ve sus propios pedidos (selector de vendedor fijo).
- Rol resuelto desde la tabla `usuarios` por correo; con fallback local
  `USER_ROLES_DEFAULT` (`admin@gmail.com`, `samir@gmail.com`, `val@gmail.com`).

## Estructura del proyecto

```
index.html       Entrada canónica (SDK Supabase + login `.lbi` + banner + nav 4 grupos + 10 vistas)
styles.css       Tokens de diseño (paleta casi negra estilo Bencho + turquesa), componentes, `@layer` primitivas
app.js           Lógica ES5 (IIFE): capa Supabase, auth, sincronización diffs, realtime, offline, renders
server.js        Servidor estático local sin dependencias (puerto 8080)
fonts/           Tipos locales: Archivo, Inter, JetBrains Mono (woff2)
DESIGN.md        Sistema de diseño documentado (paleta, tipos, componentes, checklist antislop)
impeccable-skill.propuesta.md   Propuesta de skill Impeccable lista para pegar en Open Design → Integration → Skills
```

La sincronización usa **ids locales canónicos** (`IUB-1001`, …) y guarda el id real de la
base en `_remotoId` como indirección: los `venta_id`/`compra_id` se resuelven con esa
indirección, así los diffs no rompen referencias.

## Reglas de negocio

- Ciclo de estados: `Pedido → Comprado → Bordando → Listo para entrega → Entregado → Liquidado`.
- El estado del pedido es el **más atrasado** de sus camisas (`items_camisa`).
- Cuentas por **contacto (teléfono)** del cliente.
- Costo sugerido: Versión 1 $30.000 (S–XL), 2XL +$2.000, 3XL +$4.000, 4XL +$6.000; Versión 2 +$1.000.
- Socios: Samir y Valentina. Proveedora: Yesenia (bordado); reparto proporcional al costo,
  el último pedido absorbe el redondeo.
- Liquidaciones: mitad de la ganancia (una pérdida no genera deuda).
- Papelera reversible vía `eliminado_at` hasta "Vaciar papelera".
- 8 lugares de entrega (Soledad, Plaza de la Paz, Granadillos, Centro Histórico, Domicilio,
  casa de Val / Samir, Otro).

## Exportaciones

Reportes e importación de pedidos exportan **.xlsx reales sin librerías**
(`descargarExcel` genera un ZIP/XML mínimo): exportarCompra, exportarCompleto y
"Listado de pedidos" (`#exp-pedidos`).

## Desarrollo / continuar

- Cambia `index.html`, `styles.css` o `app.js` y recarga el navegador (el server usa
  `Cache-Control: no-store`).
- Valida la JS: `node --check app.js`.
- Respeta la identidad de diseño documentada en `DESIGN.md` (paleta casi negra, acento
  turquesa, Archivo/Inter/JetBrains Mono, ritmo de 4px, contraste ≥ 4.5:1, login `.lbi`
  con etiqueta flotante y dock móvil `.gnav` con indicador).