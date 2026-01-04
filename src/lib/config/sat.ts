// Catálogos SAT para facturación electrónica CFDI 4.0

export const FORMAS_PAGO_SAT = [
  { value: '01', label: '01 - Efectivo' },
  { value: '02', label: '02 - Cheque nominativo' },
  { value: '03', label: '03 - Transferencia electrónica' },
  { value: '04', label: '04 - Tarjeta de crédito' },
  { value: '05', label: '05 - Monederos electrónicos' },
  { value: '06', label: '06 - Dinero electrónico' },
  { value: '07', label: '07 - Tarjetas digitales' },
  { value: '08', label: '08 - Vales de despensa' },
  { value: '09', label: '09 - Bienes' },
  { value: '10', label: '10 - Servicio' },
  { value: '11', label: '11 - Por cuenta de tercero' },
  { value: '12', label: '12 - Dación en pago' },
  { value: '13', label: '13 - Pago por subrogación' },
  { value: '14', label: '14 - Pago por consignación' },
  { value: '15', label: '15 - Condonación' },
  { value: '16', label: '16 - Cancelación' },
  { value: '17', label: '17 - Compensación' },
  { value: '28', label: '28 - Tarjeta de débito' },
  { value: '98', label: '98 - N/A' },
  { value: '99', label: '99 - Por definir' },
]

export const METODOS_PAGO_SAT = [
  { value: 'PUE', label: 'PUE - Pago en Una Exhibición' },
  { value: 'PPD', label: 'PPD - Pago en Parcialidades o Diferido' },
]

export const REGIMENES_FISCALES_SAT = [
  { value: '601', label: '601 - General de Ley PM' },
  { value: '603', label: '603 - Personas Morales sin fines de lucro' },
  { value: '605', label: '605 - Sueldos y salarios' },
  { value: '606', label: '606 - Arrendamiento' },
  { value: '612', label: '612 - Personas Físicas con Actividad Empresarial' },
  { value: '616', label: '616 - Sin obligaciones fiscales' },
  { value: '621', label: '621 - Incorporación Fiscal' },
  { value: '625', label: '625 - Régimen de las Actividades Agrícolas' },
  { value: '626', label: '626 - Régimen Simplificado de Confianza' },
]

export const USOS_CFDI_SAT = [
  // Adquisiciones y Gastos
  { value: 'G01', label: 'G01 - Adquisición de mercancías' },
  { value: 'G02', label: 'G02 - Devoluciones, descuentos o bonificaciones' },
  { value: 'G03', label: 'G03 - Gastos en general' },
  // Inversiones
  { value: 'I01', label: 'I01 - Construcciones' },
  { value: 'I02', label: 'I02 - Mobiliario y equipo de oficina' },
  { value: 'I03', label: 'I03 - Equipo de transporte' },
  { value: 'I04', label: 'I04 - Equipo de cómputo y accesorios' },
  { value: 'I05', label: 'I05 - Dados, troqueles, moldes, matrices y herramental' },
  { value: 'I06', label: 'I06 - Comunicaciones telefónicas' },
  { value: 'I07', label: 'I07 - Comunicaciones satelitales' },
  { value: 'I08', label: 'I08 - Otra maquinaria y equipo' },
  // Deducciones Personales
  { value: 'D01', label: 'D01 - Honorarios médicos, dentales y hospitalarios' },
  { value: 'D02', label: 'D02 - Gastos médicos por incapacidad o discapacidad' },
  { value: 'D03', label: 'D03 - Gastos funerales' },
  { value: 'D04', label: 'D04 - Donativos' },
  { value: 'D05', label: 'D05 - Intereses por créditos hipotecarios' },
  { value: 'D06', label: 'D06 - Aportaciones voluntarias al SAR' },
  { value: 'D07', label: 'D07 - Primas por seguros de gastos médicos' },
  { value: 'D08', label: 'D08 - Gastos de transportación escolar' },
  { value: 'D09', label: 'D09 - Depósitos en cuentas de ahorro o pensiones' },
  { value: 'D10', label: 'D10 - Pagos por servicios educativos (colegiaturas)' },
  // Otros
  { value: 'S01', label: 'S01 - Sin efectos fiscales' },
  { value: 'CP01', label: 'CP01 - Pagos' },
  { value: 'CN01', label: 'CN01 - Nómina' },
]

// Helpers para obtener labels
export function getFormaPagoLabel(value: string | null): string {
  if (!value) return '-'
  return FORMAS_PAGO_SAT.find(f => f.value === value)?.label || value
}

export function getMetodoPagoLabel(value: string | null): string {
  if (!value) return '-'
  return METODOS_PAGO_SAT.find(m => m.value === value)?.label || value
}

export function getRegimenFiscalLabel(value: string | null): string {
  if (!value) return '-'
  return REGIMENES_FISCALES_SAT.find(r => r.value === value)?.label || value
}

export function getUsoCfdiLabel(value: string | null): string {
  if (!value) return '-'
  return USOS_CFDI_SAT.find(u => u.value === value)?.label || value
}
