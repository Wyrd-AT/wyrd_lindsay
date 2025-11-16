// getHistory.ts
// Histórico completo via Mango (_find) com paginação/ordenação/filtros.

import { createIndex, find } from "../../api/new/couch";

export type SortOrder = "asc" | "desc";

export interface PageOpts {
  limit?: number;    // default 200
  skip?: number;     // default 0
  sort?: SortOrder;  // default "desc"
  fromISO?: string;  // filtrar timestamp >= fromISO
  toISO?: string;    // filtrar timestamp <= toISO
}

export interface TensaoRawDoc {
  _id: string;
  table: "tensao_raw";
  irrigadorId: string;
  tipo: "A" | "B" | "C" | "D";
  timestamp: string;
  timestamp_formatted: string;
  monitor_range: string;
  data: {
    monitores: Record<
      string,
      {
        voltage: number;
        status: number;
      }
    >;
  };
}

export interface SWRawDoc {
  _id: string;
  table: "sw_raw";
  irrigadorId: string;
  timestamp: string;
  timestamp_formatted: string;
  data: {
    painel_1: number;
    painel_2: number;
    lampada: number;
    sirene: number;
    manutencao: number;
    monitores: Record<
      string,
      {
        fim_de_curso_1: number;
        fim_de_curso_2: number;
        armadilha: number;
        status: number;
      }
    >;
  };
}

export interface EventDoc {
  _id: string;
  table: "events";
  irrigadorId: string;
  timestamp: string;
  timestamp_formatted: string;
  eventType: string;        // ex.: "A" no seu documento
  eventCode?: string;       // opcional — não aparece no seu exemplo
  status: string;
  description: string;
  responsible: string;
}

/** Monta selector com range por timestamp se fornecido. */
function buildSelector(
  base: Record<string, any>,
  fromISO?: string,
  toISO?: string
) {
  if (fromISO || toISO) {
    base.timestamp = {};
    if (fromISO) base.timestamp.$gte = fromISO;
    if (toISO) base.timestamp.$lte = toISO;
  }
  return base;
}

/** Garante que o campo de sort esteja presente no selector (requisito Mango). */
function ensureSortFieldInSelector(sel: Record<string, any>, field: string) {
  if (!sel[field]) {
    sel[field] = { $gte: "\u0000" }; // suficiente para habilitar sort por string ISO
  }
}

/** Calcula limit efetivo quando o driver não suporta skip nativo. */
function withClientSideSkip(limit: number, skip: number) {
  const safeLimit = Math.max(0, limit | 0);
  const safeSkip = Math.max(0, skip | 0);
  return { effectiveLimit: safeLimit + safeSkip, safeSkip, safeLimit };
}

/** Histórico de tensão (pode filtrar por tipo). */
export async function getTensaoHistory(
  db: string,
  irrigadorId: string,
  opts: PageOpts & { tipo?: "A" | "B" } = {}
): Promise<TensaoRawDoc[]> {
  const { sort = "asc", fromISO, toISO, tipo } = opts;
  const sel: any = { table: "tensao_raw", irrigadorId };
  if (tipo) sel.tipo = tipo;
  buildSelector(sel, fromISO, toISO);
  ensureSortFieldInSelector(sel, "timestamp");

  //console.log('Query selector:', JSON.stringify(sel, null, 2));

  // PASSO 1: Buscar TODOS os documentos do período (SEM sort para evitar erro 400)
  try {
    const { docs: allDocs } = await find(db, {
      selector: sel,
      limit: 100000, // Limite alto para pegar todos os dados do período
      // Removido sort - faremos no cliente
    });

    //console.log(`Fetched ${allDocs.length} tensao docs for tipo=${tipo || 'all'}`);

    // PASSO 2: Ordenar no cliente por timestamp
    const sortedDocs = (allDocs as TensaoRawDoc[]).sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return sort === 'asc' ? timeA - timeB : timeB - timeA;
    });

    // REMOVIDO: Agregação movida para useTensionData (depois do merge A+B)
    // Retornar TODOS os docs ordenados
    return sortedDocs;
  } catch (error: any) {
    console.error('Error in getTensaoHistory:', error);
    console.error('Error response:', error.response?.data);
    throw error;
  }
}

/** Histórico de SW. */
export async function getSWHistory(
  db: string,
  irrigadorId: string,
  opts: PageOpts = {}
): Promise<SWRawDoc[]> {
  const { limit = 200, skip = 0, sort = "desc", fromISO, toISO } = opts;
  const sel: any = { table: "sw_raw", irrigadorId };
  buildSelector(sel, fromISO, toISO);
  ensureSortFieldInSelector(sel, "timestamp");

  const sortSpec = [{ timestamp: sort === "asc" ? "asc" : "desc" }];

  const { effectiveLimit, safeSkip, safeLimit } = withClientSideSkip(limit, skip);

  const { docs } = await find(db, {
    selector: sel,
    limit: effectiveLimit,
    // use_index: "idx_sw_raw_irrigador_ts",
  });

  return (docs as SWRawDoc[]).slice(safeSkip, safeSkip + safeLimit);
}

type GetEventsHistoryOpts =
  PageOpts & {
    irrigadorId?: string;
    table?: "events" | "alarme" | "evento"; // default "events"
    eventType?: string; // opcional para filtrar
  };

export async function getEventsHistory(
  db: string,
  opts: GetEventsHistoryOpts = {}
): Promise<EventDoc[]> {
  const {
    limit = 300,
    skip = 0,
    sort = "desc",
    fromISO,
    toISO,
    irrigadorId,
    table = "events",
    eventType,
  } = opts;

  const sel: any = { table };

  if (irrigadorId) sel.irrigadorId = irrigadorId;
  if (table) sel.table = table;
  buildSelector(sel, fromISO, toISO);

  const sortSpec = [{ timestamp: sort === "asc" ? "asc" : "desc" }];

  const { effectiveLimit, safeSkip, safeLimit } = withClientSideSkip(limit, skip);

  const { docs } = await find(db, {
    selector: sel,
    limit: effectiveLimit,
    // use_index: "idx_events_irrigador_ts",
  });
  const arr = Array.isArray(docs) ? (docs as EventDoc[]) : ([] as EventDoc[]);
  return arr.slice(safeSkip, safeSkip + safeLimit);

}

/** (Opcional) Garante índices Mango pra ordenar por timestamp. Rode 1x num fluxo admin. */
export async function ensureIndexes(db: string) {
  try {
    await createIndex(db, {
      fields: ["table", "irrigadorId", "tipo", "timestamp"],
      name: "idx_tensao_raw_irrigador_tipo_ts",
      type: "json",
    });
  } catch {}
  try {
    await createIndex(db, {
      fields: ["table", "irrigadorId", "timestamp"],
      name: "idx_sw_raw_irrigador_ts",
      type: "json",
    });
  } catch {}
  try {
    await createIndex(db, {
      fields: ["table", "irrigadorId", "eventType", "timestamp"], // inclui eventType se você filtrar por ele
      name: "idx_events_irrigador_eventType_ts",
      type: "json",
    });
  } catch {}
}
