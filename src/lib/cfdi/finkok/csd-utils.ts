/**
 * Utilidades para manejar Certificados de Sello Digital (CSD)
 *
 * Permite leer archivos CSD del disco, convertirlos a Base64,
 * y cargarlos a Finkok para usar con el metodo sign_stamp.
 */

import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { editClient, getClient } from './registration'
import { CSD_PRUEBAS, getFinkokConfig } from '../../config/finkok'

export interface CSDArchivos {
  cer: string  // Contenido del .cer en Base64
  key: string  // Contenido del .key en Base64
}

export interface CargarCSDParams {
  taxpayer_id: string
  cerBase64: string
  keyBase64: string
  passphrase: string
}

export interface CargarCSDResult {
  success: boolean
  message: string
  error?: string
}

/**
 * Lee archivos CSD del disco y los convierte a Base64
 *
 * @param rutaCer - Ruta al archivo .cer
 * @param rutaKey - Ruta al archivo .key
 * @returns Contenido de los archivos en Base64
 *
 * @example
 * ```typescript
 * const { cer, key } = leerCSDArchivos('./certificado.cer', './llave.key')
 * ```
 */
export function leerCSDArchivos(rutaCer: string, rutaKey: string): CSDArchivos {
  if (!existsSync(rutaCer)) {
    throw new Error(`No se encontro el archivo de certificado: ${rutaCer}`)
  }

  if (!existsSync(rutaKey)) {
    throw new Error(`No se encontro el archivo de llave privada: ${rutaKey}`)
  }

  const cerBuffer = readFileSync(rutaCer)
  const keyBuffer = readFileSync(rutaKey)

  return {
    cer: cerBuffer.toString('base64'),
    key: keyBuffer.toString('base64'),
  }
}

/**
 * Convierte un archivo a Base64 desde un Buffer
 * Util para archivos subidos desde el frontend
 *
 * @param buffer - Buffer del archivo
 * @returns String en Base64
 */
export function bufferToBase64(buffer: Buffer): string {
  return buffer.toString('base64')
}

/**
 * Carga CSD a Finkok via API
 *
 * Los certificados se almacenan en Finkok asociados al RFC.
 * Esto permite usar el metodo sign_stamp para que Finkok firme.
 *
 * @param params - RFC, certificados en Base64 y passphrase
 * @returns Resultado de la operacion
 *
 * @example
 * ```typescript
 * const result = await cargarCSDaFinkok({
 *   taxpayer_id: 'AAA010101AAA',
 *   cerBase64: '...',
 *   keyBase64: '...',
 *   passphrase: '12345678a',
 * })
 * ```
 */
export async function cargarCSDaFinkok(params: CargarCSDParams): Promise<CargarCSDResult> {
  try {
    const result = await editClient({
      taxpayer_id: params.taxpayer_id,
      cer: params.cerBase64,
      key: params.keyBase64,
      passphrase: params.passphrase,
    })

    if (result.success) {
      return {
        success: true,
        message: `CSD cargados correctamente para ${params.taxpayer_id}`,
      }
    }

    return {
      success: false,
      message: result.message || 'Error al cargar CSD',
      error: result.error,
    }
  } catch (error) {
    return {
      success: false,
      message: 'Error al cargar CSD a Finkok',
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Carga los CSD de prueba del SAT a Finkok
 *
 * Usa los certificados de prueba ubicados en public/csd-pruebas/
 * RFC: EKU9003173C9, Password: 12345678a
 *
 * @returns Resultado de la operacion
 *
 * @example
 * ```typescript
 * const result = await cargarCSDPruebas()
 * if (result.success) {
 *   console.log('CSD de prueba cargados')
 * }
 * ```
 */
export async function cargarCSDPruebas(): Promise<CargarCSDResult> {
  try {
    const rutaBase = path.join(process.cwd(), 'public', 'csd-pruebas')
    const rutaCer = path.join(rutaBase, `${CSD_PRUEBAS.rfc}.cer`)
    const rutaKey = path.join(rutaBase, `${CSD_PRUEBAS.rfc}.key`)

    // Verificar que existan los archivos
    if (!existsSync(rutaCer) || !existsSync(rutaKey)) {
      return {
        success: false,
        message: 'No se encontraron los certificados de prueba',
        error: `Verifica que existan ${rutaCer} y ${rutaKey}`,
      }
    }

    // Leer archivos
    const { cer, key } = leerCSDArchivos(rutaCer, rutaKey)

    // Cargar a Finkok
    return await cargarCSDaFinkok({
      taxpayer_id: CSD_PRUEBAS.rfc,
      cerBase64: cer,
      keyBase64: key,
      passphrase: CSD_PRUEBAS.password,
    })
  } catch (error) {
    return {
      success: false,
      message: 'Error al cargar CSD de pruebas',
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Verifica si un RFC tiene CSD cargados en Finkok
 *
 * @param taxpayer_id - RFC a verificar
 * @returns true si tiene CSD cargados y activos
 *
 * @example
 * ```typescript
 * const tieneCSD = await verificarCSDEnFinkok('AAA010101AAA')
 * if (!tieneCSD) {
 *   console.log('Debes cargar los CSD primero')
 * }
 * ```
 */
export async function verificarCSDEnFinkok(taxpayer_id: string): Promise<boolean> {
  try {
    const result = await getClient(taxpayer_id)

    if (!result.success || !result.users || result.users.length === 0) {
      return false
    }

    // El cliente existe, pero no podemos saber si tiene CSD
    // sin intentar firmar. Asumimos que si esta activo, tiene CSD.
    const cliente = result.users[0]
    return cliente.status === 'A'
  } catch {
    return false
  }
}

/**
 * Obtiene la ruta de los certificados segun el ambiente
 */
export function getRutaCertificados(): string {
  const config = getFinkokConfig()
  if (config.environment === 'demo') {
    return path.join(process.cwd(), 'public', 'csd-pruebas')
  }
  return path.join(process.cwd(), 'private', 'csd')
}

/**
 * Verifica si los certificados locales estan disponibles
 */
export function certificadosLocalesDisponibles(): boolean {
  const config = getFinkokConfig()
  const rutaBase = getRutaCertificados()

  let nombreArchivo: string
  if (config.environment === 'demo') {
    nombreArchivo = CSD_PRUEBAS.rfc
  } else {
    nombreArchivo = process.env.EMPRESA_RFC || 'certificado'
  }

  const rutaCer = path.join(rutaBase, `${nombreArchivo}.cer`)
  const rutaKey = path.join(rutaBase, `${nombreArchivo}.key`)

  return existsSync(rutaCer) && existsSync(rutaKey)
}
