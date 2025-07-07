import useHistoricoAlertasStore from "../hooks/alertsHistoryStore.js";

const valueDescriptions = {
  0: "Normal",
  1: "Alarmado",
  2: "Reconhecido",
  3: "Alarme OFF",
  9: "Ausente",
};

// Mapeamento dos códigos A–E para a descrição completa
const alarmTypeDescriptions = {
  A: "Tensão abaixo de 50V e PN1 (Lindsay) e PN2 (SFR)",
  B: "Fim-de-curso 1 (SW1)",
  C: "Fim-de-curso 2 (SW2)",
  D: "Memória de Tensão baixa (1 a 8)",
  E: "Torre ausente (não responde à Central)",
};

export default function AlertHistory({ machineId }) {
  const {
    historicoAlertas,
    isLoading: isLoadingAlertas,
    error: errorAlertas,
  } = useHistoricoAlertasStore();

  if (isLoadingAlertas) {
    return <div className="p-4 text-white">Carregando histórico de alertas...</div>;
  }
  if (errorAlertas) {
    return (
      <div className="p-4 text-red-500">
        Erro ao carregar histórico de alertas: {errorAlertas.message}
      </div>
    );
  }

  // Filtra por machineId se fornecido
  const listaFiltrada = machineId
    ? historicoAlertas.filter(item => item.irrigadorId === machineId)
    : historicoAlertas;

  // Agrupa por monitor
  const porMonitor = listaFiltrada.reduce((acc, item) => {
    const key = item.monitor ?? "—";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  // Formatação de data/hora
  const formatDate = isoString =>
    new Date(isoString).toLocaleDateString("pt-BR");
  const formatTime = isoString =>
    new Date(isoString).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="bg-[#222222] p-4 space-y-8">
      <h2 className="text-2xl font-semibold text-white mb-4">Histórico de Alertas</h2>

      {Object.entries(porMonitor).map(([monitor, items]) => (
        <div key={monitor}>
          <h3 className="text-xl font-medium text-white mb-2">
            Monitor: <span className="font-bold">{monitor}</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto border-collapse">
              <thead>
                <tr className="bg-[#444444]">
                  {["Data", "Hora", "Irrigador", "Tipo de Alarme", "Status"].map((col, i) => (
                    <th
                      key={i}
                      className="px-4 py-2 text-left font-semibold text-white"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-[#444444]">
                    <td className="px-4 py-2 text-white">{formatDate(item.date)}</td>
                    <td className="px-4 py-2 text-white">{formatTime(item.date)}</td>
                    <td className="px-4 py-2 text-white">{item.irrigadorId}</td>
                    
                    <td className="px-4 py-2 text-white">
                      {alarmTypeDescriptions[item.alarme] ?? item.alarme}
                    </td>
                    <td className="px-4 py-2 text-white">
                      {valueDescriptions[item.status] ?? item.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {Object.keys(porMonitor).length === 0 && (
        <div className="p-4 text-gray-300">Nenhum alerta encontrado.</div>
      )}
    </div>
  );
}
