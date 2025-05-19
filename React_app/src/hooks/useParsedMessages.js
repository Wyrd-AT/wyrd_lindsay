// src/hooks/useParsedMessages.js
import { useState, useEffect } from "react";
import dbStore from "../stores/dbStore";
import { parseMessage } from "../utils/messageParser";

export function useParsedMessages() {
  // Mapa interno de _id → mensagem parseada
  const [messagesMap, setMessagesMap] = useState(new Map());

  useEffect(() => {
    let cancelled = false;

    // Inicia o feed de mudanças desde o início (since: 0)
    const changes = dbStore.localDB
      .changes({
        since: 0,
        live: true,
        include_docs: true,
      })
      .on("change", (change) => {
        if (cancelled) return;
        const doc = change.doc;
        // Ignora design docs e docs sem payload
        if (!doc || doc._id.startsWith("_design/")) return;
        if (typeof doc.payload !== "string") return;

        // Tenta parsear
        try {
          const parsed = parseMessage(doc.payload);
          //console.log("[useParsedMessages] parsed message:", parsed);
          const msgObj = {
            ...parsed,
            timestamp: parsed.timestamp || new Date().toISOString(),
            origin: doc.origin,
          };

          // Atualiza incrementalmente o Map
          setMessagesMap((prev) => {
            const next = new Map(prev);
            next.set(doc._id, msgObj);
            return next;
          });
        } catch (err) {
          // payload não reconhecido: ignora
        }
      })
      .on("error", (err) => {
        console.error("[useParsedMessages] changes error:", err);
      });

    return () => {
      cancelled = true;
      changes.cancel();
    };
  }, []); // roda só no mount

  // Converte o Map em array e filtra tipos válidos
  const parsedMessages = Array.from(messagesMap.values()).filter((msg) =>
    ["event", "mtTension", "command", "monitorStatus"].includes(msg.type)
  );

  return parsedMessages;
}

export default useParsedMessages;
