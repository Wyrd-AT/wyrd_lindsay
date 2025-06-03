// src/components/Header.jsx
import React, { useState } from "react";
import { HiOutlineUserAdd } from "react-icons/hi";
import { GoChevronLeft } from "react-icons/go";
import { useNavigate } from "react-router-dom";

export default function Header({ page }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  const renderHeaderContent = () => {
    const commonClasses = "flex flex-row items-center cursor-pointer";

    if (page === "perfilClient") {
      return (
        <div
          className={commonClasses}
          onClick={() => navigate("/home")}
        >
          <GoChevronLeft size={20} />
          <h1 className="text-lg md:text-xl font-semibold pl-2">
            Perfil do Cliente
          </h1>
        </div>
      );
    } else if (page === "maquina") {
      return (
        <div
          className={commonClasses}
          onClick={() => navigate("/home")}
        >
          <GoChevronLeft size={20} />
          <h1 className="text-lg md:text-xl font-semibold pl-2">
            Máquina
          </h1>
        </div>
      );
    } else {
      return (
        <div className="flex items-center justify-between w-full">
          <div className="flex flex-col">
            <h1 className="text-lg md:text-xl font-semibold">
              Olá, Cliente!
            </h1>
          </div>
          {/*
          <button
            className="flex items-center gap-2 bg-green-500 text-black font-medium px-3 md:px-4 py-2 rounded-full hover:bg-green-600 transition-colors"
            onClick={openModal}
          >
            adicionar cliente
            <HiOutlineUserAdd size={20} />
          </button>
          */}
        </div>
      );
    }
  };

  return (
    <>
      <header className="w-full text-white flex items-center justify-between p-4 md:p-8">
        {renderHeaderContent()}
      </header>

      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-md shadow-md w-11/12 max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Adicionar Cliente</h2>
              <button
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-700"
              >
                X
              </button>
            </div>
            <form>
              <div className="mb-4">
                <label className="block text-gray-700">Nome:</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring focus:border-blue-300"
                  placeholder="Digite o nome do cliente"
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700">Email:</label>
                <input
                  type="email"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring focus:border-blue-300"
                  placeholder="Digite o email do cliente"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  className="mr-2 px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md bg-green-500 text-white hover:bg-green-600"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
