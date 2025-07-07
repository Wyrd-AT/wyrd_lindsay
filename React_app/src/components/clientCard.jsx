// src/components/ClientCard.jsx
import React from 'react';
import { FaRegImage } from 'react-icons/fa';
import { FiAlertOctagon, FiEdit, FiTrash } from 'react-icons/fi';

export default function ClientCard({ name, machinesCount, alertCount, onEdit, onDelete }) {
  return (
    <div className="
      w-full sm:w-1/2 md:w-1/3 lg:w-1/4 h-24
      bg-[#39393a] hover:bg-[#4a4a4b]
      border-b border-gray-700
      rounded-lg m-4 p-4
      flex items-center justify-between
      transition-shadow shadow-sm hover:shadow-md
    ">
      <div className="flex items-center gap-4">
        <FaRegImage className="text-gray-300" size={32} />
        <div>
          <h3 className="text-md font-semibold text-white truncate">{name}</h3>
          <p className="text-xs text-gray-400">
            {machinesCount} irrigador{machinesCount !== 1 && 'es'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* badge de alertas */}
        <span className="
          bg-red-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1
        ">
          <FiAlertOctagon size={14} /> {alertCount}
        </span>
        {/* ações */}
        <button onClick={onEdit} className="text-gray-400 hover:text-white">
          <FiEdit size={18} />
        </button>
        <button onClick={onDelete} className="text-gray-400 hover:text-white">
          <FiTrash size={18} />
        </button>
      </div>
    </div>
  );
}
