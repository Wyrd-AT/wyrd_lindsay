import React from "react";
import { NavLink } from "react-router-dom";
import { BiHomeAlt } from "react-icons/bi";
import { FiUser, FiSettings } from "react-icons/fi";
import { MdOutlineWarning } from "react-icons/md";
import { useParsedMessages } from "../hooks/useParsedMessages";

export default function SideBar() {
  const parsed = useParsedMessages();
  const machines = Array.from(new Set(parsed.map((m) => m.irrigadorId)));
  const defaultMachine = machines[0] || "";

  return (
    <div className="w-[100px] bg-[#444444] py-8 px-4 flex flex-col items-center">
      <img
        src="/FieldNetLogo.png"
        alt="FieldNet Logo"
        width="150"
        height="150"
        className="mb-8"
      />

      {/* Home Revenda */}
      <NavLink
        to="/home"
        className={({ isActive }) =>
          `mb-6 ${isActive ? "text-blue-400" : "text-white"}`
        }
      >
        <BiHomeAlt size={36} />
      </NavLink>

      {/* Lista de Clientes */}
      <NavLink
        to="/clientes"
        className={({ isActive }) =>
          `mb-6 ${isActive ? "text-blue-400" : "text-white"}`
        }
      >
        <FiUser size={36} />
      </NavLink>

      {/* Máquina Revenda (primeiro irrigador) */}
      <NavLink
        to={defaultMachine ? `/maquina/${defaultMachine}` : "/home"}
        className={({ isActive }) =>
          `mb-6 ${isActive ? "text-blue-400" : "text-white"}`
        }
      >
        <MdOutlineWarning size={36} />
      </NavLink>

      {/* Máquina Cliente (ex.: cliente 01) */}
      <NavLink
        to={
          defaultMachine
            ? `/clientes/01/maquina/${defaultMachine}`
            : "/clientes"
        }
        className={({ isActive }) =>
          `mb-6 ${isActive ? "text-blue-400" : "text-white"}`
        }
      >
        <FiSettings size={36} />
      </NavLink>
    </div>
  );
}
