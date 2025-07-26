// src/components/DetalhesMaquina.jsx
import React, { useEffect } from "react";
import { IoClose, IoSearchOutline, IoSearchSharp } from "react-icons/io5";

export default function DetalhesMaquina({ isOpen, onClose, selectedMachine }) {
  // Fecha com Esc
  useEffect(() => {
    const handleEsc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      {/* overlay */}
      <div className="absolute inset-0 bg-black/60" />

      {/* modal */}
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="
          relative bg-[#393939] rounded-lg
          w-full max-w-4xl h-[80vh] overflow-hidden
          flex flex-col
        "
      >
        {/* close */}
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-3 right-3 text-white hover:text-gray-300"
        >
          <IoClose size={24} />
        </button>

        {/* cabeçalho */}
        <div className="pt-4 pb-2 px-4 text-center">
          <h3 className="text-white font-semibold text-lg sm:text-xl">
            {selectedMachine}
          </h3>
          <div className="mt-1 mx-auto w-8 h-0 border-t border-white" />
        </div>

        {/* imagem */}
        <div className="px-8">
          <div className="w-full bg-white rounded-md overflow-hidden shadow-md aspect-[30/13]">
            <img
              src="/details.png"
              alt="Detalhes da máquina"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* estatísticas + zoom */}
        <div className="mt-4 px-4 flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          {/* grid de stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1">
            {[
              ["DATA DE INSTALAÇÃO", "21 de maio de 2024"],
              ["DATA DE AQUISIÇÃO", "10 de maio de 2024"],
              ["ÚLTIMA MANUTENÇÃO", "08 de janeiro de 2025"],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5">
                <span className="text-xs text-white">{label}</span>
                <span className="text-base font-bold text-white">{value}</span>
              </div>
            ))}
          </div>
          {/* zoom */}
          <div className="flex gap-2 self-center md:self-start">
            {[IoSearchOutline, IoSearchSharp].map((Icon, i) => (
              <div
                key={i}
                className="w-8 h-8 flex items-center justify-center border-2 border-gray-700 rounded-full"
              >
                <Icon size={16} className="text-white" />
              </div>
            ))}
          </div>
        </div>

        {/* último alerta */}
        <div className="mt-4 px-4 pb-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h4 className="text-white text-base">ÚLTIMO ALERTA</h4>
            <button className="text-sm text-white/90 hover:underline">
              visualizar todos
            </button>
          </div>
          <div className="bg-[#222] p-3 rounded-lg flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex flex-wrap gap-3 sm:gap-6 items-center flex-1">
              {["18/03/2025", "16h41", "Alerta 1", "adiado em 15min"].map(
                (txt, i) => (
                  <span key={i} className="text-sm text-white">
                    {txt}
                  </span>
                )
              )}
            </div>
            <div className="flex items-center justify-center px-2 py-1 bg-[#FFE0E5] border border-[#E83838] rounded-lg">
              <span className="text-sm text-[#E83838]">Não resolvido</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
