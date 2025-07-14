import { useEffect, useMemo } from 'react'
import useMessageStore from '../stores/messageStore'

export default function useVetorTension(irrigadorIds = []) {
  const { parsedMessages = [], isLoading, error, initialize } = useMessageStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  return useMemo(() => {
    // Enquanto carrega ou deu erro, devolve um map “vazio”
    if (isLoading || error) {
      return irrigadorIds.reduce((acc, id) => {
        acc[id] = {
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
      const idSuf = raw.split(';')[0] // ex: "11111A" ou "11111B"
      if (!acc[idSuf]) acc[idSuf] = new Set()
      acc[idSuf].add(raw)
      return acc
    }, {})

    // 3) para cada irrigador puro, gera o unifiedSet e preenche tensionMap
    const tensionMap = {}

    irrigadorIds.forEach(pureId => {
      const setA = groupedRaw[pureId + 'A'] || new Set()
      const setB = groupedRaw[pureId + 'B'] || new Set()

      // junta A e B com timestamp
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

      // ordena por ts
      records.sort((a, b) => a.ts - b.ts)

      let lastA = null, lastB = null
      const unifiedSet = new Set()

      // percorre e vai “mergeando” quando tiver A e B
      records.forEach(({ ts, vals, tipo }) => {
        if (tipo === 'A') lastA = { ts, vals }
        else               lastB = { ts, vals }

        if (lastA && lastB) {
          const iso    = ts.toISOString()
          const merged = [...lastA.vals, ...lastB.vals].join(';')
          unifiedSet.add(`${pureId};${iso};${merged}`)
        }
      })

      // converte pra array e extrai o último
      const vectorsTension = Array.from(unifiedSet)
      const latestTension  = vectorsTension.length ? vectorsTension[vectorsTension.length - 1] : null

      tensionMap[pureId] = { vectorsTension, latestTension }
    })

    return tensionMap
  }, [parsedMessages, isLoading, error, irrigadorIds])
}
