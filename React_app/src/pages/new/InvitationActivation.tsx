import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Shield,
  Eye,
  EyeOff,
  CheckCircle,
  AlertTriangle,
  Check,
  X,
} from "lucide-react";
import { activateInvitation, getCurrentTerms } from "../../api/new/fastapi-auth";

const InvitationActivation: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [terms, setTerms] = useState<{ version: string; content: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) return;
    getCurrentTerms()
      .then(setTerms)
      .catch(() => {});
  }, [token]);

  // Validação de senha
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const hasMinLength = password.length >= 8;
  const passwordsMatch = password === confirmPassword && password.length > 0;
  const isPasswordValid =
    hasUpperCase && hasLowerCase && hasNumber && hasSpecial && hasMinLength;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isPasswordValid || !passwordsMatch || !termsAccepted || !token) return;

    setLoading(true);
    setError("");

    try {
      await activateInvitation(token, password, termsAccepted);
      setSuccess(true);
      setTimeout(() => navigate("/home"), 2000);
    } catch (err: any) {
      setError(err.message || "Erro ao ativar conta");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-[#272727] flex items-center justify-center p-4">
        <div className="bg-[#313131] rounded-xl p-8 shadow-lg max-w-md w-full text-center">
          <AlertTriangle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Link Inválido</h1>
          <p className="text-gray-400 mb-6">
            Este link de convite é inválido ou expirou. Contate seu
            administrador para receber um novo convite.
          </p>
          <button
            onClick={() => navigate("/")}
            className="bg-[#4ade80] text-white py-2 px-6 rounded-lg hover:bg-[#36b55c] transition font-medium"
          >
            Ir para Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#272727] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-[#313131] rounded-xl p-8 shadow-lg">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-[#272727] rounded-full flex items-center justify-center mx-auto mb-4">
              {success ? (
                <CheckCircle className="w-8 h-8 text-[#4ade80]" />
              ) : (
                <Shield className="w-8 h-8 text-[#4ade80]" />
              )}
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              {success ? "Conta Ativada!" : "Ativar Conta"}
            </h1>
            <p className="text-gray-400 text-sm">
              {success
                ? "Redirecionando para o sistema..."
                : "Defina sua senha para ativar sua conta"}
            </p>
          </div>

          {success ? (
            <div className="flex items-center justify-center py-4">
              <div className="w-6 h-6 border-2 border-[#4ade80] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Senha */}
              <div>
                <label className="block text-gray-400 text-sm mb-1">
                  Nova Senha
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#272727] text-white border border-gray-600 rounded-lg px-4 py-3 pr-12 focus:border-[#4ade80] focus:outline-none transition"
                    placeholder="Sua senha"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Requisitos de senha */}
              {password.length > 0 && (
                <div className="bg-[#272727] rounded-lg p-3 space-y-1">
                  {[
                    { ok: hasMinLength, text: "Mínimo 8 caracteres" },
                    { ok: hasUpperCase, text: "Letra maiúscula" },
                    { ok: hasLowerCase, text: "Letra minúscula" },
                    { ok: hasNumber, text: "Número" },
                    { ok: hasSpecial, text: "Caractere especial" },
                  ].map(({ ok, text }) => (
                    <div
                      key={text}
                      className={`flex items-center gap-2 text-xs ${ok ? "text-[#4ade80]" : "text-gray-500"}`}
                    >
                      {ok ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <X className="w-3 h-3" />
                      )}
                      {text}
                    </div>
                  ))}
                </div>
              )}

              {/* Confirmar Senha */}
              <div>
                <label className="block text-gray-400 text-sm mb-1">
                  Confirmar Senha
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full bg-[#272727] text-white border rounded-lg px-4 py-3 focus:outline-none transition ${
                    confirmPassword.length > 0
                      ? passwordsMatch
                        ? "border-[#4ade80]"
                        : "border-red-500"
                      : "border-gray-600 focus:border-[#4ade80]"
                  }`}
                  placeholder="Confirme sua senha"
                />
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="text-red-400 text-xs mt-1">
                    As senhas não coincidem
                  </p>
                )}
              </div>

              {/* Termos */}
              <div className="space-y-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="w-5 h-5 mt-0.5 accent-[#4ade80] cursor-pointer"
                  />
                  <span className="text-gray-400 text-sm">
                    Eu li e concordo com os{" "}
                    <button
                      type="button"
                      onClick={() => setShowTerms(!showTerms)}
                      className="text-[#4ade80] hover:underline"
                    >
                      termos de uso
                    </button>{" "}
                    *
                  </span>
                </label>

                {showTerms && terms && (
                  <div className="bg-[#272727] rounded-lg p-4 max-h-48 overflow-y-auto text-gray-400 text-xs whitespace-pre-line">
                    {terms.content}
                  </div>
                )}
              </div>

              {/* Erro */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <p className="text-red-400 text-sm text-center">{error}</p>
                </div>
              )}

              {/* Botão */}
              <button
                type="submit"
                disabled={
                  !isPasswordValid ||
                  !passwordsMatch ||
                  !termsAccepted ||
                  loading
                }
                className="w-full bg-[#4ade80] text-white py-3 px-4 rounded-lg hover:bg-[#36b55c] disabled:bg-gray-500 disabled:cursor-not-allowed transition font-medium flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Ativando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Ativar Conta
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvitationActivation;
