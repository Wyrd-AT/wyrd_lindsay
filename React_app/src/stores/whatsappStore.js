import { create } from "zustand";
import { remoteDB } from "../api/database";

const DOC_ID = "whatsapp";

export const whatsappStoreConfig = create((set) => ({
  whatsappConfig: null,
  isFetchingConfig: true,
  syncTimestamp: Date.now(),

  fetchWhatsappConfig: async () => {
    set({ isFetchingConfig: true });

    try {
      const doc = await remoteDB.get(DOC_ID);
      //console.log(doc);
      set({
        whatsappConfig: doc,
        isFetchingConfig: false,
        syncTimestamp: Date.now(),
      });
    } catch (err) {
      if (err.name === "not_found") {
        //console.log(`Documento de configuração "${DOC_ID}" ainda não existe.`);
        set({ whatsappConfig: null, isFetchingConfig: false });
      } else {
        console.error("[whatsappStore] fetchConfiguracoes error:", err);
        set({ isFetchingConfig: false });
      }
    }
  },

  updateWhatsappStatus: async (newStatus) => {
    let newDoc;

    try {
      const doc = await remoteDB.get(DOC_ID);

      newDoc = {
        ...doc,
        status: newStatus,
      };
    } catch (err) {
      if (err.name === "not_found") {
        newDoc = {
          _id: DOC_ID,
          status: newStatus,
        };
      } else {
        console.error(
          "[whatsappStore] Erro ao buscar documento para atualizar:",
          err,
        );
        throw err;
      }
    }

    try {
      const response = await remoteDB.put(newDoc);

      const docUpdated = {
        ...newDoc,
        _rev: response.rev,
      };

      set({
        whatsappConfig: docUpdated,
        syncTimestamp: Date.now(),
      });

      // console.log(
      //   `Configurações salvas com sucesso. Nova revisão: ${response.rev}`,
      // );
    } catch (err) {
      console.error("[whatsapp] Erro ao salvar (put) as configurações:", err);
    }
  },
}));