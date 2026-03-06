import React, { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "../../stores/new/authStore";

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
   * Mostrar botão de criar pivô (apenas para cliente)
   */
  showCreateButton?: boolean;
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
  showCreateButton = false,
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
      setPivos(data || []);
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
    if (role === "admin") return "Todos os Pivôs";
    if (role === "revenda") return "Pivôs dos Meus Clientes";
    return "Meus Pivôs";
  };

  return (
    <div className="bg-dashboard-bg-secondary rounded-lg shadow-md p-6 border border-dashboard-border">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-dashboard-text-primary">
          {getTitle()}
        </h2>
        {showCreateButton && authState.user?.type === "cliente" && (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-4 py-2 bg-dashboard-accent hover:bg-dashboard-accent-hover text-white rounded-lg font-bold transition"
          >
            {showCreateForm ? "Cancelar" : "+ Novo Pivô"}
          </button>
        )}
      </div>

      {/* Formulário de Criação */}
      {showCreateForm && authState.user?.type === "cliente" && (
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
      {!loading && pivos.length === 0 ? (
        <p className="text-dashboard-text-secondary text-center py-8">
          {authState.user?.type === "cliente"
            ? "Nenhum pivô cadastrado. Crie um novo!"
            : "Nenhum pivô encontrado"}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pivos.map((pivo) => (
            <div
              key={pivo._id}
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
              <div className="mt-3 flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    pivo.ativo ? "bg-green-500" : "bg-red-500"
                  }`}
                />
                <span className="text-sm text-dashboard-text-secondary">
                  {pivo.ativo ? "Ativo" : "Inativo"}
                </span>
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
                {new Date(pivo.created_at).toLocaleDateString("pt-BR")}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
