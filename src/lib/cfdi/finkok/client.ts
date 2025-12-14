/**
 * Cliente SOAP para Finkok PAC
 * Maneja la conexion con los web services de Finkok
 */

import * as soap from 'soap'
import { getFinkokConfig, FinkokConfig } from '../../config/finkok'

// Cache de clientes SOAP
const clientCache: Map<string, soap.Client> = new Map()

/**
 * Crea o recupera un cliente SOAP para un endpoint
 */
export async function getSOAPClient(endpoint: string): Promise<soap.Client> {
  // Verificar cache
  if (clientCache.has(endpoint)) {
    return clientCache.get(endpoint)!
  }

  try {
    // Crear cliente SOAP
    const client = await soap.createClientAsync(endpoint, {
      wsdl_options: {
        timeout: 30000,
      },
    })

    // Configurar timeout
    client.setEndpoint(endpoint.replace('.wsdl', ''))

    // Guardar en cache
    clientCache.set(endpoint, client)

    return client
  } catch (error) {
    throw new Error(
      `Error al conectar con Finkok: ${error instanceof Error ? error.message : 'Error de conexion'}`
    )
  }
}

/**
 * Limpia el cache de clientes SOAP
 */
export function clearClientCache(): void {
  clientCache.clear()
}

/**
 * Obtiene la configuracion actual de Finkok
 */
export function getConfig(): FinkokConfig {
  return getFinkokConfig()
}

/**
 * Verifica la conexion con Finkok
 */
export async function verificarConexion(): Promise<{
  success: boolean
  ambiente: string
  mensaje: string
}> {
  try {
    const config = getFinkokConfig()

    if (!config.user || !config.password) {
      return {
        success: false,
        ambiente: config.environment,
        mensaje:
          'Faltan credenciales de Finkok. Configura FINKOK_USER y FINKOK_PASSWORD en .env.local',
      }
    }

    // Intentar crear cliente
    const client = await getSOAPClient(config.urls.stamp)

    // Verificar que el cliente tenga los metodos esperados
    const methods = client.describe()
    const hasStamp =
      methods.StampService?.StampPort?.stamp ||
      methods.StampService?.StampPort?.quick_stamp

    if (!hasStamp) {
      return {
        success: false,
        ambiente: config.environment,
        mensaje: 'El servicio de Finkok no responde correctamente',
      }
    }

    return {
      success: true,
      ambiente: config.environment,
      mensaje: `Conexion exitosa con Finkok (${config.environment})`,
    }
  } catch (error) {
    return {
      success: false,
      ambiente: getFinkokConfig().environment,
      mensaje: error instanceof Error ? error.message : 'Error de conexion',
    }
  }
}

/**
 * Parsea errores de respuesta de Finkok
 */
export function parseFinkokError(response: unknown): string {
  if (!response) {
    return 'Respuesta vacia del servidor'
  }

  // Estructura tipica de error de Finkok
  interface FinkokErrorResponse {
    Incidencias?: {
      Incidencia?: Array<{
        CodigoError?: string
        MensajeIncidencia?: string
      }> | {
        CodigoError?: string
        MensajeIncidencia?: string
      }
    }
    error?: string
    message?: string
  }

  const resp = response as FinkokErrorResponse

  // Revisar incidencias
  if (resp.Incidencias?.Incidencia) {
    const incidencias = Array.isArray(resp.Incidencias.Incidencia)
      ? resp.Incidencias.Incidencia
      : [resp.Incidencias.Incidencia]

    const mensajes = incidencias
      .map((inc) => `[${inc.CodigoError}] ${inc.MensajeIncidencia}`)
      .join('; ')

    return mensajes || 'Error desconocido'
  }

  // Otros formatos de error
  if (resp.error) {
    return resp.error
  }

  if (resp.message) {
    return resp.message
  }

  return 'Error desconocido en la respuesta'
}

/**
 * Extrae el UUID de un XML timbrado
 */
export function extraerUUID(xmlTimbrado: string): string | null {
  // Buscar UUID en el TimbreFiscalDigital
  const match = xmlTimbrado.match(/UUID="([A-Fa-f0-9-]{36})"/i)
  return match ? match[1].toUpperCase() : null
}

/**
 * Extrae el sello del SAT de un XML timbrado
 */
export function extraerSelloSAT(xmlTimbrado: string): string | null {
  const match = xmlTimbrado.match(/SelloSAT="([^"]+)"/)
  return match ? match[1] : null
}

/**
 * Extrae el numero de certificado del SAT de un XML timbrado
 */
export function extraerNoCertificadoSAT(xmlTimbrado: string): string | null {
  const match = xmlTimbrado.match(/NoCertificadoSAT="([^"]+)"/)
  return match ? match[1] : null
}

/**
 * Extrae la fecha de timbrado de un XML
 */
export function extraerFechaTimbrado(xmlTimbrado: string): string | null {
  const match = xmlTimbrado.match(/FechaTimbrado="([^"]+)"/)
  return match ? match[1] : null
}

/**
 * Extrae la cadena original del TFD
 */
export function extraerCadenaOriginalTFD(xmlTimbrado: string): string | null {
  // Buscar el nodo TimbreFiscalDigital
  const tfdMatch = xmlTimbrado.match(/<tfd:TimbreFiscalDigital([^>]+)\/>/)
  if (!tfdMatch) return null

  const tfd = tfdMatch[1]

  // Extraer atributos en orden
  const version = tfd.match(/Version="([^"]+)"/)?.[1] || '1.1'
  const uuid = tfd.match(/UUID="([^"]+)"/)?.[1] || ''
  const fechaTimbrado = tfd.match(/FechaTimbrado="([^"]+)"/)?.[1] || ''
  const rfcProvCertif = tfd.match(/RfcProvCertif="([^"]+)"/)?.[1] || ''
  const leyenda = tfd.match(/Leyenda="([^"]+)"/)?.[1] || ''
  const selloCFD = tfd.match(/SelloCFD="([^"]+)"/)?.[1] || ''
  const noCertificadoSAT = tfd.match(/NoCertificadoSAT="([^"]+)"/)?.[1] || ''

  // Construir cadena original
  const partes = [version, uuid, fechaTimbrado, rfcProvCertif]
  if (leyenda) partes.push(leyenda)
  partes.push(selloCFD, noCertificadoSAT)

  return `||${partes.join('|')}||`
}
