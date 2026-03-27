import React, { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "../../stores/new/authStore";
import { getRecentAll } from "../../hooks/new/getRecent";
import { parseSwVector } from "../../helpers/helperHomePage";
import { matchesSearchTerm } from "../../utils/search";
import { getDoc } from "../../api/new/couch";
import ModalEditIrrigador from "./ModalEditIrrigador";

interface Pivo {
  _id: string;
  codigo: string;
  nome: string;
  owner_id: string;
  gerente_id: string;
  ativo: boolean;
  created_at: string;
  location?: {
    lat: number;
    lng: number;
  };
  equipamentos?: string[];
  contacts?: {
    whatsapp?: string;
    sms?: string;
    email?: string;
  };
  alarmCount?: number;
  lastAlertDate?: string;
  [key: string]: any;
}

export interface PivosSectionProps {
  /**
   * Função para buscar pivôs do usuário
   * Filtra automaticamente por role:
   * - Admin: todos
   * - Gerente: pivôs dos seus clientes
   * - Cliente: seus pivôs
   */
  fetchPivos?: () => Promise<Pivo[]>;

  /**
   * Função para criar novo pivô (cliente only)
   */
  onCreatePivo?: (pivoData: any) => Promise<void>;

  /**
   * Callback ao selecionar um pivô
   */
  onSelectPivo?: (pivo: Pivo) => void;

  /**
   * Atualizar pivô (admin/superadmin)
   */
  onUpdatePivo?: (pivoId: string, pivoData: Record<string, any>) => Promise<void>;

  /**
   * Deletar pivô (admin/superadmin)
   */
  onDeletePivo?: (pivoId: string) => Promise<void>;

  /**
   * Mostrar botão de criar pivô (apenas para cliente)
   */
  showCreateButton?: boolean;

  /**
   * Texto de busca para filtrar a lista atual.
   */
  searchTerm?: string;
}

/**
 * Componente para exibir lista de pivôs
 * FASE 2: Mostra pivôs com base nas permissões do usuário
 *
 * Admin:    vê TODOS os pivôs
 * Gerente:  vê pivôs dos seus clientes
 * Cliente:  vê seus próprios pivôs
 */
export default function PivosSection({
  fetchPivos,
  onCreatePivo,
  onSelectPivo,
  onUpdatePivo,
  onDeletePivo,
  showCreateButton = false,
  searchTerm = "",
}: PivosSectionProps) {
  const authState = useAuthStore();
  const [pivos, setPivos] = useState<Pivo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPivo, setNewPivo] = useState({
    codigo: "",
    nome: "",
    location: null,
  });

  const loadPivos = useCallback(async () => {
    if (!fetchPivos) return;

    setLoading(true);
    setError(null);

    try {
      const data = await fetchPivos();
      const base = data || [];
      const enriched = await Promise.all(
        base.map(async (pivo: Pivo) => {
          try {
            const recent = await getRecentAll("lindsay-data", String(pivo.codigo || ""));
            const sw = recent?.sw;
            const parsed = sw
              ? parseSwVector(sw.data, sw.updated_at)
              : { totalAlarmado: 0, date: "—" };
            return {
              ...pivo,
              alarmCount: parsed.totalAlarmado || 0,
              lastAlertDate: parsed.date || "—",
            };
          } catch {
            return {
              ...pivo,
              alarmCount: 0,
              lastAlertDate: "—",
            };
          }
        }),
      );

      // Mostra primeiro os alarmados
      enriched.sort((a, b) => (b.alarmCount || 0) - (a.alarmCount || 0));
      setPivos(enriched);
    } catch (err: any) {
      setError(err?.message || "Erro ao buscar pivôs");
      console.error("Erro ao buscar pivôs:", err);
    } finally {
      setLoading(false);
    }
  }, [fetchPivos]);

  useEffect(() => {
    loadPivos();
  }, [loadPivos]);

  const handleCreatePivo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreatePivo) return;

    try {
      setLoading(true);
      await onCreatePivo({
        ...newPivo,
        owner_id: authState.user?.email,
        gerente_id: authState.user?.gerente_id,
      });

      setNewPivo({ codigo: "", nome: "", location: null });
      setShowCreateForm(false);

      // Recarregar lista
      await loadPivos();
    } catch (err: any) {
      setError(err?.message || "Erro ao criar pivô");
    } finally {
      setLoading(false);
    }
  };

  // Determinar título baseado no role
  const getTitle = () => {
    const role = authState.user?.type;
    if (role === "admin" || role === "superadmin") return "Todos os Pivôs";
    if (role === "revenda") return "Pivôs dos Meus Clientes";
    return "Meus Pivôs";
  };

  const canManagePivo =
    (authState.user?.type === "admin" || authState.user?.type === "superadmin") &&
    !!onUpdatePivo &&
    !!onDeletePivo;

  const filteredPivos = pivos.filter((pivo) =>
    matchesSearchTerm(searchTerm, [
      pivo.nome,
      pivo.codigo,
      pivo.owner_id,
      pivo.gerente_id,
      pivo.location?.lat,
      pivo.location?.lng,
      pivo.alarmCount,
    ]),
  );

  const [editingPivo, setEditingPivo] = useState<Pivo | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);

  const openEditModal = async (pivo: Pivo) => {
    setLoadingEdit(true);
    try {
      const fullDoc = await getDoc<Pivo>("lindsay-data", pivo._id);
      setEditingPivo(fullDoc);
    } catch (err) {
      console.error("Erro ao buscar documento completo:", err);
      setEditingPivo(pivo);
    } finally {
      setLoadingEdit(false);
    }
  };

  const handleSaveEdit = async (pivoId: string, updates: Record<string, any>) => {
    if (!onUpdatePivo) return;
    await onUpdatePivo(pivoId, updates);
    await loadPivos();
  };

  const handleDeletePivo = async (pivo: Pivo) => {
    if (!onDeletePivo) return;
    if (!window.confirm(`Deseja deletar o pivô "${pivo.nome}"? Esta ação não pode ser desfeita.`)) return;
    await onDeletePivo(pivo._id);
    await loadPivos();
  };

  return (
    <div className="bg-dashboard-bg-secondary rounded-lg shadow-md p-6 border border-dashboard-border">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-dashboard-text-primary">
          {getTitle()}
        </h2>
        {showCreateButton && ["admin", "superadmin", "revenda"].includes(authState.user?.type || "") && (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-4 py-2 bg-dashboard-accent hover:bg-dashboard-accent-hover text-white rounded-lg font-bold transition"
          >
            {showCreateForm ? "Cancelar" : "+ Novo Pivô"}
          </button>
        )}
      </div>

      {/* Formulário de Criação */}
      {showCreateForm && ["admin", "superadmin", "revenda"].includes(authState.user?.type || "") && (
        <form
          onSubmit={handleCreatePivo}
          className="mb-6 p-4 bg-dashboard-bg-tertiary rounded-lg border border-dashboard-border"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Código do Pivô (ex: P001)"
              value={newPivo.codigo}
              onChange={(e) =>
                setNewPivo({ ...newPivo, codigo: e.target.value })
              }
              className="px-3 py-2 border border-dashboard-border rounded-lg bg-dashboard-bg-secondary text-dashboard-text-primary placeholder-dashboard-text-tertiary"
              required
            />
            <input
              type="text"
              placeholder="Nome do Pivô"
              value={newPivo.nome}
              onChange={(e) => setNewPivo({ ...newPivo, nome: e.target.value })}
              className="px-3 py-2 border border-dashboard-border rounded-lg bg-dashboard-bg-secondary text-dashboard-text-primary placeholder-dashboard-text-tertiary"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-4 px-4 py-2 bg-dashboard-accent hover:bg-dashboard-accent-hover text-white rounded-lg disabled:opacity-50 font-bold transition"
          >
            {loading ? "Criando..." : "Criar Pivô"}
          </button>
        </form>
      )}

      {/* Mensagens de Status */}
      {loading && (
        <p className="text-dashboard-text-secondary">Carregando pivôs...</p>
      )}
      {error && <p className="text-red-400">{error}</p>}

      {/* Lista de Pivôs */}
      {!loading && filteredPivos.length === 0 ? (
        <p className="text-dashboard-text-secondary text-center py-8">
          {pivos.length === 0
            ? authState.user?.type === "cliente"
              ? "Nenhum pivô cadastrado. Crie um novo!"
              : "Nenhum pivô encontrado"
            : "Nenhum pivô encontrado para a busca atual"}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPivos.map((pivo, idx) => (
            <div
              key={pivo._id || `pivo-${idx}`}
              onClick={() => onSelectPivo?.(pivo)}
              className="border border-dashboard-border rounded-lg p-4 bg-dashboard-bg-tertiary hover:bg-dashboard-border transition cursor-pointer"
            >
              <h3 className="font-bold text-lg text-dashboard-text-primary">
                {pivo.nome}
              </h3>
              <p className="text-dashboard-text-secondary text-sm">
                Código: {pivo.codigo}
              </p>

              {/* Status */}
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <div
                  className={`w-3 h-3 rounded-full ${
                    pivo.ativo ? "bg-green-500" : "bg-red-500"
                  }`}
                />
                <span className="text-sm text-dashboard-text-secondary">
                  {pivo.ativo ? "Ativo" : "Inativo"}
                </span>
                {(pivo.alarmCount || 0) > 0 && (
                  <span className="text-xs px-2 py-1 rounded font-bold bg-red-700 text-red-100">
                    Alarmado ({pivo.alarmCount})
                  </span>
                )}
              </div>

              {/* Localização */}
              {pivo.location && (
                <p className="text-xs text-dashboard-text-tertiary mt-2">
                  {pivo.location.lat.toFixed(2)}, {pivo.location.lng.toFixed(2)}
                </p>
              )}

              {/* Data */}
              <p className="text-xs text-dashboard-text-tertiary mt-2">
                Criado em:{" "}
                {pivo.updated_at && !isNaN(Date.parse(pivo.updated_at))
                  ? new Date(pivo.updated_at).toLocaleDateString("pt-BR")
                  : pivo.created_at && !isNaN(Date.parse(pivo.created_at))
                    ? new Date(pivo.created_at).toLocaleDateString("pt-BR")
                    : "—"}
              </p>
              <p className="text-xs text-dashboard-text-tertiary mt-1">
                Último dado: {pivo.lastAlertDate || "—"}
              </p>

              {canManagePivo && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(pivo);
                    }}
                    className="px-3 py-1 text-xs rounded bg-dashboard-accent text-white font-bold hover:bg-dashboard-accent-hover transition"
                  >
                    Editar
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePivo(pivo);
                    }}
                    className="px-3 py-1 text-xs rounded bg-red-700 text-white font-bold hover:bg-red-600 transition"
                  >
                    Deletar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal de Edição */}
      {editingPivo && (
        <ModalEditIrrigador
          pivo={editingPivo}
          onSave={handleSaveEdit}
          onClose={() => setEditingPivo(null)}
        />
      )}
    </div>
  );
}
