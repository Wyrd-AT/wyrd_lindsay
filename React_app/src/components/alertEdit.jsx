// components/alertEdit.jsx
import React, { useEffect } from "react";
import { IoClose } from "react-icons/io5";

export default function AlertEdit({ isOpen, onClose, alert }) {
  useEffect(() => {
    const handleEsc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  if (!isOpen || !alert) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black opacity-50" />
      <div
        role="dialog"
        aria-modal="true"
        className="relative bg-[#444444] text-white p-6 rounded-md w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute top-4 right-4 text-2xl text-white hover:text-gray-300"
          onClick={onClose}
          aria-label="Fechar"
        >
          <IoClose />
        </button>

        {/* Título dinâmico */}
        <div className="py-2">
          <h3 className="w-fit border-b border-gray-500">
            {alert.machine}
          </h3>
        </div>

        {/* Detalhes do alerta */}
        <div className="flex flex-wrap gap-4 text-sm mb-4">
          <div>
            <p className="text-gray-400 text-xs">DATA</p>
            <p>{alert.date}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">HORA</p>
            <p>{alert.time}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">DESCRIÇÃO</p>
            <p>{alert.description}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">STATUS</p>
            <p>{alert.status}</p>
          </div>
        </div>

        {/* Reativar alarme */}
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
            {["SMS", "WhatsApp", "E-mail", "Ligação"].map((chan) => (
              <label key={chan} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="form-checkbox text-green-500" />
                {chan}
              </label>
            ))}
          </div>
        </div>

        {/* Botão Salvar */}
        <div className="w-full flex justify-end">
          <button className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-full text-xs">
            SALVAR
          </button>
        </div>
      </div>
    </div>
  );
}
