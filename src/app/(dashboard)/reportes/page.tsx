'use client'

import { useRouter } from 'next/navigation'
import { Card, Typography, Row, Col, Spin } from 'antd'
import {
  BarChartOutlined,
  DollarOutlined,
  ShoppingCartOutlined,
  CreditCardOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  ShopOutlined,
  TrophyOutlined,
  InboxOutlined,
  SwapOutlined,
  ToolOutlined,
  ContainerOutlined,
  PercentageOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { useAuth } from '@/lib/hooks/useAuth'

const { Title, Text } = Typography

interface ReporteCard {
  key: string
  titulo: string
  descripcion: string
  icono: React.ReactNode
  ruta: string
  requiereModulo?: string // solo mostrar si org tiene este módulo
}

interface SeccionReportes {
  titulo: string
  visible: (modulos: string[]) => boolean
  reportes: ReporteCard[]
}

const SECCIONES: SeccionReportes[] = [
  {
    titulo: 'Ventas',
    visible: (m) => m.includes('facturas') || m.includes('pos'),
    reportes: [
      {
        key: 'ventas-pos',
        titulo: 'Ventas del Periodo',
        descripcion: 'Ventas diarias con totales y tendencia',
        icono: <BarChartOutlined style={{ fontSize: 28, color: '#1890ff' }} />,
        ruta: '/reportes/ventas-pos',
        requiereModulo: 'pos',
      },
      {
        key: 'ventas-forma-pago',
        titulo: 'Ventas por Forma de Pago',
        descripcion: 'Distribucion por metodo de pago',
        icono: <CreditCardOutlined style={{ fontSize: 28, color: '#722ed1' }} />,
        ruta: '/reportes/ventas-forma-pago',
        requiereModulo: 'pos',
      },
      {
        key: 'facturas-saldos',
        titulo: 'Facturas y Saldos',
        descripcion: 'Estado de facturacion y cobranza',
        icono: <FileTextOutlined style={{ fontSize: 28, color: '#13c2c2' }} />,
        ruta: '/reportes/facturas-saldos',
        requiereModulo: 'facturas',
      },
      {
        key: 'cartera-vencida',
        titulo: 'Cartera Vencida',
        descripcion: 'Facturas vencidas por antiguedad',
        icono: <ClockCircleOutlined style={{ fontSize: 28, color: '#f5222d' }} />,
        ruta: '/reportes/cartera-vencida',
        requiereModulo: 'facturas',
      },
    ],
  },
  {
    titulo: 'Punto de Venta',
    visible: (m) => m.includes('pos'),
    reportes: [
      {
        key: 'cortes-caja',
        titulo: 'Cortes de Caja',
        descripcion: 'Resumen de turnos y diferencias',
        icono: <ShopOutlined style={{ fontSize: 28, color: '#fa8c16' }} />,
        ruta: '/reportes/cortes-caja',
      },
      {
        key: 'productos-vendidos',
        titulo: 'Productos mas Vendidos',
        descripcion: 'Ranking de productos por unidades e importe',
        icono: <TrophyOutlined style={{ fontSize: 28, color: '#faad14' }} />,
        ruta: '/reportes/productos-vendidos',
      },
    ],
  },
  {
    titulo: 'Inventario',
    visible: () => true,
    reportes: [
      {
        key: 'inventario',
        titulo: 'Inventario Actual',
        descripcion: 'Stock por almacen y nivel',
        icono: <InboxOutlined style={{ fontSize: 28, color: '#52c41a' }} />,
        ruta: '/reportes/inventario',
      },
      {
        key: 'movimientos',
        titulo: 'Movimientos',
        descripcion: 'Entradas y salidas de inventario',
        icono: <SwapOutlined style={{ fontSize: 28, color: '#2f54eb' }} />,
        ruta: '/reportes/movimientos',
      },
      {
        key: 'servicios',
        titulo: 'Servicios',
        descripcion: 'Consumo de servicios por periodo',
        icono: <ToolOutlined style={{ fontSize: 28, color: '#595959' }} />,
        ruta: '/reportes/servicios',
      },
    ],
  },
  {
    titulo: 'Compras',
    visible: (m) => m.includes('compras'),
    reportes: [
      {
        key: 'ordenes-compra',
        titulo: 'Ordenes de Compra',
        descripcion: 'Seguimiento de compras a proveedores',
        icono: <ShoppingCartOutlined style={{ fontSize: 28, color: '#eb2f96' }} />,
        ruta: '/reportes/ordenes-compra',
      },
    ],
  },
  {
    titulo: 'Estadisticas',
    visible: () => true,
    reportes: [
      {
        key: 'margen-utilidad',
        titulo: 'Margen de Utilidad',
        descripcion: 'Rentabilidad por producto',
        icono: <PercentageOutlined style={{ fontSize: 28, color: '#389e0d' }} />,
        ruta: '/reportes/margen-utilidad',
      },
      {
        key: 'ordenes-venta',
        titulo: 'Ordenes de Venta',
        descripcion: 'Seguimiento de ordenes y cotizaciones',
        icono: <ContainerOutlined style={{ fontSize: 28, color: '#1890ff' }} />,
        ruta: '/reportes/ordenes-venta',
      },
    ],
  },
]

export default function ReportesHubPage() {
  const router = useRouter()
  const { organizacion, loading } = useAuth()

  const modulosActivos: string[] = organizacion?.modulos_activos || []

  if (loading || !organizacion) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      <Title level={2} style={{ marginBottom: 24 }}>Reportes</Title>

      {SECCIONES.map((seccion) => {
        if (!seccion.visible(modulosActivos)) return null

        // Filtrar reportes que requieren módulo específico
        const reportesVisibles = seccion.reportes.filter(
          (r) => !r.requiereModulo || modulosActivos.includes(r.requiereModulo)
        )
        if (reportesVisibles.length === 0) return null

        return (
          <div key={seccion.titulo} style={{ marginBottom: 32 }}>
            <Title level={4} style={{ marginBottom: 12, color: '#595959' }}>
              {seccion.titulo}
            </Title>
            <Row gutter={[16, 16]}>
              {reportesVisibles.map((reporte) => (
                <Col xs={24} sm={12} md={8} lg={6} key={reporte.key}>
                  <Card
                    hoverable
                    onClick={() => router.push(reporte.ruta)}
                    style={{ height: '100%' }}
                    styles={{ body: { padding: 20 } }}
                  >
                    <div style={{ marginBottom: 12 }}>{reporte.icono}</div>
                    <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 4 }}>
                      {reporte.titulo}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      {reporte.descripcion}
                    </Text>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        )
      })}
    </div>
  )
}
