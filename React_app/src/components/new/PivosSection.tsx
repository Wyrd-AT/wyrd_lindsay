import React, { useState, useCallback, useMemo } from "react";
import { useAuthStore } from "../../stores/new/authStore";
import { matchesSearchTerm } from "../../utils/search";
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
  alarm_count?: number;
  last_alert_date?: string;
  last_data_at?: string;
  [key: string]: any;
}

export interface PivosSectionProps {
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

  /**
   * Lista pronta de pivôs (render-only).
   */
  pivos?: Pivo[];

  /**
   * Loading externo (render-only).
   */
  loading?: boolean;

  /**
   * Loading do status recente (render-only).
   */
  loadingRecent?: boolean;

  /**
   * Erro externo (render-only).
   */
  error?: string | null;

  /**
   * Callback opcional para recarregar (render-only).
   */
  onRefresh?: () => Promise<void> | void;

  /**
   * Carrega pivô completo (quando necessário).
   */
  onLoadFullPivo?: (pivo: Pivo) => Promise<Pivo>;
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
  onCreatePivo,
  onSelectPivo,
  onUpdatePivo,
  onDeletePivo,
  showCreateButton = false,
  searchTerm = "",
  pivos: pivosProp,
  loading: loadingProp,
  loadingRecent = false,
  error: errorProp,
  onRefresh,
  onLoadFullPivo,
}: PivosSectionProps) {
  const authState = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPivo, setNewPivo] = useState({
    codigo: "",
    nome: "",
    location: null,
  });

  const effectiveLoading = loadingProp ?? false;
  const effectiveError = errorProp ?? localError;

  const effectivePivos = useMemo(() => {
    const base = pivosProp ?? [];
    const sorted = [...base].sort((a, b) => {
      const aAlarm = (a.alarm_count ?? 0) as number;
      const bAlarm = (b.alarm_count ?? 0) as number;
      return bAlarm - aAlarm;
    });
    return sorted;
  }, [pivosProp]);

  const handleCreatePivo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreatePivo) return;

    try {
      setSaving(true);
      setLocalError(null);
      await onCreatePivo({
        ...newPivo,
        owner_id: authState.user?.email,
        gerente_id: authState.user?.gerente_id,
      });

      setNewPivo({ codigo: "", nome: "", location: null });
      setShowCreateForm(false);

      // Recarregar lista
      await onRefresh?.();
    } catch (err: any) {
      setLocalError(err?.message || "Erro ao criar pivô");
    } finally {
      setSaving(false);
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

  const filteredPivos = effectivePivos.filter((pivo) =>
    matchesSearchTerm(searchTerm, [
      pivo.nome,
      pivo.codigo,
      pivo.owner_id,
      pivo.gerente_id,
      pivo.location?.lat,
      pivo.location?.lng,
      pivo.alarm_count,
    ]),
  );

  const [editingPivo, setEditingPivo] = useState<Pivo | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const openEditModal = async (pivo: Pivo) => {
    setLoadingEdit(true);
    setLocalError(null);
    try {
      if (onLoadFullPivo) {
        const fullDoc = await onLoadFullPivo(pivo);
        setEditingPivo(fullDoc);
      } else {
        setEditingPivo(pivo);
      }
    } catch (err) {
      console.error("Erro ao buscar documento completo:", err);
      setEditingPivo(pivo);
    } finally {
      setLoadingEdit(false);
    }
  };

  const handleSaveEdit = async (pivoId: string, updates: Record<string, any>) => {
    if (!onUpdatePivo) return;
    try {
      setLocalError(null);
      await onUpdatePivo(pivoId, updates);
      await onRefresh?.();
    } catch (err: any) {
      setLocalError(err?.message || "Erro ao salvar pivô.");
      throw err;
    }
  };

  const handleDeletePivo = async (pivo: Pivo) => {
    if (!onDeletePivo) return;
    if (!window.confirm(`Deseja deletar o pivô "${pivo.nome}"? Esta ação não pode ser desfeita.`)) return;
    setDeletingId(pivo._id);
    setLocalError(null);
    try {
      await onDeletePivo(pivo._id);
      await onRefresh?.();
    } catch (err: any) {
      setLocalError(err?.message || "Erro ao deletar pivô.");
    } finally {
      setDeletingId(null);
    }
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
            disabled={saving}
            className="mt-4 px-4 py-2 bg-dashboard-accent hover:bg-dashboard-accent-hover text-white rounded-lg disabled:opacity-50 font-bold transition"
          >
            {saving ? "Criando..." : "Criar Pivô"}
          </button>
        </form>
      )}

      {/* Mensagens de Status */}
      {effectiveLoading && (
        <p className="text-dashboard-text-secondary">Carregando pivôs...</p>
      )}
      {loadingRecent && !effectiveLoading && (
        <p className="text-dashboard-text-tertiary text-sm">
          Atualizando status recente...
        </p>
      )}
      {effectiveError && <p className="text-red-400">{effectiveError}</p>}

      {/* Lista de Pivôs */}
      {!effectiveLoading && filteredPivos.length === 0 ? (
        <p className="text-dashboard-text-secondary text-center py-8">
          {effectivePivos.length === 0
            ? authState.user?.type === "cliente"
              ? "Nenhum pivô cadastrado. Crie um novo!"
              : "Nenhum pivô encontrado"
            : "Nenhum pivô encontrado para a busca atual"}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPivos.map((pivo, idx) => {
            const alarmCount = pivo.alarm_count ?? 0;
            const lastAlertDate =
              pivo.last_data_at ?? pivo.last_alert_date ?? "—";
            return (
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
                {(alarmCount || 0) > 0 && (
                  <span className="text-xs px-2 py-1 rounded font-bold bg-red-700 text-red-100">
                    Alarmado ({alarmCount})
                  </span>
                )}
                {loadingRecent && !lastAlertDate && (
                  <span className="text-xs px-2 py-1 rounded bg-gray-500 text-gray-200 animate-pulse">
                    Carregando...
                  </span>
                )}
                {!loadingRecent && !lastAlertDate && (
                  <span className="text-xs px-2 py-1 rounded bg-gray-600 text-gray-200">
                    Sem dados
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
                Último dado: {lastAlertDate || "não encontrado"}
              </p>

              {canManagePivo && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(pivo);
                    }}
                    disabled={loadingEdit}
                    className="px-3 py-1 text-xs rounded bg-dashboard-accent text-white font-bold hover:bg-dashboard-accent-hover disabled:opacity-50 transition"
                  >
                    {loadingEdit ? "Carregando..." : "Editar"}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePivo(pivo);
                    }}
                    disabled={deletingId === pivo._id}
                    className="px-3 py-1 text-xs rounded bg-red-700 text-white font-bold hover:bg-red-600 disabled:opacity-50 transition"
                  >
                    {deletingId === pivo._id ? "Deletando..." : "Deletar"}
                  </button>
                </div>
              )}
            </div>
          );
          })}
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
