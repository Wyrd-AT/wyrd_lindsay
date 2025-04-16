// hooks/useParsedMessages.js
import { useState, useEffect } from "react";
import dbStore from "../stores/dbStore";

export function useParsedMessages() {
  const [parsedMessages, setParsedMessages] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const loadAndParse = async () => {
      const docs = await dbStore.fetchData();

      // agora incluímos também 'command'
      const validDocs = docs.filter((doc) => {
        if (!doc.type) return false;
        if (doc._id?.startsWith("_design/")) return false;
        return ["event", "mtTension", "command"].includes(doc.type);
      });

      const messages = validDocs.map((doc) => {
        switch (doc.type) {
          case "event":
            return {
              type: "event",
              irrigadorId: doc.irrigadorId,
              datetime: doc.datetime,
              eventType: doc.eventType,
              eventCode: doc.eventCode,
            };
          case "mtTension":
            return {
              type: "mtTension",
              irrigadorId: doc.irrigadorId,
              timestamp: doc.timestamp,
              mtReadings: doc.mtReadings || [],
            };
          case "command":
            return {
              type: "command",
              irrigadorId: doc.irrigadorId,
              command: doc.command,
              timestamp: doc.timestamp,
            };
          default:
            return null;
        }
      }).filter(Boolean);

      if (!cancelled) {
        setParsedMessages(messages);
      }
    };

    loadAndParse();

    const changes = dbStore.localDB
      .changes({ since: "now", live: true, include_docs: true })
      .on("change", loadAndParse)
      .on("error", console.error);

    return () => {
      cancelled = true;
      changes.cancel();
    };
  }, []);

  return parsedMessages;
}

export default useParsedMessages;
