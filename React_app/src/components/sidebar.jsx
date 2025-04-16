import React from "react";
import { NavLink } from "react-router-dom";
import { BiHomeAlt } from "react-icons/bi";
import { MdOutlineWarning, MdOutlineSensors } from "react-icons/md";
import { FiSend } from "react-icons/fi";

function SideBar() {
  return (
    <div className="w-[100px] md:w-[100px] bg-[#444444] py-8 px-4 flex flex-col items-center">
      <img 
        src="/FieldNetLogo.png" 
        alt="FieldNet Logo" 
        width="150" 
        height="150" 
        className="mb-8"
      />

      {/* Link para Home ou Dashboard */}
      <NavLink
        to="/home"
        className={({ isActive }) =>
          `mb-4 ${isActive ? "text-blue-400" : "text-white"}`
        }
      >
        <BiHomeAlt size={40} />
      </NavLink>

      {/* Link para página Máquina (alertas e histórico) */}
      <NavLink
        to="/maquina"
        className={({ isActive }) =>
          `mb-4 ${isActive ? "text-blue-400" : "text-white"}`
        }
      >
        <MdOutlineWarning size={40} />
      </NavLink>

      {/* Link para página Tensão */}
      <NavLink
        to="/tensao"
        className={({ isActive }) =>
          `mb-4 ${isActive ? "text-blue-400" : "text-white"}`
        }
      >
        <MdOutlineSensors size={40} />
      </NavLink>

      {/* Link para página Mensagem */}
      <NavLink
        to="/mensagem"
        className={({ isActive }) =>
          `mb-4 ${isActive ? "text-blue-400" : "text-white"}`
        }
      >
        <FiSend size={40} />
      </NavLink>
    </div>
  );
}

export default SideBar;
