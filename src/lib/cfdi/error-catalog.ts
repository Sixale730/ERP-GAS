/**
 * Catalogo de errores CFDI con mensajes legibles y acciones sugeridas.
 * Basado en codigos de error del SAT y Finkok.
 */

// === CATALOGO DE USO CFDI ===

export const USO_CFDI_CATALOG: Record<string, string> = {
  G01: 'Adquisicion de mercancias',
  G02: 'Devoluciones, descuentos o bonificaciones',
  G03: 'Gastos en general',
  I01: 'Construcciones',
  I02: 'Mobiliario y equipo de oficina',
  I03: 'Equipo de transporte',
  I04: 'Equipo de computo y accesorios',
  I05: 'Dados, troqueles, moldes, matrices y herramental',
  I06: 'Comunicaciones telefonicas',
  I07: 'Comunicaciones satelitales',
  I08: 'Otra maquinaria y equipo',
  D01: 'Honorarios medicos, dentales y gastos hospitalarios',
  D02: 'Gastos medicos por incapacidad o discapacidad',
  D03: 'Gastos funerales',
  D04: 'Donativos',
  D05: 'Intereses reales efectivamente pagados por creditos hipotecarios',
  D06: 'Aportaciones voluntarias al SAR',
  D07: 'Primas por seguros de gastos medicos',
  D08: 'Gastos de transportacion escolar obligatoria',
  D09: 'Depositos en cuentas para el ahorro, primas de pensiones',
  D10: 'Pagos por servicios educativos (colegiaturas)',
  S01: 'Sin efectos fiscales',
  CP01: 'Pagos',
  CN01: 'Nomina',
}

/**
 * Matriz de compatibilidad UsoCFDI por Regimen Fiscal (Anexo 20 SAT)
 */
export const USOCFDI_POR_REGIMEN: Record<string, string[]> = {
  '601': ['G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10', 'S01', 'CP01'],
  '603': ['G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'S01', 'CP01'],
  '605': ['G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'S01', 'CP01'],
  '606': ['G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'S01', 'CP01'],
  '607': ['G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10', 'S01', 'CP01'],
  '608': ['G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'S01', 'CP01'],
  '610': ['G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'S01', 'CP01'],
  '611': ['G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10', 'S01', 'CP01'],
  '612': ['G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10', 'S01', 'CP01'],
  '614': ['G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10', 'S01', 'CP01'],
  '616': ['G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'S01', 'CP01'],
  '620': ['G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'S01', 'CP01'],
  '621': ['G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'S01', 'CP01'],
  '622': ['G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'S01', 'CP01'],
  '623': ['G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'S01', 'CP01'],
  '624': ['G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'S01', 'CP01'],
  '625': ['G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10', 'S01', 'CP01'],
  '626': ['G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10', 'S01', 'CP01'],
}

/**
 * Retorna los UsoCFDI compatibles con un regimen fiscal
 */
export function getUsoCfdiCompatibles(regimenFiscal: string): { codigo: string; descripcion: string }[] {
  const codigos = USOCFDI_POR_REGIMEN[regimenFiscal] || ['G03', 'S01', 'CP01']
  return codigos.map(codigo => ({
    codigo,
    descripcion: USO_CFDI_CATALOG[codigo] || codigo,
  }))
}

// === CATALOGO DE ERRORES ===

export interface CfdiErrorInfo {
  titulo: string
  descripcion: string
  accion: string
  campo?: string
}

/**
 * Catalogo de errores conocidos de Finkok y SAT
 */
export const CFDI_ERROR_CATALOG: Record<string, CfdiErrorInfo> = {
  // Errores de estructura XML
  '301': {
    titulo: 'XML mal formado',
    descripcion: 'El documento XML no cumple con la estructura requerida por el SAT',
    accion: 'Contactar soporte tecnico',
  },
  '302': {
    titulo: 'Sello invalido',
    descripcion: 'La firma digital del comprobante no es valida',
    accion: 'Verificar que los CSD esten vigentes y correctamente configurados',
    campo: 'Sello',
  },
  '303': {
    titulo: 'Sello no corresponde',
    descripcion: 'El sello digital no corresponde con los datos del comprobante',
    accion: 'Regenerar el XML y volver a intentar',
  },
  '305': {
    titulo: 'Certificado revocado o caducado',
    descripcion: 'El Certificado de Sello Digital ha sido revocado o ya expiro',
    accion: 'Renovar los CSD en el portal del SAT y actualizarlos en la configuracion',
    campo: 'Certificado',
  },
  '307': {
    titulo: 'CFDI ya timbrado',
    descripcion: 'Este comprobante ya fue timbrado anteriormente con el mismo contenido',
    accion: 'Recuperar el UUID existente del timbrado anterior',
  },

  // Errores de validacion CFDI 4.0
  CFDI40102: {
    titulo: 'Fecha fuera de rango',
    descripcion: 'La fecha del comprobante esta fuera del rango permitido (72 horas)',
    accion: 'Verificar que la fecha del comprobante sea reciente',
    campo: 'Fecha',
  },
  CFDI40138: {
    titulo: 'Regimen fiscal incompatible',
    descripcion: 'El regimen fiscal del receptor no es compatible con el uso de CFDI seleccionado',
    accion: 'Verificar que el uso de CFDI sea compatible con el regimen fiscal del cliente',
    campo: 'UsoCFDI',
  },
  CFDI40161: {
    titulo: 'RFC del receptor invalido',
    descripcion: 'El RFC del receptor no esta registrado en la lista del SAT (LRFC)',
    accion: 'Verificar que el RFC del cliente sea correcto y este dado de alta en el SAT',
    campo: 'RFC',
  },

  // Errores de validacion CFDI 3.3 (algunos aun aplican)
  CFDI33101: {
    titulo: 'Certificado no vigente',
    descripcion: 'El certificado del emisor no esta vigente para la fecha del comprobante',
    accion: 'Renovar los CSD del emisor',
    campo: 'NoCertificado',
  },
  CFDI33102: {
    titulo: 'RFC del emisor no corresponde',
    descripcion: 'El RFC del emisor no corresponde con el certificado',
    accion: 'Verificar que el RFC del emisor coincida con los CSD configurados',
    campo: 'RFC Emisor',
  },
  CFDI33103: {
    titulo: 'Fecha fuera de vigencia del CSD',
    descripcion: 'La fecha del comprobante no esta dentro de la vigencia del certificado',
    accion: 'Verificar vigencia de los CSD o actualizar la fecha',
  },
  CFDI33105: {
    titulo: 'Codigo postal invalido',
    descripcion: 'El codigo postal del lugar de expedicion no existe en el catalogo del SAT',
    accion: 'Corregir el codigo postal del emisor en la configuracion',
    campo: 'LugarExpedicion',
  },
  CFDI33106: {
    titulo: 'Regimen fiscal invalido',
    descripcion: 'El regimen fiscal del emisor no corresponde con su tipo de RFC',
    accion: 'Verificar el regimen fiscal del emisor',
    campo: 'RegimenFiscal',
  },
  CFDI33111: {
    titulo: 'Clave de producto invalida',
    descripcion: 'La clave de producto/servicio no existe en el catalogo del SAT',
    accion: 'Corregir la clave de producto (ClaveProdServ) en los items de la factura',
    campo: 'ClaveProdServ',
  },
  CFDI33112: {
    titulo: 'Clave de unidad invalida',
    descripcion: 'La clave de unidad no existe en el catalogo del SAT',
    accion: 'Corregir la clave de unidad (ClaveUnidad) en los items de la factura',
    campo: 'ClaveUnidad',
  },

  // Errores de Finkok
  '705': {
    titulo: 'Usuario no autorizado',
    descripcion: 'Las credenciales de Finkok no son validas o el servicio esta suspendido',
    accion: 'Verificar las credenciales de Finkok en la configuracion',
  },
  '720': {
    titulo: 'CSD no registrados en Finkok',
    descripcion: 'No hay Certificados de Sello Digital activos para este RFC en Finkok',
    accion: 'Cargar los CSD del emisor en la seccion de configuracion CFDI',
    campo: 'CSD',
  },

  // Errores de complemento de pago
  PAGO10101: {
    titulo: 'UUID de documento invalido',
    descripcion: 'El UUID del documento relacionado no corresponde a un CFDI timbrado',
    accion: 'Verificar que la factura asociada este timbrada correctamente',
    campo: 'IdDocumento',
  },
  PAGO10104: {
    titulo: 'Monto excede saldo',
    descripcion: 'El monto del pago excede el saldo pendiente del documento',
    accion: 'Verificar el saldo pendiente de la factura',
    campo: 'ImpPagado',
  },
}

// === FUNCIONES DE PARSEO ===

export interface ParsedCfdiError {
  codigo?: string
  info?: CfdiErrorInfo
  mensajeOriginal: string
}

/**
 * Extrae y parsea un error de CFDI de un mensaje de error
 * Los errores de Finkok/SAT vienen en formato [CODIGO] descripcion
 */
export function parsearErrorCfdi(errorMessage: string): ParsedCfdiError {
  if (!errorMessage) {
    return { mensajeOriginal: 'Error desconocido' }
  }

  // Intentar extraer codigo de error entre corchetes: [CFDI40161]
  const matchBracket = errorMessage.match(/\[([A-Z0-9]+)\]/)
  if (matchBracket) {
    const codigo = matchBracket[1]
    const info = CFDI_ERROR_CATALOG[codigo]
    return { codigo, info, mensajeOriginal: errorMessage }
  }

  // Intentar extraer codigo numerico al inicio: 301 - XML mal formado
  const matchNumeric = errorMessage.match(/^(\d{3})\s*[-:]?\s*/)
  if (matchNumeric) {
    const codigo = matchNumeric[1]
    const info = CFDI_ERROR_CATALOG[codigo]
    return { codigo, info, mensajeOriginal: errorMessage }
  }

  // Buscar por contenido del mensaje
  for (const [codigo, info] of Object.entries(CFDI_ERROR_CATALOG)) {
    if (errorMessage.toLowerCase().includes(info.titulo.toLowerCase())) {
      return { codigo, info, mensajeOriginal: errorMessage }
    }
  }

  return { mensajeOriginal: errorMessage }
}

/**
 * Genera una respuesta de error estructurada para el frontend
 */
export function generarRespuestaError(
  errorMessage: string,
  incidencias?: { CodigoError?: string; MensajeIncidencia?: string }[]
): { errores: (CfdiErrorInfo & { codigo: string })[]; sugerencias: string[]; mensajeOriginal: string } {
  const errores: (CfdiErrorInfo & { codigo: string })[] = []
  const sugerencias: string[] = []

  // Parsear incidencias de Finkok
  if (incidencias && incidencias.length > 0) {
    for (const inc of incidencias) {
      const codigo = inc.CodigoError || ''
      const info = CFDI_ERROR_CATALOG[codigo]
      if (info) {
        errores.push({ ...info, codigo })
        sugerencias.push(info.accion)
      } else {
        errores.push({
          codigo,
          titulo: `Error ${codigo}`,
          descripcion: inc.MensajeIncidencia || 'Error no catalogado',
          accion: 'Contactar soporte tecnico',
        })
      }
    }
  }

  // Si no hay incidencias, parsear el mensaje directo
  if (errores.length === 0) {
    const parsed = parsearErrorCfdi(errorMessage)
    if (parsed.info && parsed.codigo) {
      errores.push({ ...parsed.info, codigo: parsed.codigo })
      sugerencias.push(parsed.info.accion)
    } else {
      errores.push({
        codigo: 'UNKNOWN',
        titulo: 'Error de timbrado',
        descripcion: errorMessage,
        accion: 'Revisar los datos de la factura e intentar nuevamente',
      })
      sugerencias.push('Revisar los datos de la factura e intentar nuevamente')
    }
  }

  return {
    errores,
    sugerencias: Array.from(new Set(sugerencias)),
    mensajeOriginal: errorMessage,
  }
}
