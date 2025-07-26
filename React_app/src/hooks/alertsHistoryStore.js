import { useState, useEffect } from "react";
import useMessageStore from "../stores/messageStore";
import { updateData } from "../api/database";

export default function useHistoricoAlertasStore() {
  const { parsedMessages = [], isLoading, error } = useMessageStore();
  const [data, setData] = useState([]);

  useEffect(() => {
    const processed = parsedMessages
      .filter(
        (msg) =>
          msg.origin === "esp32" &&
          msg.type === "string" &&
          typeof msg.data === "string" &&
          msg.data.length === 32
      )
      .map(({ _id,_rev, data }) => {
        const parts = data.split(";");
        if (parts.length < 3) return null;
        const [idFrag, rawDate, value] = parts;
        if (!value || value.length < 5) return null;

        const [datePart, timePart] = rawDate.split(" ");
        if (!datePart || !timePart) return null;

        const [year, month, day] = datePart.split("-").map(Number);
        const [hour, minute, second] = timePart.split(":").map(Number);
        const dt = new Date(year, month - 1, day, hour, minute, second);
        if (isNaN(dt.getTime())) return null;

        const formattedDate = dt.toLocaleDateString("pt-BR");      // dd/mm/yyyy
        const formattedTime = dt.toLocaleTimeString("pt-BR", {     // HH:mm:ss
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });

        return {
          _id,
          _rev,
          irrigadorId: idFrag.replace(/\D/g, ""),
          date: formattedDate,
          time: formattedTime,
          alarme: value[0],
          monitor: value.substring(1, 3),
          status: value[3],
          armadilha: value[4],
        };
      })
      .filter(Boolean);

    setData(processed);
  }, [parsedMessages]);

  const update = async (_id, updatedFields) => {
    try {
      await updateData(_id, updatedFields);
      setData((prev) =>
        prev.map((item) =>
          item._id === _id ? { ...item, ...updatedFields } : item
        )
      );
    } catch (err) {
      console.error("Erro ao atualizar documento:", err);
    }
  };

  // ainda deixamos agrupamento pronto, mas retornamos também `data`
  const groupedByDatePart = data.reduce((acc, item) => {
    acc[item.date] = acc[item.date] || [];
    acc[item.date].push(item);
    return acc;
  }, {});

  return {
    data,
    groupedByDatePart,
    isLoading,
    error,
    update,
  };
}
