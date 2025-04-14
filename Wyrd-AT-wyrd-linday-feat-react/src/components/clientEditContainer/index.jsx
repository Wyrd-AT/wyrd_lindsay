import React from "react";
import { IoAdd } from "react-icons/io5";
import { FaRegImage } from "react-icons/fa";
import { RiDeleteBinLine } from "react-icons/ri";
import { FiEdit2 } from "react-icons/fi";

const ClientEditContainer = ({ page }) => {
  return page === "perfilClient" ? (
    <header className="w-full text-white flex items-center justify-between px-8">
      {/* Esquerda: Título e link de tutorial */}
      <div className="flex justify-center items-center py-4">
        {/* Círculo branco com ícone */}
        <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mr-4">
          <FaRegImage className="text-gray-500" size={24} />
        </div>
        <div>
          <div className="text-xs">NOME DO CLIENTE</div>
          <div className="text-xs">emaildo@cliente.com</div>
        </div>
      </div>

      <div className="flex">
        <button
          className="text-gray-300 hover:text-white transition-colors p-2"
          title="Editar"
        >
          <FiEdit2 size={20} />
        </button>
        <button
          className="text-gray-300 hover:text-white transition-colors p-2"
          title="Excluir"
        >
          <RiDeleteBinLine size={20} />
        </button>
        <button className="flex items-center gap-2 bg-green-500 text-black font-medium px-4 py-2 rounded-full hover:bg-green-600 transition-colors">
          adicionar maquina
          <IoAdd size={20} />
        </button>
      </div>
      {/* Direita: Botão de adicionar cliente */}
    </header>
  ) : (
    <header className="w-full text-white flex items-center justify-between px-8">
      {/* Esquerda: Título e link de tutorial */}
      <div className="flex justify-center items-center py-4">
        {/* Círculo branco com ícone */}
        <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mr-4">
          <FaRegImage className="text-gray-500" size={24} />
        </div>
        <div>
          <div className="text-xs">NOME DO CLIENTE</div>
          <div className="text-xs">emaildo@cliente.com</div>
        </div>
      </div>

      <div className="flex">
        <button
          className="text-gray-300 hover:text-white transition-colors p-2"
          title="Editar"
        >
          <FiEdit2 size={20} />
        </button>
        <button
          className="text-gray-300 hover:text-white transition-colors p-2"
          title="Excluir"
        >
          <RiDeleteBinLine size={20} />
        </button>
      </div>
      {/* Direita: Botão de adicionar cliente */}
    </header>
  );
};

export default ClientEditContainer;
