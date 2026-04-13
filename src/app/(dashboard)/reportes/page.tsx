'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Typography, Row, Col, Spin, Tabs, Input, Badge, Tooltip } from 'antd'
import { StarFilled, StarOutlined, SearchOutlined } from '@ant-design/icons'
import { useAuth } from '@/lib/hooks/useAuth'
import { useUIStore } from '@/store/uiStore'
import {
  CATEGORIAS_CONFIG,
  REPORTES_REGISTRY,
  isReporteVisible,
  isReporteAccesible,
  type ReporteDefinition,
  type CategoriaReporte,
} from './_config/reportes-registry'
import { resolveIcon } from './_config/icon-resolver'

const { Title, Text } = Typography

// ─── Card de reporte ──────────────────────────────────────────────────────────

function ReporteCard({
  reporte,
  esFavorito,
  onToggleFavorito,
  onClick,
}: {
  reporte: ReporteDefinition
  esFavorito: boolean
  onToggleFavorito: () => void
  onClick: () => void
}) {
  const disabled = !reporte.implementado

  return (
    <Card
      hoverable={!disabled}
      onClick={disabled ? undefined : onClick}
      style={{
        height: '100%',
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? 'default' : 'pointer',
      }}
      styles={{ body: { padding: 20, position: 'relative' } }}
    >
      {/* Estrella de favorito */}
      {reporte.implementado && (
        <Tooltip title={esFavorito ? 'Quitar de favoritos' : 'Agregar a favoritos'}>
          <div
            onClick={(e) => {
              e.stopPropagation()
              onToggleFavorito()
            }}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              cursor: 'pointer',
              fontSize: 16,
              color: esFavorito ? '#faad14' : '#d9d9d9',
              transition: 'color 0.2s',
            }}
          >
            {esFavorito ? <StarFilled /> : <StarOutlined />}
          </div>
        </Tooltip>
      )}

      {/* Badge "Próximamente" */}
      {disabled && (
        <Badge.Ribbon text="Proximamente" color="default" style={{ top: -4 }}>
          <div />
        </Badge.Ribbon>
      )}

      <div style={{ marginBottom: 12 }}>
        {resolveIcon(reporte.icono, { fontSize: 28, color: reporte.iconColor })}
      </div>
      <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 4 }}>
        {reporte.titulo}
      </Text>
      <Text type="secondary" style={{ fontSize: 13 }}>
        {reporte.descripcion}
      </Text>
    </Card>
  )
}

// ─── Grid de reportes ─────────────────────────────────────────────────────────

function ReportesGrid({
  reportes,
  favoritos,
  onToggleFavorito,
  onNavigate,
}: {
  reportes: ReporteDefinition[]
  favoritos: string[]
  onToggleFavorito: (key: string) => void
  onNavigate: (ruta: string) => void
}) {
  if (reportes.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
        <Text type="secondary">No hay reportes en esta seccion</Text>
      </div>
    )
  }

  return (
    <Row gutter={[16, 16]}>
      {reportes.map((reporte) => (
        <Col xs={24} sm={12} md={8} lg={6} key={reporte.key}>
          <ReporteCard
            reporte={reporte}
            esFavorito={favoritos.includes(reporte.key)}
            onToggleFavorito={() => onToggleFavorito(reporte.key)}
            onClick={() => onNavigate(reporte.ruta)}
          />
        </Col>
      ))}
    </Row>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ReportesHubPage() {
  const router = useRouter()
  const { organizacion, loading } = useAuth()
  const reporteFavoritos = useUIStore(s => s.reporteFavoritos)
  const toggleReporteFavorito = useUIStore(s => s.toggleReporteFavorito)
  const [busqueda, setBusqueda] = useState('')

  const modulosActivos: string[] = organizacion?.modulos_activos || []

  // Filtrar reportes visibles para esta org
  const reportesVisibles = useMemo(
    () => REPORTES_REGISTRY.filter((r) => isReporteVisible(r, modulosActivos)),
    [modulosActivos]
  )

  // Filtrar por búsqueda
  const reportesFiltrados = useMemo(() => {
    if (!busqueda.trim()) return reportesVisibles
    const term = busqueda.toLowerCase()
    return reportesVisibles.filter(
      (r) =>
        r.titulo.toLowerCase().includes(term) || r.descripcion.toLowerCase().includes(term)
    )
  }, [reportesVisibles, busqueda])

  // Agrupar por categoría
  const reportesPorCategoria = useMemo(() => {
    const map: Record<CategoriaReporte, ReporteDefinition[]> = {
      ventas_comercial: [],
      cobranza: [],
      punto_de_venta: [],
      inventario: [],
      compras: [],
      fiscal_cfdi: [],
      finanzas_estadisticas: [],
    }
    for (const r of reportesFiltrados) {
      map[r.categoria].push(r)
    }
    return map
  }, [reportesFiltrados])

  // Reportes favoritos (solo implementados y visibles)
  const reportesFavoritosData = useMemo(
    () =>
      reportesFiltrados.filter(
        (r) => reporteFavoritos.includes(r.key) && isReporteAccesible(r, modulosActivos)
      ),
    [reportesFiltrados, reporteFavoritos, modulosActivos]
  )

  // Categorías visibles para esta org
  const categoriasVisibles = useMemo(
    () => CATEGORIAS_CONFIG.filter((c) => c.visible(modulosActivos)),
    [modulosActivos]
  )

  if (loading || !organizacion) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    )
  }

  // Construir items de tabs
  const tabItems = []

  // Tab de favoritos (solo si hay)
  if (reportesFavoritosData.length > 0) {
    tabItems.push({
      key: 'favoritos',
      label: (
        <span>
          <StarFilled style={{ color: '#faad14', marginRight: 6 }} />
          Favoritos ({reportesFavoritosData.length})
        </span>
      ),
      children: (
        <ReportesGrid
          reportes={reportesFavoritosData}
          favoritos={reporteFavoritos}
          onToggleFavorito={toggleReporteFavorito}
          onNavigate={(ruta) => router.push(ruta)}
        />
      ),
    })
  }

  // Tabs por categoría
  for (const cat of categoriasVisibles) {
    const reportesCat = reportesPorCategoria[cat.key]
    if (reportesCat.length === 0) continue

    tabItems.push({
      key: cat.key,
      label: (
        <span>
          {resolveIcon(cat.icono, { fontSize: 14, color: cat.color, marginRight: 6 })}
          {cat.label}
          <Badge
            count={reportesCat.filter((r) => r.implementado).length}
            style={{ backgroundColor: cat.color, marginLeft: 8 }}
            size="small"
          />
        </span>
      ),
      children: (
        <ReportesGrid
          reportes={reportesCat}
          favoritos={reporteFavoritos}
          onToggleFavorito={toggleReporteFavorito}
          onNavigate={(ruta) => router.push(ruta)}
        />
      ),
    })
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <Title level={2} style={{ margin: 0 }}>
          Reportes
        </Title>
        <Input
          placeholder="Buscar reporte..."
          prefix={<SearchOutlined />}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          allowClear
          style={{ maxWidth: 300 }}
        />
      </div>

      <Tabs
        defaultActiveKey={tabItems[0]?.key}
        items={tabItems}
        size="middle"
        style={{ marginTop: -8 }}
      />
    </div>
  )
}
