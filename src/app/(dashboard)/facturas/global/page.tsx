'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card, Button, Space, Typography, message, DatePicker, Descriptions, Statistic,
  Modal, Alert, Spin, Empty,
} from 'antd'
import { ArrowLeftOutlined, FileTextOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { useAuth } from '@/lib/hooks/useAuth'
import { usePreviewFacturaGlobal, useGenerarFacturaGlobal } from '@/lib/hooks/queries/useFacturaGlobal'
import dayjs from 'dayjs'

const { Title } = Typography
const { RangePicker } = DatePicker

const formatMoney = (val: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val)

export default function FacturaGlobalPage() {
  const router = useRouter()
  const { organizacion } = useAuth()

  // Default: primer y último día del mes actual
  const [rango, setRango] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ])

  const fechaDesde = rango[0].format('YYYY-MM-DD')
  const fechaHasta = rango[1].format('YYYY-MM-DD')

  const { data: preview, isLoading, isError, error } = usePreviewFacturaGlobal(
    fechaDesde, fechaHasta, organizacion?.id
  )

  const generar = useGenerarFacturaGlobal()

  const handleGenerar = () => {
    if (!preview || preview.ventas_count === 0) {
      message.warning('No hay ventas para facturar en este periodo')
      return
    }

    Modal.confirm({
      title: 'Generar Factura Global',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>Se creara una factura global con:</p>
          <ul>
            <li><strong>{preview.ventas_count}</strong> ventas POS</li>
            <li>Periodo: {fechaDesde} al {fechaHasta}</li>
            <li>Total: <strong>{formatMoney(preview.total)}</strong></li>
          </ul>
          <p>Las ventas incluidas se marcaran como facturadas y no podran incluirse en otra factura global.</p>
        </div>
      ),
      okText: 'Generar',
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          const resultado = await generar.mutateAsync({
            fechaDesde,
            fechaHasta,
            orgId: organizacion!.id,
          })
          message.success(`Factura ${resultado.folio} creada con ${resultado.ventas_incluidas} ventas`)
          router.push(`/facturas/${resultado.id}`)
        } catch (err: any) {
          message.error(err.message || 'Error al generar factura global')
        }
      },
    })
  }

  const hayVentas = preview && preview.ventas_count > 0

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/facturas')}>
            Facturas
          </Button>
          <Title level={2} style={{ margin: 0 }}>Factura Global</Title>
        </Space>
      </div>

      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
              Periodo de ventas POS:
            </Typography.Text>
            <RangePicker
              value={rango}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  setRango([dates[0], dates[1]])
                }
              }}
              format="DD/MM/YYYY"
              style={{ width: '100%', maxWidth: 350 }}
            />
          </div>

          {isLoading && (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <Spin size="large" />
            </div>
          )}

          {isError && (
            <Alert
              type="error"
              message="Error al cargar preview"
              description={error instanceof Error ? error.message : 'Error desconocido'}
              showIcon
            />
          )}

          {preview && !isLoading && (
            <>
              {!hayVentas ? (
                <Empty description="No hay ventas POS sin facturar en este periodo" />
              ) : (
                <>
                  <Descriptions bordered column={{ xs: 1, sm: 2 }} size="middle">
                    <Descriptions.Item label="Ventas incluidas">
                      <strong>{preview.ventas_count}</strong>
                    </Descriptions.Item>
                    <Descriptions.Item label="Folios POS">
                      {preview.folio_desde} a {preview.folio_hasta}
                    </Descriptions.Item>
                  </Descriptions>

                  <Card size="small" style={{ background: '#fafafa' }}>
                    <Space size="large" wrap>
                      <Statistic title="Subtotal" value={preview.subtotal} precision={2} prefix="$" />
                      <Statistic title="IVA" value={preview.iva} precision={2} prefix="$" />
                      {preview.ieps > 0 && (
                        <Statistic title="IEPS" value={preview.ieps} precision={2} prefix="$" />
                      )}
                      <Statistic
                        title="Total"
                        value={preview.total}
                        precision={2}
                        prefix="$"
                        valueStyle={{ color: '#1890ff', fontWeight: 'bold' }}
                      />
                    </Space>
                  </Card>

                  <Alert
                    type="info"
                    showIcon
                    message="Datos del receptor"
                    description="RFC: XAXX010101000 | Razon Social: PUBLICO EN GENERAL | Uso CFDI: S01 (Sin efectos fiscales)"
                  />

                  <Button
                    type="primary"
                    size="large"
                    icon={<FileTextOutlined />}
                    onClick={handleGenerar}
                    loading={generar.isPending}
                    block
                    style={{ maxWidth: 400 }}
                  >
                    Generar Factura Global
                  </Button>
                </>
              )}
            </>
          )}
        </Space>
      </Card>
    </div>
  )
}
