// getRecent.ts
// Pega o mais recente de cada vetor usando /_all_docs com keys.

import { getDoc, getDocAll } from "../../api/new/couch";

export interface RecentTensaoDoc {
  _id: string;
  table: "tensao_recente";
  name: "Tensao";
  type: "A" | "B" | "C" | "D";
  irrigadorId: string;
  monitor_range: string;
  updated_at: string; // ISO
  data: {
    timestamp: string; // ISO
    monitores: Record<
      string,
      {
        voltage: number;
        status: number;
      }
    >;
  };
}

export interface RecentSWDoc {
  _id: string;
  table: "sw_recente";
  name: "Status";
  irrigadorId: string;
  updated_at: string; // ISO
  data: {
    timestamp: string; // ISO
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

export interface RecentAll {
  tensao: Partial<Record<"A" | "B" | "C" | "D", RecentTensaoDoc | null>>;
  sw: RecentSWDoc | null;
}

/** Busca todos os snapshots recentes (A/B/C/D + SW) de um irrigador. */
export async function getRecentAll(db: string, irrigadorId: string): Promise<RecentAll> {
  const keys = [
    `recente_tensao::${irrigadorId}::A`,
    `recente_tensao::${irrigadorId}::B`,

    `recente_sw::${irrigadorId}`,
  ];

  const data = await getDocAll(db, { keys, include_docs: true });
  const out: RecentAll = { tensao: {}, sw: null };

  for (const row of data.rows ?? []) {
    if (!row?.doc) continue;
    const key: string = row.key;
    if (key.endsWith("::A")) out.tensao.A = row.doc as RecentTensaoDoc;
    else if (key.endsWith("::B")) out.tensao.B = row.doc as RecentTensaoDoc;
    else if (key.endsWith("::C")) out.tensao.C = row.doc as RecentTensaoDoc;
    else if (key.endsWith("::D")) out.tensao.D = row.doc as RecentTensaoDoc;
    else if (key.startsWith("recente_sw::")) out.sw = row.doc as RecentSWDoc;
  }

  return out;
}

/** Busca o snapshot recente de tensão por tipo (A|B|C|D). */
export async function getRecentTensao(
  db: string,
  irrigadorId: string,
  tipo: "A" | "B" | "C" | "D"
): Promise<RecentTensaoDoc | null> {
  try {
    const id = `recente_tensao::${irrigadorId}::${tipo}`;
    const doc = await getDoc(db, id);
    return doc as RecentTensaoDoc;
  } catch (e: any) {
    if (e?.response?.status === 404) return null;
    throw e;
  }
}

/** Busca o snapshot recente de SW. */
export async function getRecentSW(
  db: string,
  irrigadorId: string
): Promise<RecentSWDoc | null> {
  try {
    const id = `recente_sw::${irrigadorId}`;
    const doc = await getDoc(db, id);
    return doc as RecentSWDoc;
  } catch (e: any) {
    if (e?.response?.status === 404) return null;
    throw e;
  }
}
