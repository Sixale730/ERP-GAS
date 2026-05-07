export type ConfigTipo = 'boolean' | 'number' | 'string' | 'textarea' | 'enum' | 'json'

export type ConfigCategoria =
  | 'inventario'
  | 'cotizaciones'
  | 'pos'
  | 'cfdi'
  | 'insights'
  | 'performance'
  | 'ui'
  | 'envios'

export interface ConfigAplicadoEn {
  ruta: string
  descripcion: string
}

export interface ConfigItem {
  id: string
  organizacion_id: string | null
  categoria: ConfigCategoria
  clave: string
  valor: unknown
  tipo: ConfigTipo
  descripcion: string | null
  valor_default: unknown
  opciones: string[] | null
  min_valor: number | null
  max_valor: number | null
  is_global: boolean
  permite_override_usuario: boolean
  /** Etiqueta legible para UI. Si null, usar `clave`. */
  etiqueta: string | null
  /** Subgrupo dentro de la categoria, para agrupar visualmente. Solo aplica cuando una categoria tiene >5 claves. */
  subgrupo: string | null
  /** Lista de pantallas donde se aplica este parametro. Cada item: {ruta, descripcion}. */
  aplicado_en: ConfigAplicadoEn[] | null
  /** Si true, mostrar Modal.confirm antes de guardar. */
  requiere_confirmacion: boolean
  modificado_por: string | null
  modificado_por_nombre: string | null
  created_at: string
  updated_at: string
}

export interface ConfigAuditEntry {
  id: string
  valor_anterior: unknown
  valor_nuevo: unknown
  modificado_por: string | null
  modificado_por_nombre: string | null
  created_at: string
}

export const CONFIG_CATEGORIAS: { key: ConfigCategoria; label: string; icon?: string }[] = [
  { key: 'inventario', label: 'Inventario' },
  { key: 'cotizaciones', label: 'Cotizaciones y ventas' },
  { key: 'pos', label: 'POS' },
  { key: 'cfdi', label: 'CFDI / Facturación' },
  { key: 'envios', label: 'Envíos' },
  { key: 'insights', label: 'Insights y alertas' },
  { key: 'performance', label: 'Rendimiento' },
  { key: 'ui', label: 'Apariencia / UI' },
]
