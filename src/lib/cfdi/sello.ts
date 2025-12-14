/**
 * Modulo de Firma Digital para CFDI
 * Maneja la lectura de certificados CSD y la generacion del sello digital
 */

import forge from 'node-forge'
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { getFinkokConfig, CSD_PRUEBAS } from '../config/finkok'

export interface CertificadoInfo {
  noCertificado: string
  certificadoBase64: string
  rfc: string
  nombre: string
  vigenciaInicio: Date
  vigenciaFin: Date
  esValido: boolean
}

export interface ResultadoFirma {
  success: boolean
  sello?: string
  noCertificado?: string
  certificadoBase64?: string
  error?: string
}

/**
 * Obtiene la ruta de los certificados segun el ambiente
 */
function getRutaCertificados(): string {
  const config = getFinkokConfig()
  if (config.environment === 'demo') {
    // Certificados de prueba del SAT
    return path.join(process.cwd(), 'public', 'csd-pruebas')
  }
  // Certificados de produccion (carpeta privada)
  return path.join(process.cwd(), 'private', 'csd')
}

/**
 * Obtiene el password del certificado segun el ambiente
 */
function getPasswordCSD(): string {
  const config = getFinkokConfig()
  if (config.environment === 'demo') {
    return CSD_PRUEBAS.password
  }
  // En produccion, usar variable de entorno
  return process.env.CSD_PASSWORD || ''
}

/**
 * Lee y parsea un certificado .cer (formato DER)
 */
export function leerCertificado(rutaCer: string): CertificadoInfo {
  if (!existsSync(rutaCer)) {
    throw new Error(`No se encontro el certificado: ${rutaCer}`)
  }

  // Leer archivo binario (DER)
  const cerBuffer = readFileSync(rutaCer)

  // Convertir DER a PEM
  const cerBase64 = cerBuffer.toString('base64')
  const cerPem = `-----BEGIN CERTIFICATE-----\n${cerBase64.match(/.{1,64}/g)?.join('\n')}\n-----END CERTIFICATE-----`

  // Parsear certificado
  const cert = forge.pki.certificateFromPem(cerPem)

  // Extraer numero de certificado (20 digitos del serial)
  const serialHex = cert.serialNumber
  // El numero de certificado son los ultimos 20 caracteres del serial en hex
  const noCertificado = serialHex.replace(/^0+/, '').slice(-20).padStart(20, '0')

  // Extraer datos del subject
  const subjectAttrs = cert.subject.attributes
  const rfcAttr = subjectAttrs.find(
    (attr) =>
      attr.shortName === 'serialNumber' ||
      attr.shortName === '2.5.4.45' ||
      attr.name === 'uniqueIdentifier'
  )
  const nombreAttr = subjectAttrs.find(
    (attr) => attr.shortName === 'CN' || attr.name === 'commonName'
  )

  // Extraer RFC (formato: RFC / CURP)
  let rfc = ''
  if (rfcAttr && typeof rfcAttr.value === 'string') {
    const match = rfcAttr.value.match(/^([A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3})/)
    rfc = match ? match[1] : rfcAttr.value.slice(0, 13)
  }

  // Verificar vigencia
  const ahora = new Date()
  const esValido =
    ahora >= cert.validity.notBefore && ahora <= cert.validity.notAfter

  return {
    noCertificado,
    certificadoBase64: cerBase64,
    rfc,
    nombre: (nombreAttr?.value as string) || '',
    vigenciaInicio: cert.validity.notBefore,
    vigenciaFin: cert.validity.notAfter,
    esValido,
  }
}

/**
 * Lee y desencripta una llave privada .key (formato DER encriptado)
 */
export function leerLlavePrivada(
  rutaKey: string,
  password: string
): forge.pki.rsa.PrivateKey {
  if (!existsSync(rutaKey)) {
    throw new Error(`No se encontro la llave privada: ${rutaKey}`)
  }

  // Leer archivo binario
  const keyBuffer = readFileSync(rutaKey)

  // Convertir DER a base64
  const keyBase64 = keyBuffer.toString('base64')

  // Intentar como PKCS#8 encriptado
  try {
    // Decodificar DER a ASN.1
    const keyDer = forge.util.decode64(keyBase64)
    const asn1 = forge.asn1.fromDer(keyDer)

    // Desencriptar con password
    const privateKey = forge.pki.decryptRsaPrivateKey(
      forge.pki.encryptedPrivateKeyToPem(asn1),
      password
    )

    if (!privateKey) {
      throw new Error('No se pudo desencriptar la llave privada')
    }

    return privateKey as forge.pki.rsa.PrivateKey
  } catch {
    // Intentar otro metodo: PKCS#8 encrypted info
    try {
      const keyDer = forge.util.decode64(keyBase64)
      const asn1 = forge.asn1.fromDer(keyDer)

      // Convertir a PEM encriptado
      const pem = forge.pki.encryptedPrivateKeyToPem(asn1)

      // Desencriptar
      const privateKey = forge.pki.decryptRsaPrivateKey(pem, password)

      if (!privateKey) {
        throw new Error('Password incorrecto o llave privada invalida')
      }

      return privateKey as forge.pki.rsa.PrivateKey
    } catch (e) {
      throw new Error(
        `Error al leer la llave privada: ${e instanceof Error ? e.message : 'Error desconocido'}`
      )
    }
  }
}

/**
 * Genera el sello digital de una cadena original usando SHA256
 */
export function generarSello(
  cadenaOriginal: string,
  llavePrivada: forge.pki.rsa.PrivateKey
): string {
  // Crear hash SHA256 de la cadena original
  const md = forge.md.sha256.create()
  md.update(cadenaOriginal, 'utf8')

  // Firmar con la llave privada (RSASSA-PKCS1-v1_5)
  const signature = llavePrivada.sign(md)

  // Convertir a base64
  const selloBase64 = forge.util.encode64(signature)

  return selloBase64
}

/**
 * Firma un XML CFDI con los certificados configurados
 */
export async function firmarCFDI(
  xmlSinFirmar: string,
  cadenaOriginal: string
): Promise<ResultadoFirma> {
  try {
    const config = getFinkokConfig()
    const rutaBase = getRutaCertificados()
    const password = getPasswordCSD()

    // Determinar nombre de archivos segun ambiente
    let nombreArchivo: string
    if (config.environment === 'demo') {
      nombreArchivo = CSD_PRUEBAS.rfc
    } else {
      // En produccion, usar RFC de la empresa configurado
      nombreArchivo = process.env.EMPRESA_RFC || 'certificado'
    }

    const rutaCer = path.join(rutaBase, `${nombreArchivo}.cer`)
    const rutaKey = path.join(rutaBase, `${nombreArchivo}.key`)

    // Verificar que existan los archivos
    if (!existsSync(rutaCer)) {
      return {
        success: false,
        error: `No se encontro el certificado .cer en: ${rutaCer}. Debes descargar los certificados de prueba del SAT.`,
      }
    }

    if (!existsSync(rutaKey)) {
      return {
        success: false,
        error: `No se encontro la llave .key en: ${rutaKey}. Debes descargar los certificados de prueba del SAT.`,
      }
    }

    // Leer certificado
    const certInfo = leerCertificado(rutaCer)

    if (!certInfo.esValido) {
      return {
        success: false,
        error: `El certificado ha expirado. Vigencia: ${certInfo.vigenciaInicio.toLocaleDateString()} - ${certInfo.vigenciaFin.toLocaleDateString()}`,
      }
    }

    // Leer llave privada
    const llavePrivada = leerLlavePrivada(rutaKey, password)

    // Generar sello
    const sello = generarSello(cadenaOriginal, llavePrivada)

    return {
      success: true,
      sello,
      noCertificado: certInfo.noCertificado,
      certificadoBase64: certInfo.certificadoBase64,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al firmar el CFDI',
    }
  }
}

/**
 * Verifica si los certificados estan configurados correctamente
 */
export function verificarCertificados(): {
  configurado: boolean
  mensaje: string
  detalles?: CertificadoInfo
} {
  try {
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

    if (!existsSync(rutaCer)) {
      return {
        configurado: false,
        mensaje: `Falta el archivo de certificado: ${rutaCer}`,
      }
    }

    if (!existsSync(rutaKey)) {
      return {
        configurado: false,
        mensaje: `Falta el archivo de llave privada: ${rutaKey}`,
      }
    }

    // Leer certificado para verificar
    const certInfo = leerCertificado(rutaCer)

    if (!certInfo.esValido) {
      return {
        configurado: false,
        mensaje: `El certificado ha expirado`,
        detalles: certInfo,
      }
    }

    return {
      configurado: true,
      mensaje: `Certificados configurados correctamente para: ${certInfo.rfc}`,
      detalles: certInfo,
    }
  } catch (error) {
    return {
      configurado: false,
      mensaje: error instanceof Error ? error.message : 'Error al verificar certificados',
    }
  }
}
