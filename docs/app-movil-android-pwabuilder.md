# App Móvil Android (APK) — Generación con PWABuilder

Guía paso a paso para generar el archivo `.apk` de CUANTY ERP usando PWABuilder.com y publicarlo en `/descargas` del propio ERP. **No requiere instalar Android SDK ni Java.**

---

## Resumen del flujo

1. Verificar que la web tenga PWA válido (ya está, ver sección "Pre-requisitos").
2. Ir a `pwabuilder.com` y generar el APK desde la URL de producción.
3. Descargar el ZIP con el APK firmado + keystore + assetlinks.
4. Guardar el **keystore** en lugar seguro (sin él no se puede actualizar el APK).
5. Subir el APK a `public/descargas/CUANTY-ERP.apk` y activar la tarjeta en `/descargas`.
6. Pegar el SHA-256 del keystore en `public/.well-known/assetlinks.json`.
7. Hacer commit + push.

Tiempo total: ~15-20 minutos.

---

## Pre-requisitos (ya configurados)

- ✅ `public/manifest.json` declara `icons[]` con al menos 512x512 (apunta a `/icons/icon-512.png`).
- ✅ `public/icons/icon-512.png` existe.
- ✅ `public/.well-known/assetlinks.json` existe como placeholder.
- ✅ Página `/descargas` tiene tarjeta "App Móvil Android" en estado `disponible: false` lista para activar.

---

## Paso 1 — Generar el APK en PWABuilder.com

1. Abre `https://www.pwabuilder.com/`.
2. En el input grande pega la URL de producción del ERP, por ejemplo:
   `https://cuanty-erp.vercel.app` (sustituye por tu dominio real).
3. Click en **"Start"**.
4. PWABuilder analiza el sitio y muestra un score. Verifica que:
   - **Manifest** esté en verde.
   - **Service Worker** esté en verde o amarillo (warnings son OK).
   - **Security** (HTTPS) esté en verde.
5. Click en **"Package For Stores"** (esquina superior derecha).
6. Selecciona la pestaña **"Android"** (logo verde de Android).
7. Click en **"Generate Package"**.

### Configuración del package Android

PWABuilder te muestra un formulario. Valores recomendados:

| Campo | Valor |
|-------|-------|
| App name | `CUANTY ERP` |
| Short name | `CUANTY ERP` |
| Package ID | `mx.cuanty.erp` (debe coincidir con `assetlinks.json`) |
| App version | `1.0.0` |
| App version code | `1` |
| Host | (auto, tu URL) |
| Start URL | `/dashboard` |
| Icon URL | (auto, lee del manifest) |
| Theme color | `#1890ff` |
| Background color | `#ffffff` |
| Display mode | `standalone` |
| Orientation | `default` o `portrait` |
| Signing key | **"New"** (genera uno nuevo automáticamente) |
| Signing key info | Llenar con datos genéricos (nombre país MX, organización SOLAC, etc.) |

Click en **"Download Package"**.

---

## Paso 2 — Contenido del ZIP descargado

PWABuilder te entrega un `.zip` con estos archivos importantes:

| Archivo | Qué hace |
|---------|----------|
| `app-release-signed.apk` | El APK listo para distribuir e instalar |
| `signing.keystore` | **CRÍTICO — guárdalo seguro** |
| `signing-key-info.txt` | Password y alias del keystore |
| `assetlinks.json` | Contenido para tu `public/.well-known/assetlinks.json` |
| `next-steps.html` | Guía oficial de PWABuilder |

---

## Paso 3 — Guardar el keystore en lugar seguro

⚠️ **NO subir el keystore a git.** Es la clave privada que firma el APK. Si la pierdes, el APK actualizado no podrá reemplazar al instalado (Android lo verá como app distinta y los usuarios tendrán que desinstalar + reinstalar).

Guárdalo en:
- Carpeta personal con respaldo (no en el repo)
- Google Drive personal o Dropbox cifrado
- Llavero/manager de contraseñas

Junto con el `signing-key-info.txt` que tiene el password.

---

## Paso 4 — Subir el APK al repo

Renombra `app-release-signed.apk` a `CUANTY-ERP.apk` y cópialo a:

```
c:/ERP-GAS/public/descargas/CUANTY-ERP.apk
```

> El archivo está gitignored por tamaño en algunos repos. Verifica que se incluya con `git status` antes del commit.

---

## Paso 5 — Activar la tarjeta de descarga

En `src/app/(dashboard)/descargas/page.tsx`, cambia la entrada de Android de:

```ts
disponible: false,
```

a:

```ts
disponible: true,
```

Si el APK pesó diferente a 4 MB, actualiza también `tamanoMB`.

---

## Paso 6 — Configurar assetlinks.json con el SHA-256 real

Abre el `assetlinks.json` que PWABuilder te dejó en el ZIP. Copia el valor de `sha256_cert_fingerprints` (es un string hexadecimal separado por `:`).

Pégalo en `public/.well-known/assetlinks.json` reemplazando el placeholder:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "mx.cuanty.erp",
      "sha256_cert_fingerprints": [
        "AA:BB:CC:..." // ← aquí el SHA-256 real del ZIP
      ]
    }
  }
]
```

Este archivo le dice a Android que el APK con ese SHA puede mostrar tu sitio sin la barra del navegador (Trusted Web Activity).

**Si NO lo configuras**: la app se abre pero muestra una barra arriba que dice "powered by Chrome". No es bloqueante pero se ve menos profesional.

---

## Paso 7 — Commit + push

```bash
git add public/manifest.json public/icons/ public/.well-known/ public/descargas/CUANTY-ERP.apk src/app/\(dashboard\)/descargas/page.tsx
git commit -m "Feat(descargas): agregar APK Android via PWABuilder"
git push origin master
```

Vercel despliega en 1-3 minutos.

---

## Paso 8 — Verificar en el celular

1. Desde tu celular Android, abre la URL del ERP en Chrome.
2. Ve a **Configuración → Descargas** (o navega manualmente al APK).
3. Descarga `CUANTY-ERP.apk`.
4. Al abrirlo aparecerá la alerta "Por seguridad, tu teléfono no permite instalar apps desconocidas".
5. Toca **Configuración → Permitir esta fuente**.
6. Vuelve atrás e instala.
7. Abre la app — debería mostrar el ERP en pantalla completa, sin barra de navegador.

---

## Cómo distribuir al equipo SOLAC

Mejor opción: mandar por WhatsApp o correo el link directo de descarga:

```
https://[tu-dominio]/descargas/CUANTY-ERP.apk
```

O simplemente decirles "entra al ERP, ve a Configuración → Descargas y baja la app móvil".

Cada celular puede instalarlo de forma independiente. No hay límite de instalaciones.

---

## Cuándo regenerar el APK

**Rara vez**. El APK es un wrapper que carga la URL del ERP — cualquier cambio en el ERP (nuevas pantallas, fixes, módulos nuevos) se ve automáticamente la siguiente vez que el usuario abre la app, **sin reinstalar**.

Solo necesitas regenerar APK si cambias:

- Nombre de la app
- Ícono
- Color del splash screen
- Permisos nativos (cámara, GPS, etc.)
- Package ID
- URL del ERP

En ese caso: repite el flujo desde Paso 1, **pero usa el mismo keystore** (en PWABuilder, opción "Existing signing key" en lugar de "New"). Si usas keystore distinto, los usuarios tendrán que desinstalar la anterior.

---

## Cómo verificar que el TWA funciona bien

Una vez instalado, abre la app. Debe abrirse en pantalla completa **sin la barra de Chrome arriba**. Si ves la barra "powered by Chrome", el `assetlinks.json` no está bien configurado:

- Verifica que `public/.well-known/assetlinks.json` existe en producción (entra a `https://[tu-dominio]/.well-known/assetlinks.json` y debe verse el JSON).
- Verifica que `package_name` y `sha256_cert_fingerprints` coinciden con los del APK.
- Espera 5-10 minutos después del deploy para que el cache de Android refresque.

---

## Soporte para iOS (futuro)

PWABuilder también puede generar para iOS pero requiere:

- Cuenta Apple Developer ($99 USD/año)
- Mac con Xcode para firmar
- Pasar por App Store (Apple no permite distribuir IPAs fuera)

Por ahora, los usuarios de iPhone pueden usar **"Agregar a inicio"** desde Safari y queda como icono.
