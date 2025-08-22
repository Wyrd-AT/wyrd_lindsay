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

/** Ajuste explícito para IDs específicos, evitando regra “mágica” */
const MONITOR_MAP = {
  17: 0,
  18: 1,
};

export default function AlertEdit({
  isOpen = false,
  onClose,
  alertData = null,
  equipamentos = [],
  machineId
}) {
  const [minutes, setMinutes] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [localTimerOverride, setLocalTimerOverride] = useState(null);
  const [whatsappStatus, setWhatsappStatus] = useState(false);





  const addTimer = useDataStoreAgendamentos((state) => state.addAgendamento);
  const { findAgendamentoByIdOrigem } = useAgendamentos();
  const { user } = useAuthStore();

  // Evita chamar com undefined quando alertData ainda não chegou
  const storeTimer = alertData?._id ? findAgendamentoByIdOrigem(alertData._id) : null;
  const { whatsappConfig, fetchWhatsappConfig, updateWhatsappStatus } =
    whatsappStoreConfig((state) => state);


  /** Use o override local para a UI até a store sincronizar */
  const effectiveTimer = localTimerOverride ?? storeTimer ?? null;

  const isSolved = effectiveTimer?.status === "solucionado";

  useEffect(() => {
    if (!whatsappConfig) {
      fetchWhatsappConfig();
    }
  }, [whatsappConfig, fetchWhatsappConfig]);

  const handleToggleChange = (e) => {
    const newSatus = e.target.checked;
    setWhatsappStatus(newSatus);
    updateWhatsappStatus(newSatus);

  };

  /** Quando a store ficar igual ao override, limpe o override */
  useEffect(() => {
    if (!localTimerOverride || !storeTimer) return;

    // Só limpa quando a store refletir a MESMA solução (mesmos campos de solução)
    const sameSolution =
      storeTimer.status === localTimerOverride.status &&
      storeTimer.data_solucao === localTimerOverride.data_solucao &&
      storeTimer.responsavel_solucao === localTimerOverride.responsavel_solucao;

    if (sameSolution) {
      setLocalTimerOverride(null);
    }
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
        const focusables = dialogRef.current.querySelectorAll < HTMLElement > (
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

  const monitorResolved = useMemo(() => {
    if (!Array.isArray(equipamentos) || equipamentos.length === 0) return String(monitor ?? "—");
    const id = Number(alertData?.monitor);
    if (Number.isNaN(id)) return String(alertData?.monitor ?? "—");

    let idx = id === 17 ? 0 : id === 18 ? 1 : id + 1;
    if (idx < 0 || idx >= equipamentos.length) return `#${id}`;
    const item = equipamentos[idx];
    return typeof item === "string" ? item : item?.nome ?? item?.name ?? `#${id}`;
  }, [alertData?.monitor, equipamentos]);

  /** TS do alvo agendado */
  const scheduledTargetTs = useMemo(() => {
    if (!effectiveTimer?.scheduled_for || isSolved) return null;
    const ts = new Date(effectiveTimer.scheduled_for).getTime();
    return Number.isFinite(ts) ? ts : null;
  }, [effectiveTimer?.scheduled_for, isSolved]);


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
      if (ms === 0 && id) {
        clearInterval(id);
      }
    };
    tick(); // tick imediato
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
    tick(); // tick imediato
    id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [minutes, isOpen, scheduledTargetTs]);

  /** Strings de debug memoizadas */
  const prettyTimerJSON = useMemo(
    () => (effectiveTimer ? JSON.stringify(effectiveTimer, null, 2) : "—"),
    [effectiveTimer]
  );
  const prettyAlertJSON = useMemo(
    () => (alertData ? JSON.stringify(alertData, null, 2) : "—"),
    [alertData]
  );

  const sendCommandAlarmOFFxx = useCallback(
    async (command, monitor, id) => {
      try {
        await postMessage({
          topic: `lindsay/comandos/${id}`,
          payload: `${id};${command}`,
          origin: "app",
          table: "command",
          qos: 0,
          "timer": minutes,
          timestamp: new Date().toISOString(),
        });
        console.log(`Comando enviado: ${command} para monitor ${monitor} do ID ${id}`);
      } catch (err) {
        console.error(' comand error:', err)
      } finally {
      }
    },
    [machineId, postMessage]
  );

  const handleEnviar = async (command, monitor, id) => {
    try {
      const payload = `${id};${command}${monitor}`;
      const doc = {
        topic: `lindsay/comandos/${id}`,
        payload,
        origin: "app",
        table: "command",
        qos: 0,
        "timer": minutes,
        timestamp: getBrasiliaTimestamp(), // agora no fuso de Brasília
      };
      //////////console.log("[MensagemModal] enviando doc:", doc);
      await useMessageStore.getState().postMessage(doc);

    } catch (err) {
      console.error("[MensagemModal] erro ao enviar comando:", err);
    } finally {
      console.log("comando enviado")
    }
  };
  /** Ações */
  async function handleAgendamentoClick() {
    if (!alertData) return;

    const parsedMinutes = Math.trunc(Number(minutes));
    if (!Number.isFinite(parsedMinutes) || parsedMinutes < 1) {
      // aqui você pode disparar um toast/aviso se tiver infra de UI
      return;
    }

    try {
      console.log("entrou no try")
      setIsSaving(true);
      const agora = new Date();
      const scheduled = new Date(agora.getTime() + parsedMinutes * 60_000);

      const timerDoc = {
        id_origem: alertData._id,
        ultimo_agendamento: agora.toLocaleString("pt-BR"),
        scheduled_for: scheduled.toISOString(),
        responsavel_agendamento: user?.email || "Desconhecido",
        timer_value: parsedMinutes,
        status: "agendado",
        updated_at: agora.toISOString(),
        created_at: storeTimer?.created_at ?? agora.toISOString(),
        data_solucao: "—",
        responsavel_solucao: "—"
      };
      console.log("criou o doc")
      if (storeTimer?._id) {
        await addTimer({ ...storeTimer, ...timerDoc });
      } else {
        await addTimer(timerDoc);
      }

      // Override local para refletir imediatamente
      setLocalTimerOverride({
        ...(storeTimer ?? {}),
        ...timerDoc,
        _id: storeTimer?._id ?? "local",
      });
      console.log("iniciou o comando")
      handleEnviar("SendOFF", alertData.monitor, machineId)
      console.log("comando enviado")
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
      const agora = new Date();
      const base = effectiveTimer ?? {}; // pode não existir timer prévio

      const timerDoc = {
        id_origem: alertData._id,
        ultimo_agendamento: base.ultimo_agendamento ?? null,
        scheduled_for: base.scheduled_for ?? null,
        responsavel_agendamento: base.responsavel_agendamento ?? user?.email ?? "Desconhecido",
        timer_value: base.timer_value ?? null,
        status: "solucionado",
        updated_at: agora.toISOString(),
        created_at: base.created_at ?? storeTimer?.created_at ?? agora.toISOString(),
        data_solucao: agora.toLocaleString("pt-BR"),
        responsavel_solucao: user?.email || "Desconhecido",
      };

      if (storeTimer?._id) {
        await addTimer({ ...storeTimer, ...timerDoc });
      } else {
        await addTimer(timerDoc);
      }

      setLocalTimerOverride({
        ...(storeTimer ?? {}),
        ...timerDoc,
        _id: storeTimer?._id ?? "local",
      });
    } catch (err) {
      console.error("Erro ao salvar solução:", err);
    } finally {
      setIsSaving(false);
    }
  }


  if (!isOpen) return null;





  const ultimoAgendamento = effectiveTimer?.ultimo_agendamento ?? "—";
  const scheduledFor = effectiveTimer?.scheduled_for
    ? new Date(effectiveTimer.scheduled_for).toLocaleString("pt-BR")
    : "—";
  const responsavelAg = effectiveTimer?.responsavel_agendamento ?? "—";
  const timerValor = Number.isFinite(effectiveTimer?.timer_value)
    ? `${effectiveTimer.timer_value} min`
    : "—";
  const responsavelSolucao = effectiveTimer?.responsavel_solucao ?? "—";
  const dataSolucao = effectiveTimer?.data_solucao ?? "—";

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
        <details className="p-4 border-t border-[#444]">
          <summary className="cursor-pointer text-sm text-gray-400">Ver timer (JSON)</summary>
          <div className="mt-2 max-h-60 overflow-auto rounded bg-[#1f1f1f] p-3 text-xs font-mono leading-relaxed">
            <pre className="whitespace-pre-wrap break-words">{prettyTimerJSON}</pre>
          </div>
        </details>

        <details className="px-4 border-t border-[#444]">
          <summary className="cursor-pointer text-sm text-gray-400">Ver alertData (JSON)</summary>
          <div className="mt-2 max-h-60 overflow-auto rounded bg-[#1f1f1f] p-3 text-xs font-mono leading-relaxed">
            <pre className="whitespace-pre-wrap break-words">{prettyAlertJSON}</pre>
          </div>
        </details>

        <div className="flex justify-between items-center p-4 border-b border-[#444]">
          <h2
            id="alertedit-title"
            ref={titleRef}
            tabIndex={-1}
            className="text-lg font-semibold outline-none"
            title={String(monitorResolved)}
          >
            {alertData?._id} {monitorResolved}
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              className="p-1 rounded hover:bg-[#3a3a3a] focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Compartilhar"
              onClick={() => {
                // TODO: Implementar ação de compartilhamento aqui
              }}
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
            <div className="text-sm truncate" title={String(monitorResolved)}>{monitorResolved}</div>
          </div>
          <div>
            <label className="block text-sm text-gray-400">Data</label>
            <div className="text-sm">{alertData?.date ?? "—"}</div>
          </div>
          <div>
            <label className="block text-sm text-gray-400">Hora</label>
            <div className="text-sm">{alertData?.time ?? "—"}</div>
          </div>
          <div>
            <label className="block text-sm text-gray-400">Status</label>
            <div className="text-sm">
              {valueDescriptions?.[alertData?.status] ?? String(alertData?.status ?? "—")}
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
                if (Number.isNaN(v)) {
                  setMinutes(NaN);
                } else {
                  setMinutes(clamp(Math.trunc(v), 1, 10080)); // até 7 dias
                }
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

          {!isSolved && scheduledTargetTs && (
            <div className="mt-3 text-sm text-gray-400">
              Cronômetro até reativação: <span className="text-white font-mono" aria-live="polite">
                {formatHHMMSS(remainingMs)}
              </span>
              {remainingMs === 0 && <span className="ml-2 text-green-400">⏰ pronto</span>}
            </div>
          )}

          {!scheduledTargetTs && previewMs != null && Number.isFinite(previewMs) && (
            <div className="mt-3 text-sm text-gray-400">
              Prévia ({Number(minutes)} min):{" "}
              <span className="text-white font-mono" aria-live="polite">
                {formatHHMMSS(previewMs)}
              </span>
            </div>
          )}

          <div className="mt-3 grid grid-cols-1 gap-1 text-sm text-gray-400">
            <div>
              Último agendamento: <p className="text-white inline">{ultimoAgendamento}</p>
            </div>
            <div>
              Timer agendado para: <p className="text-white inline">{scheduledFor}</p>
            </div>
            <div>
              Responsável pelo agendamento: <p className="text-white inline">{responsavelAg}</p>
            </div>
            <div>
              Intervalo configurado: <p className="text-white inline">{timerValor}</p>
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
                Data da solução: <p className="text-white inline">{dataSolucao}</p>
              </div>
              <p>Responsável pela solução do alarme:</p>
              <p className="text-white">{responsavelSolucao}</p>
            </div>
          </div>
        </div>

        <div className="p-4 border-[#444]">
          <input
            type="checkbox"
            checked={whatsappStatus}
            onChange={handleToggleChange}
            className="p-4"
          />
          {whatsappStatus == false ? <label className="ml-2 text-gray-400">Notificações pelo Whatsapp DESATIVADAS</label> : <label className="ml-2 text-gray-400">Notificações pelo Whatsapp ATIVADAS</label>}

        </div>
      </div>
    </div>
  );
}
