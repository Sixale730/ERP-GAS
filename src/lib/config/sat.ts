// Catálogos SAT para facturación electrónica CFDI 4.0

export const FORMAS_PAGO_SAT = [
  { value: '01', label: '01 - Efectivo' },
  { value: '02', label: '02 - Cheque nominativo' },
  { value: '03', label: '03 - Transferencia electrónica' },
  { value: '04', label: '04 - Tarjeta de crédito' },
  { value: '28', label: '28 - Tarjeta de débito' },
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
  { value: 'G01', label: 'G01 - Adquisición de mercancías' },
  { value: 'G03', label: 'G03 - Gastos en general' },
  { value: 'P01', label: 'P01 - Por definir' },
  { value: 'S01', label: 'S01 - Sin efectos fiscales' },
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
