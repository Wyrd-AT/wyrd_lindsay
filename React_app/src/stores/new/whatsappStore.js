/**
 * Store de configuração global do WhatsApp.
 * Substitui o acesso direto ao CouchDB — passa pelo backend /api/whatsapp-config.
 */
import { create } from "zustand";
import apiClient from "../../api/new/apiClient";

export const whatsappStoreConfig = create((set) => ({
  whatsappConfig: null,
  isFetchingConfig: true,

  fetchWhatsappConfig: async () => {
    set({ isFetchingConfig: true });
    try {
      const res = await apiClient.get("/whatsapp-config");
      set({ whatsappConfig: res.data, isFetchingConfig: false });
    } catch (err) {
      // 404 = doc ainda não existe — trata como desabilitado
      if (err?.response?.status === 404) {
        set({ whatsappConfig: { enabled: false }, isFetchingConfig: false });
      } else {
        console.error("[whatsappStore] fetchWhatsappConfig error:", err);
        set({ isFetchingConfig: false });
      }
    }
  },

  updateWhatsappStatus: async (newStatus) => {
    try {
      const res = await apiClient.put("/whatsapp-config", { enabled: newStatus });
      set({ whatsappConfig: res.data });
    } catch (err) {
      console.error("[whatsappStore] updateWhatsappStatus error:", err);
      throw err;
    }
  },
}));
