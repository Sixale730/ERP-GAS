'use client'

import { useMemo } from 'react'
import { Card, Descriptions, Table, Statistic, Alert, Row, Col, Tag, Typography, Divider } from 'antd'
import { CheckCircleOutlined, WarningOutlined } from '@ant-design/icons'
import { formatMoney } from '@/lib/utils/format'

const { Text } = Typography

interface CfdiPreviewProps {
  emisor: {
    rfc: string
    nombre: string
    regimenFiscal: string
  }
  receptor: {
    rfc: string
    nombre: string
    codigoPostal: string
    regimenFiscal: string
    usoCfdi: string
  }
  conceptos: {
    descripcion: string
    cantidad: number
    precioUnitario: number
    importe: number
    descuento?: number
  }[]
  totales: {
    subtotal: number
    descuento: number
    iva: number
    total: number
  }
  validaciones: string[]
  moneda: string
  metodoPago: string
  formaPago: string
}

const FORMAS_PAGO: Record<string, string> = {
  '01': 'Efectivo',
  '02': 'Cheque nominativo',
  '03': 'Transferencia electronica',
  '04': 'Tarjeta de credito',
  '28': 'Tarjeta de debito',
  '99': 'Por definir',
}

const METODOS_PAGO: Record<string, string> = {
  PUE: 'Pago en Una sola Exhibicion',
  PPD: 'Pago en Parcialidades o Diferido',
}

export default function CfdiPreview({
  emisor,
  receptor,
  conceptos,
  totales,
  validaciones,
  moneda,
  metodoPago,
  formaPago,
}: CfdiPreviewProps) {
  const isValid = validaciones.length === 0

  const conceptoColumns = [
    {
      title: 'Descripcion',
      dataIndex: 'descripcion',
      key: 'descripcion',
      ellipsis: true,
    },
    {
      title: 'Cant.',
      dataIndex: 'cantidad',
      key: 'cantidad',
      width: 60,
      align: 'right' as const,
    },
    {
      title: 'P. Unit.',
      dataIndex: 'precioUnitario',
      key: 'precioUnitario',
      width: 110,
      align: 'right' as const,
      render: (v: number) => formatMoney(v),
    },
    {
      title: 'Importe',
      dataIndex: 'importe',
      key: 'importe',
      width: 110,
      align: 'right' as const,
      render: (v: number) => formatMoney(v),
    },
  ]

  return (
    <div>
      {/* Validation status */}
      {isValid ? (
        <Alert
          type="success"
          message="Datos listos para timbrar"
          icon={<CheckCircleOutlined />}
          showIcon
          style={{ marginBottom: 16 }}
        />
      ) : (
        <Alert
          type="error"
          message="Errores de validacion"
          description={
            <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
              {validaciones.map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
          }
          icon={<WarningOutlined />}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Emisor / Receptor */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12}>
          <Card size="small" title="Emisor" type="inner">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="RFC">
                <Text code>{emisor.rfc}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Nombre">{emisor.nombre}</Descriptions.Item>
              <Descriptions.Item label="Regimen">{emisor.regimenFiscal}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card size="small" title="Receptor" type="inner">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="RFC">
                <Text code>{receptor.rfc}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Nombre">{receptor.nombre}</Descriptions.Item>
              <Descriptions.Item label="C.P.">{receptor.codigoPostal}</Descriptions.Item>
              <Descriptions.Item label="Uso CFDI">
                <Tag>{receptor.usoCfdi}</Tag>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      {/* Datos fiscales */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Statistic title="Forma de Pago" value={FORMAS_PAGO[formaPago] || formaPago} valueStyle={{ fontSize: 14 }} />
        </Col>
        <Col span={8}>
          <Statistic title="Metodo de Pago" value={METODOS_PAGO[metodoPago] || metodoPago} valueStyle={{ fontSize: 14 }} />
        </Col>
        <Col span={8}>
          <Statistic title="Moneda" value={moneda} valueStyle={{ fontSize: 14 }} />
        </Col>
      </Row>

      {/* Conceptos */}
      <Table
        dataSource={conceptos.map((c, i) => ({ ...c, key: i }))}
        columns={conceptoColumns}
        pagination={false}
        size="small"
        style={{ marginBottom: 16 }}
      />

      {/* Totales */}
      <Divider style={{ margin: '8px 0' }} />
      <Row justify="end">
        <Col xs={24} sm={12}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text>Subtotal:</Text>
            <Text>{formatMoney(totales.subtotal)}</Text>
          </div>
          {totales.descuento > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text type="success">Descuento:</Text>
              <Text type="success">-{formatMoney(totales.descuento)}</Text>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text>IVA (16%):</Text>
            <Text>{formatMoney(totales.iva)}</Text>
          </div>
          <Divider style={{ margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text strong style={{ fontSize: 16 }}>Total:</Text>
            <Text strong style={{ fontSize: 16, color: '#1890ff' }}>
              {formatMoney(totales.total)}
            </Text>
          </div>
        </Col>
      </Row>
    </div>
  )
}
