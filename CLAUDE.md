# IRREEMPLAZABLE · App de consultoría

App privada de Camilo Castellanos (mentor) para acompañar consultantes del método IRREEMPLAZABLE: fichas, formularios, mediciones, sesiones, notas y análisis con IA.

Manual del método (fuente de verdad conceptual): https://ireemplazable-metodo.pages.dev/
Leelo antes de diseñar cualquier pantalla o tabla. La app traduce el método a un sistema; no inventa estructura nueva.

## Reglas de trabajo

- Idioma de la interfaz: español neutral, trato de "tú" hacia consultantes. Código y nombres técnicos en inglés.
- Construir por etapas (ver abajo). No avanzar a la siguiente sin que la anterior funcione deployada.
- Antes de cambios grandes, explicar el plan en 5 líneas y esperar confirmación.
- Mantener simple: el usuario no es desarrollador. Cada paso que requiera acción suya (login, secretos, clicks en Cloudflare) se explica paso a paso, en español.
- Lenguaje del método: "consultante" (nunca "paciente"), "proceso de reconstrucción de identidad" (nunca "terapia"), "resultados medibles" (nunca "clínicos").

## Stack

- Cloudflare Pages + Pages Functions (o Workers) para frontend y API.
- Cloudflare D1 como base de datos.
- Cloudflare Access para proteger el panel del mentor (solo el email de Camilo).
- Frontend liviano (HTML/JS o un framework mínimo). Nada que requiera mantenimiento complejo.
- IA: API de Anthropic llamada solo desde el servidor. La API key va como secreto de Cloudflare, nunca en el frontend ni en el repo.
- Repo en GitHub conectado a Cloudflare Pages para deploy automático.

## Privacidad y seguridad (no negociable)

- Son datos sensibles de salud emocional (Ley 25.326, Argentina). Todo el panel detrás de Cloudflare Access.
- Los formularios públicos que completan consultantes se acceden por link con token único por consultante y por formulario. Un token no permite leer datos, solo enviar. Excepción: el token de un kit de fase lee y edita solo las respuestas de ese kit (para poder completarlo en varios días) y deja de devolverlas cuando el kit se entrega.
- Antes de enviar cualquier dato a la IA: anonimizar. Quitar nombre, email, teléfono, ciudad, nombres de terceros mencionados (testigo, familiares, empresa). Reemplazar por "la consultante", "[persona 1]", etc. Mostrar al mentor el texto anonimizado antes de enviarlo.
- Las alertas de cuidado (respuesta "Sí" en crisis o pensamientos de hacerse daño) se marcan en rojo en el panel y en la ficha, y disparan un email al mentor.
- Función para exportar o eliminar todos los datos de un consultante (derecho de acceso y supresión).
- Backups: export periódico de D1 documentado en el README.

## Modelo de datos

**consultants**: id, nombre, email, whatsapp, edad, ciudad_pais, rol, fecha_ingreso, estado (aplicacion / diagnostico / activo / pausado / cerrado / sosten90), fase_actual (0–6), registro (claro / profundo), alerta_cuidado (bool), notas_generales, fase_inicio (día 1 del ciclo de 14 días de la fase actual), proxima_sesion.

**forms**: id, consultant_id, tipo (ingreso / diagnostico_fase_1…6 / bitacora / cierre), token, enviado_at, respondido_at, respuestas_json.

**arcon**: id, consultant_id, momento (sesion0 / kit_f1…f6 / fin_f1…f6 / final / sosten30 / sosten60 / sosten90), quien (consultante / mentor), autenticidad, resonancia, coherencia, observacion, narrativa (1–5), fecha.

**indicators**: id, consultant_id, fecha, sueno, energia, intensidad_sintoma, vida_propia (1–10), sintoma_descripcion.

**sessions**: id, consultant_id, fecha, numero, fase, semaforo (verde / amarillo / rojo), como_llega, tecnica_usada, intensidad (baja / media / alta), notas_mentor, lo_que_se_lleva (en palabras de la consultante), compromiso_semana, cumplio_compromiso_anterior (si / parcial / no).

**identity_acts**: id, consultant_id, fecha, fase, descripcion, tipo (no / limite / pedido / conversacion / decision).

**witness**: id, consultant_id, momento (sesion0 / fin_f3 / final), presencia, dice_lo_que_piensa, calma_presion, eleccion_vs_obligacion (1–5), cambio_concreto (texto), token, respondido_at.

**checkins**: id, consultant_id, semana, fecha, texto.

**kits**: id, consultant_id, kit_key, fase, token, config_json (textos personalizados, fecha límite, zona horaria), indicator_id, created_at, started_at, cuidado_at, entregado_at.

**kit_answers**: id, kit_id, field_key, primera_respuesta, primera_at, respuesta_final, final_at.

**kit_events**: id, kit_id, tipo (guardado / cuidado / entregado), section_key, at.

**witness_proposals**: id, consultant_id, kit_id, nombre, motivo, estado (pendiente / confirmado / descartado).

**identity_act_drafts**: id, consultant_id, kit_id, fecha, fase, con_quien, que_dije, cuerpo, estado (pendiente / confirmado / descartado), identity_act_id.

**ai_analyses**: id, consultant_id, tipo (preparar_sesion / evolucion / cierre_fase), input_anonimizado, output, fecha.

## Kits de fase

- Definición como datos en `src/kits/*.json` (secciones, bloques, textos, variables personalizables, mapeo de mediciones, testigo y acción). Se registran en `src/kits/index.js`.
- Renderer único: `public/f/kit.html` + `public/js/kit.js`. Vista del mentor: `public/panel/kit.html`.
- Tipos de bloque: p, list, heading, text, textarea, yesno (con reveal), scale, lines, columns, pick, rows, local (solo navegador), deadline, signature. Los textos aceptan `{{variable}}`.
- Cambios de esquema: siempre con una migración nueva en `migrations/`, sin comentarios (la consola de D1 junta todo en una línea).

## Pantallas

1. **Panel**: consultantes activos con fase y días del ciclo de 14 días, próximas sesiones, alertas de cuidado arriba de todo, formularios pendientes.
2. **Ficha del consultante**: datos, fase actual, línea de tiempo (formularios, sesiones, actos, check-ins), gráfico ARCON consultante vs. mentor por momento, indicadores 1–10 en el tiempo, testigo.
3. **Registro de sesión**: formulario rápido para completar al cierre del encuentro, siguiendo la estructura 1:1 del método (apertura, exploración, intervención, integración, compromiso).
4. **Formularios para consultantes**: ingreso, diagnóstico de cada fase, bitácora, testigo. Se generan con link + token y se copian para mandar por WhatsApp.
5. **Vista del método** (etapa 3): datos agregados y anónimos de todos los consultantes. Evolución promedio de ARCON por fase, técnicas usadas vs. cambio en la fase siguiente, actos de identidad por fase.

## Etapas

**Etapa 1 · Base (hacer primero)**
- Proyecto en Cloudflare Pages + D1 + Access funcionando y deployado.
- Esquema completo de la base.
- Panel, ficha y registro de sesión.
- Carga manual de ARCON e indicadores.
- Migrar `form-ingreso-irreemplazable.html` (original en la raíz; versión activa en `public/f/ingreso.html`): mantener su diseño, textos y bases y condiciones exactamente como están, pero en vez de FormSubmit debe guardar en D1 (tablas consultants, forms, arcon, indicators) y avisar por email al mentor. El "Sí" en la pregunta de crisis activa alerta_cuidado.

**Etapa 2 · Formularios del proceso**
- Diagnóstico de cada fase, bitácora, testigo, check-in semanal, todos por link con token.
- Las respuestas de ARCON e indicadores dentro de esos formularios alimentan sus tablas.

**Etapa 3 · IA y método**
- Botón "Preparar sesión" en la ficha: anonimiza, muestra lo que se va a enviar, llama a la IA y guarda el resultado. Debe devolver: en qué momento está, qué cambió desde la última sesión, brecha entre ARCON propio y del mentor, patrones que se repiten, preguntas sugeridas para explorar. Siempre como apoyo al criterio del mentor, nunca como diagnóstico.
- Resumen de cierre de fase y de proceso.
- Vista del método.

## Diseño

El sistema visual completo está en `DESIGN.md`: colores (claro y oscuro), tipografías, escala, componentes, íconos y voz de la interfaz. Es obligatorio. Antes de crear cualquier pantalla:

1. Leer `DESIGN.md` entero.
2. Definir todos los colores y tipografías como variables CSS en un único archivo de tokens.
3. Ninguna pantalla usa colores, fuentes o tamaños fuera de esos tokens.

Referencia visual de lo ya construido: `form-ingreso-irreemplazable.html`.
