import { useEffect, useMemo } from "react";
import { create } from "zustand";
import {
  couch,
  find as couchFind,
  createIndex,
  getDoc,
  upsertDoc,
} from "../../api/new/couch.ts";

// === Config do banco ===
const DB = "lindsay-data";

// garante os índices Mango (cliente e revenda) apenas 1x
let ensuredIndexCliente = false;
let ensuredIndexRevenda = false;
let ensuredIndexAdmin = false;
async function ensureIndexCliente() {
  if (ensuredIndexCliente) return;
  try {
    await createIndex(DB, {
      fields: ["table", "cnpj_cliente"],
      name: "idx_table_cnpj_cliente",
      type: "json",
    });
  } catch (e) {
    if (e?.response?.status !== 409)
      console.warn("[DataStore] Índice cnpj_cliente:", e?.message || e);
  }
  ensuredIndexCliente = true;
}
async function ensureIndexRevenda() {
  if (ensuredIndexRevenda) return;
  try {
    await createIndex(DB, {
      fields: ["table", "cnpj_revenda"],
      name: "idx_table_cnpj_revenda",
      type: "json",
    });
  } catch (e) {
    if (e?.response?.status !== 409)
      console.warn("[DataStore] Índice cnpj_revenda:", e?.message || e);
  }
  ensuredIndexRevenda = true;
}
async function ensureIndexAdmin() {
  if (ensuredIndexAdmin) return;
  try {
    await createIndex(DB, {
      fields: ["table", "cnpj_admin"],
      name: "idx_table_cnpj_admin",
      type: "json",
    });
  } catch (e) {
    if (e?.response?.status !== 409)
      console.warn("[DataStore] Índice cnpj_admin:", e?.message || e);
  }
  ensuredIndexAdmin = true;
}

// gerador simples de _id
const genId = () =>
  `irrigador:${Date.now()}${Math.random().toString(36).slice(2, 8)}`;

export const useDataStoreIrrigadores = create((set, get) => ({
  irrigadores: [],
  syncTimestamp: Date.now(),
  isLoading: false,
  error: null,

  /**
   * Busca irrigadores por CNPJ.
   * @param cnpj - CNPJ do cliente (cnpj_cliente), da revenda (cnpj_revenda) ou do admin (cnpj_admin)
   * @param filterBy - 'cnpj_cliente' | 'cnpj_revenda' | 'cnpj_admin' | 'all'
   */
  fetchIrrigadores: async (cnpj, filterBy = "cnpj_cliente") => {
    //console.log(`[DataStore] fetchIrrigadores iniciado. CNPJ: ${cnpj}, filterBy: ${filterBy}`);
    if (filterBy !== "all" && !cnpj) {
      set({ irrigadores: [], isLoading: false });
      return;
    }
    set({ isLoading: true, error: null });
    try {
      if (filterBy === "cnpj_revenda") {
        await ensureIndexRevenda();
      } else if (filterBy === "cnpj_admin") {
        await ensureIndexAdmin();
      } else {
        await ensureIndexCliente();
      }
      const selector =
        filterBy === "all"
          ? { table: "irrigadores" }
          : { table: "irrigadores", [filterBy]: cnpj };

      const data = await couchFind(DB, {
        selector,
        limit: 500,
      });
      set({
        irrigadores: data.docs || [],
        syncTimestamp: Date.now(),
        isLoading: false,
      });
    } catch (err) {
      console.error("[DataStore] fetchIrrigadores error:", err);
      set({
        error: err?.message || "Erro ao buscar irrigadores",
        isLoading: false,
      });
    }
  },

  // recebe (payload, cnpjCliente)
  addIrrigador: async (payload, cnpjCliente) => {
    try {
      const doc = {
        ...payload,
        table: "irrigadores",
        cnpj_cliente: cnpjCliente,
      };

      // upsertDoc exige _id – se não vier, geramos um
      const _id = doc._id || genId();
      const res = await upsertDoc(DB, { ...doc, _id });

      set((state) => ({
        irrigadores: [
          ...state.irrigadores,
          { ...doc, _id: res.id, _rev: res.rev },
        ],
        syncTimestamp: Date.now(),
      }));

      return { id: res.id, rev: res.rev };
    } catch (err) {
      console.error("[DataStore] addIrrigador error:", err);
      throw err;
    }
  },

  updateIrrigador: async (_id, updates) => {
    try {
      // pega a versão atual no Couch para obter _rev
      const current = await getDoc(DB, _id);
      const merged = { ...current, ...updates, _rev: current._rev };

      // salva com PUT direto
      const { data } = await couch.put(
        `/${DB}/${encodeURIComponent(_id)}`,
        merged,
      );
      const rev = data.rev || data._rev;

      set((state) => ({
        irrigadores: state.irrigadores.map((doc) =>
          doc._id === _id ? { ...doc, ...updates, _rev: rev } : doc,
        ),
        syncTimestamp: Date.now(),
      }));

      return { id: _id, rev };
    } catch (err) {
      // conflito -> refaz com _rev mais recente
      if (err?.response?.status === 409) {
        console.warn(
          "[DataStore] updateIrrigador 409 — tentando novamente com _rev novo.",
        );
        const latest = await getDoc(DB, _id);
        const merged = { ...latest, ...updates, _rev: latest._rev };
        const { data } = await couch.put(
          `/${DB}/${encodeURIComponent(_id)}`,
          merged,
        );
        const rev = data.rev || data._rev;

        set((state) => ({
          irrigadores: state.irrigadores.map((doc) =>
            doc._id === _id ? { ...doc, ...updates, _rev: rev } : doc,
          ),
          syncTimestamp: Date.now(),
        }));
        return { id: _id, rev };
      }
      console.error("[DataStore] updateIrrigador error:", err);
      throw err;
    }
  },

  removeIrrigador: async (_id) => {
    try {
      // precisa do _rev pra deletar
      const cur = await getDoc(DB, _id);
      const res = await couch.delete(`/${DB}/${encodeURIComponent(_id)}`, {
        params: { rev: cur._rev },
      });
      if (res.status >= 400) {
        throw new Error(`Couch DELETE failed: ${res.status}`);
      }

      set((state) => ({
        irrigadores: state.irrigadores.filter((d) => d._id !== _id),
        syncTimestamp: Date.now(),
      }));
    } catch (err) {
      console.error("[DataStore] removeIrrigador error:", err);
      throw err;
    }
  },
}));

/**
 * Hook para listar irrigadores.
 * - Cliente: usa cnpj do usuário e filterBy 'cnpj_cliente' (só seus pivôs).
 * - Revenda: usa cnpj do usuário e filterBy 'cnpj_revenda' (todos os pivôs dos clientes cadastrados).
 * - Admin: filterBy 'cnpj_admin' (pivôs de todas as revendas/clientes vinculados ao admin).
 * @param cnpj - CNPJ do usuário logado (cliente, revenda ou admin)
 * @param userType - 'cliente' | 'revenda' | 'admin'
 */
export function useIrrigadores(cnpj, userType) {
  const irrigadores = useDataStoreIrrigadores((s) => s.irrigadores);
  const fetchIrrigadores = useDataStoreIrrigadores((s) => s.fetchIrrigadores);
  const filterBy =
    userType === "superadmin"
      ? "all"
      : userType === "admin"
      ? "cnpj_admin"
      : userType === "revenda"
        ? "cnpj_revenda"
        : "cnpj_cliente";
  //console.log(`[useIrrigadores] userType: ${userType}, filterBy: ${filterBy}, cnpj: ${cnpj}`);

  useEffect(() => {
    if (cnpj) fetchIrrigadores(cnpj, filterBy);
  }, [fetchIrrigadores, cnpj, filterBy]);

  return useMemo(() => irrigadores, [irrigadores]);
}
