/**
 * Generador de Cadena Original usando XSLT
 *
 * Usa el XSLT oficial del SAT para generar la cadena original
 * a partir del XML del CFDI. Esto garantiza que la cadena
 * sea exactamente igual a la que el SAT espera.
 */

import { Xslt, XmlParser } from 'xslt-processor'
import { readFileSync } from 'fs'
import path from 'path'

// Cache del XSLT para no leerlo en cada llamada
let xsltCache: string | null = null

/**
 * Obtiene el contenido del XSLT, usando cache
 * En desarrollo, siempre recarga el archivo para detectar cambios
 */
function getXsltContent(): string {
  // En desarrollo, no usar cache para detectar cambios
  if (process.env.NODE_ENV === 'development' || !xsltCache) {
    const xsltPath = path.join(process.cwd(), 'public', 'xslt', 'cadenaoriginal_4_0.xslt')
    xsltCache = readFileSync(xsltPath, 'utf-8')
  }
  return xsltCache
}

/**
 * Elimina los prefijos de namespace y declaraciones xmlns del XML
 * Esto permite que el XSLT funcione con xslt-processor que no maneja bien namespaces
 */
function stripNamespaces(xml: string): string {
  // Eliminar prefijos de elementos: <cfdi:Comprobante -> <Comprobante, </cfdi:Comprobante -> </Comprobante
  let result = xml.replace(/<(\/?)cfdi:/g, '<$1')

  // Eliminar declaraciones xmlns
  result = result.replace(/\s+xmlns:cfdi="[^"]*"/g, '')
  result = result.replace(/\s+xmlns:xsi="[^"]*"/g, '')
  result = result.replace(/\s+xsi:schemaLocation="[^"]*"/g, '')

  return result
}

/**
 * Genera la cadena original de un XML CFDI usando XSLT
 *
 * @param xmlCfdi - XML del CFDI (debe tener NoCertificado y Certificado, pero Sello puede estar vacio)
 * @returns Cadena original en formato ||campo1|campo2|...|campoN||
 *
 * @example
 * ```typescript
 * const cadena = await generarCadenaOriginalXSLT(xmlSinSello)
 * // Returns: ||4.0|A|123|2025-01-01T12:00:00|...|16.00||
 * ```
 */
export async function generarCadenaOriginalXSLT(xmlCfdi: string): Promise<string> {
  try {
    const xsltContent = getXsltContent()

    // Eliminar namespaces del XML para compatibilidad con xslt-processor
    const xmlSinNamespaces = stripNamespaces(xmlCfdi)

    const xslt = new Xslt()
    const xmlParser = new XmlParser()

    // Parsear XML (sin namespaces) y XSLT
    const xmlDoc = xmlParser.xmlParse(xmlSinNamespaces)
    const xslDoc = xmlParser.xmlParse(xsltContent)

    // Aplicar transformacion XSLT (es async)
    let cadenaOriginal = await xslt.xsltProcess(xmlDoc, xslDoc)

    // Limpiar espacios en blanco y saltos de linea
    cadenaOriginal = cadenaOriginal.trim()

    // La cadena debe empezar y terminar con ||
    if (!cadenaOriginal.startsWith('||')) {
      cadenaOriginal = '||' + cadenaOriginal
    }
    if (!cadenaOriginal.endsWith('||')) {
      // Remover el ultimo pipe si existe y agregar doble pipe
      if (cadenaOriginal.endsWith('|')) {
        cadenaOriginal = cadenaOriginal + '|'
      } else {
        cadenaOriginal = cadenaOriginal + '||'
      }
    }

    return cadenaOriginal
  } catch (error) {
    throw new Error(
      `Error al generar cadena original: ${error instanceof Error ? error.message : 'Error desconocido'}`
    )
  }
}

/**
 * Limpia el cache del XSLT (util para testing)
 */
export function clearXsltCache(): void {
  xsltCache = null
}
