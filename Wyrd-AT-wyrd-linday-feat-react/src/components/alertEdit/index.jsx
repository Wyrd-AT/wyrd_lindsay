import React, { useEffect } from "react";
import { IoClose } from "react-icons/io5";

export default function AlertEdit({ isOpen, onClose }) {
  // Fecha ao pressionar a tecla Esc
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  // Não renderiza nada se o modal estiver fechado
  if (!isOpen) return null;

  // Fecha ao clicar fora do conteúdo do modal
  const handleBackdropClick = (e) => {
    onClose();
  };

  // Impede o fechamento ao clicar dentro do modal
  const handleModalClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      {/* Fundo semi-transparente */}
      <div className="absolute inset-0 bg-black opacity-50"></div>

      {/* Conteúdo do modal */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative bg-[#444444] text-white p-6 rounded-md w-full max-w-md"
        onClick={handleModalClick}
      >
        {/* Botão de fechar */}
        <button
          className="absolute top-4 right-4 text-2xl text-white hover:text-gray-300"
          onClick={onClose}
          aria-label="Fechar"
        >
          <IoClose />
        </button>

        {/* Título */}
        <div className="py-2">
          <h3 className="w-fit border-b border-gray-500 flex">IRRIGADOR 01</h3>
        </div>

        {/* Informações do alerta (estático, mas pode ser dinâmico) */}
        <div className="flex items-center flex-wrap gap-2 text-sm mb-4">
          <span className="py-2">ALERTA</span>
          <div className="w-full flex justify-between items-center">
            <div>
              <p className="text-gray-400 text-[12px]">DATA</p>
              <p className="text-[12px]">21 de maio de 2024</p>
            </div>
            <div>
              <p className="text-gray-400 text-[12px]">HORA</p>
              <p className="text-[12px]">16h41</p>
            </div>
            <div>
              <p className="text-gray-400 text-[12px]">TIPO DE ALERTA</p>
              <p className="text-[12px]">Alerta 1</p>
            </div>
            <div>
              <p className="text-gray-400 text-[12px]">LEMBRETE</p>
              <p className="text-[12px]">adiado em 15min</p>
            </div>
          </div>
        </div>

        {/* Seletor de tempo para reativar alarme */}
        <div className="flex items-center gap-2 mb-4">
          <label className="whitespace-nowrap text-sm">
            Ativar alarme novamente em:
          </label>
          <select className="border-b border-gray-500 px-2 py-1 text-sm bg-[#444444]">
            <option value="15">15 MINUTOS</option>
            <option value="30">30 MINUTOS</option>
            <option value="60">1 HORA</option>
            <option value="120">2 HORAS</option>
            <option value="1440">1 DIA</option>
          </select>
        </div>

        {/* Notificações */}
        <div className="mb-4">
          <p className="text-sm mb-2">NOTIFICAÇÕES</p>
          <div className="flex flex-col gap-2 ml-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="form-checkbox text-green-500" />
              SMS
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="form-checkbox text-green-500" />
              WhatsApp
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="form-checkbox text-green-500" />
              E-mail
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="form-checkbox text-green-500" />
              Ligação
            </label>
          </div>
        </div>

        {/* Botão de salvar */}
        <div className="w-full flex justify-end">
          <button className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-full text-xs">
            SALVAR
          </button>
        </div>
      </div>
    </div>
  );
}
