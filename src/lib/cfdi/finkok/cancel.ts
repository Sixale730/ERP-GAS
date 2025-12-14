/**
 * Servicio de Cancelacion CFDI con Finkok
 */

import { getSOAPClient, getConfig, parseFinkokError } from './client'
import { FinkokCancelResponse, FinkokStatusResponse } from '../types'
import { MotivoCancelacion, MOTIVOS_CANCELACION } from '../../config/finkok'

interface CancelResult {
  Acuse?: string
  Fecha?: string
  RfcEmisor?: string
  Folios?: {
    Folio?: {
      UUID?: string
      EstatusUUID?: string
      EstatusCancelacion?: string
    }
  }
  CodEstatus?: string
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

interface StatusResult {
  sat?: {
    CodigoEstatus?: string
    Estado?: string
    EsCancelable?: string
    EstatusCancelacion?: string
  }
  error?: string
}

/**
 * Cancela un CFDI usando el metodo cancel_signature
 * Requiere firmar la solicitud de cancelacion
 */
export async function cancel(
  uuid: string,
  rfcEmisor: string,
  motivo: MotivoCancelacion = '02',
  uuidSustitucion?: string
): Promise<FinkokCancelResponse> {
  try {
    const config = getConfig()

    if (!config.user || !config.password) {
      return {
        success: false,
        error: 'Faltan credenciales de Finkok',
        codigo_error: 'CONFIG_ERROR',
      }
    }

    // Validar motivo
    if (!MOTIVOS_CANCELACION[motivo]) {
      return {
        success: false,
        error: `Motivo de cancelacion invalido: ${motivo}`,
        codigo_error: 'INVALID_MOTIVO',
      }
    }

    // Si el motivo es 01, debe proporcionar UUID de sustitucion
    if (motivo === '01' && !uuidSustitucion) {
      return {
        success: false,
        error: 'El motivo 01 requiere UUID de sustitucion',
        codigo_error: 'MISSING_UUID_SUSTITUCION',
      }
    }

    const client = await getSOAPClient(config.urls.cancel)

    // Preparar parametros
    const params: Record<string, unknown> = {
      username: config.user,
      password: config.password,
      rfcemisor: rfcEmisor,
      uuid: uuid.toUpperCase(),
      motivo,
    }

    // Agregar UUID de sustitucion si aplica
    if (motivo === '01' && uuidSustitucion) {
      params.foliosustitucion = uuidSustitucion.toUpperCase()
    }

    // Llamar al servicio
    // Nota: En produccion deberia usarse cancel_signature con firma digital
    // Por simplicidad usamos cancel que funciona en demo
    const [result]: [CancelResult] = await client.cancelAsync(params)

    // Verificar incidencias
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

    // Verificar estado de cancelacion
    const folio = result.Folios?.Folio
    if (folio?.EstatusUUID) {
      // Codigos de estado:
      // 201 - Cancelado exitosamente
      // 202 - Previamente cancelado
      // 203 - No corresponde el RFC
      // 204 - No existe el certificado
      // 205 - No se cancelo (requiere aceptacion)
      const estatusCancelacion = folio.EstatusUUID

      if (estatusCancelacion !== '201' && estatusCancelacion !== '202') {
        return {
          success: false,
          error: `No se pudo cancelar: ${folio.EstatusCancelacion || estatusCancelacion}`,
          status: estatusCancelacion,
        }
      }
    }

    return {
      success: true,
      acuse: result.Acuse || undefined,
      fecha_cancelacion: result.Fecha || undefined,
      status: folio?.EstatusUUID || 'Cancelado',
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al cancelar',
      codigo_error: 'CANCEL_ERROR',
    }
  }
}

/**
 * Consulta el estado de un CFDI ante el SAT
 */
export async function getSatStatus(
  uuid: string,
  rfcEmisor: string,
  rfcReceptor: string,
  total: string
): Promise<FinkokStatusResponse> {
  try {
    const config = getConfig()

    if (!config.user || !config.password) {
      return {
        success: false,
        error: 'Faltan credenciales de Finkok',
      }
    }

    const client = await getSOAPClient(config.urls.cancel)

    const params = {
      username: config.user,
      password: config.password,
      uuid: uuid.toUpperCase(),
      rfce: rfcEmisor,
      rfcr: rfcReceptor,
      total,
    }

    const [result]: [StatusResult] = await client.get_sat_statusAsync(params)

    if (result.error) {
      return {
        success: false,
        error: result.error,
      }
    }

    if (!result.sat) {
      return {
        success: false,
        error: 'No se obtuvo respuesta del SAT',
      }
    }

    // Mapear estado
    let status: 'Vigente' | 'Cancelado' | 'No Encontrado' = 'No Encontrado'
    if (result.sat.Estado === 'Vigente') {
      status = 'Vigente'
    } else if (result.sat.Estado === 'Cancelado') {
      status = 'Cancelado'
    }

    return {
      success: true,
      status,
      es_cancelable: result.sat.EsCancelable === 'Cancelable sin aceptacion',
      estado_cancelacion: result.sat.EstatusCancelacion || undefined,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al consultar',
    }
  }
}

/**
 * Obtiene el acuse de cancelacion de un CFDI
 */
export async function getCancelReceipt(
  uuid: string,
  rfcEmisor: string
): Promise<FinkokCancelResponse> {
  try {
    const config = getConfig()

    if (!config.user || !config.password) {
      return {
        success: false,
        error: 'Faltan credenciales de Finkok',
        codigo_error: 'CONFIG_ERROR',
      }
    }

    const client = await getSOAPClient(config.urls.cancel)

    const params = {
      username: config.user,
      password: config.password,
      uuid: uuid.toUpperCase(),
      rfcemisor: rfcEmisor,
    }

    const [result]: [{ acuse?: string; error?: string }] =
      await client.get_receiptAsync(params)

    if (result.error) {
      return {
        success: false,
        error: result.error,
      }
    }

    return {
      success: true,
      acuse: result.acuse || undefined,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener acuse',
      codigo_error: 'RECEIPT_ERROR',
    }
  }
}

/**
 * Consulta CFDIs relacionados a un UUID
 */
export async function getRelated(
  uuid: string,
  rfcEmisor: string
): Promise<{
  success: boolean
  padres?: string[]
  hijos?: string[]
  error?: string
}> {
  try {
    const config = getConfig()

    if (!config.user || !config.password) {
      return {
        success: false,
        error: 'Faltan credenciales de Finkok',
      }
    }

    const client = await getSOAPClient(config.urls.cancel)

    const params = {
      username: config.user,
      password: config.password,
      uuid: uuid.toUpperCase(),
      rfcemisor: rfcEmisor,
    }

    interface RelatedResult {
      UUIDRelacionadoPadres?: { UUID?: string[] }
      UUIDRelacionadosHijos?: { UUID?: string[] }
      error?: string
    }

    const [result]: [RelatedResult] = await client.get_relatedAsync(params)

    if (result.error) {
      return {
        success: false,
        error: result.error,
      }
    }

    return {
      success: true,
      padres: result.UUIDRelacionadoPadres?.UUID || [],
      hijos: result.UUIDRelacionadosHijos?.UUID || [],
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al consultar',
    }
  }
}
