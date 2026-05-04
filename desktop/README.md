# CUANTY Desktop (Tauri wrapper)

Wrapper de escritorio que carga `https://cuanty.cloud` en una ventana nativa.

Vive solo en la rama `feat/desktop-tauri`. No se mergea a master.

## Requisitos (instalados 1 vez)

- Rust toolchain (`rustup`) ✓
- Visual Studio Build Tools 2022 con workload "Desktop development with C++" ✓
- WebView2 Runtime (Windows 11 ya lo trae) ✓
- Node.js 20+ ✓

## Primera vez que corres esto

Desde la carpeta `desktop/`:

```powershell
# 1. Instalar deps de npm (~30 s)
npm install

# 2. Generar todos los iconos a partir del placeholder
npx tauri icon src-tauri/icons/_placeholder.png

# 3. Modo desarrollo - primera vez compila Rust (~3-5 min, despues 5-15 s)
npm run dev
```

Tras el paso 3 se abre una ventana cargando `https://cuanty.cloud`.

## Comandos diarios

```powershell
npm run dev      # desarrollo
npm run build    # genera instalador .msi y .exe en src-tauri/target/release/bundle/
```

## Donde queda el binario

Tras `npm run build`:

- `src-tauri/target/release/bundle/msi/CUANTY ERP_0.1.0_x64_en-US.msi`
- `src-tauri/target/release/bundle/nsis/CUANTY ERP_0.1.0_x64-setup.exe`

Doble clic al MSI o EXE para instalar. SmartScreen mostrara "Editor desconocido" la primera vez (porque no esta firmado) → "Mas informacion" → "Ejecutar de todos modos". Una vez instalado, no vuelve a pedir.

## Atajos

- `Ctrl+Shift+C` - mostrar/ocultar la ventana (atajo global del SO).

## Cambiar el icono

Cuando tengas un PNG 1024x1024 listo:

```powershell
npx tauri icon ruta/a/mi-logo.png
```

Eso regenera todos los tamaños y formatos en `src-tauri/icons/` (ico, icns, varios PNG).

## Iteracion

Para traer cambios del ERP cuando se actualice master:

```bash
git checkout feat/desktop-tauri
git merge master
```

Como el wrapper apunta a `cuanty.cloud`, cualquier deploy a Vercel se ve reflejado sin recompilar Tauri. Solo recompilas si tocas:

- `src-tauri/tauri.conf.json`
- Codigo Rust en `src-tauri/src/`
- Versiones de plugins en `src-tauri/Cargo.toml`

## Estructura

```
desktop/
├── package.json               # scripts npm + dep @tauri-apps/cli
├── src/index.html             # fallback (no se usa, solo evita warning)
└── src-tauri/
    ├── Cargo.toml             # crate Rust + plugins
    ├── build.rs
    ├── tauri.conf.json        # config principal: apunta a cuanty.cloud
    ├── capabilities/
    │   └── default.json       # permisos del wrapper
    ├── icons/                 # iconos generados con `tauri icon`
    └── src/
        ├── main.rs            # entry point
        └── lib.rs             # plugins + atajo global Ctrl+Shift+C
```
