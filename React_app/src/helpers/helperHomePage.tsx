import { RecentSWDoc } from "../hooks/new/getRecent";

export function toDateISOorNull(s?: string | null) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function parseBrTimestamp(ts?: string | null) {
  if (!ts || typeof ts !== 'string') return null;
  const m = ts.match(/^(\d{2}):(\d{2}):(\d{2})\s+(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, hh, mm, ss, dd, MM, yyyy] = m;
  const iso = `${yyyy}-${MM}-${dd}T${hh}:${mm}:${ss}`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

export function isAlarm(v: any) {
  return typeof v === 'number' && v == 1;
}

/** Conta alarmes APENAS do último snapshot recebido */
export function parseSwVector(data: RecentSWDoc['data'] | undefined, fallbackUpdatedAt?: string) {
  if (!data || typeof data !== 'object') {
    return { totalAlarmado: 0, date: '—' };
  }

  // timestamp exibido: prioriza data do payload; senão usa updated_at
  const dIso = toDateISOorNull(data.timestamp);
  const dBr  = parseBrTimestamp(data.timestamp);
  const dUpd = toDateISOorNull(fallbackUpdatedAt);
  const finalDate = dIso || dBr || dUpd || null;

  // conta SOMENTE os alarmes do snapshot atual
  let total = 0;

  // bits globais que você quer considerar
  (['painel_1', 'painel_2'] as const).forEach((k) => {
    if (isAlarm((data as any)[k])) total += 1;
  });

  // monitores: soma 1 por monitor se QUALQUER bit relevante estiver 1
  if (data.monitores && typeof data.monitores === 'object') {
    for (const key of Object.keys(data.monitores)) {
      const m = (data.monitores as any)[key] || {};
      if (isAlarm(m.fim_de_curso_1) || isAlarm(m.fim_de_curso_2) || isAlarm(m.status)) {
        total += 1;
      }
    }
  }

  const dateStr = finalDate
    ? finalDate.toLocaleString()
    : (data.timestamp || fallbackUpdatedAt || '—');

  return { totalAlarmado: total, date: dateStr };
}