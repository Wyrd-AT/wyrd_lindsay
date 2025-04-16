import React, { useEffect } from "react";
import { IoClose, IoSearch, IoSearchOutline } from "react-icons/io5";

export default function DetalhesMaquina({ isOpen, onClose }) {
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

  if (!isOpen) return null;

  const handleBackdropClick = () => {
    onClose();
  };

  const handleModalClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black opacity-60"></div>
      <div
        role="dialog"
        aria-modal="true"
        className="bg-[#222] text-white p-6 rounded-lg w-[70vw] h-[80vh] relative z-10"
        onClick={handleModalClick}
      >
        {/* Botão de Fechar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white text-2xl hover:text-gray-400"
          aria-label="Fechar"
        >
          <IoClose />
        </button>

        {/* Nome da máquina */}
        <div className="px-2">
          <h3 className="w-fit border-b border-gray-500 flex">
            IRRIGADOR 01
          </h3>
        </div>

        {/* Imagem */}
        <div className="w-full flex justify-center">
          <img
            src="/details.png" // Substitua com a imagem correta
            alt="Detalhes da máquina"
            className="w-full h-auto"
          />
        </div>

        <div className="w-full pr-2 flex">
          <div className="w-1/2 flex justify-between items-center">
            <span className="text-[12px]">ÚLTIMO ALERTA</span>
            <a href="#" className="text-blue-400 text-sm hover:underline">
              visualizar todos
            </a>
          </div>
          <div className="w-1/2 flex justify-end gap-3">
            <button
              className="text-white hover:text-gray-400"
              aria-label="Zoom Out"
            >
              <IoSearchOutline size={20} />
            </button>
            <button
              className="text-white hover:text-gray-400"
              aria-label="Zoom In"
            >
              <IoSearch size={20} />
            </button>
          </div>
        </div>

        {/* Informações da máquina */}
        <div className="w-full mt-6 text-sm flex justify-between items-center">
          <div className="border-r p-2 w-1/2 flex flex-col justify-between items-center">
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
              <span className="bg-[#FFE0E5] text-[#E83838] border border-[#E83838] px-2 py-1 rounded-full text-center">
                Não resolvido
              </span>
            </div>
          </div>

          <div className="w-1/2 flex flex-col justify-between items-center p-2">
            <div></div>
            <div>
              <p className="text-gray-400 text-[12px]">DATA DE INSTALAÇÃO</p>
              <p className="text-[12px]">21 de maio de 2024</p>
            </div>
            <div>
              <p className="text-gray-400 text-[12px]">DATA DE AQUISIÇÃO</p>
              <p className="text-[12px]">10 de maio de 2024</p>
            </div>
            <div>
              <p className="text-gray-400 text-[12px]">ÚLTIMA MANUTENÇÃO</p>
              <p className="text-[12px]">08 de janeiro de 2025</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
