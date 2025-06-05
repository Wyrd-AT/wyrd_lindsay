import { NavLink } from "react-router-dom";
import { BiHomeAlt, BiUser } from "react-icons/bi";
import { FiLogOut } from "react-icons/fi";
import { useAuth } from "./useAuth";

export default function SideBar() {
  const { logout } = useAuth();

  return (
    <div
      className="
        sticky top-0 left-0
        w-[100px] bg-[#444444]
        py-8 flex flex-col items-center
        h-screen
        z-10
      "
    >
      <img
        src="/FieldNetLogo.png"
        alt="FieldNet Logo"
        width="100"
        height="100"
        className="mb-8"
      />

      {/* Home */}
      <NavLink
        to="/"
        className={({ isActive }) =>
          `mb-4 ${isActive ? "text-green-500" : "text-white"}`
        }
      >
        <BiHomeAlt size={40} />
      </NavLink>

      {/* Perfil */}
      <button
        onClick={() => {
          // lógica de logout aqui
          console.log("Perfil");
        }}
        className="text-white hover:text-green-500 mb-4"
      >
        <BiUser size={40} />
      </button>

      {/* Espaço flexível para empurrar o logout pro final */}
      <div className="flex-grow" />

      {/* Logout */}
      <button
        onClick={() => {
          // lógica de logout aqui
          console.log("Logout!");
          logout();
        }}
        className="text-white hover:text-green-500 mb-4"
      >
        <FiLogOut size={40} />
      </button>
    </div>
  );
}
