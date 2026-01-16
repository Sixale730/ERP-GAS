'use client'

import { Skeleton, Card, Row, Col, Space } from 'antd'

interface TableSkeletonProps {
  rows?: number
  columns?: number
}

export function TableSkeleton({ rows = 5, columns = 5 }: TableSkeletonProps) {
  return (
    <div className="table-skeleton">
      {/* Header */}
      <div style={{ display: 'flex', gap: 16, padding: '16px 0', borderBottom: '1px solid #f0f0f0' }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton.Input key={`header-${i}`} active size="small" style={{ width: i === 1 ? 200 : 100 }} />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={`row-${rowIndex}`}
          style={{
            display: 'flex',
            gap: 16,
            padding: '12px 0',
            borderBottom: '1px solid #f0f0f0',
            alignItems: 'center'
          }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton.Input
              key={`cell-${rowIndex}-${colIndex}`}
              active
              size="small"
              style={{ width: colIndex === 1 ? 200 : 80 + (colIndex * 10) }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton">
      {/* Title */}
      <Skeleton.Input active style={{ width: 150, height: 32, marginBottom: 24 }} />

      {/* Stats Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Col xs={24} sm={12} lg={6} key={`stat-${i}`}>
            <Card>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Skeleton.Input active size="small" style={{ width: 100 }} />
                <Skeleton.Input active style={{ width: 80, height: 38 }} />
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Data Tables */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card>
            <Skeleton.Input active size="small" style={{ width: 180, marginBottom: 16 }} />
            <TableSkeleton rows={4} columns={3} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card>
            <Skeleton.Input active size="small" style={{ width: 150, marginBottom: 16 }} />
            <TableSkeleton rows={4} columns={4} />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

interface FormSkeletonProps {
  fields?: number
}

export function FormSkeleton({ fields = 6 }: FormSkeletonProps) {
  return (
    <div className="form-skeleton">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={`field-${i}`} style={{ marginBottom: 24 }}>
          <Skeleton.Input active size="small" style={{ width: 100, marginBottom: 8 }} />
          <Skeleton.Input active style={{ width: '100%' }} />
        </div>
      ))}
      <Space>
        <Skeleton.Button active />
        <Skeleton.Button active />
      </Space>
    </div>
  )
}

export function CardListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <Row gutter={[16, 16]}>
      {Array.from({ length: count }).map((_, i) => (
        <Col xs={24} sm={12} lg={8} key={`card-${i}`}>
          <Card>
            <Skeleton active paragraph={{ rows: 3 }} />
          </Card>
        </Col>
      ))}
    </Row>
  )
}

export function DetailSkeleton() {
  return (
    <div className="detail-skeleton">
      {/* Header */}
      <Space style={{ marginBottom: 24 }}>
        <Skeleton.Avatar active size={48} />
        <Space direction="vertical">
          <Skeleton.Input active style={{ width: 200 }} />
          <Skeleton.Input active size="small" style={{ width: 150 }} />
        </Space>
      </Space>

      {/* Info sections */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[24, 16]}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Col xs={24} sm={12} key={`info-${i}`}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Skeleton.Input active size="small" style={{ width: 80 }} />
                <Skeleton.Input active style={{ width: '80%' }} />
              </Space>
            </Col>
          ))}
        </Row>
      </Card>

      {/* Table */}
      <Card>
        <TableSkeleton rows={3} columns={5} />
      </Card>
    </div>
  )
}
