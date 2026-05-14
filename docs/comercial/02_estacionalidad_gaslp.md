# 02 — Estacionalidad del Gas LP en México

## Hecho fundamental

El consumo de Gas LP en México **sube en invierno y baja en verano**. Cuando las gaseras venden más, su flota opera más, los equipos se desgastan más rápido y la demanda de refacciones sube. Cuando venden menos, paran equipos para mantenimiento mayor o instalación de equipo nuevo.

## 3 ciclos paralelos que mueven el negocio

1. **Ciclo de consumo (clima)**: invierno alto / verano bajo.
2. **Ciclo de inversión de capital**: las gaseras compran equipos nuevos en valle estival (no quieren parar autotanques en invierno).
3. **Ciclo normativo y fiscal**: calibraciones PROFECO 2 veces al año (mar y sept), verificaciones SAT/Anexo 30, cumplimiento NOM-259.

**Implicación operativa**: las ventas de **equipos nuevos** y de **refacciones** se comportan en sentido inverso. Hay que planear inventario, flujo de caja y campañas comerciales por línea, no consolidado.

## Calendario anual de consumo Gas LP nacional

| Período | Temporada | Nivel | Driver |
|---------|-----------|-------|--------|
| Dic – Feb | Pico invernal | ALTO (100%) | Calentadores, calefacción, posadas y fiestas |
| Mar – Abr | Transición primavera | MEDIO (75%) | Baja gradual |
| May – Jun | Bajo verano | BAJO (60-65%) | Solo cocción y calentadores reducidos |
| Jul – Ago | Valle estival | MUY BAJO (55-60%) | Mínimo consumo doméstico |
| Sep – Oct | Transición otoño | MEDIO (70%) | Inicio de frentes fríos en norte |
| Noviembre | Pre-invierno | ALTO (85-90%) | Llenado preventivo de tanques |

Porcentajes referenciales basados en patrones nacionales. Jalisco específicamente tiene picos menos pronunciados que el norte.

## Calendario de ventas proyectado (líneas cruzadas)

| Mes | Equipos nuevos | Refacciones | Servicio/calibración | Driver principal |
|-----|----------------|-------------|----------------------|------------------|
| Ene | BAJO | MUY ALTO | ALTO | Fallas por uso intensivo invernal |
| Feb | BAJO | ALTO | ALTO | Continúa demanda invernal, cierre fiscal |
| Mar | MEDIO | MEDIO | MUY ALTO | Verificaciones PROFECO 1er semestre |
| Abr | MEDIO-ALTO | MEDIO | ALTO | Planeación inversión Q2 |
| May | ALTO | MEDIO | ALTO | Compra equipos antes de baja, calor extremo en GDL |
| Jun | ALTO | BAJO-MEDIO | MEDIO | Inversión planeada, gaseras tienen tiempo de instalar |
| Jul | MUY ALTO | BAJO | MEDIO | Ventana ideal de instalación (baja operativa) |
| Ago | MUY ALTO | BAJO | MEDIO | Preparación pre-invierno, capacitación |
| Sep | ALTO | MEDIO | MUY ALTO | Verificaciones PROFECO 2do semestre |
| Oct | MEDIO | ALTO | ALTO | Mantenimiento preventivo pre-invierno |
| Nov | BAJO | MUY ALTO | ALTO | Reparaciones de emergencia pre-pico |
| Dic | MUY BAJO | MUY ALTO | BAJO | Solo emergencias, cierre de año |

## Clima en Jalisco — particularidad local

Guadalajara tiene clima templado todo el año (5-32°C). **Mayo es el mes más cálido** (media 25°C), **enero el más frío** (17.7°C). En 2026 algunos municipios del AMG (Tlajomulco, Ixtlahuacán) llegaron a 36°C — islas de calor.

**Implicación local**: dos picos térmicos al año (mayo caluroso + enero fresco) → **dos olas de fallas en equipos** por estrés térmico, no una sola.

## Efectos del clima en los equipos

| Fenómeno | Estación | Efecto en equipo GASPAR |
|----------|----------|-------------------------|
| Expansión térmica del Gas LP | Calor extremo (may-jun) | Variaciones de volumen, mayor exigencia al sistema de compensación; presión interna del tanque sube |
| Efecto Joule-Thomson | Frío + descarga rápida | Enfriamiento súbito al despachar, afecta mediciones |
| Condensación de humedad | Lluvias (jun-oct GDL) | Falla de tarjetas, oxidación de conectores, displays con humedad atrapada |
| Choque térmico | Madrugadas frías + mediodía caliente | Fatiga de componentes, fisuras en plásticos |
| UV intenso | Verano-primavera | Degradación de pantallas, plásticos, etiquetas, cables expuestos |
| Vibración por contracción térmica | Cambio brusco día/noche | Aflojamiento de tornillería, fallas intermitentes |

## Componentes vulnerables por estación

- **Invierno (dic-feb)**: baterías de respaldo (frío reduce capacidad), impresoras térmicas (papel humedecido), desgaste por operación intensiva (teclados, gatillos, mangueras).
- **Primavera-verano caliente (abr-jun)**: displays LCD (pérdida de contraste >40°C), tarjetas electrónicas (capacitores se degradan), sensores de temperatura mal calibrados.
- **Lluvias (jul-oct)**: sellos, juntas, gabinetes IP (filtraciones), conectores y borneras (oxidación), módems de comunicación (rayos y sobrevoltajes).

## KPIs externos a monitorear

- Temperatura promedio mensual Jalisco + estados clientes
- Precio internacional del propano (Mont Belvieu, Texas)
- Precio máximo CNE semanal del Gas LP
- Pronóstico de frentes fríos (Conagua/SMN)
- Días de reserva nacional de Gas LP (riesgo de racionamiento)

## KPIs internos del negocio

- **Mix de ventas** (equipos nuevos / refacciones / servicio) — debe rotar con el calendario
- Días de inventario por SKU crítico (displays, impresoras, tarjetas madre, sensores)
- Lead time de SICOM (15 días para equipos bajo pedido)
- Ticket promedio por tipo de cliente
- Tasa de conversión cotización → orden
- Tiempo de respuesta en servicio de emergencia (decisivo en invierno)
- Renovaciones de suscripción G4S

## Plan operativo trimestral

- **Q1 (ene-mar)** — Modo emergencia y cumplimiento. Inventario alto de refacciones rápidas. Servicio 24/7. Calibraciones PROFECO mar.
- **Q2 (abr-jun)** — Modo venta consultiva. Visitar gaseras grandes con propuestas de renovación. Capacitación NOM-259. Promociones por volumen en equipos nuevos.
- **Q3 (jul-sep)** — Modo instalación masiva. Agendar instalaciones del Q2. Aprovechar baja operativa. Calibraciones PROFECO sept.
- **Q4 (oct-dic)** — Modo preventivo y emergencia. Stock alto de SKU crítico. Kit pre-invierno. Cierre y cobranza agresiva.
