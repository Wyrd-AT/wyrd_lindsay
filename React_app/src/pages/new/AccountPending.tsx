import React from "react";
import { useNavigate } from "react-router-dom";
import { Clock, LogOut, RefreshCw } from "lucide-react";
import { useAuthStore } from "../../stores/new/authStore";

const AccountPending: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const handleLogout = () => {
    useAuthStore.getState().logout();
    navigate("/");
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-[#272727] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-[#313131] rounded-xl p-8 shadow-lg text-center">
          {/* Ícone */}
          <div className="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="w-10 h-10 text-yellow-400" />
          </div>

          {/* Título */}
          <h1 className="text-2xl font-bold text-white mb-3">
            Conta Pendente de Aprovação
          </h1>

          {/* Mensagem */}
          <p className="text-gray-400 mb-6">
            Sua solicitação de registro foi recebida com sucesso.
            Você poderá acessar todas as funcionalidades assim que{" "}
            {user?.type === "revenda"
              ? "o administrador"
              : "a revenda"}{" "}
            aprovar sua conta.
          </p>

          {/* Info */}
          <div className="bg-[#272727] rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Email</span>
              <span className="text-white">{user?.email}</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-gray-500">Tipo</span>
              <span className="text-white capitalize">{user?.type}</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-gray-500">Status</span>
              <span className="inline-flex items-center gap-1 text-yellow-400">
                <Clock className="w-3 h-3" />
                Pendente
              </span>
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3">
            <button
              onClick={handleRefresh}
              className="flex-1 flex items-center justify-center gap-2 bg-[#272727] text-white py-3 px-4 rounded-lg hover:bg-gray-700 transition font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              Verificar novamente
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 flex items-center justify-center gap-2 bg-gray-600 text-white py-3 px-4 rounded-lg hover:bg-gray-700 transition font-medium"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountPending;
