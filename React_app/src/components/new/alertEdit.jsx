import React, { useMemo, useState, useEffect, useRef } from "react";
import { IoClose } from "react-icons/io5";
import { FiShare2 } from "react-icons/fi";
import PizZip from "pizzip";

import { valueDescriptions } from "./alertHistory";
import { getBrasiliaTimestamp } from "./messageModal"

import { useAuthStore } from "../../stores/new/authStore";
import useMessageStore from "../../stores/new/messageStore";
;
import { whatsappStoreConfig } from "../../stores/new/whatsappStore";
import { find, getDoc, getDocAll, upsertDoc } from "../../api/new/couch";
import { appendHistoryEvent, currentId, getById, historyIdMonthly, setCurrent } from "../../hooks/new/useAgendamentos";
import Docxtemplater from "docxtemplater";
import { saveAs } from "file-saver";


function xmlSafe(s) {
  const str = String(s ?? "—");
  return str.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}
const fmtBR = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("pt-BR");
};


/** Busca eventos do histórico (modelo novo “history:YYYY-MM”). Fallback para modelo legado. */
async function fetchTimerHistory(DB_NAME, idOrigem) {
  // 1) Tenta ler docs de histórico particionado por mês
  try {
    const prefix = `timer:${idOrigem}:history:`; // prefixo para todos os meses
    const startkey = prefix;
    const endkey = startkey + "\ufff0";

    const data = await getDocAll(DB_NAME, {
      include_docs: true,
      startkey,
      endkey,
      limit: 10000, // ajuste se precisar
    });

    const events = [];
    for (const row of data?.rows ?? []) {
      const evs = row?.doc?.events;
      if (Array.isArray(evs)) {
        for (const e of evs) {
          const atIso = e?.at ? new Date(e.at).toISOString() : new Date().toISOString();
          events.push({
            type: e?.type === "solve" ? "solve" : "schedule",
            at: atIso,
            by: xmlSafe(e?.by || "—"),
            timer_value:
              e?.type === "solve" ? (e?.related?.timer_value ?? "—") : (e?.timer_value ?? "—"),
            scheduled_for:
              e?.type === "solve" ? e?.related?.scheduled_for : e?.scheduled_for,
          });
        }
      }
    }

    if (events.length) {
      events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
      return { events, source: "history-docs" };
    }
  } catch (_) {
    // segue para fallback
  }

  // 2) Fallback: modelo legado — varre docs por id_origem via find
  try {
    const res = await find(DB_NAME, {
      selector: { id_origem: { $eq: idOrigem } },
      limit: 2000,
    });

    const docs = res?.docs ?? [];
    const legacyEvents = docs.map((d) => {
      const atBase =
        d?.updated_at || d?.created_at || d?.data_solucao || d?.ultimo_agendamento;
      const atIso = atBase ? new Date(atBase).toISOString() : new Date().toISOString();

      if (d?.status === "solucionado") {
        return {
          type: "solve",
          at: atIso,
          by: xmlSafe(d?.responsavel_solucao || "—"),
          timer_value: d?.timer_value ?? "—", // só para consistência, usamos related abaixo
          scheduled_for: d?.scheduled_for ?? null,
          // mantém shape compatível com quem usa related, se precisar
          related: {
            scheduled_for: d?.scheduled_for ?? null,
            timer_value: d?.timer_value ?? null,
          },
        };
      }

      return {
        type: "schedule",
        at: atIso,
        by: xmlSafe(d?.responsavel_agendamento || "—"),
        timer_value: d?.timer_value ?? "—",
        scheduled_for: d?.scheduled_for ?? null,
      };
    });

    legacyEvents.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    return { events: legacyEvents, source: "legacy-find" };
  } catch (err) {
    throw new Error("Falha ao buscar histórico.");
  }
}

/** Monta um Document (docx) com os eventos */
async function buildTimerHistoryDocx({ idOrigem, monitorNome, currentDoc, events }) {
    const title = new Paragraph({
      text: `Histórico de Timer – Alarme ${monitorNome || idOrigem}`,
      heading: HeadingLevel.HEADING_1,
    });

    const meta = [
      new Paragraph({
        children: [
          new TextRun({ text: "ID de Origem: ", bold: true }),
          new TextRun(String(idOrigem)),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Gerado em: ", bold: true }),
          new TextRun(fmtBR(new Date().toISOString())),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Estado atual: ", bold: true }),
          new TextRun(
            currentDoc
              ? `${currentDoc?.status ?? "—"} | agendado p/ ${fmtBR(
                currentDoc?.scheduled_for
              )} | intervalo ${currentDoc?.timer_value ?? "—"} min`
              : "—"
          ),
        ],
      }),
      new Paragraph(" "),
    ];

    // Tabela com eventos
    const headerRow = new TableRow({
      children: ["Data/Hora", "Tipo", "Timer (min)", "Agendado para", "Responsável"].map(
        (t) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: t, bold: true })] })],
          })
      ),
    });

    const eventRows = (events?.length ? events : []).map((ev) => {
      const tipo = ev?.type === "solve" ? "solucionado" : "agendado";
      const timer =
        ev?.type === "schedule"
          ? (ev?.timer_value ?? "—")
          : ev?.related?.timer_value ?? "—";
      const sched =
        ev?.type === "schedule"
          ? fmtBR(ev?.scheduled_for)
          : fmtBR(ev?.related?.scheduled_for);

      return new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(fmtBR(ev?.at))] }),
          new TableCell({ children: [new Paragraph(tipo)] }),
          new TableCell({ children: [new Paragraph(String(timer ?? "—"))] }),
          new TableCell({ children: [new Paragraph(sched || "—")] }),
          new TableCell({ children: [new Paragraph(ev?.by || "—")] }),
        ],
      });
    });

    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow, ...eventRows],
    });

    const doc = new Document({
      sections: [
        {
          children: [title, ...meta, table],
        },
      ],
    });

    return doc;
  }

  /** Faz o download do docx gerado */
  async function downloadDocx(doc, filename = "historico_timer.docx") {
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }




  /** =========================
   * Utils
   * ========================= */
  const DB_NAME = "lindsay-data"; // troque se necessário
  const MONITOR_MAP = { 17: 0, 18: 1 }; // ajustes pontuais

  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const safeNumber = (n, fallback = NaN) =>
    Number.isFinite(Number(n)) ? Number(n) : fallback;

  const pad2 = (n) => String(n).padStart(2, "0");
  const formatMs = (ms) => {
    if (!Number.isFinite(ms) || ms < 0) return "—";
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  };

  const nowIsoBr = () => new Date().toLocaleString("pt-BR");

  /** Indicador "..." */
  function Dots({ className }) {
    const [dots, setDots] = useState("");
    useEffect(() => {
      const id = setInterval(
        () => setDots((d) => (d.length >= 3 ? "" : d + ".")),
        300
      );
      return () => clearInterval(id);
    }, []);
    return (
      <span className={className} aria-live="polite">
        {dots.padEnd(3, " ")}
      </span>
    );
  }

  /** Banner simples de erro */
  function ErrorBanner({ message, onClose }) {
    if (!message) return null;
    return (
      <div
        role="alert"
        className="mx-4 mb-3 rounded border border-red-500 bg-red-900/30 text-red-200 text-sm p-2 flex items-start justify-between gap-4"
      >
        <p>{message}</p>
        <button
          className="shrink-0 px-2 py-0.5 rounded bg-red-700/30 hover:bg-red-700/50"
          onClick={onClose}
          aria-label="Fechar alerta de erro"
        >
          ok
        </button>
      </div>
    );
  }

  /** =========================
   * Componente principal
   * ========================= */
  export default function AlertEdit({
    isOpen = false,
    onClose,
    alertData = null,
    equipamentos = [],
    machineId,
  }) {
    /** ====== Stores ====== */
    const { user } = useAuthStore();
    const whatsappConfig = whatsappStoreConfig((s) => s.whatsappConfig);
    const fetchWhatsappConfig = whatsappStoreConfig((s) => s.fetchWhatsappConfig);
    const updateWhatsappStatus = whatsappStoreConfig((s) => s.updateWhatsappStatus);

    /** ====== Estado local ====== */
    // WhatsApp
    const [whatsappStatus, setWhatsappStatus] = useState(false);
    const [isWhatsappLoading, setIsWhatsappLoading] = useState(false);

    // Agendamento/documento atual
    const [agendamento, setAgendamento] = useState(null);

    // Inputs/flags
    const [minutes, setMinutes] = useState(0);
    const [isSavingSchedule, setIsSavingSchedule] = useState(false);
    const [isSavingSolve, setIsSavingSolve] = useState(false);
    const [isTimerLoading, setIsTimerLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    const isAlertLoading = isOpen && !alertData;

    // A11y e focus trap
    const dialogRef = useRef(null);
    const titleRef = useRef(null);

    /** ====== Efeito: Abertura modal / focus & trap & ESC ====== */
    useEffect(() => {
      if (!isOpen) return;
      // foco inicial
      requestAnimationFrame(() => titleRef.current?.focus());

      const handleKeyDown = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose?.();
        }
        if (e.key === "Tab" && dialogRef.current) {
          const focusables = dialogRef.current.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1")]'
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

    /** ====== Efeito: Carregar config do WhatsApp ====== */
    useEffect(() => {
      if (!isOpen) return;
      let cancelled = false;

      (async () => {
        setIsWhatsappLoading(true);
        setErrorMsg("");

        try {
          // Só busca se ainda não tiver config
          if (!whatsappConfig) {
            await Promise.resolve(fetchWhatsappConfig?.());
          }

          if (!cancelled) {
            const next = Boolean((whatsappStoreConfig.getState().whatsappConfig || {}).enabled);
            // evita setState redundante
            setWhatsappStatus((prev) => (prev === next ? prev : next));
          }
        } catch (err) {
          if (!cancelled) setErrorMsg("Falha ao carregar configuração do WhatsApp.");
        } finally {
          if (!cancelled) setIsWhatsappLoading(false);
        }
      })();

      return () => { cancelled = true; };
      // ⚠️ note que NÃO colocamos fetchWhatsappConfig aqui
      // e dependemos de isOpen + whatsappConfig apenas.
    }, [isOpen, whatsappConfig]);


    /** ====== Efeito: Buscar agendamento mais recente por id_origem ====== */
    useEffect(() => {
      if (!isOpen || !alertData?._id) return;
      let cancelled = false;
      (async () => {
        setIsTimerLoading(true);
        setErrorMsg("");
        try {
          const curr = await getById(DB_NAME, currentId(alertData._id));
          if (!cancelled) setAgendamento(curr ?? null);
        } catch (err) {
          if (!cancelled) setErrorMsg("Erro ao buscar estado atual do timer.");
        } finally {
          if (!cancelled) setIsTimerLoading(false);
        }
      })();
      return () => { cancelled = true; };
    }, [isOpen, alertData?._id]);

    /** ====== Derivados ====== */
    const isSolved = agendamento?.status === "solucionado";

    // resolve nome do monitor
    const monitorResolved = useMemo(() => {
      const raw = alertData?.monitor;
      if (!Array.isArray(equipamentos) || equipamentos.length === 0) {
        return String(raw ?? "—");
      }
      const id = Number(raw);
      if (Number.isNaN(id)) return String(raw ?? "—");
      const idx = MONITOR_MAP[id] ?? id + 1; // regra anterior mantida
      if (idx < 0 || idx >= equipamentos.length) return `#${id}`;
      const item = equipamentos[idx];
      return typeof item === "string" ? item : item?.nome ?? item?.name ?? `#${id}`;
    }, [alertData?.monitor, equipamentos]);

    // TS alvo agendado
    const scheduledTargetTs = useMemo(() => {
      if (!agendamento?.scheduled_for || isSolved) return null;
      const ts = new Date(agendamento.scheduled_for).getTime();
      return Number.isFinite(ts) ? ts : null;
    }, [agendamento?.scheduled_for, isSolved]);

    /** ====== Contagens: agendamento atual e prévia ====== */
    const [remainingMs, setRemainingMs] = useState(null);
    useEffect(() => {
      if (!isOpen || !scheduledTargetTs) {
        setRemainingMs(null);
        return;
      }
      let id = null;
      const tick = () => {
        const ms = Math.max(0, scheduledTargetTs - Date.now());
        setRemainingMs(ms);
        if (ms === 0 && id) clearInterval(id);
      };
      tick();
      id = setInterval(tick, 1000);
      return () => clearInterval(id);
    }, [scheduledTargetTs, isOpen]);

    const [previewMs, setPreviewMs] = useState(null);
    useEffect(() => {
      const mins = safeNumber(minutes, NaN);
      if (!isOpen || scheduledTargetTs || !Number.isFinite(mins) || mins < 1) {
        setPreviewMs(null);
        return;
      }
      let id = null;
      const previewTarget = Date.now() + mins * 60_000;
      const tick = () => {
        const ms = Math.max(0, previewTarget - Date.now());
        setPreviewMs(ms);
        if (ms === 0 && id) clearInterval(id);
      };
      tick();
      id = setInterval(tick, 1000);
      return () => clearInterval(id);
    }, [minutes, isOpen, scheduledTargetTs]);

    /** ====== Helpers: Couch ====== */
    const genDocId = () => {
      try {
        if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
          return crypto.randomUUID();
        }
      } catch (_) { }
      const ts = Date.now().toString(36);
      const rnd = Math.random().toString(36).slice(2);
      return `ag_${ts}_${rnd}`;
    };

    async function handleExportHistoryDocx_Template() {
      try {
        if (!alertData?._id) {
          setErrorMsg("Sem id de origem para gerar histórico.");
          return;
        }
        setErrorMsg("");

        // 1) dados
        let currentDoc = null;
        try {
          currentDoc = await getDoc(DB_NAME, currentId(alertData._id));
        } catch (_) { }
        const { events } = await fetchTimerHistory(DB_NAME, alertData._id);

        // normaliza eventos para o template
        const rows = (events || []).map((ev) => ({
          at: fmtBR(ev.at),
          tipo: ev.type === "solve" ? "solucionado" : "agendado",
          timer: String(ev.timer_value ?? "—"),
          scheduled: fmtBR(ev.scheduled_for),
          by: xmlSafe(ev.by || "—"),
        }));

        const estadoAtual = currentDoc
          ? `${xmlSafe(currentDoc.status ?? "—")} | agendado p/ ${fmtBR(
            currentDoc.scheduled_for
          )} | intervalo ${xmlSafe(currentDoc.timer_value ?? "—")} min`
          : "—";

        const data = {
          monitor: xmlSafe(monitorResolved || ""),
          id_origem: xmlSafe(alertData._id),
          gerado_em: fmtBR(new Date().toISOString()),
          estado_atual: estadoAtual,
          events: rows,
        };

        const res = await fetch('/Template.docx');
        if (!res.ok) throw new Error('Falha ao carregar o template do relatório.');
        const arrayBuffer = await res.arrayBuffer();
        const zip = new PizZip(arrayBuffer);

        const doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
        });
        doc.setData(data);
        doc.render(); // se faltar algum campo, lança erro aqui

        // 4) gera blob e baixa
        const out = doc.getZip().generate({ type: "blob" });
        const filenameSafe = `historico_timer_${String(
          monitorResolved || alertData._id
        )
          .replace(/[\\/:*?"<>|]+/g, "_")
          .replace(/\s+/g, "_")}.docx`;
        saveAs(out, filenameSafe);
      } catch (e) {
        console.error(e);
        setErrorMsg("Falha ao gerar o DOCX a partir do template.");
      }
    }

    async function upsertAgendamento(parsedMinutes) {
      if (!alertData?._id) throw new Error("alertData._id ausente");
      const now = new Date();
      const scheduled = new Date(now.getTime() + parsedMinutes * 60_000);
      setIsTimerLoading(true);
      setErrorMsg("");
      try {
        await setCurrent(DB_NAME, alertData._id, {
          status: "agendado",
          timer_value: parsedMinutes,
          scheduled_for: scheduled.toISOString(),
          ultimo_agendamento: nowIsoBr(),
          responsavel_agendamento: user?.email || "Desconhecido",
          data_solucao: "-",
          responsavel_solucao: "-",
        });
        await appendHistoryEvent(DB_NAME, alertData._id, {
          type: "schedule",
          at: now.toISOString(),
          by: user?.email || "Desconhecido",
          timer_value: parsedMinutes,
          scheduled_for: scheduled.toISOString(),
        });
        const curr = await getById(DB_NAME, currentId(alertData._id));
        setAgendamento(curr);
        return curr;
      } finally {
        setIsTimerLoading(false);
      }
    }

    async function handleEnviar(command, monitor, id, overrideMinutes = null) {
      try {
        const now = new Date();
        // Se overrideMinutes for fornecido (ex: 0 para envio imediato), usa ele. Senão usa o valor do state.
        const parsedMinutes = overrideMinutes !== null ? overrideMinutes : (Number.isFinite(minutes) ? minutes : 0);
        const scheduled_for = parsedMinutes > 0
          ? new Date(now.getTime() + parsedMinutes * 60_000).toISOString()
          : null;

        const payload = `${id};${command}${monitor ?? ""}`;
        const doc = {
          topic: `lindsay/comandos/${id}`,
          payload,
          origin: "app",
          table: "command",
          qos: 0,

          // Campos de agendamento
          timer_minutes: parsedMinutes,
          scheduled_for: scheduled_for,
          scheduled: false,  // Será marcado como true pelo Python quando agendar
          executed: false,   // Será marcado como true pelo Python quando executar
          timer_ref: alertData?._id ? `timer:${alertData._id}:current` : null,

          // Metadados
          created_at: now.toISOString(),
          created_by: user?.email || "Desconhecido",
          status: parsedMinutes > 0 ? "pending" : "immediate",
          timestamp: getBrasiliaTimestamp(),
        };

        await useMessageStore.getState().postMessage(doc);
      } catch (err) {
        setErrorMsg("Falha ao enviar comando para a máquina.");
        console.error("[AlertEdit] erro ao enviar comando:", err);
      }
    }

    /** ====== Handlers ====== */
    const handleToggleChange = (e) => {
      const newStatus = e.target.checked;
      setWhatsappStatus(newStatus);
      try {
        updateWhatsappStatus?.(newStatus);
      } catch (err) {
        setErrorMsg("Não foi possível atualizar o status do WhatsApp.");
      }
    };

    async function handleAgendamentoClick() {
      if (!alertData) return;
      const parsedMinutes = Math.trunc(Number(minutes));
      if (!Number.isFinite(parsedMinutes) || parsedMinutes < 1) {
        setErrorMsg("Informe um número de minutos válido (>= 1).");
        return;
      }
      try {
        setIsSavingSchedule(true);
        await upsertAgendamento(parsedMinutes);
        await handleEnviar("SendOFF", alertData.monitor, machineId);
      } catch (err) {
        setErrorMsg("Erro ao salvar agendamento.");
        console.error("Erro ao salvar agendamento:", err);
      } finally {
        setIsSavingSchedule(false);
      }
    }

    async function handleSolutionClick() {
      if (!alertData) return;
      try {
        setIsSavingSolve(true);
        setIsTimerLoading(true);
        setErrorMsg("");

        const agora = new Date();
        const currentBefore = await getById(DB_NAME, currentId(alertData._id));
        await setCurrent(DB_NAME, alertData._id, {
          ...(currentBefore || {}),
          status: "solucionado",
          data_solucao: nowIsoBr(),
          responsavel_solucao: user?.email || "Desconhecido",
        });
        await appendHistoryEvent(DB_NAME, alertData._id, {
          type: "solve",
          at: agora.toISOString(),
          by: user?.email || "Desconhecido",
          related: {
            scheduled_for: currentBefore?.scheduled_for ?? null,
            timer_value: currentBefore?.timer_value ?? null,
          },
        });
        const curr = await getById(DB_NAME, currentId(alertData._id));
        setAgendamento(curr);
        // Sempre envia comando imediatamente (timer_minutes = 0), ignorando valor do input
        await handleEnviar("ack", "", machineId, 0);

      } catch (err) {
        setErrorMsg("Erro ao marcar alarme como solucionado.");
        console.error("Erro ao salvar solução:", err);
      } finally {
        setIsTimerLoading(false);
        setIsSavingSolve(false);
      }
    }

    /** ====== Render ====== */
    if (!isOpen) return null;

    const ultimoAgendamento = agendamento?.ultimo_agendamento || "—";
    const scheduledFor = agendamento?.scheduled_for
      ? new Date(agendamento.scheduled_for).toLocaleString("pt-BR")
      : "—";
    const responsavelAg = agendamento?.responsavel_agendamento || "—";
    const timerValor = Number.isFinite(agendamento?.timer_value)
      ? `${agendamento.timer_value} minutos`
      : "—";
    const dataSolucao =
      agendamento?.data_solucao && agendamento.data_solucao !== "-"
        ? agendamento.data_solucao
        : "—";
    const responsavelSolucao =
      agendamento?.responsavel_solucao && agendamento.responsavel_solucao !== "-"
        ? agendamento.responsavel_solucao
        : "—";

    const agendarDisabled =
      isSavingSchedule ||
      !Number.isFinite(minutes) ||
      minutes < 1 ||
      isSavingSolve;


    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* camada de fundo */}
        <div
          className="absolute inset-0 bg-black/50"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* modal */}
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="alertedit-title"
          className="relative bg-[#2f2f2f] text-white rounded-md w-full max-w-md flex flex-col outline-none shadow-xl"
        >
          {/* Cabeçalho */}
          <div className="flex justify-between items-center p-4 border-b border-[#444]">
            <h2
              id="alertedit-title"
              ref={titleRef}
              tabIndex={-1}
              className="text-lg font-semibold outline-none truncate"
              title={String(monitorResolved)}
            >
              Alarme {isAlertLoading ? <Dots /> : monitorResolved || "Sem dados"}
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                className="p-1 rounded hover:bg-[#3a3a3a] focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Compartilhar"
                onClick={handleExportHistoryDocx_Template}
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

          {/* Erro (se houver) */}
          <ErrorBanner message={errorMsg} onClose={() => setErrorMsg("")} />

          {/* Dados do alarme */}
          <div className="grid grid-cols-4 gap-4 px-4 pb-2">
            <div>
              <label className="block text-xs text-gray-400">Monitor</label>
              <div className="text-sm truncate" title={String(monitorResolved)}>
                {isAlertLoading ? <Dots /> : monitorResolved || "Sem dados"}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400">Data</label>
              <div className="text-sm">
                {isAlertLoading ? <Dots /> : alertData?.date || "Sem dados"}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400">Hora</label>
              <div className="text-sm">
                {isAlertLoading ? <Dots /> : alertData?.time || "Sem dados"}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400">Status</label>
              <div className="text-sm">
                {isAlertLoading ? (
                  <Dots />
                ) : (
                  valueDescriptions?.[alertData?.status] ??
                  alertData?.status ??
                  "Sem dados"
                )}
              </div>
            </div>
          </div>

          {/* Agendar */}
          <div className="p-4 border-t border-[#444]">
            <h3 className="text-sm text-gray-300">Ativar alarme novamente em:</h3>

            <div className="flex items-center gap-2 mt-2">
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
                className="w-24 px-2 py-1 text-sm bg-[#444444] rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isSavingSchedule || isSavingSolve}
                inputMode="numeric"
                aria-label="Minutos até reativação"
              />
              <span className="text-sm text-gray-300">MINUTOS</span>

              <button
                type="button"
                className="px-3 py-1 text-sm rounded bg-blue-600 text-white disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={handleAgendamentoClick}
                title={isSavingSchedule ? "Processando..." : "Agendar"}
                disabled={agendarDisabled}
                aria-busy={isSavingSchedule}
              >
                {isSavingSchedule ? "Agendando..." : "Agendar"}
              </button>
            </div>

            {/* Contagens */}
            <div className="mt-2 text-xs text-gray-400">
              {scheduledTargetTs ? (
                <p>
                  Restante até reativar:{" "}
                  <span className="text-white">{formatMs(remainingMs)}</span>
                </p>
              ) : Number.isFinite(minutes) && minutes > 0 ? (
                <p>
                  Prévia para {minutes} min:{" "}
                  <span className="text-white">{formatMs(previewMs)}</span>
                </p>
              ) : null}
            </div>

            {/* Info do agendamento atual */}
            <div className="mt-3 grid grid-cols-1 gap-1 text-sm text-gray-400">
              <div>
                Último agendamento:{" "}
                <span className="text-white">
                  {isTimerLoading ? <Dots /> : ultimoAgendamento}
                </span>
              </div>
              <div>
                Timer agendado para:{" "}
                <span className="text-white">
                  {isTimerLoading ? <Dots /> : scheduledFor}
                </span>
              </div>
              <div>
                Responsável pelo agendamento:{" "}
                <span className="text-white">
                  {isTimerLoading ? <Dots /> : responsavelAg}
                </span>
              </div>
              <div>
                Intervalo configurado:{" "}
                <span className="text-white">
                  {isTimerLoading ? <Dots /> : timerValor}
                </span>
              </div>
            </div>
          </div>

          {/* Solução */}
          <div className="px-4 pb-4 border-t border-[#444]">
            <button
              type="button"
              className="mt-4 px-3 py-1 text-sm rounded bg-blue-600 text-white disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClick={handleSolutionClick}
              title={isSavingSolve ? "Solucionando..." : "Solucionar Alarme"}
              disabled={isSavingSolve || isSavingSchedule}
              aria-busy={isSavingSolve}
            >
              {isSavingSolve ? "Solucionando..." : "Solucionar Alarme"}
            </button>

            <div className="mt-3 text-sm text-gray-400">
              <div>
                Data da solução:{" "}
                <span className="text-white">
                  {isTimerLoading ? <Dots /> : dataSolucao}
                </span>
              </div>
              <div>
                Responsável pela solução do alarme:{" "}
                <span className="text-white">
                  {isTimerLoading ? <Dots /> : responsavelSolucao}
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }
