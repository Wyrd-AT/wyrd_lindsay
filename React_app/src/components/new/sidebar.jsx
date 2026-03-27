// src/components/SideBar.jsx
import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { BiHomeAlt, BiUser } from "react-icons/bi";
import { FiLogOut, FiUsers, FiShield, FiSettings } from "react-icons/fi";
import { useAuthStore } from "../../stores/new/authStore";

export default function SideBar() {
  const navigate = useNavigate();
  const { logout, user } = useAuthStore();

  const isAdmin = user?.type === "admin" || user?.type === "superadmin";
  const isRevenda = user?.type === "revenda";

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

      {/* Gerenciar Pivôs (Admin + Revenda) */}
      {(isAdmin || isRevenda) && (
        <NavLink
          to="/gerenciar-pivos"
          className={({ isActive }) =>
            `mb-4 transition ${isActive ? "text-[#08cb7c]" : "text-white hover:text-[#08cb7c]"}`
          }
          title="Gerenciar Pivôs"
        >
          <FiSettings size={40} />
        </NavLink>
      )}

      {/* Gerenciar Admins (Admin only) */}
      {isAdmin && (
        <NavLink
          to="/gerenciar-admins"
          className={({ isActive }) =>
            `mb-4 transition ${isActive ? "text-[#08cb7c]" : "text-white hover:text-[#08cb7c]"}`
          }
          title="Gerenciar Admins"
        >
          <FiShield size={40} />
        </NavLink>
      )}

      {/* Gerenciar Revendas (Admin only) */}
      {isAdmin && (
        <NavLink
          to="/gerenciar-revendas"
          className={({ isActive }) =>
            `mb-4 transition ${isActive ? "text-[#08cb7c]" : "text-white hover:text-[#08cb7c]"}`
          }
          title="Gerenciar Revendas"
        >
          <FiUsers size={40} />
        </NavLink>
      )}

      {/* Gerenciar Clientes (Admin only) */}
      {isAdmin && (
        <NavLink
          to="/gerenciar-clientes"
          className={({ isActive }) =>
            `mb-4 transition ${isActive ? "text-[#08cb7c]" : "text-white hover:text-[#08cb7c]"}`
          }
          title="Gerenciar Clientes"
        >
          <BiUser size={40} />
        </NavLink>
      )}

      {/* Gerenciar Clientes (Revenda only) */}
      {isRevenda && (
        <NavLink
          to="/gerenciar-clientes-revenda"
          className={({ isActive }) =>
            `mb-4 transition ${isActive ? "text-[#08cb7c]" : "text-white hover:text-[#08cb7c]"}`
          }
          title="Gerenciar Clientes"
        >
          <BiUser size={40} />
        </NavLink>
      )}

      {/* Gerenciar Usuários da Empresa (apenas superusuário; não mostrar para gerente nem comum) */}
      {user?.type === "cliente" && user?.sub_role === "superusuario" && (
        <NavLink
          to="/gerenciar-usuarios-empresa"
          className={({ isActive }) =>
            `mb-4 transition ${isActive ? "text-[#08cb7c]" : "text-white hover:text-[#08cb7c]"}`
          }
          title="Gerenciar Usuários"
        >
          <FiUsers size={40} />
        </NavLink>
      )}

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
      <div className="mt-auto text-gray-300 text-xs">FieldNet v0.3</div>
    </div>
  );
}
