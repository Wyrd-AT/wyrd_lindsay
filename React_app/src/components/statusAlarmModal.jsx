// src/components/StatusAlarmModal.jsx
import React, {
  useEffect,
  useState,
  useCallback,
  useMemo
} from "react";
import { IoClose } from "react-icons/io5";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import useMessageStore from "../stores/messageStore";
import useHistoricoAlertasStore from "../hooks/alertsHistoryStore";
import { useIrrigadores } from "../stores/dataStoreIrrigadores";

// Mapeamento dos códigos para a descrição
const valueDescriptions = {
  "0": "Normal",
  "1": "Alarmado",
  "2": "Reconhecido",
  "3": "Alarme OFF",
  "9": "Ausente"
};
const alarmTypeDescriptions = {
  A: "Tensão abaixo de 50V e PN1 (Lindsay) e PN2 (SFR)",
  B: "Fim-de-curso 1 (SW1)",
  C: "Fim-de-curso 2 (SW2)",
  D: "Memória de Tensão baixa (1 a 8)",
  E: "Torre ausente (não responde à Central)",
};

export default function StatusAlarmModal({
  isOpen,
  onClose,
  selectedMachine,
  card // { title, statuses }
}) {
  const postMessage = useMessageStore((s) => s.postMessage);
  const {
    historicoAlertas,
    isLoading: isLoadingHistory,
    error: historyError
  } = useHistoricoAlertasStore();


  const [loading, setLoading] = useState(false);
  const [responseMsg, setResponseMsg] = useState("");
  const [collapsedSections, setCollapsedSections] = useState({});

  // Fecha modal com Esc
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);



  const machineId = selectedMachine?.replace("IRRIGADOR ", "") || "";
  const equipment = card?.title;


  const irrigadores = useIrrigadores() || [];
  //console.log(irrigadores)
  // Filtra apenas os que derem true nessa comparação
  const irrigador_analisado = irrigadores.filter(
    (item) => item.codigo === machineId
  );

  const historico_do_irrigador_analisado = historicoAlertas.filter(
    (item) => item.irrigadorId === machineId
  )

  //console.log(irrigador_analisado);
  console.log(historico_do_irrigador_analisado)


  const equipamento_by_code = Object.fromEntries(
    Array.from({ length: 13 }, (_, i) => {
      const code = String(i + 1).padStart(2, "0");       // "01", "02", …, "13"
      const idx = i + 2;// 2, 3, …, 14
      return [code, irrigador_analisado[0]?.equipamentos[idx]];
    })
  );


  //console.log(equipamento_by_code)

  const filteredHistory = useMemo(() => {
    if (
      !historico_do_irrigador_analisado ||
      !machineId ||
      !equipamento_by_code
    ) {
      return [];
    }

    return historicoAlertas.filter((item) => {
      let equipamentoDoItem
      if (item.monitor == 17) {
        equipamentoDoItem = "Painel 1";

      } else if (item.monitor == 18) {
        equipamentoDoItem = "Painel 2";

      }else if(item.monitor == "02" && item.alarme == "E"){
        const monitor_numerico = parseFloat(item.monitor)+6
        console.log(String("0"+monitor_numerico))
        equipamentoDoItem = equipamento_by_code[String("0"+monitor_numerico)];


      }
       else {
        // mapeia o código do monitor para o equipamento real
        equipamentoDoItem = equipamento_by_code[item.monitor];
        // só inclui se o irrigador bater e o equipamento também
      }
      console.log(equipment)
      return (
        item.irrigadorId === machineId &&
        equipamentoDoItem === equipment
      );
    });
  }, [
    historicoAlertas,
    machineId,
    equipment,
    equipamento_by_code
  ]);

  console.log(filteredHistory)

  const historicoPorEquipamento = useMemo(() => {
    return historicoAlertas.reduce((acumulador, item) => {
      // só processa itens do irrigador atual
      if (item.irrigadorId !== machineId) return acumulador;

      // mapeia o código do monitor para o equipamento real
      const equipamentoDoItem = equipamento_by_code[item.monitor];

      // inicializa o array se ainda não existir
      if (!acumulador[equipamentoDoItem]) {
        acumulador[equipamentoDoItem] = [];
      }

      // adiciona o item ao grupo do equipamento
      acumulador[equipamentoDoItem].push(item);

      return acumulador;
    }, {});
  }, [
    historicoAlertas,
    machineId,
    equipamento_by_code
  ]);

  // Exemplo de uso:
  console.log(historicoPorEquipamento);
  const sortedHistory = useMemo(() => {
    return [...filteredHistory].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );
  }, [filteredHistory]);

  const formatDate = (iso) =>
    new Date(iso).toLocaleDateString("pt-BR");
  const formatTime = (iso) =>
    new Date(iso).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit"
    });

  const groupedByDate = useMemo(() => {
    return sortedHistory.reduce((acc, item) => {
      const d = formatDate(item.date);
      if (!acc[d]) acc[d] = [];
      acc[d].push(item);
      return acc;
    }, {});
  }, [sortedHistory]);

  const toggleSection = (date) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [date]: !prev[date]
    }));
  };

  // --- Fim seção histórico ---

  // Helper genérico para enviar comandos
  const sendCommand = useCallback(
    async (command, successText) => {
      setLoading(true);
      setResponseMsg("");
      try {
        const payload = `${machineId};${command}`;
        const doc = {
          topic: `lindsay/comandos/${machineId}`,
          payload,
          origin: "app",
          table: "command",
          qos: 0,
          timestamp: new Date().toISOString()
        };
        await postMessage(doc);
        setResponseMsg(`✅ ${successText}`);
      } catch {
        setResponseMsg(
          `❌ Falha ao ${successText.toLowerCase()}.`
        );
      } finally {
        setLoading(false);
      }
    },
    [machineId, postMessage]
  );

  if (!isOpen || !card) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black opacity-60" />

      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 bg-[#222] text-white p-6 rounded-lg w-full max-w-[50vw] max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-white text-2xl hover:text-gray-400"
          aria-label="Fechar"
        >
          <IoClose />
        </button>

        <h2 className="text-2xl font-semibold mb-4 text-center">
          Histórico – {equipment}
        </h2>

        {/* Status atuais do card */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {card.statuses.map((s) => {
            const isTension =
              s.label === "Falha por tensão"
            const desc = isTension
              ? s.value
              : valueDescriptions[s.value] || s.value;
            return (
              <div
                key={s.label}
                className="bg-[#2b2b2b] p-2 rounded flex flex-col"
              >
                <span className="font-medium">{s.label}</span>
                <span className="mt-1">{desc}</span>
              </div>
            );
          })}
        </div>

        {/* Botões de ação */}
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() =>
              sendCommand(
                "alarme",
                "Status solicitado com sucesso!"
              )
            }
            disabled={loading}
            className="flex-1 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 px-4 py-2 rounded"
          >
            {loading ? "Solicitando..." : "Solicitar Status"}
          </button>
          <button
            type="button"
            onClick={() =>
              sendCommand(
                "set_alarmon",
                "Alarme ligado com sucesso!"
              )
            }
            disabled={loading}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 px-4 py-2 rounded"
          >
            {loading ? "..." : "Ligar Alarme"}
          </button>
          <button
            type="button"
            onClick={() =>
              sendCommand(
                "set_alarmoff",
                "Alarme desligado com sucesso!"
              )
            }
            disabled={loading}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 px-4 py-2 rounded"
          >
            {loading ? "..." : "Desligar Alarme"}
          </button>
          <button
            type="button"
            onClick={() =>
              sendCommand(
                "siren",
                "Sirene disparada com sucesso!"
              )
            }
            disabled={loading}
            className="flex-1 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 px-4 py-2 rounded"
          >
            {loading ? "..." : "Disparar Sirene"}
          </button>
        </div>

        {responseMsg && (
          <p
            className={`mb-4 ${responseMsg.startsWith("✅")
              ? "text-green-400"
              : "text-red-400"
              }`}
          >
            {responseMsg}
          </p>
        )}

        {/* Histórico de alertas por equipamento */}
        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-2">
            Histórico de Alertas
          </h3>
          <div
            className="flex justify-between px-4 py-1 hover:bg-[#2a2a2a] rounded"
          >
            <span className="w-1/5">
              Data
            </span>
            <span className="w-1/5">
              Descrição
            </span>
            <span className="w-1/5">
              Monitor
            </span>
            <span className="w-1/5">
              Status
            </span>
          </div>

          {isLoadingHistory ? (
            <p>Carregando histórico...</p>
          ) : historyError ? (
            <p className="text-red-400">
              Erro: {historyError.message}
            </p>
          ) : sortedHistory.length === 0 ? (
            <p>Nenhum alerta registrado ainda.</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedByDate).map(
                ([date, items]) => {
                  const collapsed =
                    collapsedSections[date];
                  return (
                    <div key={date}>
                      <div
                        className="flex items-center cursor-pointer bg-[#333] px-3 py-1 rounded"
                        onClick={() =>
                          toggleSection(date)
                        }
                      >

                        {collapsed ? (
                          <FiChevronDown />
                        ) : (
                          <FiChevronUp />
                        )}
                        <span className="ml-2 font-medium">

                          {date}
                        </span>
                      </div>

                      {!collapsed && (
                        <div className="mt-2">

                          {items.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex justify-between px-4 py-1 hover:bg-[#2a2a2a] rounded"
                            >
                              <span className="w-1/5">
                                {formatTime(item.date)}
                              </span>
                              <span className="w-1/5">
                                {alarmTypeDescriptions[item.alarme]}
                              </span>
                              <span className="w-1/5">
                                {item.monitor}
                              </span>
                              <span className="w-1/5">
                                {valueDescriptions[
                                  item.status
                                ] || item.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
