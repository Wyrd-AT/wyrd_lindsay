import { RecentSWDoc, RecentTensaoDoc } from "../hooks/new/getRecent";
import useMessageStore from "../stores/new/messageStore";

export type Summary =
  | "Normal"
  | "Ausente"
  | "Alarmado"
  | "Reconhecido"
  | "Alarme OFF"
  | "Desconhecido";
export type Monitor = {
  statusSw1: string;
  statusSw2: string;
  armadilha: number;
  statusTensao: Summary;
};
export type ParsedSW = {
  status_manutencao: "0" | "1";
  painel_1: string;
  painel_2?: string;
  monitores: Monitor[];
};
export type DeviceCard = {
  id: string;
  title: string;
  statuses: { label: string; value: string | number }[];
};

export interface Irrigador {
  codigo: string;
  irrigador?: string;
  equipamentos?: string[];
}

export interface OverviewProps {
  pivoId: string | null;
  cnpjCliente: string | null;
  email?: string;
  equipamentoNames?: string[];
}

/* ----------------- helpers de data ----------------- */
export function parseBrToMs(ts?: string) {
  if (!ts) return NaN;
  const m = ts.match(/^(\d{2}):(\d{2}):(\d{2})\s+(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return NaN;
  const [, hh, mm, ss, dd, MM, yyyy] = m;
  return new Date(`${yyyy}-${MM}-${dd}T${hh}:${mm}:${ss}`).getTime();
}

/* ----------------- helpers de parse SW/Tensão ----------------- */
export function parseSwVectorOverview(data: RecentSWDoc["data"] | undefined) {
  if (!data || typeof data !== "object") return null;

  const toStr = (v: any) => (v == null ? "0" : String(v));
  const mArr: Monitor[] = [];

  if (data.monitores && typeof data.monitores === "object") {
    const keys = Object.keys(data.monitores).sort();
    for (const k of keys) {
      const m: any = (data.monitores as any)[k] || {};
      mArr.push({
        statusSw1: toStr(m.fim_de_curso_1),
        statusSw2: toStr(m.fim_de_curso_2),
        armadilha:
          typeof m.armadilha === "number"
            ? m.armadilha
            : Number(m.armadilha || 0),
        statusTensao: m.status,
      });
    }
  }

  return {
    status_manutencao: (Number(data.manutencao) > 0 ? "1" : "0") as "0" | "1",
    painel_1: toStr(data.painel_1),
    painel_2: toStr(data.painel_2),
    monitores: mArr,
  } as ParsedSW;
}

export function monitoresToVoltageMap(
  doc?: RecentTensaoDoc,
): Map<number, number> {
  // Converte { monitor_01: {voltage}, ... } => Map(1=>V, 2=>V, ...)
  const map = new Map<number, number>();
  if (!doc?.data?.monitores) return map;

  for (const [key, val] of Object.entries(doc.data.monitores)) {
    const m = key.match(/^monitor_(\d{2})$/);
    if (!m) continue;
    const mt = Number(m[1]); // 01..28
    const v = Number((val as any).voltage);
    if (Number.isFinite(mt) && Number.isFinite(v)) map.set(mt, v);
  }
  return map;
}

export async function sendCommand(
  command: "update" | "sirene" | "ack" | "man",
  successText: string,
  failureText: string,
  pivoId: string | null,
  setResponseMsg: (msg: string) => void,
  setLoading: (loading: boolean) => void,
  loading: boolean,
) {
  if (!pivoId) {
    setResponseMsg("❌ Nenhuma máquina selecionada.");
    return;
  }

  if (loading) return; // Evita múltiplos cliques

  try {
    setLoading(true);
    setResponseMsg("");

    // Formata timestamp em São Paulo (igual à versão web)
    const now = new Date();
    const timestamp =
      new Intl.DateTimeFormat("sv-SE", {
        timeZone: "America/Sao_Paulo",
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
        .format(now)
        .replace(" ", "T") + "-03:00";

    const payload = `${pivoId};${command}`;
    const doc = {
      topic: `lindsay/comandos/${pivoId}`,
      payload,
      origin: "app",
      table: "command",
      qos: 0,
      timestamp,
    };

    const sucess = useMessageStore.getState().postMessage(doc);
    //console.log(sucess)
    setResponseMsg(`✅ ${successText}`);
  } catch (err) {
    console.error("[Overview] erro ao enviar comando:", err);
    setResponseMsg(`❌ ${failureText}`);
    throw err; // Propaga erro para quem chamou
  } finally {
    setLoading(false);
  }
}
/* ============================================================= */
