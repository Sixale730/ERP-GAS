/**
 * Configuracion de Finkok PAC para timbrado CFDI
 *
 * IMPORTANTE: Para usar el servicio de timbrado, debes:
 * 1. Crear una cuenta en https://demo-facturacion.finkok.com/ (gratis para pruebas)
 * 2. Agregar tus credenciales en .env.local
 *
 * Variables de entorno requeridas:
 * - FINKOK_USER: Tu usuario de Finkok
 * - FINKOK_PASSWORD: Tu password de Finkok
 * - FINKOK_ENVIRONMENT: 'demo' o 'production'
 */

export type FinkokEnvironment = 'demo' | 'production'

export interface FinkokConfig {
  user: string
  password: string
  environment: FinkokEnvironment
  urls: {
    stamp: string
    cancel: string
    utilities: string
  }
}

// URLs de los web services de Finkok
const FINKOK_URLS = {
  demo: {
    stamp: 'https://demo-facturacion.finkok.com/servicios/soap/stamp.wsdl',
    cancel: 'https://demo-facturacion.finkok.com/servicios/soap/cancel.wsdl',
    utilities: 'https://demo-facturacion.finkok.com/servicios/soap/utilities.wsdl',
  },
  production: {
    stamp: 'https://facturacion.finkok.com/servicios/soap/stamp.wsdl',
    cancel: 'https://facturacion.finkok.com/servicios/soap/cancel.wsdl',
    utilities: 'https://facturacion.finkok.com/servicios/soap/utilities.wsdl',
  },
}

// Certificados de prueba del SAT (para ambiente demo)
export const CSD_PRUEBAS = {
  rfc: 'EKU9003173C9',
  nombre: 'ESCUELA KEMPER URGATE SA DE CV',
  regimenFiscal: '601',
  codigoPostal: '21000',
  password: '12345678a',
  // Los certificados .cer y .key deben descargarse del SAT
  // y colocarse en public/csd-pruebas/
}

// Motivos de cancelacion segun SAT
export const MOTIVOS_CANCELACION = {
  '01': 'Comprobante emitido con errores con relacion',
  '02': 'Comprobante emitido con errores sin relacion',
  '03': 'No se llevo a cabo la operacion',
  '04': 'Operacion nominativa relacionada en una factura global',
} as const

export type MotivoCancelacion = keyof typeof MOTIVOS_CANCELACION

/**
 * Obtiene la configuracion de Finkok desde variables de entorno
 */
export function getFinkokConfig(): FinkokConfig {
  const environment = (process.env.FINKOK_ENVIRONMENT || 'demo') as FinkokEnvironment

  return {
    user: process.env.FINKOK_USER || '',
    password: process.env.FINKOK_PASSWORD || '',
    environment,
    urls: FINKOK_URLS[environment],
  }
}

/**
 * Verifica si las credenciales de Finkok estan configuradas
 */
export function isFinkokConfigured(): boolean {
  const config = getFinkokConfig()
  return Boolean(config.user && config.password)
}

/**
 * Obtiene mensaje de error si Finkok no esta configurado
 */
export function getFinkokConfigError(): string | null {
  const config = getFinkokConfig()

  if (!config.user) {
    return 'Falta configurar FINKOK_USER en variables de entorno'
  }

  if (!config.password) {
    return 'Falta configurar FINKOK_PASSWORD en variables de entorno'
  }

  return null
}
