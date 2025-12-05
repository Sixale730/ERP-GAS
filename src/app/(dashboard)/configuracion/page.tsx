'use client'

import { useState, useEffect } from 'react'
import { Card, Form, InputNumber, Button, Space, Typography, message, Divider, Statistic, Row, Col, Spin } from 'antd'
import { SaveOutlined, ReloadOutlined, DollarOutlined, PercentageOutlined } from '@ant-design/icons'
import { useConfiguracion } from '@/lib/hooks/useConfiguracion'
import { formatDate } from '@/lib/utils/format'

const { Title, Text } = Typography

export default function ConfiguracionPage() {
  const { tipoCambio, fechaTipoCambio, margenGanancia, loading, updateTipoCambio, updateMargenGanancia, reload } = useConfiguracion()

  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [formValues, setFormValues] = useState({ tipo_cambio: tipoCambio, margen_ganancia: margenGanancia })

  useEffect(() => {
    if (!loading) {
      form.setFieldsValue({
        tipo_cambio: tipoCambio,
        margen_ganancia: margenGanancia
      })
      setFormValues({ tipo_cambio: tipoCambio, margen_ganancia: margenGanancia })
    }
  }, [loading, tipoCambio, margenGanancia, form])

  const handleValuesChange = (_: any, allValues: any) => {
    setFormValues(allValues)
  }

  const handleSave = async () => {
    const values = form.getFieldsValue()
    setSaving(true)

    try {
      const [tcResult, mgResult] = await Promise.all([
        updateTipoCambio(values.tipo_cambio),
        updateMargenGanancia(values.margen_ganancia)
      ])

      if (tcResult.error || mgResult.error) {
        throw new Error('Error al guardar configuracion')
      }

      message.success('Configuracion guardada correctamente')
    } catch (err: any) {
      message.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Ejemplo de calculo
  const costoEjemplo = 100 // USD
  const tcActual = formValues.tipo_cambio || tipoCambio
  const margenActual = formValues.margen_ganancia || margenGanancia
  const precioCalculado = costoEjemplo * tcActual * (1 + margenActual / 100)

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 8 }}>
        <Title level={2} style={{ margin: 0 }}>Configuracion del Sistema</Title>
        <Button icon={<ReloadOutlined />} onClick={reload}>
          Recargar
        </Button>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Parametros de Precios" style={{ marginBottom: 16 }}>
            <Form form={form} layout="vertical" onValuesChange={handleValuesChange}>
              <Form.Item
                name="tipo_cambio"
                label="Tipo de Cambio (MXN por 1 USD)"
                rules={[{ required: true, message: 'Requerido' }]}
                extra={`Ultima actualizacion: ${formatDate(fechaTipoCambio)}`}
              >
                <InputNumber
                  min={1}
                  max={100}
                  step={0.01}
                  precision={2}
                  style={{ width: '100%' }}
                  prefix={<DollarOutlined />}
                  addonAfter="MXN"
                />
              </Form.Item>

              <Form.Item
                name="margen_ganancia"
                label="Margen de Ganancia (%)"
                rules={[{ required: true, message: 'Requerido' }]}
                extra="Porcentaje que se agrega sobre el costo del proveedor"
              >
                <InputNumber
                  min={0}
                  max={500}
                  step={1}
                  precision={0}
                  style={{ width: '100%' }}
                  prefix={<PercentageOutlined />}
                  addonAfter="%"
                />
              </Form.Item>

              <Divider />

              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSave}
                loading={saving}
                size="large"
                block
              >
                Guardar Configuracion
              </Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Vista Previa de Calculo" style={{ marginBottom: 16 }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              Ejemplo: Producto con costo de proveedor de $100 USD
            </Text>

            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <Statistic
                title="Costo Proveedor (USD)"
                value={costoEjemplo}
                prefix="$"
                suffix="USD"
              />
              <Statistic
                title="Precio de Venta Calculado (MXN)"
                value={precioCalculado}
                prefix="$"
                suffix="MXN"
                precision={2}
                valueStyle={{ color: '#1890ff', fontSize: 28 }}
              />
            </Space>

            <Divider />

            <Text type="secondary">
              Formula: Costo USD x Tipo Cambio x (1 + Margen%)
            </Text>
            <br />
            <Text code>
              ${costoEjemplo} x {tcActual} x {(1 + margenActual / 100).toFixed(2)} = ${precioCalculado.toFixed(2)} MXN
            </Text>
          </Card>

          <Card title="Informacion">
            <Text type="secondary">
              <ul style={{ paddingLeft: 20, margin: 0 }}>
                <li>El <strong>costo promedio</strong> de cada producto esta en USD (precio del proveedor)</li>
                <li>Al crear una cotizacion, el precio se calcula automaticamente usando estos parametros</li>
                <li>Puedes ajustar el tipo de cambio por cotizacion individual</li>
                <li>El precio calculado puede editarse manualmente en cada linea</li>
              </ul>
            </Text>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
