import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, RefreshCw, ArrowLeft, CheckCircle } from "lucide-react";
import { useAuthStore } from "../../stores/new/authStore";
import {
  verifyEmail as verifyEmailApi,
  resendVerificationCode,
} from "../../api/new/fastapi-auth";

const VerifyEmail: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const email = user?.email || "";

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Cooldown timer para reenvio
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Redirecionar se não autenticado
  useEffect(() => {
    if (!email) {
      navigate("/");
    }
  }, [email, navigate]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    setError("");

    // Auto-focus próximo campo
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit quando completo
    const fullCode = newCode.join("");
    if (fullCode.length === 6) {
      handleVerify(fullCode);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const newCode = [...code];
    for (let i = 0; i < pasted.length; i++) {
      newCode[i] = pasted[i];
    }
    setCode(newCode);

    if (pasted.length === 6) {
      handleVerify(pasted);
    } else {
      inputRefs.current[pasted.length]?.focus();
    }
  };

  const handleVerify = async (fullCode: string) => {
    setLoading(true);
    setError("");

    try {
      await verifyEmailApi(email, fullCode);
      setSuccess(true);
      updateUser({ email_verified: true, requires_action: "accept_terms" });

      setTimeout(() => {
        if (user?.terms_accepted) {
          navigate("/home");
        } else {
          navigate("/accept-terms");
        }
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Erro ao verificar código");
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return;

    setResending(true);
    setError("");

    try {
      await resendVerificationCode(email);
      setResendCooldown(60);
    } catch (err: any) {
      setError(err.message || "Erro ao reenviar código");
    } finally {
      setResending(false);
    }
  };

  if (!email) return null;

  return (
    <div className="min-h-screen bg-[#272727] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-[#313131] rounded-xl p-8 shadow-lg">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#272727] rounded-full flex items-center justify-center mx-auto mb-4">
              {success ? (
                <CheckCircle className="w-8 h-8 text-[#4ade80]" />
              ) : (
                <Mail className="w-8 h-8 text-[#4ade80]" />
              )}
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              {success ? "Email Verificado!" : "Verificar Email"}
            </h1>
            <p className="text-gray-400 text-sm">
              {success ? (
                "Redirecionando..."
              ) : (
                <>
                  Enviamos um código de 6 dígitos para{" "}
                  <span className="text-[#4ade80] font-medium">{email}</span>
                </>
              )}
            </p>
          </div>

          {!success && (
            <>
              {/* Campos do código */}
              <div className="flex justify-center gap-3 mb-6" onPaste={handlePaste}>
                {code.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => { inputRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    disabled={loading}
                    className="w-12 h-14 text-center text-2xl font-bold bg-[#272727] text-white border-2 border-gray-600 rounded-lg focus:border-[#4ade80] focus:outline-none transition disabled:opacity-50"
                  />
                ))}
              </div>

              {/* Erro */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                  <p className="text-red-400 text-sm text-center">{error}</p>
                </div>
              )}

              {/* Loading */}
              {loading && (
                <div className="flex items-center justify-center gap-2 mb-4">
                  <div className="w-4 h-4 border-2 border-[#4ade80] border-t-transparent rounded-full animate-spin" />
                  <span className="text-gray-400 text-sm">Verificando...</span>
                </div>
              )}

              {/* Reenviar */}
              <div className="text-center mt-6">
                <p className="text-gray-500 text-sm mb-2">
                  Não recebeu o código?
                </p>
                <button
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || resending}
                  className="inline-flex items-center gap-2 text-[#4ade80] hover:text-[#36b55c] disabled:text-gray-500 disabled:cursor-not-allowed transition text-sm font-medium"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${resending ? "animate-spin" : ""}`}
                  />
                  {resendCooldown > 0
                    ? `Reenviar em ${resendCooldown}s`
                    : resending
                      ? "Reenviando..."
                      : "Reenviar código"}
                </button>
              </div>

              {/* Voltar */}
              <div className="text-center mt-6 pt-4 border-t border-gray-700">
                <button
                  onClick={() => {
                    useAuthStore.getState().logout();
                    navigate("/");
                  }}
                  className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition text-sm"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar para login
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
