# Valora

Análisis fundamental y valoración de empresas para decisiones de inversión a largo plazo. PWA instalable con sincronización entre dispositivos vía GitHub, datos en vivo de Yahoo Finance y Financial Modeling Prep, y análisis profundo de empresas españolas vía export SABI.

## Contenido del paquete

- `index.html` — la app completa
- `manifest.json` — metadatos PWA
- `service-worker.js` — cache offline
- `icon-192.png`, `icon-512.png` — iconos de app

## Instalación

### Paso 1 — Servir los archivos por HTTPS

Las PWA **necesitan HTTPS** (o localhost) para funcionar. Tres opciones, de más fácil a más control:

**Opción A · GitHub Pages (recomendada, gratis)**
1. Crear repo público en GitHub: `tu-usuario/valora`
2. Subir los 5 archivos al repo (puedes arrastrarlos en la web de GitHub)
3. Settings → Pages → Source: `main` branch
4. Esperar ~1 min, tendrás la URL `https://tu-usuario.github.io/valora/`
5. Abrir esa URL desde el navegador

**Opción B · Vercel/Netlify (gratis, drag-and-drop)**
1. Ir a vercel.com o netlify.com, registrarse
2. Drag-and-drop la carpeta del proyecto
3. Te dan URL HTTPS al instante

**Opción C · Servir local (sólo para probar)**
Desde la carpeta del proyecto en terminal:
```bash
python3 -m http.server 8000
```
Abrir `http://localhost:8000/` en el navegador. La PWA funciona en localhost aunque no sea HTTPS.

### Paso 2 — Instalar como app

**En iPhone (Safari):**
1. Abrir la URL en Safari
2. Botón compartir (cuadrado con flecha) → "Añadir a la pantalla de inicio"
3. Aparecerá el icono en tu pantalla principal como una app nativa

**En Android (Chrome):**
1. Abrir la URL
2. Aparecerá un banner "Añadir a inicio"
3. O menú (3 puntos) → "Instalar app"

**En Mac/Windows (Chrome/Edge):**
1. Abrir la URL
2. Icono "+" o "Instalar" en la barra de direcciones
3. La app se instala como aplicación nativa con su propia ventana

## Fuentes de datos

### 1. Por ticker (Alpha Vantage) — opción principal

Permite analizar empresas cotizadas del mundo: AAPL, MSFT, IBM, SAP, BNP.PAR, etc.

**Setup Alpha Vantage (gratuito, 25 análisis/día, 20 segundos):**
1. Ve a [alphavantage.co/support/#api-key](https://www.alphavantage.co/support/#api-key)
2. Rellena el formulario (nombre + email + uso académico/personal — sin tarjeta)
3. La página devuelve la API key al instante
4. En la app: **Ajustes** → sección Alpha Vantage → pega la key
5. Vuelve a la pestaña Análisis financiero → escribe ticker → Analizar

Limitaciones conocidas:
- Alpha Vantage devuelve **5 años de annual reports**.
- Plan free: 25 requests/día y 5 requests/minuto. Cada análisis consume 4 requests, por tanto ~6 análisis distintos por día.
- Sufijos por mercado: sin sufijo para NYSE/NASDAQ, `.LON` Londres, `.PAR` París, `.FRK` Frankfurt, `.MAD` Madrid, `.MIL` Milán, `.SWX` Suiza. Algunos mercados pequeños pueden no estar cubiertos.

### 2. Por archivo SABI — análisis en profundidad

Para empresas españolas no cotizadas o cuando quieras hasta 25 ejercicios de histórico, sube el `.xlsx` exportado del SABI (Bureau van Dijk / Moody's). Cubre ~todas las empresas españolas, cotizadas y no cotizadas.

### 3. Financial Modeling Prep — fallback opcional

FMP queda como fuente secundaria. **El plan Basic gratuito de FMP ha dejado de cubrir los estados financieros históricos en 2024-2025** (devuelve HTTP 402 Payment Required incluso para AAPL). Solo configura una API key de FMP en Ajustes si tienes plan **Starter+** ($14/mes); en ese caso se usará como reintento automático cuando Yahoo falle.

### 4. Precios en vivo

Junto al input "Precio actual acción" hay un botón **↻** que descarga el precio real de Yahoo Finance al instante. Sin API key necesaria.

Para que sepa qué ticker buscar: si cargaste por ticker (Yahoo), ya lo tiene; si subiste un SABI, te lo preguntará la primera vez.

## Sincronización entre dispositivos (GitHub)

Los análisis guardados (Watchlist) viven en tu navegador. Para verlos en móvil + portátil sincronizados, conecta GitHub:

**Setup GitHub (5 minutos):**
1. Crear repo **privado** vacío en github.com/new (ej: `valora-data`). Marca *Private*.
2. Generar Personal Access Token fine-grained en github.com/settings/tokens?type=beta:
   - Repository access: **Only select repositories** → tu repo nuevo
   - Permissions: Contents = **Read and write**
   - Expiration: 1 año o "no expiration"
3. Copia el token (empieza por `github_pat_...`)
4. En la app: **Ajustes** → sección GitHub → pega token y `tu-usuario/valora-data`
5. Pulsa "Probar conexión"
6. En tu dispositivo principal: pulsa **↑ Push** para subir tus análisis
7. En otros dispositivos: pulsa **↓ Pull** para descargar

## Privacidad

- **Tu API key de FMP** vive solo en localStorage de tu navegador. No la enviamos a ningún sitio. Las llamadas a FMP van directas de tu navegador a su servidor.
- **Tu token de GitHub** también vive solo en tu navegador. Las llamadas a GitHub API van directas de tu navegador a tu propio repo privado.
- **Los análisis** se guardan en tu navegador y, si activas sync, en tu repo privado de GitHub que solo tú ves.
- No hay servidor nuestro. No hay tracking. No hay anuncios.

## Aviso legal

Valora proporciona información calculada a partir de datos públicos. No constituye asesoramiento financiero ni recomendación de inversión. Las decisiones de inversión son responsabilidad exclusiva del usuario. Los datos pueden contener errores y los resultados dependen de hipótesis (WACC, crecimiento, múltiplos) que pueden no cumplirse.

## Solución de problemas

**"Service Worker registration failed"**
- Asegúrate de servir por HTTPS o localhost. file:// no funciona.

**"FMP_HTTP_403"**
- Has agotado las 250 requests/día gratuitas. Espera 24h o sube de plan.
- O algunos tickers (mercados emergentes muy específicos) requieren plan pago.

**"Yahoo Finance no devuelve precio"**
- A veces el proxy CORS (corsproxy.io) tiene caídas. Vuelve a intentarlo en 1 minuto.
- Para tickers raros, configura FMP como fallback.

**"GitHub: 401 Unauthorized"**
- Token expirado o sin permisos. Regenera el token con los permisos Contents: Read and write.

**Funciona en portátil pero no en iPhone**
- Asegúrate de instalar la PWA desde **Safari** (no Chrome iOS) y "Añadir a pantalla de inicio".
- Limpia caché de Safari si has actualizado el código en el repo: Ajustes → Safari → Borrar historial.
