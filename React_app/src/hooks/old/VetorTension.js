import { useEffect, useMemo } from "react"
import useMessageStore from "../stores/messageStore"

export default function useVetorTension(irrigadorIds = []) {
  const { parsedMessages = [], isLoading, error, initialize } = useMessageStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  return useMemo(() => {
    if (isLoading || error) {
      return irrigadorIds.reduce((acc, id) => {
        acc[id] = {
          all: [],
          last24h: [],
          last7d: [],
          last30d: [],
          latest: null,
          // chaves antigas
          vectorsTension: [],
          latestTension: null
        }
        return acc
      }, {})
    }

    // 1) filtra raws válidos de 9 campos
    const raws = parsedMessages
      .filter(m => m.type === 'string')
      .map(m => m.data)
      .filter(d => d.split(';').length === 9)

    // 2) agrupa por “id+sufixo” (A/B)
    const groupedRaw = raws.reduce((acc, raw) => {
      const idSuf = raw.split(';')[0]
      if (!acc[idSuf]) acc[idSuf] = new Set()
      acc[idSuf].add(raw)
      return acc
    }, {} )

    const tensionMap = {}

    // define os cortes de data
    const now = new Date()
    const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const cutoff7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const cutoff30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    irrigadorIds.forEach(pureId => {
      const setA = groupedRaw[pureId + 'A'] || new Set()
      const setB = groupedRaw[pureId + 'B'] || new Set()

      const records = [
        ...[...setA].map(raw => {
          const [, ts, ...vals] = raw.split(';')
          return { ts: new Date(ts), vals, tipo: 'A' }
        }),
        ...[...setB].map(raw => {
          const [, ts, ...vals] = raw.split(';')
          return { ts: new Date(ts), vals, tipo: 'B' }
        })
      ]
      records.sort((a, b) => a.ts.getTime() - b.ts.getTime())

      let lastA = null, lastB = null
      const unifiedSet = new Set()

      records.forEach(({ ts, vals, tipo }) => {
        if (tipo === 'A') lastA = { ts, vals }
        else lastB = { ts, vals }

        if (lastA && lastB) {
          const iso = ts.toISOString()
          const merged = [...lastA.vals, ...lastB.vals].join(';')
          unifiedSet.add(`${pureId};${iso};${merged}`)
        }
      })

      // transforma em array ordenado
      const all = Array.from(unifiedSet)
      // filtra por timestamp
      const last24h = all.filter(raw => {
        const ts = new Date(raw.split(';')[1])
        return ts >= cutoff24h
      })
      const last7d = all.filter(raw => {
        const ts = new Date(raw.split(';')[1])
        return ts >= cutoff7d
      })
      const last30d = all.filter(raw => {
        const ts = new Date(raw.split(';')[1])
        return ts >= cutoff30d
      })

      const latest = all.length ? all[all.length - 1] : null

      tensionMap[pureId] = {
        // novos campos para os gráficos
        all,
        last24h,
        last7d,
        last30d,
        latest,
        // compatibilidade com o antigo nome
        vectorsTension: all,
        latestTension: latest
      }
    })

    return tensionMap
  }, [parsedMessages, isLoading, error, irrigadorIds])
}
