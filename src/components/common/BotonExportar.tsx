'use client'

import { useState } from 'react'
import { Button, Dropdown, message } from 'antd'
import { DownloadOutlined, FileExcelOutlined, FilePdfOutlined } from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { exportarExcel, type ColumnaExcel, type ResumenEstadistica } from '@/lib/utils/excel'
import { generarPDFReporte } from '@/lib/utils/pdf'
import dayjs from 'dayjs'

interface BotonExportarProps {
  nombre: string
  tituloReporte: string
  columnas: ColumnaExcel[]
  datos: Record<string, unknown>[]
  fetchTodos?: () => Promise<Record<string, unknown>[]>
  resumen?: ResumenEstadistica[]
  subtitulo?: string
}

export default function BotonExportar({
  nombre,
  tituloReporte,
  columnas,
  datos,
  fetchTodos,
  resumen,
  subtitulo,
}: BotonExportarProps) {
  const [loading, setLoading] = useState(false)

  const handleExport = async (tipo: 'excel' | 'pdf') => {
    setLoading(true)
    try {
      const dataToExport = fetchTodos ? await fetchTodos() : datos
      if (dataToExport.length === 0) {
        message.warning('No hay datos para exportar')
        return
      }

      const nombreArchivo = `${nombre}_${dayjs().format('YYYY-MM-DD')}`

      if (tipo === 'excel') {
        await exportarExcel({
          columnas,
          datos: dataToExport,
          nombreArchivo,
          nombreHoja: nombre,
          tituloReporte,
          subtitulo,
          resumen,
        })
      } else {
        await generarPDFReporte({
          titulo: tituloReporte,
          nombreArchivo,
          columnas: columnas.map((c) => ({
            titulo: c.titulo,
            dataIndex: c.dataIndex,
            width: c.ancho ? c.ancho * 10 : undefined,
          })),
          datos: dataToExport.map((row) => {
            const mapped: Record<string, any> = {}
            columnas.forEach((col) => {
              const val = row[col.dataIndex]
              if (col.formato === 'moneda' && typeof val === 'number') {
                mapped[col.dataIndex] = `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              } else {
                mapped[col.dataIndex] = val != null ? val : ''
              }
            })
            return mapped
          }),
          orientacion: 'landscape',
        })
      }
    } catch (error: any) {
      console.error('Error exportando:', error)
      message.error('Error al exportar')
    } finally {
      setLoading(false)
    }
  }

  const items: MenuProps['items'] = [
    {
      key: 'excel',
      label: 'Descargar Excel',
      icon: <FileExcelOutlined style={{ color: '#52c41a' }} />,
      onClick: () => handleExport('excel'),
    },
    {
      key: 'pdf',
      label: 'Descargar PDF',
      icon: <FilePdfOutlined style={{ color: '#ff4d4f' }} />,
      onClick: () => handleExport('pdf'),
    },
  ]

  return (
    <Dropdown menu={{ items }} trigger={['click']}>
      <Button icon={<DownloadOutlined />} loading={loading}>
        Descargar
      </Button>
    </Dropdown>
  )
}
