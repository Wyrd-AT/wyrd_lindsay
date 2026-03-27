// src/pages/HomePageRevenda.jsx
import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useNavigate } from "react-router-dom";

import BodyContent from "../../components/new/body";
import Header from "../../components/new/header";
import Sidebar from "../../components/new/sidebar";
import IrrigadorCard from "../../components/new/irrigadorCard";
import { ModalIrrigador as ModalIrrigadorBase } from "../../components/new/modalNewIrrigador";

const ModalIrrigador = ModalIrrigadorBase as React.FC<{
  closeModal: () => void;
  onSuccess?: () => void;
}>;

import {
  useIrrigadores,
  useDataStoreIrrigadores,
} from "../../stores/new/dataStoreIrrigadores";
import { useAuthStore } from "../../stores/new/authStore";

import { getRecentAll, RecentSWDoc } from "../../hooks/new/getRecent";
import { getDoc, pingCouch, COUCH_USERS_DB } from "../../api/new/couch";
import { parseSwVector } from "../../helpers/helperHomePage";
import { useChangesListener } from "../../hooks/new/useChangesListener";
import { matchesSearchTerm } from "../../utils/search";

export default function HomePageRevenda() {
  const navigate = useNavigate();

  const { isAuthenticated, user, updateUser } = useAuthStore();
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  // Admin/revenda: se não tem CNPJ no user (ex.: sessão antiga), buscar do CouchDB
  useEffect(() => {
    const docId = user?.doc_id;
    if (!docId || user.cnpj) return;
    const type = user.type;
    if (type !== "admin" && type !== "superadmin" && type !== "revenda" && type !== "cliente") return;
    let cancelled = false;
    (async () => {
      try {
        const doc = await getDoc(COUCH_USERS_DB, docId);
        if (cancelled || !doc) return;
        const cnpj =
          type === "admin" || type === "superadmin"
            ? doc.cnpj_admin
            : type === "revenda"
              ? (doc.cnpj_revenda ?? doc.cnpj)
              : (doc.cnpj_cliente ?? doc.cnpj);
        if (cnpj) updateUser({ cnpj });
      } catch {
        // doc não encontrado ou erro de rede
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.doc_id, user?.cnpj, user?.type, updateUser]);

  const cnpjUser = user?.cnpj ?? "";
  const userType = user?.type;

  const [couchOk, setCouchOk] = useState<boolean | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Cliente: pivôs por cnpj_cliente. Revenda: pivôs por cnpj_revenda. Admin: pivôs por cnpj_admin (mesmo critério da revenda).
  const irrigadores = useIrrigadores(cnpjUser, userType);
  const fetchIrrigadores = useDataStoreIrrigadores((s) => s.fetchIrrigadores);
  const filterBy =
    userType === "admin" || userType === "superadmin"
      ? "cnpj_admin"
      : userType === "revenda"
        ? "cnpj_revenda"
        : "cnpj_cliente";
  const irrigadorIds = useMemo(
    () =>
      Array.isArray(irrigadores)
        ? irrigadores.map((doc) => String(doc.codigo))
        : [],
    [irrigadores],
  );

  const [todosSW, setTodosSW] = useState<Record<string, RecentSWDoc>>({});
  const [loadingSW, setLoadingSW] = useState(false);
  const [errorSW, setErrorSW] = useState<string | null>(null);
  const fetchSWTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingRef = useRef(false);

  const fetchSW = useCallback(async () => {
    if (!irrigadorIds?.length || couchOk !== true || isFetchingRef.current)
      return;

    // Debounce: cancela requisição anterior se ainda estiver pendente
    if (fetchSWTimeoutRef.current) {
      clearTimeout(fetchSWTimeoutRef.current);
    }

    fetchSWTimeoutRef.current = setTimeout(async () => {
      if (isFetchingRef.current) return; // Evita requisições simultâneas
      isFetchingRef.current = true;
      setLoadingSW(true);
      setErrorSW(null);
      try {
        const results = await Promise.all(
          irrigadorIds.map(async (id) => {
            const all = await getRecentAll("lindsay-data", id);
            return { id, sw: all.sw || null };
          }),
        );
        const map: Record<string, RecentSWDoc> = {};
        for (const r of results) {
          if (!r.sw) continue;
          const prev = map[r.id];
          const currMs =
            Date.parse(r.sw.updated_at || r.sw.data?.timestamp || "") || 0;
          const prevMs = prev
            ? Date.parse(prev.updated_at || prev.data?.timestamp || "") || 0
            : -1;
          if (!prev || currMs > prevMs) map[r.id] = r.sw;
        }
        setTodosSW(map);
      } catch (e: any) {
        setErrorSW(e?.message ?? "Falha ao carregar vetores recentes");
      } finally {
        setLoadingSW(false);
        isFetchingRef.current = false;
        fetchSWTimeoutRef.current = null;
      }
    }, 500); // Debounce de 500ms
  }, [irrigadorIds, couchOk]);

  const doPing = useCallback(async () => {
    try {
      setCouchOk(null);
      const res = (await pingCouch()) as
        | boolean
        | { ok?: boolean; status?: number };
      const ok =
        typeof res === "boolean"
          ? res
          : !!(res && (res.ok ?? res?.status === 200));
      setCouchOk(ok);
      if (!ok) {
        setErrorSW("Não foi possível conectar ao servidor (CouchDB).");
      } else {
        await fetchSW();
      }
    } catch {
      setCouchOk(false);
      setErrorSW("Não foi possível conectar ao servidor (CouchDB).");
    }
  }, [fetchSW]);

  // Executa apenas uma vez na montagem do componente
  useEffect(() => {
    doPing();
    return () => {
      if (fetchSWTimeoutRef.current) {
        clearTimeout(fetchSWTimeoutRef.current);
      }
    };
  }, []); // Removido fetchSW da dependência para evitar loops

  // Monitora mudanças no CouchDB e atualiza automaticamente
  // Usa longpoll para reduzir requisições (mais eficiente)
  useChangesListener({
    db: "lindsay-data",
    onChange: async (changes) => {
      // Verifica se alguma mudança afeta os documentos recentes (sw_recente ou tensao_recente)
      const hasRelevantChange = changes.some(
        (change) =>
          change.id.startsWith("recente_sw::") ||
          change.id.startsWith("recente_tensao::"),
      );

      if (hasRelevantChange) {
        //console.log('[HomePageRevenda] Mudanças detectadas, atualizando dados...');
        // Recarrega os dados do SW
        await fetchSW();
      }
    },
    includeDocs: false, // não precisamos do documento completo, só o ID
    pollInterval: 15000, // Aumentado para 15 segundos (era 5s)
    useLongpoll: true, // Usa longpoll para reduzir requisições
    pause: couchOk !== true, // pausa se o CouchDB não estiver OK
    onError: (error) => {
      console.error("[HomePageRevenda] Erro ao monitorar mudanças:", error);
    },
  });

  // 2) Redireciona se não estiver logado

  // 4) Estado do Modal
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 7) Funções para abrir e fechar o modal
  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  const filteredIrrigadores = useMemo(
    () =>
      irrigadores.filter((doc) =>
        matchesSearchTerm(searchTerm, [
          doc.irrigador,
          doc.nome,
          doc.codigo,
          doc.nome_cliente,
          doc.nome_revenda,
          doc.nome_admin,
          doc.cnpj_cliente,
          doc.cnpj_revenda,
          doc.cnpj_admin,
        ]),
      ),
    [irrigadores, searchTerm],
  );

  return (
    <div className="w-full h-full text-white flex bg-[#313131]">
      <Sidebar />
      <BodyContent>
        <Header
          page="home"
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Pesquisar pivô, cliente, revenda ou código..."
        />

        <div className="flex items-center justify-between px-4 mb-4">
          <h1 className="text-2xl font-bold">
            {userType === "admin" || userType === "superadmin" ? "Todos os Pivôs" : "Pivôs"}
          </h1>
          {(userType === "admin" || userType === "superadmin") && (
            <button
              onClick={openModal}
              className="bg-[#08cb7c] p-2 rounded-lg font-bold"
            >
              + Adicionar Pivô
            </button>
          )}
        </div>

        <div
          className="w-full grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3
                     overflow-auto scrollbar scrollbar-thin scrollbar-thumb-red-500
                     scrollbar-track-gray-800 py-4 gap-5 px-4"
        >
          {filteredIrrigadores.length > 0 ? (
            filteredIrrigadores.map((doc) => {
              const swDoc = todosSW[doc.codigo];
              const info = swDoc
                ? parseSwVector(swDoc.data, swDoc.updated_at)
                : { date: "—", totalAlarmado: 0 };

              return (
                <IrrigadorCard
                  key={doc._id}
                  machineId={doc.codigo}
                  displayName={
                    doc.irrigador ?? doc.nome ?? doc.codigo ?? "Pivô"
                  }
                  nomeCliente={doc.nome_cliente}
                  nomeRevenda={doc.nome_revenda}
                  nomeAdmin={doc.nome_admin}
                  cnpjCliente={doc.cnpj_cliente}
                  cnpjRevenda={doc.cnpj_revenda}
                  cnpjAdmin={doc.cnpj_admin}
                  revendaId={doc.revenda_id}
                  ownerId={doc.owner_id}
                  userType={user?.type}
                  alertCount={info.totalAlarmado}
                  lastAlertDate={info.date}
                />
              );
            })
          ) : (
            <div className="text-gray-400">
              {irrigadores.length === 0
                ? "Nenhum pivô cadastrado."
                : "Nenhum pivô encontrado para a busca atual."}
            </div>
          )}
        </div>

        {isModalOpen && (
          <ModalIrrigador
            closeModal={closeModal}
            onSuccess={() => fetchIrrigadores(cnpjUser, filterBy)}
          />
        )}
      </BodyContent>
    </div>
  );
}
