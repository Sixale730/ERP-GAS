# 06 — Fuentes Públicas para Prospección

Resultado de investigación web (mayo 2026) sobre qué fuentes oficiales rinden y cuáles no para prospectar gaseras Gas LP en México.

## Mapa de fuentes calificado

| Fuente | Promesa | Realidad | Veredicto |
|--------|---------|----------|-----------|
| **CNE / padrón Gas LP** | "Universo de gaseras" | ✅ PDFs públicos por modalidad + dataset abierto | **El punto de partida** |
| **CNE Consulta de Precios** | (no estaba en plan) | 🎯 Distribuidoras que reportan precios = gaseras VIVAS | **Mejor que el padrón mismo** |
| **SAT L_CNE** | (no estaba en plan) | 🎯 Lista vigente que actualiza el SAT para CFDI = la **más fresca** | **Lista limpia para prospectar** |
| **PROFECO sanciones específicas Gas LP** | "Señales calientes" | ❌ NO publica nombres individuales desde 2018 | **Descartar como fuente directa** |
| **PROFECO Quién es Quién Gas LP** | (no estaba en plan) | ⚠️ Semanal pero es precios, no sanciones | Útil de cruce |
| **ASEA RENAGAS** | (no estaba en plan) | 🎯 ~60% de instalaciones SIN autorización ambiental vigente. Nombres no públicos, vía PNT | **La mina de oro real** |
| **DOF otorgamientos** | "Nuevos permisos" | ❌ Solo caducidades masivas y acuerdos generales | Marco, no prospectos |
| **DOF marco normativo 2025-2026** | (no estaba en plan) | 🎯 6 palancas frescas de pitch | **El nuevo guion de venta** (ver archivo 03) |
| **AMEXGAS directorio** | "Listado afiliados" | ❌ No tiene directorio público. Vía formal "Empresas Conexas" | Requiere inscripción |
| **Congreso AMEXGAS noviembre 2026** | (no estaba en plan) | 🎯 100% del decisor en 3 días | **Apartar agenda Q3-Q4** |
| **COPARMEX Jalisco** | (no estaba en plan) | ✅ Cursos ASEA hidrocarburos = audiencia gaseros real | Validación |
| **Medios técnicos** (Petroquimex, Energía a Debate) | "Posicionamiento" | ✅ Aceptan colaboraciones | Vector real de autoridad |

## Detalles por fuente

### 1. CNE — padrón de permisionarios Gas LP

**URLs concretas:**
- Página principal: `https://www.cne.gob.mx/Permisos/`
- Permisos otorgados Gas LP: `https://www.gob.mx/cne/documentos/permisos-otorgados-en-materia-de-gas-lp-400960`
- PDF padrón distribución: `https://www.gob.mx/cms/uploads/attachment/file/822342/Distribuci_n_de_Gas_Licuado_de_Petr_leo_mediante_Planta_de_Distribuci_n.pdf`
- Dataset abierto: `https://www.datos.gob.mx/dataset/permisos_almacenamiento_transporte_distribucion_gas_licuado_petroleo`
- Consulta de Precios (gaseras vivas): `https://www.cne.gob.mx/ConsultaPrecios/GasLP/PlantaDistribucion.html?idiom=es`
- SAT L_CNE: `https://www.sat.gob.mx/minisitio/ControlesVolumetricos/consulta_permisos.html`

**Campos que trae el padrón:**
\# · Número de Permiso · Razón Social · Fecha Otorgamiento · Estatus · Modalidad · Capacidad · Domicilio/Estado.

**Cambio nomenclatura**: permisos nuevos formato `CNE/PL/###/COM/2026`; viejos `CRE/...`. Útil para detectar antigüedad.

**Ruta rápida (1-2 horas)**:
1. Descargar PDFs por modalidad de la página CNE.
2. Cruzar con Consulta de Precios CNE para enriquecer con cobertura geográfica.
3. Filtrar por estado (Jalisco, Nayarit, Colima, Michoacán, Guanajuato).

**Ruta completa (3-10 días hábiles)**: solicitar por PNT padrón Excel completo con todos los campos.

### 2. PROFECO

**URLs:**
- Sala de prensa: `https://www.gob.mx/profeco/prensa`
- Reporte de gaseras: `https://www.gob.mx/profeco/articulos/reporte-de-gaseras`
- Quién es Quién Gas LP: `https://combustibles.profeco.gob.mx/`

**Realidad importante**: PROFECO **dejó de publicar nombres individuales de gaseras Gas LP sancionadas desde ~2018**. Lo que publica:
- Agregados ("X% de cilindros inmovilizados")
- Sanciones a gasolineras (combustibles líquidos), no Gas LP
- "Quién es Quién Gas LP" — precios por región, no sanciones

**Operativos recientes (referencia, no Gas LP)**:
- Dic 2025: PROFECO+ASEA inmovilizaron 780 instrumentos, clausuraron 161 estaciones gasolineras, 43 denuncias FGR.
- May 2025: 67 máquinas inmovilizadas en 6 estaciones de Guadalajara/Tlaquepaque/Zapopan (gasolineras).

**Solicitud PNT recomendada**:
> "Listado de plantas distribuidoras de Gas LP con instrumentos de medición inmovilizados 2024-2025 desglosado por entidad federativa, indicando razón social, domicilio, tipo de instrumento y motivo".

### 3. ASEA — RENAGAS (LA MINA DE ORO)

**Hallazgo clave**: ASEA reconoce públicamente que **~60% de instalaciones RENAGAS carecen de autorización ambiental vigente**. Programa de Regularización Extraordinario 2026-2030 con multas reducidas. Los nombres NO son públicos.

**Solicitud PNT recomendada**:
> "Lista de permisionarios Gas LP RENAGAS sin autorización ambiental vigente en Jalisco, Nayarit, Colima, Michoacán, Guanajuato".

Plazo legal: 20 días hábiles.

### 4. DOF — Diario Oficial de la Federación

**URL buscador**: `https://www.dof.gob.mx/index_111.php`

**Keywords útiles**: "Gas Licuado de Petróleo" (no "LP"), "caducidad", "permiso", "acuerdo CRE", "acuerdo CNE", "NOM-EM-007-ASEA".

**Hallazgo**: DOF NO publica otorgamientos individuales por gasera. Sí publica acuerdos generales y caducidades masivas. Para prospectar gaseras nuevas usar **datos.gob.mx** filtrando `fecha_otorgamiento >= 2025-05-01` y estados.

Detalles de las 6+ palancas normativas en `03_palancas_normativas_2026.md`.

### 5. AMEXGAS y otras asociaciones

| Asociación | URL | Directorio público | Inscripción proveedores |
|------------|-----|-------------------|--------------------------|
| **AMEXGAS** | amexgas.com.mx | ❌ No publica | ✅ Categoría "Empresas Conexas" via correo + comité |
| AMPES | ampes.mx | Parcial | Más enfocada gasolineras |
| AMGN | (LinkedIn/FB) | — | Gas natural, no LP |
| ANEGAS / ANIGAS | — | Sin sitios verificables | — |

**Contacto AMEXGAS**: contacto@amexgas.com.mx · +52 55 5545 7264 · Juan Jacobo Rousseau 44, CDMX.

### 6. Cámaras locales relevantes en Jalisco

- **CANACO Guadalajara**: Av. Vallarta 4095, Fracc. Camino Real · (33) 3880 9071 / 3880 9097.
- **CANACINTRA Jalisco**: tiene Sección de Energía, no rama hidrocarburos formal.
- **COPARMEX Jalisco**: coparmexjal.org.mx — **SÍ ha impartido cursos de cumplimiento ASEA para hidrocarburos**, audiencia activa de gaseros.

### 7. Eventos del sector 2026

| Evento | Fecha | Lugar | Comentario |
|--------|-------|-------|-----------|
| Expo MEiH 2026 | 24-26 mar | CDMX | Ya pasó, referencia 2027 |
| Congreso AIGLP 2026 | 24-26 mar | Buenos Aires | Ya pasó |
| NPGA Propane Expo | 19-21 abr | Nashville TN | Ya pasó |
| Expogas AMPES | 15-17 abr | Tampico | Ya pasó |
| ONEXPO 2026 | 12-15 may | Mérida | En curso/inminente. Más gasolinero |
| Congreso Mexicano del Petróleo | 3-6 jun | Veracruz | **Próximo, Q2** |
| **Congreso AMEXGAS 2026** | nov (sin fecha confirmada) | TBD | **EL evento de Gas LP, apartar agenda** |

### 8. Medios técnicos para colocar contenido

- Petroquimex (`petroquimex.com`) — Industria Energética; nota Gas LP frecuente.
- Energía a Debate (`energiaadebate.com`) — periodismo energético analítico.
- Energy Magazine MX (`energymagazine.mx`) — audiencia ejecutiva.
- Global Energy (`globalenergy.mx`) — tag activo "AMEXGAS / Gas LP".
- Revista Petroquímica (`revistapetroquimica.com`) — alcance LatAm.

## Plan de prospección desde fuentes públicas

```
Paso 1: Descargar padrón CNE (PDFs por modalidad)
        → Universo de 80-150 gaseras Jalisco+Bajío
Paso 2: Cruzar con Consulta de Precios CNE
        → Lista de 40-80 gaseras VIVAS reportando
Paso 3: Mandar 2 solicitudes PNT (ASEA RENAGAS + PROFECO sanciones)
        → Llegan en 20 días hábiles, suman 5-15 prospectos calientes
Paso 4: Cruzar todo
        → Lista final de 10-15 prospectos calificados con señal de necesidad
```

Bateo proyectado vs WhatsApp frío: **4-6x mejor**.

## Qué evitar

- ❌ Comprar bases "premium" a vendedores externos (suelen ser padrón CRE filtrado, caro y desactualizado).
- ❌ Usar datos del SAT que no sean los abiertos oficiales (69-B, publicaciones DOF). Es problema legal real.
- ❌ Esperar respuesta PNT en 3 días (proceso formal, 10-20 hábiles).
- ❌ Mandar solicitud PNT genérica "todos los permisionarios de México" — te dan 10,000 registros en PDF mal estructurado.
