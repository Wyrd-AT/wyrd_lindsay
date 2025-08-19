import React, { useMemo, useState, useEffect } from "react";
import { IoClose } from "react-icons/io5";
import { FiShare2 } from "react-icons/fi";
import { valueDescriptions } from "./alertHistory";
import { useAuthStore } from "../stores/authStore";
import { useAgendamentos, useDataStoreAgendamentos } from "../stores/dataStoreTimers";

function mkReqId(prefix = "ag") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function formatHHMMSS(ms) {
  const total = Math.max(0, Math.floor((ms ?? 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export default function AlertEdit({
  isOpen = false,
  onClose,
  alertData = null,
  equipamentos = [],
}) {
  const [monitor, setMonitor] = useState("Painel 1");
  const [minutes, setMinutes] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [localTimerOverride, setLocalTimerOverride] = useState(null);
  const addTimer = useDataStoreAgendamentos((state) => state.addAgendamento);
  const { agendamentos, findAgendamentoByIdOrigem } = useAgendamentos();
  const { user } = useAuthStore();
  const storeTimer = findAgendamentoByIdOrigem(alertData?._id);

  useEffect(() => {
    if (alertData?.monitor != null) setMonitor(alertData.monitor);
  }, [alertData?.monitor]);

  const monitorResolved = useMemo(() => {
    if (!Array.isArray(equipamentos) || equipamentos.length === 0) return String(monitor ?? "—");
    const id = Number(alertData?.monitor);
    if (Number.isNaN(id)) return String(alertData?.monitor ?? monitor ?? "—");

    let idx = id === 17 ? 0 : id === 18 ? 1 : id + 1;
    if (idx < 0 || idx >= equipamentos.length) return `#${id}`;
    const item = equipamentos[idx];
    return typeof item === "string" ? item : item?.nome ?? item?.name ?? `#${id}`;
  }, [alertData?.monitor, equipamentos, monitor]);

  useEffect(() => {
    if (!localTimerOverride) return;
    if (storeTimer?.scheduled_for && storeTimer.scheduled_for === localTimerOverride.scheduled_for) {
      setLocalTimerOverride(null);
    }
  }, [alertData]);

  const effectiveTimer = storeTimer;
  const scheduledTargetTs = useMemo(
    () => effectiveTimer?.scheduled_for ? new Date(effectiveTimer.scheduled_for).getTime() : null,
    [effectiveTimer?.scheduled_for]
  );

  const [remainingMs, setRemainingMs] = useState(null);
  useEffect(() => {
    if (!scheduledTargetTs || !isOpen) {
      setRemainingMs(null);
      return;
    }
    const tick = () => setRemainingMs(Math.max(0, scheduledTargetTs - Date.now()));
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [scheduledTargetTs, isOpen]);

  const [previewMs, setPreviewMs] = useState(null);
  useEffect(() => {
    const mins = Number(minutes || 0);
    if (!isOpen || !Number.isFinite(mins) || mins <= 0 || scheduledTargetTs) {
      setPreviewMs(null);
      return;
    }
    const previewTarget = Date.now() + mins * 60_000;
    const tick = () => setPreviewMs(Math.max(0, previewTarget - Date.now()));
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [minutes, isOpen, scheduledTargetTs]);

  async function handleAgendamentoClick() {
    if (!alertData) return;

    const reqId = mkReqId();
    try {
      setIsSaving(true);
      const agora = new Date();
      const parsedMinutes = Number(minutes || 0);
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
      };

      if (storeTimer?._id) {
        await addTimer({ ...storeTimer, ...timerDoc });
      } else {
        await addTimer(timerDoc);
        setMinutes(0);
      }

      setLocalTimerOverride({
        ...(storeTimer ?? {}),
        ...timerDoc,
        _id: storeTimer?._id ?? "local",
      });
    } catch (err) {
      console.error("Erro ao salvar agendamento:", err);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSolutionClick() {
    if (!effectiveTimer) return;

    const reqId = mkReqId();
    try {
      setIsSaving(true);
      const agora = new Date();
      const timerDoc = {
        id_origem: alertData._id,
        ultimo_agendamento: effectiveTimer.ultimo_agendamento,
        scheduled_for: effectiveTimer?.scheduled_for,
        responsavel_agendamento: effectiveTimer?.responsavel_agendamento || "Desconhecido",
        timer_value: effectiveTimer?.timer_value,
        status: "solucionado",
        updated_at: agora.toISOString(),
        created_at: effectiveTimer?.created_at,
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
  const scheduledFor = effectiveTimer?.scheduled_for ? new Date(effectiveTimer.scheduled_for).toLocaleString("pt-BR") : "—";
  const responsavel = effectiveTimer?.responsavel_agendamento ?? "—";
  const timerValor = Number.isFinite(effectiveTimer?.timer_value) ? `${effectiveTimer.timer_value} min` : "—";
  const responsavelSolucao = effectiveTimer?.responsavel_solucao ?? "—";
  const dataSolucao = effectiveTimer?.data_solucao ?? "—";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black opacity-25" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative bg-[#2f2f2f] text-white rounded-md w-full max-w-md flex flex-col" aria-busy={isSaving}>
        <details className="p-4 border-t border-[#444]">
          <summary className="cursor-pointer text-sm text-gray-400">Ver timer (JSON)</summary>
          <div className="mt-2 max-h-60 overflow-auto rounded bg-[#1f1f1f] p-3 text-xs font-mono leading-relaxed">
            <pre className="whitespace-pre-wrap break-words">{effectiveTimer ? JSON.stringify(effectiveTimer, null, 2) : "—"}</pre>
          </div>
        </details>
        <details className="px-4 border-t border-[#444]">
          <summary className="cursor-pointer text-sm text-gray-400">Ver alertData (JSON)</summary>
          <div className="mt-2 max-h-60 overflow-auto rounded bg-[#1f1f1f] p-3 text-xs font-mono leading-relaxed">
            <pre className="whitespace-pre-wrap break-words">{alertData ? JSON.stringify(alertData, null, 2) : "—"}</pre>
          </div>
        </details>

        <div className="flex justify-between items-center p-4 border-b border-[#444]">
          <h2 className="text-lg font-semibold" title={String(monitorResolved)}>{alertData?._id} {monitorResolved}</h2>
          <div className="flex gap-2">
            <FiShare2 size={20} />
            <button type="button" onClick={onClose} aria-label="Fechar"><IoClose size={20} /></button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 p-4">
          <div><label className="block text-sm text-gray-400">Monitor</label><div className="text-sm truncate" title={String(monitorResolved)}>{monitorResolved}</div></div>
          <div><label className="block text-sm text-gray-400">Data</label><div className="text-sm">{alertData?.date}</div></div>
          <div><label className="block text-sm text-gray-400">Hora</label><div className="text-sm">{alertData?.time}</div></div>
          <div><label className="block text-sm text-gray-400">Status</label><div className="text-sm">{valueDescriptions[alertData?.status]}</div></div>
        </div>

        <div className="p-4 border-t border-[#444]">
          <h3 className="text-sm text-gray-400">Ativar alarme novamente em:</h3>
          <div className="flex items-center gap-2 mt-1">
            <input type="number" min={0} value={minutes} onChange={(e) => setMinutes(e.target.value)} className="w-20 px-2 text-sm bg-[#444444] rounded" disabled={isSaving} />
            <span className="text-sm text-gray-300">MINUTOS</span>
            <button type="button" className="px-3 py-1 text-sm rounded bg-blue-600 text-white disabled:opacity-60 disabled:cursor-not-allowed" onClick={handleAgendamentoClick} title={isSaving ? "Processando..." : "Agendar"} disabled={isSaving} aria-busy={isSaving}>
              {isSaving ? "Agendando..." : "Agendar"}
            </button>
          </div>

          {scheduledTargetTs && (
            <div className="mt-3 text-sm text-gray-400">
              Cronômetro até reativação: <span className="text-white font-mono" aria-live="polite">{formatHHMMSS(remainingMs)}</span>
              {remainingMs === 0 && <span className="ml-2 text-green-400">⏰ pronto</span>}
            </div>
          )}

          {!scheduledTargetTs && previewMs != null && (
            <div className="mt-3 text-sm text-gray-400">
              Prévia ({Number(minutes)} min): <span className="text-white font-mono" aria-live="polite">{formatHHMMSS(previewMs)}</span>
            </div>
          )}

          <div className="mt-3 grid grid-cols-1 gap-1 text-sm text-gray-400">
            <div>Último agendamento: <p className="text-white inline">{ultimoAgendamento}</p></div>
            <div>Timer agendado para: <p className="text-white inline">{scheduledFor}</p></div>
            <div>Responsável pelo agendamento: <p className="text-white inline">{responsavel}</p></div>
            <div>Intervalo configurado: <p className="text-white inline">{timerValor}</p></div>
          </div>

          <div className="mt-6 text-sm text-gray-400 border-t border-[#444] pt-4">
            <button type="button" className="px-3 py-1 text-sm rounded bg-blue-600 text-white disabled:opacity-60 disabled:cursor-not-allowed" onClick={handleSolutionClick} title={isSaving ? "Solucionando..." : "Solucionar Alarme"} disabled={isSaving} aria-busy={isSaving}>
              {isSaving ? "Solucionando..." : "Solucionar Alarme"}
            </button>
            <div>
              <div className="mt-2">Data da solução: <p className="text-white inline">{dataSolucao}</p></div>
              <p>Responsável pela solução do alarme:</p>
              <p className="text-white">{responsavelSolucao}</p>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[#444]">
          <input type="checkbox" checked={false} readOnly className="p-4" />
          <label className="ml-2 text-gray-400">Notificações pelo Whatsapp DESATIVADAS</label>
        </div>
      </div>
    </div>
  );
}
