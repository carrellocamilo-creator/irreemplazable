# IRREEMPLAZABLE · Sistema visual

Este archivo define cómo se ve y cómo suena la app. Toda pantalla nueva se construye con estos tokens. Si algo no está acá, se pregunta antes de inventarlo.

## Concepto

**Testigo lúcido.** La app no motiva, no premia, no gamifica. Observa con claridad y sostiene. Se siente como una libreta de trabajo serena y precisa: mucho aire, poco color, la tipografía hace el trabajo.

Tres ideas guían cada decisión:

1. **Mineral, no decorativo.** Paleta tomada de piedra, pino y líquen: cosas que no se reemplazan, que crecen lento. Nada brillante, nada de moda.
2. **Dos voces.** Serif = la voz humana (lo que dice la consultante, lo que escribe el mentor, preguntas). Sans = la interfaz (botones, datos, navegación). Quien habla se reconoce por la letra.
3. **Evolución, no calificación.** Los datos se muestran como trayectoria en el tiempo, nunca como nota, ranking ni porcentaje de "éxito".

## Color

### Modo claro

| Token | Nombre | Hex | Uso |
| --- | --- | --- | --- |
| `--paper` | Piedra | `#F3F4F0` | Fondo de página |
| `--card` | Blanco hueso | `#FFFFFF` | Tarjetas, campos |
| `--ink` | Grafito | `#1C2320` | Texto principal |
| `--soft` | Grafito suave | `#5B6661` | Texto secundario |
| `--line` | Niebla | `#D6DBD6` | Bordes, divisores |
| `--pine` | Pino | `#2E4A41` | Primario: botones, links, foco, datos de la consultante |
| `--lichen` | Líquen | `#DCE5DF` | Fondos suaves, estados seleccionados |
| `--ochre` | Ocre | `#A07A2E` | Acento escaso: actos de identidad y datos del mentor |
| `--ochre-soft` | Ocre claro | `#F2EAD8` | Fondo de acto de identidad |
| `--alert` | Arcilla roja | `#9C3A2C` | Solo alertas de cuidado y errores |
| `--alert-soft` | Arcilla clara | `#F6E4E0` | Fondo de alerta |

### Modo oscuro

| Token | Hex |
| --- | --- |
| `--paper` | `#141917` |
| `--card` | `#1B211F` |
| `--ink` | `#E6EBE7` |
| `--soft` | `#9DA9A3` |
| `--line` | `#2D3632` |
| `--pine` | `#9CC3B4` |
| `--lichen` | `#22302B` |
| `--ochre` | `#D4AE62` |
| `--ochre-soft` | `#2E2818` |
| `--alert` | `#E48A7A` |
| `--alert-soft` | `#3A2420` |

### Semáforo del cuerpo (T1)

| Estado | Hex claro | Hex oscuro |
| --- | --- | --- |
| Verde | `#4F7A5E` | `#8FBF9E` |
| Amarillo | `#B88A2E` | `#D9B35E` |
| Rojo | `#9C3A2C` | `#E48A7A` |

Se muestra como un punto de 10px + la palabra. Nunca como fondo completo de una tarjeta.

### Reglas de color

- Pino es el único color de acción. Un solo botón relleno por pantalla.
- Ocre se usa en dos lugares y nada más: actos de identidad y la línea del mentor en gráficos de ARCON. Es el "oro" del proceso: escaso a propósito.
- En gráficos ARCON: consultante = pino (línea sólida), mentor = ocre (línea punteada). La brecha entre ambas se sombrea en líquen.
- Rojo arcilla solo para cuidado y errores. Si aparece rojo, tiene que significar algo.
- Sin degradés, sin sombras decorativas, sin colores de marca de terceros.

## Tipografía

| Rol | Familia | Pesos | Dónde |
| --- | --- | --- | --- |
| Voz | **Newsreader** (Google Fonts) | 400, 500 | Títulos, preguntas, respuestas de la consultante, notas del mentor, resultados de IA |
| Interfaz | **Instrument Sans** (Google Fonts) | 400, 500, 600 | Navegación, botones, etiquetas, tablas, números |
| Firma | **Caveat** (Google Fonts) | 500 | Solo firmas en el acuerdo |

Fallbacks: `Georgia, serif` y `system-ui, sans-serif`.

### Escala

| Nivel | Familia | Tamaño | Interlineado |
| --- | --- | --- | --- |
| Display (formularios) | Newsreader 400 | 44–58px fluido | 1.05 |
| H1 (panel) | Newsreader 400 | 32px | 1.15 |
| H2 | Newsreader 500 | 24px | 1.25 |
| H3 | Instrument Sans 600 | 16px | 1.35 |
| Texto de lectura | Newsreader 400 | 18px | 1.6 |
| Texto de interfaz | Instrument Sans 400 | 15px | 1.5 |
| Pequeño / metadatos | Instrument Sans 400 | 13px | 1.4 |

- Números siempre en Instrument Sans con cifras tabulares (`font-variant-numeric: tabular-nums`).
- Sin mayúsculas sostenidas en etiquetas. Única excepción: el logotipo IRREEMPLAZABLE.
- Línea de lectura máxima: 68 caracteres.

## Logotipo

`IRREEMPLAZABLE` en Instrument Sans 600, mayúsculas, espaciado +0.06em, color pino. Sin ícono por ahora. Debajo, en el panel: "Mentor en Reconstrucción de Identidad" en 13px, color suave.

## Forma y espacio

- Radio: 8px en campos y botones, 12px en tarjetas, 999px en pastillas (estados, sí/no).
- Bordes de 1px color `--line`. Sin sombras, salvo el anillo de foco (3px líquen).
- Espaciado en múltiplos de 4. Aire generoso entre secciones (48–72px en formularios, 32px en panel).
- Grillas de 12 columnas en panel. Formularios en una sola columna de 680px máximo, alineados a la izquierda.

## Dos superficies, una identidad

**Formularios de consultante:** serif dominante, una columna, mucho aire, ritmo lento. Se leen como una carta, no como un trámite. Referencia: `form-ingreso-irreemplazable.html`.

**Panel del mentor:** sans dominante, más denso, navegación lateral fija. Las notas, respuestas y análisis de IA vuelven a la serif para que se lean como texto humano dentro de la herramienta.

## Componentes clave

- **Tarjeta de consultante:** nombre en Newsreader 20px, fase como pastilla líquen ("Fase 3 · Desprogramar lo heredado"), día del ciclo (Día 6 de 14) con barra fina, punto de semáforo de la última sesión, ícono de alerta en arcilla solo si corresponde.
- **Línea de tiempo de la ficha:** vertical, a la izquierda. Cada evento con su fecha en 13px y un marcador: círculo pino (sesión), cuadrado líquen (formulario), rombo ocre (acto de identidad), triángulo arcilla (alerta).
- **Gráfico ARCON:** 5 mini gráficos de línea (una por dimensión) en fila, eje 1–5, 8 momentos en X. Consultante pino, mentor ocre punteado.
- **Bloque de IA:** fondo líquen, texto en Newsreader, etiqueta "Análisis de apoyo · revisar con criterio propio" arriba. Nunca aparece como verdad: siempre como borrador para el mentor.
- **Alerta de cuidado:** banda con borde izquierdo de 3px arcilla, fondo arcilla claro, texto directo y la acción siguiente.

## Íconos

Lucide o Tabler, trazo fino (1.5px), versión outline. Nunca rellenos. Sin emojis en ninguna parte de la app.

## Movimiento

Mínimo. Transiciones de 150ms en hover y foco. Un único momento con intención: al cerrar una fase, la línea de ARCON se dibuja de izquierda a derecha. Respetar `prefers-reduced-motion`.

## Voz de la interfaz

- Directa, humana, sin entusiasmo artificial. Nunca "¡Excelente!", "¡Felicitaciones!" ni signos de exclamación del sistema.
- Botones con verbo: "Registrar sesión", "Enviar formulario", "Preparar sesión".
- Estados vacíos como invitación: "Todavía no hay sesiones. Registra la primera al cerrar el encuentro."
- Lenguaje del método: consultante, proceso, fase, acto de identidad, testigo. Nunca paciente, terapia, tratamiento, diagnóstico clínico.
