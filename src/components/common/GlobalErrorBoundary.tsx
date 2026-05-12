'use client'

/**
 * GlobalErrorBoundary: captura crashes de render de React y muestra un
 * fallback con boton para reportar el error al super admin.
 *
 * Se monta dentro del layout del dashboard para no afectar a paginas
 * publicas (landing, login, etc.).
 */

import React from 'react'
import { Result, Button, Typography, Space } from 'antd'
import { BugOutlined, ReloadOutlined } from '@ant-design/icons'

const { Paragraph, Text } = Typography

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
  reportSent: boolean
  sending: boolean
  reportError: string | null
}

interface Props {
  children: React.ReactNode
}

export default class GlobalErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    reportSent: false,
    sending: false,
    reportError: null,
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo })
    // eslint-disable-next-line no-console
    console.error('[GlobalErrorBoundary]', error, errorInfo)
  }

  reset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      reportSent: false,
      sending: false,
      reportError: null,
    })
  }

  reportar = async () => {
    if (typeof window === 'undefined') return
    this.setState({ sending: true, reportError: null })
    const error = this.state.error
    const componentStack = this.state.errorInfo?.componentStack ?? null

    try {
      const res = await fetch('/api/reportes-errores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descripcion: `[Crash automatico] ${error?.message ?? 'Error desconocido en la interfaz'}`,
          ruta: window.location.pathname + window.location.search,
          mensaje_tecnico: error?.message ?? null,
          stack: error?.stack ?? null,
          contexto: { component_stack: componentStack },
          origen: 'boundary',
          user_agent: navigator.userAgent,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
        }),
      })
      const json = await res.json()
      if (!json.success) {
        this.setState({ sending: false, reportError: json.error || 'No se pudo enviar el reporte' })
        return
      }
      this.setState({ sending: false, reportSent: true })
    } catch (err) {
      this.setState({
        sending: false,
        reportError: err instanceof Error ? err.message : 'Error de red',
      })
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const { error, reportSent, sending, reportError } = this.state

    return (
      <div style={{ padding: 24, minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Result
          status="error"
          icon={<BugOutlined />}
          title="Algo salio mal"
          subTitle="Ocurrio un error inesperado en esta pantalla. Puedes reportarlo para que lo revisemos."
          extra={
            <Space direction="vertical" align="center" style={{ width: '100%' }}>
              <Space>
                <Button icon={<ReloadOutlined />} onClick={this.reset}>
                  Reintentar
                </Button>
                {!reportSent ? (
                  <Button
                    type="primary"
                    danger
                    icon={<BugOutlined />}
                    onClick={this.reportar}
                    loading={sending}
                  >
                    Reportar este error
                  </Button>
                ) : (
                  <Button type="primary" disabled>
                    Reporte enviado
                  </Button>
                )}
                <Button onClick={() => { window.location.href = '/dashboard' }}>
                  Ir al Dashboard
                </Button>
              </Space>
              {reportError && (
                <Text type="danger" style={{ fontSize: 12 }}>{reportError}</Text>
              )}
              {error?.message && (
                <Paragraph style={{ marginTop: 16, maxWidth: 600 }}>
                  <Text code style={{ fontSize: 12 }}>{error.message}</Text>
                </Paragraph>
              )}
            </Space>
          }
        />
      </div>
    )
  }
}
