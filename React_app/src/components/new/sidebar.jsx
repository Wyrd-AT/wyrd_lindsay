// src/components/SideBar.jsx
import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { BiHomeAlt, BiUser } from "react-icons/bi";
import { FiLogOut } from "react-icons/fi";
import { useAuthStore } from "../../stores/new/authStore";

export default function SideBar() {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  return (
    <div
      className="
        sticky top-0 left-0
        w-[100px] bg-[#444444]
        h-[100vh]
        flex flex-col items-center
        z-10
      "
    >
      {/* Logo */}
      <img
        src="/FieldNetLogo.png"
        alt="FieldNet Logo"
        width="80"
        height="80"
        className="mb-4"
      />

      {/* Home */}
      <NavLink
        to="/home"
        className={({ isActive }) =>
          `mb-4 ${isActive ? "text-green-500" : "text-white"}`
        }
      >
        <BiHomeAlt size={40} />
      </NavLink>

      {/* Perfil */}
      <button
        onClick={() => {
          //////////console.log("Perfil");
        }}
        className="text-white hover:text-green-500 mb-4"
      >
        <BiUser size={40} />
      </button>

      {/* Espaço flexível para empurrar o rodapé */}
      <div className="flex-grow" />

      {/* Logout */}
      <button
        onClick={() => {
          logout();
          navigate("/");
        }}
        className="text-white hover:text-green-500 mb-4"
      >
        <FiLogOut size={40} />
      </button>

      {/* Versão no rodapé */}
      <div className="mt-auto text-gray-300 text-xs">
        FieldNet v0.3
      </div>
    </div>
  );
}
