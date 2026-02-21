// src/components/SideBar.jsx
import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { BiHomeAlt, BiUser } from "react-icons/bi";
import { FiLogOut, FiUsers, FiShield } from "react-icons/fi";
import { useAuthStore } from "../../stores/new/authStore";


export default function SideBar() {
  const navigate = useNavigate();
  const { logout, user } = useAuthStore();
  const [showAdminMenu, setShowAdminMenu] = useState(false);

  const isAdmin = user?.type === 'admin';
  const isRevenda = user?.type === 'revenda';

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

      {/* Gerenciar Pivôs (Admin only)
      {isAdmin && (
        <NavLink
          to="/gerenciar-pivos"
          className={({ isActive }) =>
            `mb-4 transition ${isActive ? "text-[#08cb7c]" : "text-white hover:text-[#08cb7c]"}`
          }
          title="Gerenciar Pivôs"
        >
          <BsGear size={40} />

        </NavLink>
      )} */}


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
      {user?.type === 'cliente' && user?.sub_role === 'superusuario' && (
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

      

      {/* Admin Menu - Criar Revenda/Cliente */}
      {isAdmin && (
        <div className="relative group mb-4">
          <button
            onClick={() => setShowAdminMenu(!showAdminMenu)}
            className="text-white hover:text-[#08cb7c] transition relative"
            title="Gerenciamento Admin"
          >
          </button>

          {/* Dropdown Menu */}
          {showAdminMenu && (
            <div className="absolute left-20 top-0 bg-[#555555] border border-[#08cb7c] rounded-lg shadow-lg py-2 w-48 z-50">
              <button
                onClick={() => {
                  // Disparar evento para o AdminDashboard
                  window.dispatchEvent(new CustomEvent('admin:create-revenda'));
                  setShowAdminMenu(false);
                }}
                className="w-full text-left px-4 py-2 text-white hover:bg-[#08cb7c] hover:text-black transition flex items-center gap-2"
              >
                <span>🏢</span> Criar Revenda
              </button>
              <button
                onClick={() => {
                  // Disparar evento para o AdminDashboard
                  window.dispatchEvent(new CustomEvent('admin:create-cliente'));
                  setShowAdminMenu(false);
                }}
                className="w-full text-left px-4 py-2 text-white hover:bg-[#08cb7c] hover:text-black transition flex items-center gap-2"
              >
                <span>👥</span> Criar Cliente
              </button>
            </div>
          )}
        </div>
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
      <div className="mt-auto text-gray-300 text-xs">
        FieldNet v0.3
      </div>
    </div>
  );
}
