import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { IoClose } from "react-icons/io5";
import { FiShare2 } from "react-icons/fi";
import { valueDescriptions } from "./alertHistory";
import { useAuthStore } from "../stores/authStore";
import { useAgendamentos, useDataStoreAgendamentos } from "../stores/dataStoreTimers";
import useMessageStore from "../stores/messageStore";
import { getBrasiliaTimestamp } from "./messageModal";
import { whatsappStoreConfig } from "../stores/whatsappStore";

/** Utilitário simples */
function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function formatHHMMSS(ms) {
  const total = Math.max(0, Math.floor((ms ?? 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/** “...” animando */
function Dots({ className }) {
  const [dots, setDots] = useState("");
  useEffect(() => {
    const id = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."));
    }, 300);
    return () => clearInterval(id);
  }, []);
  // padEnd só pra manter largura estável
  return (
    <span className={className} aria-live="polite">
      {dots.padEnd(3, " ")}
    </span>
  );
}

/** Ajuste explícito para IDs específicos, evitando regra “mágica” */
const MONITOR_MAP = { 17: 0, 18: 1 };

export default function AlertEdit({
  isOpen = false,
  onClose,
  alertData = null,
  equipamentos = [],
  machineId,
}) {
  const [minutes, setMinutes] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [localTimerOverride, setLocalTimerOverride] = useState(null);
  const [whatsappStatus, setWhatsappStatus] = useState(false);

  // estados de carregamento
  const [isTimerLoading, setIsTimerLoading] = useState(false);
  const [isWhatsappLoading, setIsWhatsappLoading] = useState(false);
  const isAlertLoading = isOpen && !alertData;

  const addTimer = useDataStoreAgendamentos((state) => state.addAgendamento);
  const updateTimer = useDataStoreAgendamentos((state) => state.updateAgendamento);

  const storeTimer = useAgendamentos(s => alertData?._id ? s.agendamentosById[alertData._id] : null);


  const { findAgendamentoByIdOrigem } = useAgendamentos();
  const { user } = useAuthStore();




  const { whatsappConfig, fetchWhatsappConfig, updateWhatsappStatus } =
    whatsappStoreConfig((state) => state);

  const effectiveTimer = useMemo(() => {
    if (localTimerOverride && storeTimer) {
      const l = new Date(localTimerOverride.updated_at ?? 0).getTime();
      const s = new Date(storeTimer.updated_at ?? 0).getTime();
      return l >= s ? localTimerOverride : storeTimer;
    }
    return localTimerOverride ?? storeTimer ?? null;
  }, [localTimerOverride, storeTimer,!isOpen]);
  const isSolved = effectiveTimer?.status === "solucionado";

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /**
   * Refaz a leitura do agendamento até que o predicado seja verdadeiro
   * (ou acabar as tentativas). Retorna o dado mais recente encontrado.
   */
  async function refetchPersistedAgendamento(idOrigem, predicate, { tries = 10, delayMs = 150 } = {}) {
    for (let i = 0; i < tries; i++) {
      const fresh = findAgendamentoByIdOrigem(idOrigem);
      if (predicate?.(fresh)) return fresh;
      await sleep(delayMs);
    }
    // última tentativa sem predicate garantir (pelo menos devolve algo)
    return findAgendamentoByIdOrigem(idOrigem) ?? null;
  }

  /** WhatsApp: buscar config + hidratar status */
  useEffect(() => {
    if (!isOpen) return;
    setIsWhatsappLoading(true);
    // algumas stores não retornam Promise; usamos a própria mudança do estado
    if (!whatsappConfig) {
      const maybePromise = fetchWhatsappConfig?.();
      // se for promise, marcamos o fim depois; se não for, o efeito abaixo ajusta
      Promise.resolve(maybePromise).finally(() => setIsWhatsappLoading(false));
    } else {
      setWhatsappStatus(Boolean(whatsappConfig?.enabled ?? false));
      setIsWhatsappLoading(false);
    }
  }, [isOpen, whatsappConfig, fetchWhatsappConfig]);

  const handleToggleChange = (e) => {
    const newStatus = e.target.checked;
    setWhatsappStatus(newStatus);
    updateWhatsappStatus(newStatus);
  };

  /** Quando a store ficar igual ao override, limpe o override */
  useEffect(() => {
    if (!localTimerOverride || !storeTimer) return;
    const l = new Date(localTimerOverride.updated_at ?? 0).getTime();
    const s = new Date(storeTimer.updated_at ?? 0).getTime();
    // se a store já está no mesmo estado ou mais nova/recente, não precisamos manter override
    if (s >= l) setLocalTimerOverride(null);
  }, [storeTimer, localTimerOverride]);

  /** Acessibilidade/focus trap + ESC para fechar */
  const dialogRef = useRef(null);
  const titleRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    // Foca o título ao abrir
    requestAnimationFrame(() => titleRef.current?.focus());

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  /** Resolve nome do monitor */
  const monitorResolved = useMemo(() => {
    if (!Array.isArray(equipamentos) || equipamentos.length === 0) {
      return String(alertData?.monitor ?? "—");
    }
    const id = Number(alertData?.monitor);
    if (Number.isNaN(id)) return String(alertData?.monitor ?? "—");

    const idx = MONITOR_MAP[id] ?? id + 1; // sua lógica anterior com o map aplicado
    if (idx < 0 || idx >= equipamentos.length) return `#${id}`;
    const item = equipamentos[idx];
    return typeof item === "string" ? item : item?.nome ?? item?.name ?? `#${id}`;
  }, [alertData?.monitor, equipamentos]);

  /** TS do alvo agendado */
  const scheduledTargetTs = useMemo(() => {
    if (!effectiveTimer?.scheduled_for || isSolved) return null;
    const ts = new Date(effectiveTimer.scheduled_for).getTime();
    return Number.isFinite(ts) ? ts : null;
  }, [isSolved]);

  /** Contagem regressiva do agendamento atual */
  const [remainingMs, setRemainingMs] = useState(null);
  useEffect(() => {
    if (!isOpen || !scheduledTargetTs) {
      setRemainingMs(null);
      return;
    }
    let id;
    const tick = () => {
      const ms = Math.max(0, scheduledTargetTs - Date.now());
      setRemainingMs(ms);
      if (ms === 0 && id) clearInterval(id);
    };
    tick();
    id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [scheduledTargetTs, isOpen]);

  /** Prévia da contagem para novo agendamento (quando não há agendamento ativo) */
  const [previewMs, setPreviewMs] = useState(null);
  useEffect(() => {
    const mins = Number(minutes || 0);
    if (!isOpen || scheduledTargetTs || !Number.isFinite(mins) || mins < 1) {
      setPreviewMs(null);
      return;
    }
    const previewTarget = Date.now() + mins * 60_000;
    let id;
    const tick = () => {
      const ms = Math.max(0, previewTarget - Date.now());
      setPreviewMs(ms);
      if (ms === 0 && id) clearInterval(id);
    };
    tick();
    id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [minutes, isOpen, scheduledTargetTs]);

  const handleEnviar = async (command, monitor, id) => {
    try {
      // dica: se puder, prefira JSON aqui
      const payload = `${id};${command}${monitor}`;
      const doc = {
        topic: `lindsay/comandos/${id}`,
        payload,
        origin: "app",
        table: "command",
        qos: 0,
        timer: minutes,
        timestamp: getBrasiliaTimestamp(),
      };
      await useMessageStore.getState().postMessage(doc);
    } catch (err) {
      console.error("[MensagemModal] erro ao enviar comando:", err);
    } finally {
      // noop
    }
  };

  // --- HELPER: cria/atualiza (upsert) o agendamento usando o existente se houver
  async function upsertAgendamento(parsedMinutes) {
    if (!alertData?._id) throw new Error("alertData._id ausente");
    console.log(effectiveTimer)

    const now = new Date();
    const scheduled = new Date(now.getTime() + parsedMinutes * 60_000);

    const existing = findAgendamentoByIdOrigem(alertData._id);
    console.log(existing)

    const base = {
      id_origem: alertData._id,
      created_at: existing?.created_at ?? now.toISOString(),
      data_solucao: existing?.data_solucao ?? "—",
      responsavel_solucao: existing?.responsavel_solucao ?? "—",
    };

    const doc = {
      ...(existing ?? {}), // mantém _id para UPDATE se existir
      ...base,
      ultimo_agendamento: now.toLocaleString("pt-BR"),
      scheduled_for: scheduled.toISOString(),
      responsavel_agendamento:
        user?.email || existing?.responsavel_agendamento || "Desconhecido",
      timer_value: parsedMinutes,
      status: "agendado",
      updated_at: now.toISOString(),
      data_solucao: "-",
      responsavel_solucao: "-",
    };
    setIsTimerLoading(true);

    try {
      existing ? await updateTimer(existing._id, doc) : await addTimer(doc)
    }
    catch (err) {
      console.error("[MensagemModal] erro ao enviar comando:", err);
    }


    // revalida até a store refletir os mesmos campos-chave
    const persisted = doc

    setLocalTimerOverride(persisted);
    setIsTimerLoading(false);

    console.log(persisted)

    return persisted;
  }


  // --- HANDLE: Agendar
  async function handleAgendamentoClick() {
    if (!alertData) return;

    const parsedMinutes = Math.trunc(Number(minutes));
    if (!Number.isFinite(parsedMinutes) || parsedMinutes < 1) {
      // TODO: toast/erro de validação
      return;
    }

    try {
      setIsSaving(true);
      await upsertAgendamento(parsedMinutes);
      await handleEnviar("SendOFF", alertData.monitor, machineId);
    } catch (err) {
      console.error("Erro ao salvar agendamento:", err);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSolutionClick() {
    if (!alertData) return;

    try {
      setIsSaving(true);
      setIsTimerLoading(true);

      const agora = new Date();
      const base = effectiveTimer ?? {};
      const existing = findAgendamentoByIdOrigem(alertData._id);


      const timerDoc = {
        id_origem: alertData._id,
        ultimo_agendamento: base.ultimo_agendamento ?? null,
        scheduled_for: base.scheduled_for ?? null,
        responsavel_agendamento: base.responsavel_agendamento ?? user?.email ?? "Desconhecido",
        timer_value: base.timer_value ?? null,
        status: "solucionado",
        updated_at: agora.toISOString(),
        created_at: base.created_at ?? agora.toISOString(),
        data_solucao: agora.toLocaleString("pt-BR"),
        responsavel_solucao: user?.email || "Desconhecido",
      };

      try {
        existing ? await updateTimer(existing._id, timerDoc) : await addTimer(timerDoc)
      }
      catch (err) {
        console.error("[MensagemModal] erro ao enviar comando:", err);
      }


      const persisted = timerDoc

      setLocalTimerOverride(persisted);
    } catch (err) {
      console.error("Erro ao salvar solução:", err);
    } finally {
      setIsTimerLoading(false);
      setIsSaving(false);
    }
  }



  useEffect(() => {
    if (!isOpen || !alertData?._id) return;

    setIsTimerLoading(true);
    try {
      const existing = findAgendamentoByIdOrigem(alertData._id);
      if (existing) {
        setLocalTimerOverride(existing);
        if (Number.isFinite(existing.timer_value)) setMinutes(existing.timer_value);
      } else {
        setLocalTimerOverride(null);
      }
    } catch (err) {
      console.error("Erro ao hidratar agendamento ao abrir modal:", err);
    } finally {
      setIsTimerLoading(false);
    }
  }, [isOpen, alertData?._id, findAgendamentoByIdOrigem]);

  if (!isOpen) return null;


  const ultimoAgendamento = effectiveTimer?.ultimo_agendamento || "—";
  const scheduledFor = effectiveTimer?.scheduled_for
    ? new Date(effectiveTimer.scheduled_for).toLocaleString('pt-BR')
    : "—";
  const responsavelAg = effectiveTimer?.responsavel_agendamento || "—";
  const timerValor = Number.isFinite(effectiveTimer?.timer_value)
    ? `${effectiveTimer.timer_value} minutos`
    : "—";
  const dataSolucao = effectiveTimer?.data_solucao && effectiveTimer.data_solucao !== "-"
    ? effectiveTimer.data_solucao
    : "—";
  const responsavelSolucao = effectiveTimer?.responsavel_solucao && effectiveTimer.responsavel_solucao !== "-"
    ? effectiveTimer.responsavel_solucao
    : "—";


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black opacity-25" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="alertedit-title"
        className="relative bg-[#2f2f2f] text-white rounded-md w-full max-w-md flex flex-col outline-none"
        aria-busy={isSaving}
      >
        <div className="flex justify-between items-center p-4 border-b border-[#444]">
          <h2
            id="alertedit-title"
            ref={titleRef}
            tabIndex={-1}
            className="text-lg font-semibold outline-none"
            title={String(monitorResolved)}
          >
            Alarme{" "}
            {isAlertLoading ? <Dots /> : monitorResolved || "Sem dados"}
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              className="p-1 rounded hover:bg-[#3a3a3a] focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Compartilhar"
              onClick={() => {/* implementar */ }}
            >
              <FiShare2 size={20} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="p-1 rounded hover:bg-[#3a3a3a] focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <IoClose size={20} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 p-4">
          <div>
            <label className="block text-sm text-gray-400">Monitor</label>
            <div className="text-sm truncate" title={String(monitorResolved)}>
              {isAlertLoading ? <Dots /> : monitorResolved || "Sem dados"}
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400">Data</label>
            <div className="text-sm">
              {isAlertLoading ? <Dots /> : alertData?.date || "Sem dados"}
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400">Hora</label>
            <div className="text-sm">
              {isAlertLoading ? <Dots /> : alertData?.time || "Sem dados"}
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400">Status</label>
            <div className="text-sm">
              {isAlertLoading ? (
                <Dots />
              ) : valueDescriptions?.[alertData?.status] ?? alertData?.status ?? "Sem dados"}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[#444]">
          <h3 className="text-sm text-gray-400">Ativar alarme novamente em:</h3>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="number"
              min={1}
              step={1}
              value={Number.isFinite(minutes) ? minutes : ""}
              onChange={(e) => {
                const v = e.currentTarget.valueAsNumber;
                if (Number.isNaN(v)) setMinutes(NaN);
                else setMinutes(clamp(Math.trunc(v), 1, 10080)); // até 7 dias
              }}
              className="w-20 px-2 text-sm bg-[#444444] rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSaving}
              inputMode="numeric"
              aria-label="Minutos até reativação"
            />
            <span className="text-sm text-gray-300">MINUTOS</span>
            <button
              type="button"
              className="px-3 py-1 text-sm rounded bg-blue-600 text-white disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClick={handleAgendamentoClick}
              title={isSaving ? "Processando..." : "Agendar"}
              disabled={isSaving || !Number.isFinite(minutes) || minutes < 1}
              aria-busy={isSaving}
            >
              {isSaving ? "Agendando..." : "Agendar"}
            </button>
          </div>




          <div className="mt-3 grid grid-cols-1 gap-1 text-sm text-gray-400">
            <div>
              Último agendamento:{" "}
              <p className="text-white inline">
                {isTimerLoading ? <Dots /> : ultimoAgendamento || "Sem dados"}
              </p>
            </div>
            <div>
              Timer agendado para:{" "}
              <p className="text-white inline">
                {isTimerLoading ? <Dots /> : scheduledFor || "Sem dados"}
              </p>
            </div>
            <div>
              Responsável pelo agendamento:{" "}
              <p className="text-white inline">
                {isTimerLoading ? <Dots /> : responsavelAg || "Sem dados"}
              </p>
            </div>
            <div>
              Intervalo configurado:{" "}
              <p className="text-white inline">
                {isTimerLoading ? <Dots /> : timerValor || "Sem dados"}
              </p>
            </div>
          </div>

          <div className="mt-6 text-sm text-gray-400 border-t border-[#444] pt-4">
            <button
              type="button"
              className="px-3 py-1 text-sm rounded bg-blue-600 text-white disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClick={handleSolutionClick}
              title={isSaving ? "Solucionando..." : "Solucionar Alarme"}
              disabled={isSaving}
              aria-busy={isSaving}
            >
              {isSaving ? "Solucionando..." : "Solucionar Alarme"}
            </button>
            <div>
              <div className="mt-2">
                Data da solução:{" "}
                <p className="text-white inline">
                  {isTimerLoading ? <Dots /> : dataSolucao || "Sem dados"}
                </p>
              </div>
              <p>Responsável pela solução do alarme:</p>
              <p className="text-white">
                {isTimerLoading ? <Dots /> : responsavelSolucao || "Sem dados"}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 border-[#444]">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(whatsappStatus)}
              onChange={handleToggleChange}
              className="p-4"
              disabled={isWhatsappLoading}
            />
            {isWhatsappLoading ? (
              <span className="text-gray-400"><Dots /> Carregando configuração do WhatsApp</span>
            ) : whatsappStatus ? (
              <span className="text-gray-400">Notificações pelo Whatsapp ATIVADAS</span>
            ) : (
              <span className="text-gray-400">Notificações pelo Whatsapp DESATIVADAS</span>
            )}
          </label>
        </div>
      </div>
    </div>
  );
}

