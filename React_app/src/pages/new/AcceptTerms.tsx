import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, CheckCircle, LogOut } from "lucide-react";
import { useAuthStore } from "../../stores/new/authStore";
import { acceptTerms, getCurrentTerms } from "../../api/new/fastapi-auth";

const AcceptTerms: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);

  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [terms, setTerms] = useState<{
    version: string;
    content: string;
    effective_date: string;
  } | null>(null);
  const [loadingTerms, setLoadingTerms] = useState(true);

  useEffect(() => {
    if (!user?.email) {
      navigate("/");
      return;
    }

    const fetchTerms = async () => {
      try {
        const data = await getCurrentTerms();
        setTerms(data);
      } catch {
        setError("Erro ao carregar termos de uso");
      } finally {
        setLoadingTerms(false);
      }
    };
    fetchTerms();
  }, [user, navigate]);

  const handleAccept = async () => {
    if (!accepted || !terms) return;

    setLoading(true);
    setError("");

    try {
      await acceptTerms(terms.version);
      setSuccess(true);
      updateUser({
        terms_accepted: true,
        terms_version: terms.version,
        requires_action: null,
      });

      setTimeout(() => {
        // Redirecionar para dashboard correto
        const type = user?.type;
        if (type === "admin" || type === "superadmin") navigate("/admin/home");
        else if (type === "revenda") navigate("/home");
        else navigate("/home");
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Erro ao aceitar termos");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = () => {
    useAuthStore.getState().logout();
    navigate("/");
  };

  if (!user?.email) return null;

  return (
    <div className="min-h-screen bg-[#272727] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="bg-[#313131] rounded-xl p-8 shadow-lg max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-[#272727] rounded-full flex items-center justify-center mx-auto mb-4">
              {success ? (
                <CheckCircle className="w-8 h-8 text-[#4ade80]" />
              ) : (
                <FileText className="w-8 h-8 text-[#4ade80]" />
              )}
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              {success ? "Termos Aceitos!" : "Termos de Uso"}
            </h1>
            {success ? (
              <p className="text-gray-400 text-sm">Redirecionando...</p>
            ) : (
              <p className="text-gray-400 text-sm">
                Leia e aceite os termos de uso para continuar
                {terms && (
                  <span className="text-gray-500 ml-1">
                    (v{terms.version})
                  </span>
                )}
              </p>
            )}
          </div>

          {!success && (
            <>
              {/* Conteúdo dos Termos */}
              <div className="flex-grow overflow-y-auto mb-6 bg-[#272727] rounded-lg p-6 text-gray-300 text-sm space-y-4">
                {loadingTerms ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-[#4ade80] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : terms ? (
                  terms.content.split("\n\n").map((section, idx) => {
                    const lines = section.split("\n");
                    const title = lines[0];
                    const body = lines.slice(1).join("\n");

                    // Verificar se é um título numerado
                    const isTitle = /^\d+\./.test(title);

                    return (
                      <div key={idx}>
                        {isTitle ? (
                          <>
                            <h3 className="text-[#4ade80] font-semibold mb-2">
                              {title}
                            </h3>
                            {body && (
                              <p className="whitespace-pre-line">{body}</p>
                            )}
                          </>
                        ) : (
                          <p className="whitespace-pre-line">{section}</p>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-red-400">Erro ao carregar termos</p>
                )}
              </div>

              {/* Erro */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                  <p className="text-red-400 text-sm text-center">{error}</p>
                </div>
              )}

              {/* Checkbox */}
              <label className="flex items-start gap-3 cursor-pointer mb-4">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  className="w-5 h-5 mt-0.5 accent-[#4ade80] cursor-pointer"
                />
                <span className="text-gray-400 text-sm">
                  Eu li e concordo com os termos de uso acima *
                </span>
              </label>

              {/* Botões */}
              <div className="flex gap-3">
                <button
                  onClick={handleReject}
                  className="flex-1 flex items-center justify-center gap-2 bg-gray-600 text-white py-3 px-4 rounded-lg hover:bg-gray-700 transition font-medium"
                >
                  <LogOut className="w-4 h-4" />
                  Rejeitar
                </button>
                <button
                  onClick={handleAccept}
                  disabled={!accepted || loading}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#4ade80] text-white py-3 px-4 rounded-lg hover:bg-[#36b55c] disabled:bg-gray-500 disabled:cursor-not-allowed transition font-medium"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Aceitando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Aceitar
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AcceptTerms;
