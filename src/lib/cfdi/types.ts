/**
 * Tipos TypeScript para CFDI 4.0
 * Basado en el estandar del SAT para Comprobantes Fiscales Digitales por Internet
 */

// === TIPOS PRINCIPALES DEL CFDI ===

export interface CFDIComprobante {
  Version: '4.0'
  Serie?: string
  Folio?: string
  Fecha: string // ISO 8601: YYYY-MM-DDTHH:MM:SS
  FormaPago?: string // Catalogo SAT c_FormaPago
  NoCertificado?: string
  Certificado?: string
  SubTotal: string // Decimal con 6 decimales
  Descuento?: string
  Moneda: 'MXN' | 'USD'
  TipoCambio?: string // Solo si Moneda != MXN
  Total: string
  TipoDeComprobante: 'I' | 'E' | 'T' | 'N' | 'P' // Ingreso, Egreso, Traslado, Nomina, Pago
  Exportacion: '01' | '02' | '03' | '04' // No aplica, Definitiva, Temporal, Objeto de impuesto
  MetodoPago?: 'PUE' | 'PPD'
  LugarExpedicion: string // Codigo postal
  Sello?: string
  Emisor: CFDIEmisor
  Receptor: CFDIReceptor
  Conceptos: CFDIConcepto[]
  Impuestos?: CFDIImpuestos
  Complemento?: CFDIComplemento
}

export interface CFDIEmisor {
  Rfc: string
  Nombre: string
  RegimenFiscal: string // Catalogo SAT c_RegimenFiscal
}

export interface CFDIReceptor {
  Rfc: string
  Nombre: string
  DomicilioFiscalReceptor: string // Codigo postal
  RegimenFiscalReceptor: string
  UsoCFDI: string // Catalogo SAT c_UsoCFDI
}

export interface CFDIConcepto {
  ClaveProdServ: string // Catalogo SAT c_ClaveProdServ
  NoIdentificacion?: string // SKU o codigo interno
  Cantidad: string
  ClaveUnidad: string // Catalogo SAT c_ClaveUnidad
  Unidad?: string // Descripcion de la unidad
  Descripcion: string
  ValorUnitario: string
  Importe: string
  Descuento?: string
  ObjetoImp: '01' | '02' | '03' | '04' // No objeto, Si objeto, Si objeto no desglosado, Si objeto no causa
  Impuestos?: CFDIConceptoImpuestos
}

export interface CFDIConceptoImpuestos {
  Traslados?: CFDIConceptoTraslado[]
  Retenciones?: CFDIConceptoRetencion[]
}

export interface CFDIConceptoTraslado {
  Base: string
  Impuesto: '002' | '003' // 002 = IVA, 003 = IEPS
  TipoFactor: 'Tasa' | 'Cuota' | 'Exento'
  TasaOCuota?: string // 0.160000 para 16%
  Importe?: string
}

export interface CFDIConceptoRetencion {
  Base: string
  Impuesto: '001' | '002' | '003' // 001 = ISR, 002 = IVA, 003 = IEPS
  TipoFactor: 'Tasa' | 'Cuota'
  TasaOCuota: string
  Importe: string
}

export interface CFDIImpuestos {
  TotalImpuestosTrasladados?: string
  TotalImpuestosRetenidos?: string
  Traslados?: CFDITraslado[]
  Retenciones?: CFDIRetencion[]
}

export interface CFDITraslado {
  Base: string
  Impuesto: '002' | '003'
  TipoFactor: 'Tasa' | 'Cuota' | 'Exento'
  TasaOCuota?: string
  Importe?: string
}

export interface CFDIRetencion {
  Impuesto: '001' | '002' | '003'
  Importe: string
}

export interface CFDIComplemento {
  TimbreFiscalDigital?: TimbreFiscalDigital
}

// === TIMBRE FISCAL DIGITAL ===

export interface TimbreFiscalDigital {
  Version: '1.1'
  UUID: string
  FechaTimbrado: string
  RfcProvCertif: string
  SelloCFD: string
  NoCertificadoSAT: string
  SelloSAT: string
}

// === TIPOS PARA FINKOK ===

export interface FinkokStampResponse {
  success: boolean
  uuid?: string
  xml?: string
  fecha_timbrado?: string
  certificado_sat?: string
  sello_cfdi?: string
  sello_sat?: string
  cadena_original?: string
  error?: string
  codigo_error?: string
}

export interface FinkokCancelResponse {
  success: boolean
  acuse?: string
  fecha_cancelacion?: string
  status?: string
  error?: string
  codigo_error?: string
}

export interface FinkokStatusResponse {
  success: boolean
  status?: 'Vigente' | 'Cancelado' | 'No Encontrado'
  fecha_cancelacion?: string
  es_cancelable?: boolean
  estado_cancelacion?: string
  error?: string
}

// === TIPOS PARA LA APLICACION ===

export interface DatosFacturaCFDI {
  id: string
  folio: string
  serie?: string
  fecha: string
  fecha_vencimiento?: string
  subtotal: number
  descuento_monto: number
  iva: number
  total: number
  moneda: 'MXN' | 'USD'
  tipo_cambio?: number
  forma_pago?: string
  metodo_pago?: 'PUE' | 'PPD'
  notas?: string
  // Datos del cliente
  cliente_rfc: string
  cliente_razon_social: string
  cliente_regimen_fiscal: string
  cliente_uso_cfdi: string
  cliente_codigo_postal: string
  // Items
  items: ItemFacturaCFDI[]
}

export interface ItemFacturaCFDI {
  sku?: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  descuento_porcentaje: number
  subtotal: number
  clave_prod_serv?: string // Clave SAT del producto
  clave_unidad?: string // Clave SAT de la unidad
  unidad?: string
}

export interface ResultadoTimbrado {
  success: boolean
  uuid?: string
  xml_timbrado?: string
  xml_sin_timbrar?: string
  fecha_timbrado?: string
  certificado_emisor?: string
  certificado_sat?: string
  sello_cfdi?: string
  sello_sat?: string
  cadena_original?: string
  error?: string
}

export interface ResultadoCancelacion {
  success: boolean
  acuse?: string
  fecha_cancelacion?: string
  error?: string
}

// === CONSTANTES DE CATALOGOS SAT ===

// Claves de producto/servicio mas comunes
export const CLAVES_PROD_SERV = {
  PRODUCTO_GENERAL: '01010101', // No existe en el catalogo
  SERVICIO_GENERAL: '80101500', // Servicios de consultoria de negocios
  EQUIPO_COMPUTO: '43211500', // Computadoras
  SOFTWARE: '43231500', // Software funcional
  ACCESORIOS: '43211700', // Accesorios de computadora
} as const

// Claves de unidad mas comunes
export const CLAVES_UNIDAD = {
  PIEZA: 'H87', // Pieza
  SERVICIO: 'E48', // Unidad de servicio
  ACTIVIDAD: 'ACT', // Actividad
  TRABAJO: 'E51', // Trabajo
  NO_APLICA: 'XNA', // No aplica
} as const
