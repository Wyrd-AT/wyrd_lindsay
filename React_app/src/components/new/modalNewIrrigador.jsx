// src/components/ModalIrrigador.jsx
import React, { useRef, useState, useEffect } from "react";
import { useAuthStore } from "../../stores/new/authStore";
import { useNavigate } from "react-router-dom";
import useEquipamentos from "../../hooks/new/useEquipaments";
import { usePivos } from "../../hooks/new/usePivos";
import apiClient from "../../api/new/apiClient";

export const ModalIrrigador = ({ closeModal, onSuccess }) => {
  const nameRef = useRef();
  const apelidoRef = useRef();
  const whatsappRef = useRef();
  const smsRef = useRef();
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();
  const { createPivo } = usePivos();

  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState("");
  const [isOwnPivo, setIsOwnPivo] = useState(false);
  const [loadingClientes, setLoadingClientes] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [revendas, setRevendas] = useState([]);
  const [loadingRevendas, setLoadingRevendas] = useState(false);
  const [revendaId, setRevendaId] = useState("");

  // Tipos que podem criar pivôs
  const isManager = ["admin", "superadmin", "revenda"].includes(user?.type);
  const isSuperAdmin = user?.type === "superadmin";
  const isAdmin = user?.type === "admin";
  const isAdminOrSuper = ["admin", "superadmin"].includes(user?.type);
  const isRevenda = user?.type === "revenda";

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  // Carregar clientes ao abrir
  useEffect(() => {
    if (!isManager) return;
    let cancelled = false;
    (async () => {
      setLoadingClientes(true);
      try {
        const res = await apiClient.get("/clientes");
        const all = res.data?.clientes || [];
        // Filtrar apenas superusuários que pertencem à hierarquia do usuário
        const list = all.filter((c) => {
          // Deve ser superusuário
          if (c.sub_role !== "superusuario") return false;

          // Superadmin: vê TODOS os clientes
          if (isSuperAdmin) {
            return true;
          }

          // Revenda: mostra apenas seus clientes
          if (isRevenda) {
            return c.revenda_id === user?.doc_id;
          }

          // Admin: mostra apenas clientes de suas revendas (mesmo cnpj_admin)
          if (isAdmin) {
            return c.cnpj_admin === user?.cnpj;
          }

          return false;
        });

        if (!cancelled) {
          setClientes(list);
          const firstCnpj = list[0]?.cnpj_cliente ?? "";
          // Revenda deve obrigatoriamente selecionar um cliente
          if (isRevenda && list.length > 0 && !clienteId) {
            setClienteId(firstCnpj);
          } else if (isAdminOrSuper && list.length > 0 && !clienteId && !isOwnPivo) {
            setClienteId(firstCnpj);
          }
        }
      } catch (err) {
        if (!cancelled)
          setError("Não foi possível carregar a lista de clientes.");
      } finally {
        if (!cancelled) setLoadingClientes(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isManager, isOwnPivo, clienteId, isRevenda, isAdminOrSuper, user]);

  // Carregar revendas quando for superadmin criando pivô para cliente
  useEffect(() => {
    if (!isSuperAdmin || !clienteId || isOwnPivo) return;

    let cancelled = false;
    (async () => {
      setLoadingRevendas(true);
      try {
        const res = await apiClient.get("/revendas");
        const allRevendas = res.data?.revendas || [];
        if (!cancelled) {
          setRevendas(allRevendas);
          // Se o cliente tiver revenda_id, preseleciona
          const clienteSelecionado = clientes.find(
            (c) => c.cnpj_cliente === clienteId
          );
          if (clienteSelecionado?.revenda_id && !revendaId) {
            setRevendaId(clienteSelecionado.revenda_id);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar revendas:", err);
      } finally {
        if (!cancelled) setLoadingRevendas(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin, clienteId, isOwnPivo, clientes, revendaId]);

  const { list: equipamentos, add, remove, update } = useEquipamentos(14);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeModal]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const codigo = nameRef.current?.value?.trim();
    const nome = apelidoRef.current?.value?.trim();

    const whatsapp = whatsappRef.current?.value?.trim();
    const sms = smsRef.current?.value?.trim();

    if (!codigo) {
      setError("Por favor, informe o código do irrigador.");
      return;
    }
    if (!nome) {
      setError("Por favor, informe o nome do irrigador.");
      return;
    }
    // Revenda deve sempre ter cliente
    if (isRevenda && !clienteId) {
      setError("Revenda deve sempre vincular o pivô a um cliente.");
      return;
    }

    // Admin/Superadmin deve ter cliente a menos que seja pivô próprio
    if (isAdminOrSuper && !isOwnPivo && !clienteId) {
      setError("Selecione o cliente ao qual o pivô será associado.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await createPivo({
        codigo,
        nome,
        whatsapp,
        sms,
        // Revenda sempre envia cliente_id
        // Admin/Superadmin envia apenas se não for pivô próprio
        cliente_id:
          isRevenda || (isAdminOrSuper && !isOwnPivo)
            ? clienteId
            : undefined,
        equipamentos: equipamentos.filter(Boolean),
      });
      onSuccess?.();
      closeModal();
    } catch (err) {
      console.error("Falha ao criar pivô:", err);
      setError(
        err?.message || "Não foi possível criar o pivô. Tente novamente.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const onBackdropClick = (e) => {
    if (e.target === e.currentTarget) closeModal();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
      onClick={onBackdropClick}
    >
      <form
        onSubmit={handleSubmit}
        className="bg-[#444444] p-6 rounded-md shadow-md w-11/12 max-w-md max-h-[90vh] overflow-y-auto"
      >
        <header className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">Adicionar Pivô</h2>
          <button
            type="button"
            onClick={closeModal}
            aria-label="Fechar"
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </header>

        {error && <div className="mb-4 text-red-400 text-sm">{error}</div>}

        {isManager && (
          <label className="block text-white mb-4">
            <div className="flex items-center justify-between mb-2">
              <span>
                Cliente
                {isRevenda && <span className="text-red-400 ml-1">*</span>}
              </span>
              {/* Apenas Admin/Superadmin podem criar pivô próprio */}
              {isAdminOrSuper && (
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={isOwnPivo}
                    onChange={(e) => {
                      setIsOwnPivo(e.target.checked);
                      if (e.target.checked) {
                        setClienteId("");
                      }
                    }}
                    disabled={isSaving}
                  />
                  Pivô próprio (sem cliente)
                </label>
              )}
            </div>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="w-full text-black px-3 py-2 border rounded-md mt-1 focus:outline-none"
              disabled={isSaving || loadingClientes || (isAdminOrSuper && isOwnPivo)}
              required={isRevenda || (isAdminOrSuper && !isOwnPivo)}
            >
              <option value="">
                {isAdminOrSuper && isOwnPivo ? "Pivô próprio" : "Selecione o cliente"}
              </option>
              {clientes.map((c) => (
                <option
                  key={c._id ?? c.cnpj_cliente}
                  value={c.cnpj_cliente ?? ""}
                >
                  {[c.cnpj_cliente || "—", c.name || "—"].join(" - ")}
                </option>
              ))}
            </select>
            {loadingClientes && (
              <span className="text-gray-400 text-sm">
                Carregando clientes...
              </span>
            )}
            {!loadingClientes && clientes.length === 0 && !isAdminOrSuper && (
              <span className="text-amber-400 text-sm">
                Nenhum cliente encontrado. Verifique com o administrador.
              </span>
            )}
            {!loadingClientes && clientes.length === 0 && isAdminOrSuper && !isOwnPivo && (
              <span className="text-amber-400 text-sm">
                Nenhum cliente superusuário encontrado. Apenas clientes com
                perfil superusuário podem receber pivôs.
              </span>
            )}
          </label>
        )}

        {/* Campo de Revenda para Superadmin */}
        {isSuperAdmin && !isOwnPivo && clienteId && (
          <label className="block text-white mb-4">
            <div className="flex items-center justify-between mb-2">
              <span>Revenda</span>
              {loadingRevendas && (
                <span className="text-gray-400 text-xs">Carregando...</span>
              )}
            </div>
            <select
              value={revendaId}
              onChange={(e) => setRevendaId(e.target.value)}
              className="w-full text-black px-3 py-2 border rounded-md mt-1 focus:outline-none"
              disabled={isSaving || loadingRevendas}
            >
              <option value="">Selecione a revenda (se necessário)</option>
              {revendas.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.name} ({r.cnpj_revenda || "—"})
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block text-white mb-4">
          Código:
          <input
            ref={nameRef}
            name="codigo"
            type="text"
            className="w-full text-black px-3 py-2 border rounded-md mt-1 focus:outline-none"
            placeholder="Ex: PIVO-001"
            disabled={isSaving}
          />
        </label>
        <label className="block text-white mb-4">
          Nome:
          <input
            ref={apelidoRef}
            name="nome"
            type="text"
            className="w-full text-black px-3 py-2 border rounded-md mt-1 focus:outline-none"
            placeholder="Nome do irrigador"
            disabled={isSaving}
          />
        </label>

        <fieldset className="mb-4 p-4 border border-gray-600 rounded-md">
          <legend className="text-white mb-2 px-2">
            Contatos para Notificação (opcional)
          </legend>
          <label className="block text-white mb-3">
            <span className="text-sm text-gray-300">WhatsApp:</span>
            <input
              ref={whatsappRef}
              name="whatsapp"
              type="text"
              className="w-full text-black px-3 py-2 border rounded-md mt-1 focus:outline-none"
              placeholder="+5511999999999"
              disabled={isSaving}
            />
          </label>
          <label className="block text-white mb-3">
            <span className="text-sm text-gray-300">SMS:</span>
            <input
              ref={smsRef}
              name="sms"
              type="text"
              className="w-full text-black px-3 py-2 border rounded-md mt-1 focus:outline-none"
              placeholder="+5511988888888"
              disabled={isSaving}
            />
          </label>
        </fieldset>

        <fieldset className="mb-4">
          <legend className="text-white mb-2">Equipamentos</legend>
          {equipamentos.map((eq, idx) => (
            <div key={idx} className="flex items-center mb-2">
              <input
                type="text"
                value={eq}
                onChange={(e) => update(idx, e.target.value)}
                placeholder={`Equipamento ${idx + 1}`}
                className="flex-1 text-black px-3 py-2 border rounded-md focus:outline-none"
                disabled={isSaving}
              />
              {equipamentos.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="ml-2 px-2 py-1 text-sm border border-red-500 rounded"
                  aria-label={`Remover equipamento ${idx + 1}`}
                  disabled={isSaving}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={add}
            disabled={isSaving || equipamentos.length >= 14}
            className="mt-2 text-sm px-3 py-1 border rounded-md text-white"
          >
            + Adicionar equipamento ({equipamentos.length}/14)
          </button>
        </fieldset>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={closeModal}
            className="mr-2 px-4 py-2 border rounded-md text-white"
            disabled={isSaving}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={
              isSaving ||
              // Revenda sempre precisa de cliente
              (isRevenda && (!clienteId || loadingClientes)) ||
              // Admin/Superadmin precisa de cliente a menos que seja pivô próprio
              (isAdminOrSuper && !isOwnPivo && (!clienteId || loadingClientes))
            }
            className={`px-4 py-2 rounded-md text-white ${isSaving ? "bg-gray-500 cursor-not-allowed" : "bg-[#08cb7c] hover:bg-green-600"}`}
          >
            {isSaving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
};
