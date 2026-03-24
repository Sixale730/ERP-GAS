// ─── Tipos ────────────────────────────────────────────────────────────────────

export type CategoriaReporte =
  | 'ventas_comercial'
  | 'cobranza'
  | 'punto_de_venta'
  | 'inventario'
  | 'compras'
  | 'fiscal_cfdi'
  | 'finanzas_estadisticas'

export interface CategoriaConfig {
  key: CategoriaReporte
  label: string
  icono: string
  color: string
  visible: (modulos: string[]) => boolean
}

export interface ReporteDefinition {
  key: string
  titulo: string
  descripcion: string
  icono: string
  iconColor: string
  ruta: string
  categoria: CategoriaReporte
  requiereModulo?: string
  requiereAlguno?: string[]
  requiereTodos?: string[]
  implementado: boolean
}

// ─── Categorías (orden de tabs) ───────────────────────────────────────────────

export const CATEGORIAS_CONFIG: CategoriaConfig[] = [
  {
    key: 'ventas_comercial',
    label: 'Ventas y Comercial',
    icono: 'BarChartOutlined',
    color: '#1890ff',
    visible: (m) => m.includes('facturas') || m.includes('pos') || m.includes('ordenes_venta'),
  },
  {
    key: 'cobranza',
    label: 'Cobranza',
    icono: 'DollarOutlined',
    color: '#13c2c2',
    visible: (m) => m.includes('facturas'),
  },
  {
    key: 'punto_de_venta',
    label: 'Punto de Venta',
    icono: 'ShopOutlined',
    color: '#fa8c16',
    visible: (m) => m.includes('pos'),
  },
  {
    key: 'inventario',
    label: 'Inventario',
    icono: 'InboxOutlined',
    color: '#52c41a',
    visible: () => true,
  },
  {
    key: 'compras',
    label: 'Compras',
    icono: 'ShoppingCartOutlined',
    color: '#eb2f96',
    visible: (m) => m.includes('compras'),
  },
  {
    key: 'fiscal_cfdi',
    label: 'Fiscal / CFDI',
    icono: 'AuditOutlined',
    color: '#f5222d',
    visible: (m) => m.includes('cfdi'),
  },
  {
    key: 'finanzas_estadisticas',
    label: 'Finanzas y Estadisticas',
    icono: 'FundOutlined',
    color: '#722ed1',
    visible: (m) => m.includes('facturas') || m.includes('pos'),
  },
]

// ─── Función de visibilidad ───────────────────────────────────────────────────

export function isReporteVisible(reporte: ReporteDefinition, modulosActivos: string[]): boolean {
  if (!reporte.implementado) return true // mostrar como "Próximamente"
  if (reporte.requiereTodos?.length) {
    if (!reporte.requiereTodos.every((m) => modulosActivos.includes(m))) return false
  }
  if (reporte.requiereAlguno?.length) {
    if (!reporte.requiereAlguno.some((m) => modulosActivos.includes(m))) return false
  }
  if (reporte.requiereModulo) {
    if (!modulosActivos.includes(reporte.requiereModulo)) return false
  }
  return true
}

/** Reportes no implementados solo se muestran si la categoría es visible para la org */
export function isReporteAccesible(reporte: ReporteDefinition, modulosActivos: string[]): boolean {
  if (!reporte.implementado) return false
  if (reporte.requiereTodos?.length) {
    if (!reporte.requiereTodos.every((m) => modulosActivos.includes(m))) return false
  }
  if (reporte.requiereAlguno?.length) {
    if (!reporte.requiereAlguno.some((m) => modulosActivos.includes(m))) return false
  }
  if (reporte.requiereModulo) {
    if (!modulosActivos.includes(reporte.requiereModulo)) return false
  }
  return true
}

// ─── Registro de todos los reportes ───────────────────────────────────────────

export const REPORTES_REGISTRY: ReporteDefinition[] = [
  // ── Existentes: Ventas y Comercial ────────────────────────────────────────
  {
    key: 'ordenes-venta',
    titulo: 'Ordenes de Venta',
    descripcion: 'Seguimiento de ordenes y cotizaciones',
    icono: 'ContainerOutlined',
    iconColor: '#1890ff',
    ruta: '/reportes/ordenes-venta',
    categoria: 'ventas_comercial',
    requiereModulo: 'ordenes_venta',
    implementado: true,
  },

  // ── Fase 1: Ventas y Comercial ────────────────────────────────────────────
  {
    key: 'ventas-cliente',
    titulo: 'Ventas por Cliente',
    descripcion: 'Volumen de ventas por cada cliente',
    icono: 'TeamOutlined',
    iconColor: '#1890ff',
    ruta: '/reportes/ventas-cliente',
    categoria: 'ventas_comercial',
    requiereAlguno: ['facturas', 'pos'],
    implementado: true,
  },
  {
    key: 'ventas-vendedor',
    titulo: 'Ventas por Vendedor',
    descripcion: 'Desempeno y ventas por vendedor',
    icono: 'UserOutlined',
    iconColor: '#52c41a',
    ruta: '/reportes/ventas-vendedor',
    categoria: 'ventas_comercial',
    requiereAlguno: ['facturas', 'pos'],
    implementado: true,
  },
  {
    key: 'ventas-categoria',
    titulo: 'Ventas por Categoria',
    descripcion: 'Distribucion de ventas por categoria de producto',
    icono: 'AppstoreOutlined',
    iconColor: '#722ed1',
    ruta: '/reportes/ventas-categoria',
    categoria: 'ventas_comercial',
    requiereAlguno: ['facturas', 'pos'],
    implementado: true,
  },

  // ── Fase 2: Ventas y Comercial ────────────────────────────────────────────
  {
    key: 'comparativo-ventas',
    titulo: 'Comparativo de Ventas',
    descripcion: 'Comparar ventas entre dos periodos',
    icono: 'SwapOutlined',
    iconColor: '#2f54eb',
    ruta: '/reportes/comparativo-ventas',
    categoria: 'ventas_comercial',
    requiereAlguno: ['facturas', 'pos'],
    implementado: false,
  },
  {
    key: 'conversion-cotizaciones',
    titulo: 'Conversion de Cotizaciones',
    descripcion: 'Tasa de conversion de cotizaciones a facturas',
    icono: 'FunnelPlotOutlined',
    iconColor: '#13c2c2',
    ruta: '/reportes/conversion-cotizaciones',
    categoria: 'ventas_comercial',
    requiereModulo: 'cotizaciones',
    implementado: false,
  },

  // ── Fase 3: Ventas y Comercial ────────────────────────────────────────────
  {
    key: 'devoluciones-cancelaciones',
    titulo: 'Devoluciones y Cancelaciones',
    descripcion: 'Registro de devoluciones, cancelaciones y notas de credito',
    icono: 'RollbackOutlined',
    iconColor: '#f5222d',
    ruta: '/reportes/devoluciones-cancelaciones',
    categoria: 'ventas_comercial',
    requiereAlguno: ['facturas', 'pos'],
    implementado: false,
  },

  // ── Existentes: Cobranza ──────────────────────────────────────────────────
  {
    key: 'facturas-saldos',
    titulo: 'Facturas y Saldos',
    descripcion: 'Estado de facturacion y cobranza',
    icono: 'FileTextOutlined',
    iconColor: '#13c2c2',
    ruta: '/reportes/facturas-saldos',
    categoria: 'cobranza',
    requiereModulo: 'facturas',
    implementado: true,
  },
  {
    key: 'cartera-vencida',
    titulo: 'Cartera Vencida',
    descripcion: 'Facturas vencidas por antiguedad',
    icono: 'ClockCircleOutlined',
    iconColor: '#f5222d',
    ruta: '/reportes/cartera-vencida',
    categoria: 'cobranza',
    requiereModulo: 'facturas',
    implementado: true,
  },

  // ── Fase 1: Cobranza ─────────────────────────────────────────────────────
  {
    key: 'estado-cuenta-cliente',
    titulo: 'Estado de Cuenta',
    descripcion: 'Estado de cuenta detallado por cliente',
    icono: 'SolutionOutlined',
    iconColor: '#1890ff',
    ruta: '/reportes/estado-cuenta-cliente',
    categoria: 'cobranza',
    requiereModulo: 'facturas',
    implementado: true,
  },
  {
    key: 'pagos-recibidos',
    titulo: 'Pagos Recibidos',
    descripcion: 'Detalle de pagos recibidos por periodo',
    icono: 'DollarOutlined',
    iconColor: '#52c41a',
    ruta: '/reportes/pagos-recibidos',
    categoria: 'cobranza',
    requiereModulo: 'facturas',
    implementado: true,
  },

  // ── Existentes: Punto de Venta ────────────────────────────────────────────
  {
    key: 'ventas-pos',
    titulo: 'Ventas del Periodo',
    descripcion: 'Ventas diarias con totales y tendencia',
    icono: 'BarChartOutlined',
    iconColor: '#1890ff',
    ruta: '/reportes/ventas-pos',
    categoria: 'punto_de_venta',
    requiereModulo: 'pos',
    implementado: true,
  },
  {
    key: 'ventas-forma-pago',
    titulo: 'Ventas por Forma de Pago',
    descripcion: 'Distribucion por metodo de pago',
    icono: 'CreditCardOutlined',
    iconColor: '#722ed1',
    ruta: '/reportes/ventas-forma-pago',
    categoria: 'punto_de_venta',
    requiereModulo: 'pos',
    implementado: true,
  },
  {
    key: 'cortes-caja',
    titulo: 'Cortes de Caja',
    descripcion: 'Resumen de turnos y diferencias',
    icono: 'ShopOutlined',
    iconColor: '#fa8c16',
    ruta: '/reportes/cortes-caja',
    categoria: 'punto_de_venta',
    requiereModulo: 'pos',
    implementado: true,
  },
  {
    key: 'productos-vendidos',
    titulo: 'Productos mas Vendidos',
    descripcion: 'Ranking de productos por unidades e importe',
    icono: 'TrophyOutlined',
    iconColor: '#faad14',
    ruta: '/reportes/productos-vendidos',
    categoria: 'punto_de_venta',
    requiereModulo: 'pos',
    implementado: true,
  },

  // ── Fase 3: Punto de Venta ────────────────────────────────────────────────
  {
    key: 'analisis-horarios',
    titulo: 'Analisis de Horarios',
    descripcion: 'Horas pico y patrones de venta por dia y hora',
    icono: 'FieldTimeOutlined',
    iconColor: '#fa8c16',
    ruta: '/reportes/analisis-horarios',
    categoria: 'punto_de_venta',
    requiereModulo: 'pos',
    implementado: false,
  },
  {
    key: 'productividad-cajero',
    titulo: 'Productividad por Cajero',
    descripcion: 'Rendimiento y ventas por cajero/vendedor',
    icono: 'IdcardOutlined',
    iconColor: '#eb2f96',
    ruta: '/reportes/productividad-cajero',
    categoria: 'punto_de_venta',
    requiereModulo: 'pos',
    implementado: false,
  },

  // ── Existentes: Inventario ────────────────────────────────────────────────
  {
    key: 'inventario',
    titulo: 'Inventario Actual',
    descripcion: 'Stock por almacen y nivel',
    icono: 'InboxOutlined',
    iconColor: '#52c41a',
    ruta: '/reportes/inventario',
    categoria: 'inventario',
    implementado: true,
  },
  {
    key: 'movimientos',
    titulo: 'Movimientos',
    descripcion: 'Entradas y salidas de inventario',
    icono: 'SwapOutlined',
    iconColor: '#2f54eb',
    ruta: '/reportes/movimientos',
    categoria: 'inventario',
    implementado: true,
  },
  {
    key: 'servicios',
    titulo: 'Servicios',
    descripcion: 'Consumo de servicios por periodo',
    icono: 'ToolOutlined',
    iconColor: '#595959',
    ruta: '/reportes/servicios',
    categoria: 'inventario',
    implementado: true,
  },

  // ── Fase 1: Inventario ────────────────────────────────────────────────────
  {
    key: 'valuacion-inventario',
    titulo: 'Valuacion de Inventario',
    descripcion: 'Valor monetario del stock a costo y precio venta',
    icono: 'AccountBookOutlined',
    iconColor: '#389e0d',
    ruta: '/reportes/valuacion-inventario',
    categoria: 'inventario',
    requiereModulo: 'inventario',
    implementado: true,
  },

  // ── Fase 2: Inventario ────────────────────────────────────────────────────
  {
    key: 'rotacion-inventario',
    titulo: 'Rotacion de Inventario',
    descripcion: 'Velocidad de rotacion y dias de inventario por producto',
    icono: 'SyncOutlined',
    iconColor: '#1890ff',
    ruta: '/reportes/rotacion-inventario',
    categoria: 'inventario',
    requiereModulo: 'inventario',
    implementado: false,
  },
  {
    key: 'productos-sin-movimiento',
    titulo: 'Productos Sin Movimiento',
    descripcion: 'Productos sin ventas ni salidas en X dias',
    icono: 'StopOutlined',
    iconColor: '#ff4d4f',
    ruta: '/reportes/productos-sin-movimiento',
    categoria: 'inventario',
    requiereModulo: 'inventario',
    implementado: false,
  },

  // ── Fase 3: Inventario ────────────────────────────────────────────────────
  {
    key: 'punto-reorden',
    titulo: 'Punto de Reorden',
    descripcion: 'Productos por debajo del minimo con sugerencia de compra',
    icono: 'AlertOutlined',
    iconColor: '#faad14',
    ruta: '/reportes/punto-reorden',
    categoria: 'inventario',
    requiereTodos: ['inventario', 'compras'],
    implementado: false,
  },
  {
    key: 'conciliacion-inventario',
    titulo: 'Conciliacion Fisica',
    descripcion: 'Comparar conteo fisico vs sistema para detectar diferencias',
    icono: 'ReconciliationOutlined',
    iconColor: '#595959',
    ruta: '/reportes/conciliacion-inventario',
    categoria: 'inventario',
    requiereModulo: 'inventario',
    implementado: false,
  },

  // ── Existentes: Compras ───────────────────────────────────────────────────
  {
    key: 'ordenes-compra',
    titulo: 'Ordenes de Compra',
    descripcion: 'Seguimiento de compras a proveedores',
    icono: 'ShoppingCartOutlined',
    iconColor: '#eb2f96',
    ruta: '/reportes/ordenes-compra',
    categoria: 'compras',
    requiereModulo: 'compras',
    implementado: true,
  },

  // ── Fase 2: Compras ──────────────────────────────────────────────────────
  {
    key: 'compras-proveedor',
    titulo: 'Compras por Proveedor',
    descripcion: 'Volumen de compras agrupado por proveedor',
    icono: 'TeamOutlined',
    iconColor: '#eb2f96',
    ruta: '/reportes/compras-proveedor',
    categoria: 'compras',
    requiereModulo: 'compras',
    implementado: false,
  },
  {
    key: 'historial-precios-compra',
    titulo: 'Historial de Precios de Compra',
    descripcion: 'Evolucion de precios de compra por producto y proveedor',
    icono: 'LineChartOutlined',
    iconColor: '#fa8c16',
    ruta: '/reportes/historial-precios-compra',
    categoria: 'compras',
    requiereModulo: 'compras',
    implementado: false,
  },

  // ── Fase 1: Fiscal / CFDI ────────────────────────────────────────────────
  {
    key: 'reporte-iva',
    titulo: 'Reporte de IVA',
    descripcion: 'IVA trasladado vs acreditable para declaracion mensual',
    icono: 'CalculatorOutlined',
    iconColor: '#f5222d',
    ruta: '/reportes/reporte-iva',
    categoria: 'fiscal_cfdi',
    requiereModulo: 'cfdi',
    implementado: true,
  },
  {
    key: 'cfdi-emitidos',
    titulo: 'CFDI Emitidos',
    descripcion: 'Facturas timbradas con UUID, status SAT y totales',
    icono: 'SafetyCertificateOutlined',
    iconColor: '#1890ff',
    ruta: '/reportes/cfdi-emitidos',
    categoria: 'fiscal_cfdi',
    requiereModulo: 'cfdi',
    implementado: true,
  },

  // ── Fase 3: Fiscal / CFDI ────────────────────────────────────────────────
  {
    key: 'diot',
    titulo: 'DIOT',
    descripcion: 'Declaracion informativa de operaciones con terceros',
    icono: 'FileProtectOutlined',
    iconColor: '#f5222d',
    ruta: '/reportes/diot',
    categoria: 'fiscal_cfdi',
    requiereTodos: ['cfdi', 'compras'],
    implementado: false,
  },
  {
    key: 'complementos-pago',
    titulo: 'Complementos de Pago',
    descripcion: 'Pagos PPD pendientes y emitidos como complemento',
    icono: 'FileDoneOutlined',
    iconColor: '#52c41a',
    ruta: '/reportes/complementos-pago',
    categoria: 'fiscal_cfdi',
    requiereModulo: 'cfdi',
    implementado: false,
  },

  // ── Existentes: Finanzas y Estadísticas ───────────────────────────────────
  {
    key: 'margen-utilidad',
    titulo: 'Margen de Utilidad',
    descripcion: 'Rentabilidad por producto',
    icono: 'PercentageOutlined',
    iconColor: '#389e0d',
    ruta: '/reportes/margen-utilidad',
    categoria: 'finanzas_estadisticas',
    implementado: true,
  },

  // ── Fase 2: Finanzas y Estadísticas ──────────────────────────────────────
  {
    key: 'abc-clientes',
    titulo: 'ABC de Clientes',
    descripcion: 'Clasificacion Pareto 80/20 de clientes por volumen',
    icono: 'TeamOutlined',
    iconColor: '#722ed1',
    ruta: '/reportes/abc-clientes',
    categoria: 'finanzas_estadisticas',
    requiereAlguno: ['facturas', 'pos'],
    implementado: false,
  },
  {
    key: 'abc-productos',
    titulo: 'ABC de Productos',
    descripcion: 'Clasificacion Pareto 80/20 de productos por ingreso',
    icono: 'GoldOutlined',
    iconColor: '#faad14',
    ruta: '/reportes/abc-productos',
    categoria: 'finanzas_estadisticas',
    requiereAlguno: ['facturas', 'pos'],
    implementado: false,
  },

  // ── Fase 3: Finanzas y Estadísticas ──────────────────────────────────────
  {
    key: 'flujo-efectivo',
    titulo: 'Flujo de Efectivo',
    descripcion: 'Ingresos vs egresos y flujo neto por periodo',
    icono: 'FundOutlined',
    iconColor: '#1890ff',
    ruta: '/reportes/flujo-efectivo',
    categoria: 'finanzas_estadisticas',
    requiereModulo: 'facturas',
    implementado: false,
  },
  {
    key: 'estado-resultados',
    titulo: 'Estado de Resultados',
    descripcion: 'Ingresos, costos y utilidad bruta simplificada',
    icono: 'FileTextOutlined',
    iconColor: '#722ed1',
    ruta: '/reportes/estado-resultados',
    categoria: 'finanzas_estadisticas',
    requiereModulo: 'facturas',
    implementado: false,
  },
]
