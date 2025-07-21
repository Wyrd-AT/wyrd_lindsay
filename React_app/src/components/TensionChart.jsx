// src/components/TensionChart.jsx
import React, { useMemo } from 'react'
import { format } from 'date-fns'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts'
import useVetorTension from '../hooks/VetorTension'

// Paleta com 14 cores distintas
const COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7300',
  '#d0ed57', '#8dd1e1', '#a4de6c', '#d08484',
  '#84d0d8', '#b584d0', '#d0b584', '#84b5d0',
  '#b5d084', '#d084b5'
]

/**
 * @param {Object} props
 * @param {string} props.irrigadorId
 * @param {string[]} props.equipments
 * @param {'last24h'|'last7d'|'last30d'|'all'} [props.period='last24h']
 * @param {string|number} [props.width='100%']
 * @param {string|number} [props.height=300]
 */
const TensionChart = ({
  irrigadorId,
  equipments = [],
  period = 'last24h',
  width = '100%',
  height = 300
}) => {
  const tensionMap = useVetorTension([irrigadorId])
  const rawList = tensionMap[irrigadorId]?.[period] || []

  // ignorando os dois primeiros equipamentos
  const shiftedEquipments = useMemo(() => equipments.slice(2), [equipments])

  const data = useMemo(() => {
    return rawList
      .map(raw => {
        const parts = raw.split(';')
        const ts = new Date(parts[1])
        const vals = parts.slice(2).map(Number)
        const entry = { timestamp: ts }
        vals.forEach((v, i) => {
          const key = shiftedEquipments[i]
          if (key) entry[key] = v
        })
        return entry
      })
      .filter(e => Object.keys(e).length > 1)
      .sort((a, b) => a.timestamp - b.timestamp)
  }, [rawList, shiftedEquipments])

  const tensionKeys = useMemo(() => {
    if (!data.length) return []
    return Object.keys(data[0]).filter(k => k !== 'timestamp')
  }, [data])

  return (
    <ResponsiveContainer width={width} height={height} className="bg-[#222222] px-8">
      <LineChart data={data}>
        <XAxis
          dataKey="timestamp"
          tickFormatter={t => format(new Date(t), 'dd/MM/yy HH:mm')}
        />
        <YAxis
          domain={['dataMin', 'dataMax']}
          label={{
            value: 'Tensão',
            angle: -90,
            position: 'left',
            offset: 15,
            textAnchor: 'middle', // Center align the text
          }}
          tickFormatter={value => parseFloat(value.toFixed(2))}
        />
        <Tooltip
          labelFormatter={t => format(new Date(t), 'dd/MM/yyyy HH:mm:ss')}
          formatter={(value, name) => [`${value.toFixed(2)}`, name]}
        />
        <Legend />
        {tensionKeys.map((key, idx) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            name={key}
            dot={false}
            stroke={COLORS[idx % COLORS.length]}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

export default TensionChart
