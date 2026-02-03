'use client'

import { useEffect, useState } from 'react'
import { Select } from 'antd'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'

interface VendedorSelectProps {
  value?: string | null
  onChange?: (value: string | null, nombre?: string | null) => void
  disabled?: boolean
  autoAssignCurrent?: boolean
}

interface Vendedor {
  id: string
  nombre: string | null
  email: string
}

export default function VendedorSelect({
  value,
  onChange,
  disabled = false,
  autoAssignCurrent = false,
}: VendedorSelectProps) {
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [loading, setLoading] = useState(true)
  const { erpUser } = useAuth()

  useEffect(() => {
    loadVendedores()
  }, [])

  useEffect(() => {
    // Auto-asignar usuario actual si está habilitado y no hay valor previo
    if (autoAssignCurrent && !value && erpUser?.id && vendedores.length > 0) {
      const currentUser = vendedores.find(v => v.id === erpUser.id)
      if (currentUser && onChange) {
        onChange(erpUser.id, currentUser.nombre || currentUser.email)
      }
    }
  }, [autoAssignCurrent, value, erpUser, vendedores, onChange])

  const loadVendedores = async () => {
    try {
      setLoading(true)
      const supabase = createClient()

      const { data, error } = await supabase
        .schema('erp')
        .from('usuarios')
        .select('id, nombre, email')
        .eq('is_active', true)
        .in('rol', ['vendedor', 'admin_cliente'])
        .order('nombre', { ascending: true })

      if (error) throw error

      setVendedores(data || [])
    } catch (error) {
      console.error('Error cargando vendedores:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (newValue: string | null) => {
    if (onChange) {
      const vendedor = vendedores.find(v => v.id === newValue)
      const nombre = vendedor?.nombre || vendedor?.email || null
      onChange(newValue, nombre)
    }
  }

  const options = vendedores.map(vendedor => ({
    value: vendedor.id,
    label: vendedor.nombre || vendedor.email,
  }))

  return (
    <Select
      value={value}
      onChange={handleChange}
      placeholder="Seleccionar vendedor"
      loading={loading}
      disabled={disabled}
      allowClear
      showSearch
      filterOption={(input, option) =>
        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
      }
      options={options}
      style={{ width: '100%' }}
    />
  )
}
