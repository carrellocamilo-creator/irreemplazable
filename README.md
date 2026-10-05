# IRREEMPLAZABLE · App de consultoría

App privada para acompañar consultantes del método IRREEMPLAZABLE. Funciona sobre Cloudflare Pages + D1 + Access. No requiere compilar nada.

## Qué hay en el repo

| Carpeta / archivo | Qué es |
| --- | --- |
| `public/` | Las pantallas. `panel/` es el panel del mentor, `f/ingreso.html` el formulario de ingreso. |
| `public/css/tokens.css` | Todos los colores, fuentes y tamaños (de `DESIGN.md`). |
| `public/js/method.js` | Fases, momentos ARCON, indicadores y estructura de la sesión. Si el método cambia, se cambia acá. |
| `functions/` | El servidor (API). `api/admin/` es privado; `api/form/` recibe formularios por token. |
| `src/` | Seguridad (Access), email y utilidades. |
| `schema.sql` | Esquema de la base. Se pega una vez en la consola de D1. |
| `form-ingreso-irreemplazable.html` | Formulario original (referencia). La versión activa es `public/f/ingreso.html`. |

## Puesta en marcha (una sola vez)

### 1. GitHub
1. Crea la rama `main` a partir del trabajo de la Etapa 1: en el repo → **Branches** (o el selector de ramas) → **New branch** → nombre `main`, origen `claude/lucid-goodall-nh3cw4` → **Create branch**.
2. Repo → **Settings** → **General** → **Default branch** → elige `main`.
3. De ahí en adelante, cada etapa llega como Pull Request hacia `main`. Al hacer **Merge**, Cloudflare publica solo.

### 2. Base de datos (D1)
1. Entra a [dash.cloudflare.com](https://dash.cloudflare.com) → menú izquierdo **Storage & Databases** → **D1 SQL Database** → **Create**.
2. Nombre: `irreemplazable-db`. Ubicación: automática. **Create**.
3. Dentro de la base, pestaña **Console**. Abre `schema.sql` en GitHub, botón **Copy raw file**, pégalo en la consola y aprieta **Execute**.
4. Verifica en la pestaña **Tables** que aparezcan 9 tablas.

### 3. Proyecto en Cloudflare Pages
1. Menú izquierdo **Workers & Pages** → **Create** → pestaña **Pages** → **Connect to Git**.
2. Autoriza GitHub si lo pide y elige el repo `irreemplazable`.
3. Configuración:
   - Production branch: `main`
   - Framework preset: `None`
   - Build command: *(vacío)*
   - Build output directory: `public`
4. **Save and Deploy**. Anota la dirección que te da (algo como `irreemplazable.pages.dev`).

### 4. Conectar la base al proyecto
1. En el proyecto → **Settings** → **Bindings** → **Add** → **D1 database**.
2. Variable name: `DB`. Database: `irreemplazable-db`. **Save**.

### 5. Proteger el panel con Cloudflare Access
1. Menú izquierdo **Zero Trust**. Si es la primera vez, elige un nombre de equipo (por ejemplo `irreemplazable`) y el plan **Free**. Puede pedir una tarjeta; el plan gratis no cobra.
2. **Access** → **Applications** → **Add an application** → **Self-hosted**.
3. Application name: `Panel IRREEMPLAZABLE`.
4. Agrega dos destinos (**Add public hostname**):
   - Domain `irreemplazable.pages.dev`, path `panel`
   - Domain `irreemplazable.pages.dev`, path `api/admin`
5. Policy: nombre `Solo mentor`, Action **Allow**, Include → **Emails** → `cami.castellanos85@gmail.com`.
6. Login method: **One-time PIN** (te llega un código por email). Guarda.
7. Abre la aplicación recién creada y copia el **Application Audience (AUD) Tag**.
8. En **Settings** (de Zero Trust) → **Custom pages** o **General**, copia tu **Team domain** (termina en `.cloudflareaccess.com`).

### 6. Email de aviso (EmailJS)
1. En [emailjs.com](https://www.emailjs.com) → **Email Services**: debe haber un servicio conectado (por ejemplo Gmail). Copia su **Service ID**.
2. **Email Templates** → **Create New Template**:
   - **To Email:** `{{to_email}}`
   - **Subject:** `{{subject}}`
   - **Content:** `{{message}}`
   - Guarda y copia el **Template ID**.
3. **Account** → **General**: copia la **Public Key**. **Account** → **Security**: copia la **Private Key** y activa **"Allow EmailJS API for non-browser applications"**.

(También funciona con Resend: basta con cargar `RESEND_API_KEY` en lugar de las variables de EmailJS.)

### 7. Variables del proyecto
En el proyecto de Pages → **Settings** → **Variables and Secrets** → **Add**:

| Nombre | Tipo | Valor |
| --- | --- | --- |
| `MENTOR_EMAIL` | Text | `cami.castellanos85@gmail.com` |
| `ACCESS_TEAM_DOMAIN` | Text | tu team domain, ej. `rapid-glitter-63be.cloudflareaccess.com` |
| `ACCESS_AUD` | Text | el AUD Tag de la aplicación de Access |
| `EMAILJS_SERVICE_ID` | Text | Service ID |
| `EMAILJS_TEMPLATE_ID` | Text | Template ID |
| `EMAILJS_PUBLIC_KEY` | Text | Public Key |
| `EMAILJS_PRIVATE_KEY` | **Secret** | Private Key |

Después: **Deployments** → en el último, menú **⋯** → **Retry deployment** (para que tome las variables).

### 8. Prueba
1. Abre `https://irreemplazable.pages.dev/panel/`. Tiene que pedirte el email y un código.
2. **Nueva consultante** → tu nombre de prueba → copia el link.
3. Abre el link en otra ventana, completa el formulario y envía.
4. Revisa que llegue el email y que la ficha muestre ARCON e indicadores.
5. Elimina la consultante de prueba desde su ficha (**Datos y privacidad** → **Eliminar**).

## Cómo funciona

- **Panel** (`/panel/`): alertas de cuidado arriba, consultantes en proceso con fase y día del ciclo de 14 días, próximas sesiones, formularios pendientes.
- **Ficha** (`/panel/consultante?id=…`): ARCON consultante vs. mentor, indicadores en el tiempo, línea de tiempo, respuestas del ingreso, proceso, datos, testigo, notas, exportar y eliminar.
- **Registro de sesión** (`/panel/sesion?c=…`): apertura, exploración, intervención, integración, compromiso.
- **Formulario de ingreso** (`/f/ingreso?t=TOKEN`): link único por consultante, se usa una sola vez. Guarda en `consultants`, `forms`, `arcon` (momento `sesion0`) e `indicators`. Un "Sí" en la pregunta de crisis activa la alerta de cuidado.

## Privacidad y seguridad

- Panel y API privada detrás de Cloudflare Access. El servidor además verifica la firma de Access y el email del mentor: si falta configuración, niega el acceso.
- Los tokens de formulario son aleatorios (256 bits), solo permiten enviar una vez y nunca devuelven datos.
- El email de aviso no incluye respuestas: solo el nombre y el link a la ficha.
- Derecho de acceso y supresión: en cada ficha, **Exportar** (JSON completo) y **Eliminar** (borra todo lo de esa consultante).

## Respaldos

- **Automático**: D1 guarda 30 días de historial (Time Travel). Para restaurar a una fecha, pide ayuda: se hace con un comando.
- **Manual (recomendado una vez por mes)**: en el panel, menú izquierdo → **Descargar respaldo completo**. Guarda el archivo en una carpeta privada (no en un lugar compartido).

## Pendiente

- Nombres de fases 0, 1, 2, 4, 5 y 6 en `public/js/method.js`, según el manual del método.
- Etapa 2: diagnóstico por fase, bitácora, testigo, check-in semanal.
- Etapa 3: IA (preparar sesión, cierres), vista del método.
