'use client'

import React from 'react'
import { Button, Result } from 'antd'

interface ErrorBoundaryProps {
  children: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 48 }}>
          <Result
            status="error"
            title="Algo salio mal"
            subTitle={this.state.error?.message || 'Ocurrio un error inesperado'}
            extra={[
              <Button
                type="primary"
                key="retry"
                onClick={this.handleReset}
              >
                Reintentar
              </Button>,
              <Button
                key="home"
                onClick={() => window.location.href = '/'}
              >
                Ir al inicio
              </Button>,
            ]}
          />
        </div>
      )
    }

    return this.props.children
  }
}
