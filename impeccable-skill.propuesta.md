# Propuesta — Instalar "Impeccable" como skill del proyecto

Propuesta para la pestaña **Integration → Skills** de Open Design. NO se instala en `.od-skills/`
(carpeta de solo lectura): se pega donde corresponda o se copia a la configuración de OpenCode.
Este documento describe qué es, qué cambia y qué definir como skill, con una sugerencia lista para pegar.

---

## 1. Qué es Impeccable

- Fuente: https://impeccable.style/ (por pbakaus). Repositorio: `pbakaus/impeccable` (acompaña al catálogo
  https://github.com/voltagent/awesome-design-md).
- **"The missing design vocabulary for agents"**: les da a los agentes el vocabulario de diseño que les falta.
- Incluye:
  - **Anti-slop checks**: una lista concreta de vicios que producen las interfaces generadas por IA
    (fondos beige/crema, serif de display en cursiva, "chip soup", tarjetas dentro de tarjetas,
    "todo igual" sin jerarquía, titulares vagos, demasiados campos, CTA genéricos, gradientes morados,
    movimiento decorativo sin propósito). Cada chequeo viene con un "antes/después".
  - **`/document`**: extrae el sistema de diseño de un producto ya hecho y lo guarda como `DESIGN.md`
    + `PRODUCT.md`, para que la próxima vez el agente produzca UI consistente.
  - **Workflow** para mantener esos documentos al día con lo que realmente se envía.

## 2. Qué cambiaría en este proyecto

Con Impeccable activo, el prototipo de Camisas IUB ganaría:

1. **Aplicación automática del vocabulario anti-slop** en futuras ediciones (nadie vuelve a poner dos primarios
   en la misma pantalla, ni beige, ni tarjetas anidadas).
2. **`/document` de este prototipo**: ya existe `DESIGN.md` en la raíz con los tokens reales de `styles.css`;
   Impeccable lo usaría como fuente para nuevas vistas (Excel, factura, móvil nativo, etc.).
3. **Un único lenguaje de revisión** entre agentes y quien edita: los mismos 59+ chequeos, sin re-discutir cada
   decisión.

**Qué NO cambia**: la identidad visual (acento turquesa, Archivo/Inter/JetBrains Mono, ritmo de 4px,
tema claro/oscuro) ni el comportamiento de la app. Impeccable es un filtro de calidad, no un tema.

## 3. Opciones de instalación

| Vía | Pasos |
| --- | ----- |
| **Skills tab (Open Design - recomendada)** | Crear un skill nuevo llamado `impeccable` en Integration → Skills y pegar la definición de la sección 4. Los checks se aplicarán cuando el agente abra este proyecto. |
| **OpenCode a nivel de usuario** | Copiar el paquete/skill de Impeccable a la configuración de OpenCode (ver https://impeccable.style para el instalador oficial: Codex CLI, Claude Code, Cursor, Copilot, Gemini CLI, Grok Build, OpenCode…). |
| **Ad-hoc, sin instalar** | Pegar el extracto de la sección 4 en el prompt de cada tarea de UI. |

> Nota: también puede instalarse como plugin oficial de OpenCode si la cuenta lo permite; en ese caso la
> instalación la hace el mismo instalador y esta propuesta se ignora.

## 4. Definición sugerida del skill (lista para pegar)

```markdown
---
name: impeccable
description: >-
  Filtro de calidad de diseño ("anti-slop") para la UI de Camisas IUB. Úsalo en
  cualquier tarea que toque index.html, styles.css o nuevas vistas. NO cambia la
  identidad visual: respeta los tokens de styles.css y de DESIGN.md.
---

# Impeccable — revisión de calidad

Cada vez que produzcas o edites interfaz, pásala por estos chequeos antes de entregar:

## Anti-slop (lo que NUNCA)
- Fondos beige/crema (usar #EEF1F5/#0C111B). Sin gradientes, sin glass de adorno.
- Separar display en serif/cursiva (display = Archivo). Nunca letter-spacing exagerado en títulos.
- "Chip soup": una sopa de píldoras sin foco. Cada badge/chip comunica UN dato útil.
- "Cards in cards": más de un nivel de tarjeta anidada.
- "Everything equal": todo lo mismo, sin jerarquía. La jerarquía la dan tamaño+peso+espacio+acento.
- Titulares vagos ("Panel", "Información"). Cada título dice qué contiene.
- Demasiados campos en una pantalla. Reducir o agrupar por sección.
- CTA genéricos y MULTIPLES primarios. Regla: UNA acción principal por pantalla.
- Gradientes morados/neón. Acento = --accent turquesa, un solo color de marca.
- Movimiento decorativo. El movimiento solo comunica: entrada, prensado, salida.

## Proceso
1. Lee DESIGN.md y los tokens de styles.css ANTES de escribir HTML/CSS.
2. Para cada pantalla nombra la acción primaria y hazla la única .btn-primaria visible.
3. Revisa estados: hover, focus-visible (anillo --focus), active (hundir 1px), disabled.
4. Contraste mínimo 4.5:1 en tema claro Y oscuro; no "aproximar" por ojo.
5. Texto: español, corto, sin emojis, sin "Haz clic aquí" vagos.
6. Antes de cerrar: `npx tata --path .` o el modo live de Impeccable si está instalado;
   si no, la lista de arriba es la fuente.
```

## 5. Qué puede tocar

- `index.html` y `styles.css` (presentación).
- `DESIGN.md` (mantener los tokens/documentación al día, vía `/document` si aplica).
- Un skill de solo lectura NO debe tocar `.od-skills/`, ni `app.js` a menos que el cambio de UI lo requiera
  (y aun así sin cambiar reglas de negocio).

## 6. Mantenimiento

- El catálogo `pbakaus/impeccable` se actualiza con chequeos nuevos: revisar el changelog con la misma
  cadencia que se revisan las dependencias.
- Cada vez que el prototipo cambie de estilo de verdad (nuevo token, nuevo componente), edita `DESIGN.md`
  primero y después el código, para que el documento siga siendo la fuente de verdad.

## 7. Ritual de cierre

Antes de marcar una tarea de UI como terminada: pasar los chequeos de la sección 4, confirmar UNA primaria,
y reportar al usuario qué vicios se corrigieron (si hubo) y cuáles se conservaron por diseño.