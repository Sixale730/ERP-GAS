'use client'

import Link from 'next/link'
import { Space, Tag, Typography, Tooltip, Popover, Spin } from 'antd'
import { InfoCircleOutlined, HistoryOutlined, EnvironmentOutlined } from '@ant-design/icons'
import type { ConfigItem } from '@/types/configuracion-sistema'
import { useConfigAudit } from '@/lib/hooks/queries/useConfiguracionSistema'
import { formatDateTime } from '@/lib/utils/format'

const { Text } = Typography

interface Props {
  item: ConfigItem
  /** Modo de la fila: 'read' muestra solo valor, 'edit' muestra control editable. */
  mode?: 'read' | 'edit'
  /** Render del control editable (lo provee el padre en modo edit). */
  control?: React.ReactNode
  /** Acciones a la derecha (ej: restaurar default). */
  actions?: React.ReactNode
}

function formatValor(valor: unknown): string {
  if (valor === null || valor === undefined) return '—'
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No'
  if (typeof valor === 'string') return valor
  if (typeof valor === 'number') return String(valor)
  return JSON.stringify(valor)
}

function isModificado(valor: unknown, valorDefault: unknown): boolean {
  return JSON.stringify(valor) !== JSON.stringify(valorDefault)
}

function AuditPopoverContent({ categoria, clave }: { categoria: string; clave: string }) {
  const { data, isLoading } = useConfigAudit(categoria, clave, 5)

  if (isLoading) return <Spin size="small" />
  if (!data || data.length === 0) return <Text type="secondary">Sin modificaciones registradas</Text>

  return (
    <div style={{ maxWidth: 320 }}>
      <Text strong>Últimas modificaciones</Text>
      <div style={{ marginTop: 8 }}>
        {data.map((entry) => (
          <div key={entry.id} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #f0f0f0' }}>
            <div style={{ fontSize: 12, color: '#666' }}>
              {formatDateTime(entry.created_at)} · {entry.modificado_por_nombre ?? 'Sistema'}
            </div>
            <div style={{ fontSize: 12 }}>
              <Text delete type="secondary">{formatValor(entry.valor_anterior)}</Text>
              {' → '}
              <Text strong>{formatValor(entry.valor_nuevo)}</Text>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ConfigItemRow({ item, mode = 'read', control, actions }: Props) {
  const modificado = isModificado(item.valor, item.valor_default)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '12px 0',
        borderBottom: '1px solid #f0f0f0',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Space size={6} wrap>
            <Text strong style={{ fontSize: 14 }}>{item.etiqueta || item.clave}</Text>
            <Tag color="default" style={{ marginInlineEnd: 0 }}>{item.tipo}</Tag>
            {modificado && <Tag color="blue">modificado</Tag>}
            {item.permite_override_usuario && <Tag color="purple">override usuario</Tag>}
            {item.requiere_confirmacion && <Tag color="orange">sensible</Tag>}
              <Popover
              content={<AuditPopoverContent categoria={item.categoria} clave={item.clave} />}
              title={null}
              trigger="click"
              placement="topLeft"
            >
              <Tooltip title="Ver historial de cambios">
                <HistoryOutlined style={{ color: '#999', cursor: 'pointer' }} />
              </Tooltip>
            </Popover>
          </Space>
          {item.etiqueta && (
            <div style={{ marginTop: 2 }}>
              <Text code style={{ fontSize: 11, color: '#999' }}>{item.clave}</Text>
            </div>
          )}
        </div>

        <Space size={8} align="center">
          {mode === 'read' ? (
            <Text>{formatValor(item.valor)}</Text>
          ) : (
            control
          )}
          {actions}
        </Space>
      </div>

      {item.descripcion && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          <InfoCircleOutlined style={{ marginInlineEnd: 4 }} />
          {item.descripcion}
        </Text>
      )}

      {item.aplicado_en && item.aplicado_en.length > 0 && (
        <div style={{ fontSize: 12, color: '#666' }}>
          <EnvironmentOutlined style={{ marginInlineEnd: 4 }} />
          <Text type="secondary" style={{ fontSize: 12 }}>Aplicado en: </Text>
          {item.aplicado_en.map((ap, i) => (
            <span key={i}>
              {i > 0 && ' · '}
              {ap.ruta === '*' ? (
                <Tooltip title={ap.descripcion}>
                  <Text style={{ fontSize: 12 }}>Global</Text>
                </Tooltip>
              ) : (
                <Tooltip title={ap.descripcion}>
                  <Link href={ap.ruta} style={{ fontSize: 12 }}>
                    {ap.ruta}
                  </Link>
                </Tooltip>
              )}
            </span>
          ))}
        </div>
      )}

      <div style={{ fontSize: 11, color: '#999' }}>
        Default: <Text code style={{ fontSize: 11 }}>{formatValor(item.valor_default)}</Text>
        {item.modificado_por_nombre && (
          <> · Modificado por <Text style={{ fontSize: 11 }}>{item.modificado_por_nombre}</Text> · {formatDateTime(item.updated_at)}</>
        )}
      </div>
    </div>
  )
}
