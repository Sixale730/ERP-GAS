'use client'

import { useEffect, useState } from 'react'
import { Select } from 'antd'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'

interface UsuarioComprasSelectProps {
  value?: string | null
  onChange?: (value: string | null, nombre?: string | null) => void
  disabled?: boolean
  autoAssignCurrent?: boolean
}

interface Usuario {
  id: string
  nombre: string | null
  email: string
}

export default function UsuarioComprasSelect({
  value,
  onChange,
  disabled = false,
  autoAssignCurrent = false,
}: UsuarioComprasSelectProps) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const { erpUser } = useAuth()

  useEffect(() => {
    loadUsuarios()
  }, [])

  useEffect(() => {
    if (autoAssignCurrent && !value && erpUser?.id && usuarios.length > 0) {
      const currentUser = usuarios.find(u => u.id === erpUser.id)
      if (currentUser && onChange) {
        onChange(erpUser.id, currentUser.nombre || currentUser.email)
      }
    }
  }, [autoAssignCurrent, value, erpUser, usuarios, onChange])

  const loadUsuarios = async () => {
    try {
      setLoading(true)
      const supabase = createClient()

      const { data, error } = await supabase
        .schema('erp')
        .from('usuarios')
        .select('id, nombre, email')
        .eq('is_active', true)
        .in('rol', ['super_admin', 'admin_cliente', 'compras'])
        .order('nombre', { ascending: true })

      if (error) throw error

      setUsuarios(data || [])
    } catch (error) {
      console.error('Error cargando usuarios de compras:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (newValue: string | null) => {
    if (onChange) {
      const usuario = usuarios.find(u => u.id === newValue)
      const nombre = usuario?.nombre || usuario?.email || null
      onChange(newValue, nombre)
    }
  }

  const options = usuarios.map(usuario => ({
    value: usuario.id,
    label: usuario.nombre || usuario.email,
  }))

  return (
    <Select
      value={value}
      onChange={handleChange}
      placeholder="Seleccionar usuario"
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
