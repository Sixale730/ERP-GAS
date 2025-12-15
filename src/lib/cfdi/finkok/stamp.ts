/**
 * Servicio de Timbrado CFDI con Finkok
 */

import {
  getSOAPClient,
  getConfig,
  parseFinkokError,
  extraerUUID,
  extraerSelloSAT,
  extraerNoCertificadoSAT,
  extraerFechaTimbrado,
  extraerCadenaOriginalTFD,
} from './client'
import { FinkokStampResponse } from '../types'

interface StampResult {
  xml?: string
  UUID?: string
  Fecha?: string
  CodEstatus?: string
  SatSeal?: string
  NoCertificadoSAT?: string
  Incidencias?: {
    Incidencia?: Array<{
      CodigoError?: string
      MensajeIncidencia?: string
    }> | {
      CodigoError?: string
      MensajeIncidencia?: string
    }
  }
}

/**
 * Timbra un CFDI usando el metodo stamp de Finkok
 * Este metodo es mas lento pero mas confiable
 */
export async function stamp(xmlFirmado: string): Promise<FinkokStampResponse> {
  try {
    const config = getConfig()

    if (!config.user || !config.password) {
      return {
        success: false,
        error: 'Faltan credenciales de Finkok',
        codigo_error: 'CONFIG_ERROR',
      }
    }

    // Obtener cliente SOAP
    const client = await getSOAPClient(config.urls.stamp)

    // Preparar parametros
    const params = {
      username: config.user,
      password: config.password,
      xml: xmlFirmado,
    }

    // Llamar al servicio
    const [result]: [StampResult] = await client.stampAsync(params)

    // Verificar respuesta
    if (result.Incidencias?.Incidencia) {
      const error = parseFinkokError(result)
      return {
        success: false,
        error,
        codigo_error: Array.isArray(result.Incidencias.Incidencia)
          ? result.Incidencias.Incidencia[0]?.CodigoError
          : result.Incidencias.Incidencia?.CodigoError,
      }
    }

    // Extraer datos del XML timbrado
    const xmlTimbrado = result.xml || ''
    const uuid = result.UUID || extraerUUID(xmlTimbrado)
    const fechaTimbrado = result.Fecha || extraerFechaTimbrado(xmlTimbrado)
    const selloSAT = result.SatSeal || extraerSelloSAT(xmlTimbrado)
    const noCertificadoSAT =
      result.NoCertificadoSAT || extraerNoCertificadoSAT(xmlTimbrado)
    const cadenaOriginal = extraerCadenaOriginalTFD(xmlTimbrado)

    if (!uuid) {
      return {
        success: false,
        error: 'No se pudo obtener el UUID del timbrado',
        codigo_error: 'NO_UUID',
      }
    }

    return {
      success: true,
      uuid,
      xml: xmlTimbrado,
      fecha_timbrado: fechaTimbrado || undefined,
      certificado_sat: noCertificadoSAT || undefined,
      sello_sat: selloSAT || undefined,
      cadena_original: cadenaOriginal || undefined,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al timbrar',
      codigo_error: 'STAMP_ERROR',
    }
  }
}

/**
 * Timbra un CFDI usando el metodo quick_stamp de Finkok
 * Este metodo es mas rapido pero puede tener mayor tasa de error
 */
export async function quickStamp(
  xmlFirmado: string
): Promise<FinkokStampResponse> {
  try {
    const config = getConfig()

    if (!config.user || !config.password) {
      return {
        success: false,
        error: 'Faltan credenciales de Finkok',
        codigo_error: 'CONFIG_ERROR',
      }
    }

    const client = await getSOAPClient(config.urls.stamp)

    const params = {
      username: config.user,
      password: config.password,
      xml: xmlFirmado,
    }

    const [result]: [StampResult] = await client.quick_stampAsync(params)

    if (result.Incidencias?.Incidencia) {
      const error = parseFinkokError(result)
      return {
        success: false,
        error,
        codigo_error: Array.isArray(result.Incidencias.Incidencia)
          ? result.Incidencias.Incidencia[0]?.CodigoError
          : result.Incidencias.Incidencia?.CodigoError,
      }
    }

    const xmlTimbrado = result.xml || ''
    const uuid = result.UUID || extraerUUID(xmlTimbrado)
    const fechaTimbrado = result.Fecha || extraerFechaTimbrado(xmlTimbrado)
    const selloSAT = result.SatSeal || extraerSelloSAT(xmlTimbrado)
    const noCertificadoSAT =
      result.NoCertificadoSAT || extraerNoCertificadoSAT(xmlTimbrado)
    const cadenaOriginal = extraerCadenaOriginalTFD(xmlTimbrado)

    if (!uuid) {
      return {
        success: false,
        error: 'No se pudo obtener el UUID del timbrado',
        codigo_error: 'NO_UUID',
      }
    }

    return {
      success: true,
      uuid,
      xml: xmlTimbrado,
      fecha_timbrado: fechaTimbrado || undefined,
      certificado_sat: noCertificadoSAT || undefined,
      sello_sat: selloSAT || undefined,
      cadena_original: cadenaOriginal || undefined,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al timbrar',
      codigo_error: 'QUICK_STAMP_ERROR',
    }
  }
}

/**
 * Consulta si un CFDI fue previamente timbrado
 */
export async function stamped(xmlFirmado: string): Promise<FinkokStampResponse> {
  try {
    const config = getConfig()

    if (!config.user || !config.password) {
      return {
        success: false,
        error: 'Faltan credenciales de Finkok',
        codigo_error: 'CONFIG_ERROR',
      }
    }

    const client = await getSOAPClient(config.urls.stamp)

    const params = {
      username: config.user,
      password: config.password,
      xml: xmlFirmado,
    }

    const [result]: [StampResult] = await client.stampedAsync(params)

    if (result.Incidencias?.Incidencia) {
      const error = parseFinkokError(result)
      // El codigo 307 significa que no existe previamente (lo cual es esperado)
      const codigo = Array.isArray(result.Incidencias.Incidencia)
        ? result.Incidencias.Incidencia[0]?.CodigoError
        : result.Incidencias.Incidencia?.CodigoError

      if (codigo === '307') {
        return {
          success: false,
          error: 'El CFDI no ha sido timbrado previamente',
          codigo_error: '307',
        }
      }

      return {
        success: false,
        error,
        codigo_error: codigo,
      }
    }

    const xmlTimbrado = result.xml || ''
    const uuid = result.UUID || extraerUUID(xmlTimbrado)

    return {
      success: true,
      uuid: uuid || undefined,
      xml: xmlTimbrado || undefined,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al consultar',
      codigo_error: 'STAMPED_ERROR',
    }
  }
}

/**
 * Timbra un CFDI usando el metodo sign_stamp de Finkok
 *
 * Este metodo permite que Finkok firme el XML con los CSD que tiene almacenados.
 * El XML debe estar completo pero SIN los atributos Sello, Certificado y NoCertificado.
 *
 * IMPORTANTE: Para usar este metodo, los CSD deben estar cargados en el panel de Finkok
 * o via el metodo editClient() del servicio de Registration.
 *
 * @param xmlSinFirmar - XML del CFDI sin atributos de firma (sin Sello, Certificado, NoCertificado)
 * @returns Respuesta con el XML timbrado y firmado
 *
 * @example
 * ```typescript
 * // Primero cargar CSD a Finkok (solo una vez)
 * await editClient({ taxpayer_id: 'AAA010101AAA', cer, key, passphrase })
 *
 * // Luego timbrar con sign_stamp
 * const result = await signStamp(xmlSinFirmar)
 * ```
 */
export async function signStamp(xmlSinFirmar: string): Promise<FinkokStampResponse> {
  try {
    const config = getConfig()

    if (!config.user || !config.password) {
      return {
        success: false,
        error: 'Faltan credenciales de Finkok',
        codigo_error: 'CONFIG_ERROR',
      }
    }

    const client = await getSOAPClient(config.urls.stamp)

    const params = {
      username: config.user,
      password: config.password,
      xml: xmlSinFirmar,
    }

    // Llamar al metodo sign_stamp de Finkok
    const [result]: [StampResult] = await client.sign_stampAsync(params)

    if (result.Incidencias?.Incidencia) {
      const error = parseFinkokError(result)
      const codigo = Array.isArray(result.Incidencias.Incidencia)
        ? result.Incidencias.Incidencia[0]?.CodigoError
        : result.Incidencias.Incidencia?.CodigoError

      // Error 720: RFC del Emisor no tiene Certificado Activo
      if (codigo === '720') {
        return {
          success: false,
          error: 'El RFC emisor no tiene CSD cargados en Finkok. Carga los certificados primero.',
          codigo_error: '720',
        }
      }

      return {
        success: false,
        error,
        codigo_error: codigo,
      }
    }

    const xmlTimbrado = result.xml || ''
    const uuid = result.UUID || extraerUUID(xmlTimbrado)
    const fechaTimbrado = result.Fecha || extraerFechaTimbrado(xmlTimbrado)
    const selloSAT = result.SatSeal || extraerSelloSAT(xmlTimbrado)
    const noCertificadoSAT =
      result.NoCertificadoSAT || extraerNoCertificadoSAT(xmlTimbrado)
    const cadenaOriginal = extraerCadenaOriginalTFD(xmlTimbrado)

    if (!uuid) {
      return {
        success: false,
        error: 'No se pudo obtener el UUID del timbrado',
        codigo_error: 'NO_UUID',
      }
    }

    return {
      success: true,
      uuid,
      xml: xmlTimbrado,
      fecha_timbrado: fechaTimbrado || undefined,
      certificado_sat: noCertificadoSAT || undefined,
      sello_sat: selloSAT || undefined,
      cadena_original: cadenaOriginal || undefined,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al timbrar con sign_stamp',
      codigo_error: 'SIGN_STAMP_ERROR',
    }
  }
}

/**
 * Timbra un CFDI intentando primero quick_stamp y luego stamp si falla
 */
export async function timbrar(xmlFirmado: string): Promise<FinkokStampResponse> {
  // Intentar quick_stamp primero (mas rapido)
  let resultado = await quickStamp(xmlFirmado)

  // Si falla con error de conexion o timeout, intentar stamp normal
  if (
    !resultado.success &&
    (resultado.codigo_error === 'QUICK_STAMP_ERROR' ||
      resultado.error?.includes('timeout') ||
      resultado.error?.includes('ECONNREFUSED'))
  ) {
    resultado = await stamp(xmlFirmado)
  }

  // Si el error es que ya esta timbrado, intentar recuperar
  if (!resultado.success && resultado.codigo_error === '307') {
    resultado = await stamped(xmlFirmado)
  }

  return resultado
}
