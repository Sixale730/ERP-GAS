'use client'

import { useState } from 'react'
import { Button, Dropdown, message } from 'antd'
import { DownloadOutlined, FileExcelOutlined, FilePdfOutlined } from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { exportarExcel, exportarPDF, type ColumnaExportar } from '@/lib/utils/exportar'

interface BotonExportarProps {
  nombre: string
  columnas: ColumnaExportar[]
  datos: Record<string, unknown>[]
  fetchTodos?: () => Promise<Record<string, unknown>[]>
}

export default function BotonExportar({ nombre, columnas, datos, fetchTodos }: BotonExportarProps) {
  const [loading, setLoading] = useState(false)

  const handleExport = async (tipo: 'excel' | 'pdf') => {
    setLoading(true)
    try {
      const dataToExport = fetchTodos ? await fetchTodos() : datos
      if (dataToExport.length === 0) {
        message.warning('No hay datos para exportar')
        return
      }
      if (tipo === 'excel') {
        await exportarExcel(nombre, columnas, dataToExport)
      } else {
        await exportarPDF(nombre, columnas, dataToExport)
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
