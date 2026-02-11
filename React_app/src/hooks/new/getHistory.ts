import { Monitor } from "./../../helpers/helperOverview";
// getHistory.ts
// Histórico completo via Views CouchDB para melhor performance.

import {
  createIndex,
  queryView,
  ensureHistoryViews,
} from "../../api/new/couch";

export type SortOrder = "asc" | "desc";

export interface PageOpts {
  limit?: number; // default 200
  skip?: number; // default 0
  sort?: SortOrder; // default "desc"
  fromISO?: string; // filtrar timestamp >= fromISO
  toISO?: string; // filtrar timestamp <= toISO
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
  armadilha: string;
  description: string;
  estado: string;
  eventType: string;
  irrigadorId: string;
  monitor: string | number;
  responsible: string;
  status: string;
  table: "events";
  timestamp: string;
  timestamp_formatted: string;
  _id: string;
  _rev: string;
}

// Re-exporta para inicialização das views
export { ensureHistoryViews };

/** Histórico de tensão usando View (muito mais eficiente para grandes volumes). */
export async function getTensaoHistory(
  db: string,
  irrigadorId: string,
  opts: PageOpts & { tipo?: "A" | "B" } = {},
): Promise<TensaoRawDoc[]> {
  const { sort = "asc", fromISO, toISO, tipo, limit = 50000 } = opts;

  // View key: [irrigadorId, tipo, timestamp]
  const tipoKey = tipo || "";
  const startTimestamp = fromISO || "";
  const endTimestamp = toISO || "\ufff0"; // \ufff0 = maior que qualquer string

  try {
    const result = await queryView<TensaoRawDoc>(
      db,
      "history",
      "tensao_by_irrigador",
      {
        startkey:
          sort === "asc"
            ? [irrigadorId, tipoKey, startTimestamp]
            : [irrigadorId, tipoKey, endTimestamp],
        endkey:
          sort === "asc"
            ? [irrigadorId, tipoKey, endTimestamp]
            : [irrigadorId, tipoKey, startTimestamp],
        include_docs: true,
        descending: sort === "desc",
        limit, // Limite para evitar timeout em períodos grandes
        stale: "update_after", // Retorna resultado imediato, atualiza índice em background
      },
    );

    // Extrair docs das rows
    const docs = result.rows
      .map((row) => row.doc)
      .filter((doc): doc is TensaoRawDoc => doc !== undefined);

    // Se tipo não foi especificado, a view retorna todos os tipos
    if (tipo) {
      return docs.filter((doc) => doc.tipo === tipo);
    }

    return docs;
  } catch (error: any) {
    console.error("Error in getTensaoHistory:", error);
    console.error("Error response:", error.response?.data);
    throw error;
  }
}

/** Histórico de SW usando View. */
export async function getSWHistory(
  db: string,
  irrigadorId: string,
  opts: PageOpts = {},
): Promise<SWRawDoc[]> {
  const { limit = 200, skip = 0, sort = "desc", fromISO, toISO } = opts;

  // View key: [irrigadorId, timestamp]
  const startTimestamp = fromISO || "";
  const endTimestamp = toISO || "\ufff0";

  try {
    const result = await queryView<SWRawDoc>(db, "history", "sw_by_irrigador", {
      startkey:
        sort === "asc"
          ? [irrigadorId, startTimestamp]
          : [irrigadorId, endTimestamp],
      endkey:
        sort === "asc"
          ? [irrigadorId, endTimestamp]
          : [irrigadorId, startTimestamp],
      include_docs: true,
      descending: sort === "desc",
      limit: limit + skip, // Pega um pouco mais para o skip
      skip: skip,
    });

    return result.rows
      .map((row) => row.doc)
      .filter((doc): doc is SWRawDoc => doc !== undefined);
  } catch (error: any) {
    console.error("Error in getSWHistory:", error);
    throw error;
  }
}

type GetEventsHistoryOpts = PageOpts & {
  irrigadorId?: string;
  table?: "events" | "alarme" | "evento"; // default "events"
  eventType?: string; // opcional para filtrar
};

export async function getEventsHistory(
  db: string,
  opts: GetEventsHistoryOpts = {},
): Promise<EventDoc[]> {
  const {
    limit = 300,
    skip = 0,
    sort = "desc",
    fromISO,
    toISO,
    irrigadorId,
    eventType,
  } = opts;

  const startTimestamp = fromISO || "";
  const endTimestamp = toISO || "\ufff0";

  try {
    let result;

    if (irrigadorId && eventType) {
      // Caso 1: Temos irrigadorId E eventType - busca exata
      // View key: [irrigadorId, eventType, timestamp]
      result = await queryView<EventDoc>(db, "history", "events_by_irrigador", {
        startkey:
          sort === "asc"
            ? [irrigadorId, eventType, startTimestamp]
            : [irrigadorId, eventType, endTimestamp],
        endkey:
          sort === "asc"
            ? [irrigadorId, eventType, endTimestamp]
            : [irrigadorId, eventType, startTimestamp],
        include_docs: true,
        descending: sort === "desc",
        limit: limit + skip,
        skip: skip,
        stale: "update_after",
      });
    } else if (irrigadorId) {
      // Caso 2: Só temos irrigadorId - busca todos eventTypes desse irrigador
      // Usar range de "" até "\ufff0" no eventType
      result = await queryView<EventDoc>(db, "history", "events_by_irrigador", {
        startkey:
          sort === "asc"
            ? [irrigadorId, "", startTimestamp]
            : [irrigadorId, "\ufff0", endTimestamp],
        endkey:
          sort === "asc"
            ? [irrigadorId, "\ufff0", endTimestamp]
            : [irrigadorId, "", startTimestamp],
        include_docs: true,
        descending: sort === "desc",
        limit: limit + skip,
        skip: skip,
        stale: "update_after",
      });
    } else {
      // Caso 3: Busca global por timestamp
      result = await queryView<EventDoc>(db, "history", "events_by_timestamp", {
        startkey: sort === "asc" ? startTimestamp : endTimestamp,
        endkey: sort === "asc" ? endTimestamp : startTimestamp,
        include_docs: true,
        descending: sort === "desc",
        limit: limit + skip,
        skip: skip,
        stale: "update_after",
      });
    }

    let docs = result.rows
      .map((row) => row.doc)
      .filter((doc): doc is EventDoc => doc !== undefined);

    // Filtrar por eventType no cliente se necessário (caso 2 e 3)
    if (eventType && !irrigadorId) {
      docs = docs.filter((doc) => doc.eventType === eventType);
    }

    return docs;
  } catch (error: any) {
    console.error("Error in getEventsHistory:", error);
    console.error("Error response:", error.response?.data);
    throw error;
  }
}

export async function getAlertHistory(
  db: string,
  opts: GetEventsHistoryOpts = {},
): Promise<EventDoc[]> {
  const {
    limit = 300,
    skip = 0,
    sort = "desc",
    fromISO,
    toISO,
    irrigadorId,
  } = opts;

  if (!irrigadorId) {
    throw new Error(
      "O parâmetro 'irrigadorId' é obrigatório para esta consulta.",
    );
  }

  const startTimestamp = fromISO || "";
  const endTimestamp = toISO || "\ufff0";

  try {
    const startKey = [irrigadorId, startTimestamp];
    const endKey = [irrigadorId, endTimestamp];

    const result = await queryView<EventDoc>(db, "history", "alert_history", {
      startkey: sort === "asc" ? startKey : endKey,
      endkey: sort === "asc" ? endKey : startKey,
      include_docs: true,
      descending: sort === "desc",
      limit: limit + skip,
      skip: skip,
      stale: "update_after",
    });

    let docs = result.rows
      .map((row) => row.doc)
      .filter((doc): doc is EventDoc => doc !== undefined);

    return docs;
  } catch (error: any) {
    console.error("Error in getAlertHistory:", error);
    throw error;
  }
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
