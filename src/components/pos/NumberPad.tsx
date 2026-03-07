'use client'

import { Button } from 'antd'
import { DeleteOutlined, EnterOutlined } from '@ant-design/icons'

interface NumberPadProps {
  value: string
  onChange: (value: string) => void
  onEnter?: () => void
}

export default function NumberPad({ value, onChange, onEnter }: NumberPadProps) {
  const handlePress = (key: string) => {
    if (key === 'C') {
      onChange('')
    } else if (key === 'BS') {
      onChange(value.slice(0, -1))
    } else if (key === '.') {
      if (!value.includes('.')) {
        onChange(value + '.')
      }
    } else {
      onChange(value + key)
    }
  }

  const btnStyle: React.CSSProperties = {
    width: '100%',
    height: 56,
    fontSize: 20,
    fontWeight: 600,
  }

  const keys = [
    ['7', '8', '9'],
    ['4', '5', '6'],
    ['1', '2', '3'],
    ['C', '0', '.'],
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
      {keys.map((row, ri) =>
        row.map(key => (
          <Button
            key={key}
            style={btnStyle}
            onClick={() => handlePress(key)}
            type={key === 'C' ? 'default' : undefined}
            danger={key === 'C'}
          >
            {key}
          </Button>
        )).concat(
          ri === 0 ? [
            <Button key="BS" style={btnStyle} onClick={() => handlePress('BS')} icon={<DeleteOutlined />} />
          ] : ri === 3 ? [
            <Button key="OK" style={{ ...btnStyle, background: '#52c41a', color: '#fff', borderColor: '#52c41a' }} onClick={onEnter} icon={<EnterOutlined />} />
          ] : ri === 1 ? [
            <Button key="00" style={btnStyle} onClick={() => handlePress('00')}>00</Button>
          ] : [
            <Button key={`empty-${ri}`} style={btnStyle} onClick={() => handlePress('000')}>000</Button>
          ]
        )
      )}
    </div>
  )
}
