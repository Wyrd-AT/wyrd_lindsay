import React, { useState, useEffect } from "react";

interface PivoData {
  _id: string;
  codigo?: string;
  nome?: string;
  equipamentos?: string[];
  contacts?: {
    whatsapp?: string;
    sms?: string;
    email?: string;
  };
  ativo?: boolean;
  [key: string]: any;
}

interface ModalEditIrrigadorProps {
  pivo: PivoData;
  onSave: (pivoId: string, updates: Partial<PivoData>) => Promise<void>;
  onClose: () => void;
}

export default function ModalEditIrrigador({
  pivo,
  onSave,
  onClose,
}: ModalEditIrrigadorProps) {
  const [nome, setNome] = useState(pivo.nome || pivo.irrigador || "");
  const [codigo, setCodigo] = useState(pivo.codigo || "");
  const [ativo, setAtivo] = useState(pivo.ativo ?? true);
  const [whatsapp, setWhatsapp] = useState(pivo.contacts?.whatsapp || "");
  const [sms, setSms] = useState(pivo.contacts?.sms || "");
  const [email, setEmail] = useState(pivo.contacts?.email || "");
  const [equipamentos, setEquipamentos] = useState<string[]>(
    pivo.equipamentos?.length ? [...pivo.equipamentos] : [""],
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const addEquipamento = () => {
    if (equipamentos.length < 16) setEquipamentos([...equipamentos, ""]);
  };

  const removeEquipamento = (idx: number) => {
    setEquipamentos(equipamentos.filter((_, i) => i !== idx));
  };

  const updateEquipamento = (idx: number, value: string) => {
    const next = [...equipamentos];
    next[idx] = value;
    setEquipamentos(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome.trim()) {
      setError("O nome do pivô é obrigatório.");
      return;
    }
    if (!codigo.trim()) {
      setError("O código do pivô é obrigatório.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(pivo._id, {
        nome: nome.trim(),
        codigo: codigo.trim(),
        irrigador: codigo.trim(),
        ativo,
        contacts: {
          whatsapp: whatsapp.trim(),
          sms: sms.trim(),
          email: email.trim(),
        },
        equipamentos: equipamentos.filter((eq) => eq.trim() !== ""),
        updated_at: new Date().toISOString(),
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || "Erro ao salvar pivô.");
    } finally {
      setIsSaving(false);
    }
  };

  const onBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
      onClick={onBackdropClick}
    >
      <form
        onSubmit={handleSubmit}
        className="bg-[#444444] p-6 rounded-md shadow-md w-11/12 max-w-md max-h-[90vh] overflow-y-auto"
      >
        <header className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">Editar Pivô</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </header>

        {error && <div className="mb-4 text-red-400 text-sm">{error}</div>}

        {/* Status ativo/inativo */}
        <label className="flex items-center gap-3 text-white mb-4 cursor-pointer">
          <span>Status:</span>
          <button
            type="button"
            onClick={() => setAtivo(!ativo)}
            disabled={isSaving}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              ativo ? "bg-[#08cb7c]" : "bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                ativo ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span className={`text-sm ${ativo ? "text-green-400" : "text-red-400"}`}>
            {ativo ? "Ativo" : "Inativo"}
          </span>
        </label>

        {/* Código */}
        <label className="block text-white mb-4">
          Código:
          <input
            type="text"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            className="w-full text-black px-3 py-2 border rounded-md mt-1 focus:outline-none"
            placeholder="Ex: LIND01"
            disabled={isSaving}
          />
        </label>

        {/* Nome */}
        <label className="block text-white mb-4">
          Nome:
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full text-black px-3 py-2 border rounded-md mt-1 focus:outline-none"
            placeholder="Nome do pivô"
            disabled={isSaving}
          />
        </label>



        {/* Equipamentos */}
        <fieldset className="mb-4">
          <legend className="text-white mb-2">Equipamentos</legend>
          {equipamentos.map((eq, idx) => (
            <div key={idx} className="flex items-center mb-2">
              <input
                type="text"
                value={eq}
                onChange={(e) => updateEquipamento(idx, e.target.value)}
                placeholder={`Equipamento ${idx + 1}`}
                className="flex-1 text-black px-3 py-2 border rounded-md focus:outline-none"
                disabled={isSaving}
              />
              {equipamentos.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeEquipamento(idx)}
                  className="ml-2 px-2 py-1 text-sm border border-red-500 rounded text-red-400 hover:text-red-300"
                  aria-label={`Remover equipamento ${idx + 1}`}
                  disabled={isSaving}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addEquipamento}
            disabled={isSaving || equipamentos.length >= 16}
            className="mt-2 text-sm px-3 py-1 border rounded-md text-white hover:bg-gray-600 transition"
          >
            + Adicionar equipamento ({equipamentos.length}/16)
          </button>
        </fieldset>

        {/* Botões */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="mr-2 px-4 py-2 border rounded-md text-white hover:bg-gray-600 transition"
            disabled={isSaving}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className={`px-4 py-2 rounded-md text-white ${
              isSaving
                ? "bg-gray-500 cursor-not-allowed"
                : "bg-[#08cb7c] hover:bg-green-600"
            }`}
          >
            {isSaving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}
