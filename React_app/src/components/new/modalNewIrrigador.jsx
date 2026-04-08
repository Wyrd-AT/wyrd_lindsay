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

  const [admins, setAdmins] = useState([]);
  const [adminId, setAdminId] = useState("");
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  const [revendas, setRevendas] = useState([]);
  const [revendaId, setRevendaId] = useState("");
  const [loadingRevendas, setLoadingRevendas] = useState(false);

  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState("");
  const [loadingClientes, setLoadingClientes] = useState(true);

  const [isOwnPivo, setIsOwnPivo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

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

  // Carregar admins para superadmin
  useEffect(() => {
    if (!isSuperAdmin) return;
    let cancelled = false;
    (async () => {
      setLoadingAdmins(true);
      try {
        const res = await apiClient.get("/admins");
        const allAdmins = res.data?.admins || [];
        if (!cancelled) {
          setAdmins(allAdmins);
        }
      } catch (err) {
        console.error("Erro ao carregar admins:", err);
      } finally {
        if (!cancelled) setLoadingAdmins(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin]);

  // Carregar revendas: para superadmin quando seleciona admin, para admin automaticamente
  useEffect(() => {
    // Superadmin precisa ter admin selecionado; admin carrega as próprias revendas
    if (isSuperAdmin && !adminId) {
      setRevendas([]);
      setRevendaId("");
      return;
    }
    if (!isSuperAdmin && !isAdmin) return;

    let cancelled = false;
    (async () => {
      setLoadingRevendas(true);
      try {
        const res = await apiClient.get("/revendas");
        const allRevendas = res.data?.revendas || [];
        // cnpj a comparar: superadmin usa o admin selecionado, admin usa o próprio cnpj
        const cnpjFiltro = isSuperAdmin ? adminId : user?.cnpj;
        const filtered = allRevendas.filter(
          (r) => r.cnpj_admin === cnpjFiltro
        );
        if (!cancelled) {
          setRevendas(filtered);
          setRevendaId("");
          setClientes([]);
          setClienteId("");
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
  }, [isSuperAdmin, isAdmin, adminId, user]);

  // Carregar clientes quando revenda for selecionada
  useEffect(() => {
    if (!isManager) return;
    let cancelled = false;
    (async () => {
      setLoadingClientes(true);
      try {
        const res = await apiClient.get("/clientes");
        const all = res.data?.clientes || [];

        // Filtrar com base no tipo de usuário
        let list = all.filter((c) => c.sub_role === "superusuario");

        if (isSuperAdmin && revendaId) {
          // Superadmin com revenda selecionada: mostra clientes dessa revenda
          // revendaId contém cnpj_revenda (ex: "14.309.992/0001-48")
          list = list.filter((c) => c.cnpj_revenda === revendaId);
        } else if (isSuperAdmin) {
          // Superadmin sem revenda: mostra todos
          // (já filtrado por superusuario acima)
        } else if (isRevenda) {
          // Revenda: mostra apenas seus clientes
          list = list.filter((c) => c.revenda_id === user?.doc_id);
        } else if (isAdmin) {
          if (revendaId) {
            // Admin com revenda selecionada: mostra clientes dessa revenda
            list = list.filter((c) => c.cnpj_revenda === revendaId);
          } else {
            // Admin sem revenda selecionada: mostra todos os seus clientes
            list = list.filter((c) => c.cnpj_admin === user?.cnpj);
          }
        }

        if (!cancelled) {
          setClientes(list);
          const firstCnpj = list[0]?.cnpj_cliente ?? "";
          if (isRevenda && list.length > 0 && !clienteId) {
            setClienteId(firstCnpj);
          } else if (isAdmin && list.length > 0 && !clienteId && !isOwnPivo) {
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
  }, [isManager, isOwnPivo, clienteId, isRevenda, isAdmin, isSuperAdmin, user, revendaId]);


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

    // Validações específicas por tipo de usuário
    if (isSuperAdmin) {
      if (!adminId) {
        setError("Superadmin deve selecionar um admin.");
        return;
      }
      if (!revendaId) {
        setError("Superadmin deve selecionar uma revenda.");
        return;
      }
      if (!isOwnPivo && !clienteId) {
        setError("Selecione o cliente ao qual o pivô será associado.");
        return;
      }
    } else if (isRevenda && !clienteId) {
      setError("Revenda deve sempre vincular o pivô a um cliente.");
      return;
    } else if (isAdmin) {
      if (!revendaId) {
        setError("Selecione a revenda.");
        return;
      }
      if (!isOwnPivo && !clienteId) {
        setError("Selecione o cliente ao qual o pivô será associado.");
        return;
      }
    }

    setIsSaving(true);
    setError(null);

    try {
      const pivoPayload = {
        codigo,
        nome,
        equipamentos: equipamentos.filter(Boolean),
        ...(whatsapp && { whatsapp }),
        ...(sms && { sms }),
      };

      // Vincular ao cliente: revenda sempre obrigatório; admin/superadmin se não for pivô próprio
      const clienteAlvo = isRevenda || (isAdminOrSuper && !isOwnPivo) ? clienteId : undefined;
      if (clienteAlvo) {
        pivoPayload.cliente_id = clienteAlvo;
      }

      await createPivo(pivoPayload);
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

        {/* Fluxo em cascata para Superadmin: Admin → Revenda */}
        {isSuperAdmin && (
          <>
            {/* Seleção de Admin */}
            <label className="block text-white mb-4">
              <div className="flex items-center justify-between mb-2">
                <span>
                  Admin <span className="text-red-400 ml-1">*</span>
                </span>
                {loadingAdmins && (
                  <span className="text-gray-400 text-xs">Carregando...</span>
                )}
              </div>
              <select
                value={adminId}
                onChange={(e) => setAdminId(e.target.value)}
                className="w-full text-black px-3 py-2 border rounded-md mt-1 focus:outline-none"
                disabled={isSaving || loadingAdmins}
                required
              >
                <option value="">Selecione um admin</option>
                {admins.map((a) => (
                  <option key={a._id} value={a.cnpj_admin}>
                    {a.name} ({a.cnpj_admin})
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        {/* Seleção de Revenda: superadmin (após escolher admin) ou admin regular */}
        {(isSuperAdmin ? !!adminId : isAdmin) && (
          <label className="block text-white mb-4">
            <div className="flex items-center justify-between mb-2">
              <span>
                Revenda <span className="text-red-400 ml-1">*</span>
              </span>
              {loadingRevendas && (
                <span className="text-gray-400 text-xs">Carregando...</span>
              )}
            </div>
            <select
              value={revendaId}
              onChange={(e) => setRevendaId(e.target.value)}
              className="w-full text-black px-3 py-2 border rounded-md mt-1 focus:outline-none"
              disabled={isSaving || loadingRevendas || revendas.length === 0}
              required
            >
              <option value="">Selecione uma revenda</option>
              {revendas.map((r) => (
                <option key={r.cnpj_revenda} value={r.cnpj_revenda}>
                  {r.name} ({r.cnpj_revenda || "—"})
                </option>
              ))}
            </select>
            {revendas.length === 0 && !loadingRevendas && (
              <span className="text-amber-400 text-xs mt-1 block">
                Nenhuma revenda encontrada
              </span>
            )}
          </label>
        )}

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
              // Superadmin deve selecionar admin, revenda e cliente
              (isSuperAdmin && (!adminId || !revendaId || (!isOwnPivo && !clienteId))) ||
              // Revenda sempre precisa de cliente
              (isRevenda && (!clienteId || loadingClientes)) ||
              // Admin precisa de revenda e cliente (a menos que seja pivô próprio)
              (isAdmin && (!revendaId || (!isOwnPivo && (!clienteId || loadingClientes))))
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
