import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { signUp, confirmSignUp, registerRevenda } from "../../api/new/auth";
import TermsOfUseModal from "../../blocks/TermsOfUseModal";

const SignUp = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // Step 1: Cadastro, Step 2: Confirmação
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userType, setUserType] = useState("cliente"); // Tipo de usuário: admin, revenda, cliente
  const [domain, setDomain] = useState(""); // Domínio para revenda
  const [cnpj, setCnpj] = useState(""); // CNPJ para revenda (novo)
  const [phoneNumber, setPhoneNumber] = useState(""); // Telefone opcional
  const [confirmationCode, setConfirmationCode] = useState("");
  const [error, setError] = useState("");
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    // Garante que o modal de termos seja exibido quando a página carrega
    setShowTermsModal(true);
  }, []);

  const toggleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const [passwordCriteria, setPasswordCriteria] = useState({
    containsUpperCase: false,
    containsLowerCase: false,
    containsNumber: false,
    containsSpecialChar: false,
  });

  // Atualiza os critérios de senha conforme o usuário digita
  const handlePasswordChange = (e) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    setPasswordCriteria({
      containsUpperCase: /[A-Z]/.test(newPassword),
      containsLowerCase: /[a-z]/.test(newPassword),
      containsNumber: /\d/.test(newPassword),
      containsSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword),
    });
  };

  const handleRegister = async () => {
    setError("");
    if (!validateForm()) return;

    try {
      // CASO 1: Registro de Revenda (novo fluxo)
      if (userType === "revenda") {
        try {
          const response = await registerRevenda(
            email,
            password,
            name,
            domain || email.split("@")[1],
            cnpj,
          );

          //console.log("✅ Revenda registrada com sucesso:", response);

          // Mostrar mensagem de sucesso
          setError(""); // Limpar erros
          setShowSuccessPopup(true);

          // Redirecionar após 3 segundos
          setTimeout(() => {
            navigate("/");
          }, 3000);
        } catch (error) {
          console.error("Revenda registration error:", error);
          setError(
            error.message || "Erro ao registrar revenda. Tente novamente.",
          );
        }
        return;
      }

      // CASO 2: Registro de Cliente ou Admin (fluxo original)
      const customAttributes = {
        name: name,
        type: userType,
        status: userType === "admin" || userType === "superadmin" ? "active" : "pending",
      };

      // Adicionar telefone se fornecido
      if (phoneNumber) {
        customAttributes.phone_number = phoneNumber;
      }

      await signUp(email, password, customAttributes);
      setStep(2); // Avança para a etapa de confirmação
    } catch (error) {
      console.error("Registration error:", error);
      setError(error.message || "Erro ao registrar. Tente novamente.");
    }
  };

  const handleConfirmRegister = async () => {
    try {
      await confirmSignUp(email, confirmationCode); // Confirmação de código
      setShowSuccessPopup(true); // Exibe popup de sucesso
      handleCloseSuccessPopup();
    } catch (error) {
      setError("Invalid confirmation code. Please try again.");
    }
  };

  const validateForm = () => {
    if (name.length < 2) {
      setError("Nome deve ter pelo menos 2 caracteres");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Por favor, insira um email válido");
      return false;
    }
    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres");
      return false;
    }
    // Validação específica para revenda
    if (userType === "revenda" && !domain && !email.includes("@")) {
      setError("Revenda deve ter um domínio válido");
      return false;
    }
    return true;
  };

  const handleCloseSuccessPopup = () => {
    setShowSuccessPopup(false);
    navigate("/"); // Redireciona para a página de login após cadastro bem-sucedido
  };

  const handleAcceptTerms = () => {
    setTermsAccepted(true);
    setShowTermsModal(false);
  };

  const handleRejectTerms = () => {
    navigate("/"); // Volta para home se rejeitar os termos
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#272727]">
      {showTermsModal && (
        <TermsOfUseModal
          onAccept={handleAcceptTerms}
          onReject={handleRejectTerms}
        />
      )}
      <div className="w-3/5 h-full flex align-middle justify-center items-center">
        <div className="bg-[#313131] p-8 rounded-lg shadow-md w-96 relative">
          <div className="flex justify-center mb-6">
            <img
              src="/fieldnet.svg"
              alt="FieldNet Logo"
              width="150"
              height="50"
            />
          </div>

          <h2 className="text-[#4ade80] text-2xl font-semibold text-center mb-4">
            Novo Usuário
          </h2>
          <hr className="border-[#4ade80] mb-4" />

          {step === 1 ? (
            <form onSubmit={(e) => e.preventDefault()}>
              <div>
                <label
                  htmlFor="name"
                  className="text-gray-400 block text-sm font-medium mb-1"
                >
                  Name *
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                  className="w-full px-3 py-2 bg-[#444444] text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label
                  htmlFor="email"
                  className="text-gray-400 block text-sm font-medium mb-1"
                >
                  Email *
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  pattern="[^\s@]+@[^\s@]+\.[^\s@]+"
                  className="w-full px-3 py-2 bg-[#444444] text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label
                  htmlFor="userType"
                  className="text-gray-400 block text-sm font-medium mb-1"
                >
                  Tipo de Usuário *
                </label>
                <select
                  id="userType"
                  value={userType}
                  onChange={(e) => setUserType(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-[#444444] text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="cliente">Cliente</option>
                  <option value="revenda">Revenda</option>
                  <option value="admin">Admin</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {(userType === "admin" || userType === "superadmin") &&
                    "⚠️ Admin será criado com status ativo"}
                  {userType === "revenda" &&
                    "⚠️ Revenda precisa de aprovação do admin"}
                  {userType === "cliente" &&
                    "⚠️ Cliente precisa de aprovação da revenda"}
                </p>
              </div>
              {userType === "revenda" && (
                <>
                  <div>
                    <label
                      htmlFor="domain"
                      className="text-gray-400 block text-sm font-medium mb-1"
                    >
                      Domínio (opcional)
                    </label>
                    <input
                      id="domain"
                      type="text"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      placeholder={email ? email.split("@")[1] : "exemplo.com"}
                      className="w-full px-3 py-2 bg-[#444444] text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Se não informado, será usado o domínio do email
                    </p>
                  </div>
                  <div>
                    <label
                      htmlFor="cnpj"
                      className="text-gray-400 block text-sm font-medium mb-1"
                    >
                      CNPJ *
                    </label>
                    <input
                      id="cnpj"
                      type="text"
                      value={cnpj}
                      onChange={(e) => setCnpj(e.target.value)}
                      placeholder="XX.XXX.XXX/0001-XX"
                      pattern="\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}"
                      required
                      className="w-full px-3 py-2 bg-[#444444] text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Formato: XX.XXX.XXX/0001-XX
                    </p>
                  </div>
                </>
              )}
              <div>
                <label
                  htmlFor="phoneNumber"
                  className="text-gray-400 block text-sm font-medium mb-1"
                >
                  Telefone (opcional)
                </label>
                <input
                  id="phoneNumber"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+55 11 99999-9999"
                  className="w-full px-3 py-2 bg-[#444444] text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="text-gray-400 block text-sm font-medium mb-1"
                >
                  Password *
                </label>
                <div className="relative">
                  {" "}
                  {/* 1: container relative */}
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"} // altera o tipo conforme o estado
                    value={password}
                    onChange={handlePasswordChange}
                    required
                    minLength={8}
                    className="
      w-full 
      px-3 py-2        /* padding geral */
      pr-10            /* 2: padding extra à direita para espaço do ícone */
      bg-[#444444] text-white 
      border border-gray-600 rounded 
      focus:outline-none focus:ring-2 focus:ring-green-500
    "
                  />
                  <button
                    type="button"
                    onClick={toggleShowPassword}
                    className="
      absolute         /* 3: posicionamento absoluto dentro do relative */
      bottom-5          /* centraliza verticalmente */
      left-72          /* distância da borda direita */
      -translate-y-1/2 /* corrige o deslocamento exato para o meio */
      flex items-center 
      text-xl text-gray-400 hover:text-gray-200
    "
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              <div className="password-rules text-sm text-gray-500 my-4">
                <p
                  className={
                    passwordCriteria.containsUpperCase
                      ? "text-green-600"
                      : "text-red-600"
                  }
                >
                  {passwordCriteria.containsUpperCase ? "✅" : "❌"} At least 1
                  uppercase letter
                </p>
                <p
                  className={
                    passwordCriteria.containsLowerCase
                      ? "text-green-600"
                      : "text-red-600"
                  }
                >
                  {passwordCriteria.containsLowerCase ? "✅" : "❌"} At least 1
                  lowercase letter
                </p>
                <p
                  className={
                    passwordCriteria.containsNumber
                      ? "text-green-600"
                      : "text-red-600"
                  }
                >
                  {passwordCriteria.containsNumber ? "✅" : "❌"} At least 1
                  number
                </p>
                <p
                  className={
                    passwordCriteria.containsSpecialChar
                      ? "text-green-600"
                      : "text-red-600"
                  }
                >
                  {passwordCriteria.containsSpecialChar ? "✅" : "❌"} At least
                  1 special character
                </p>
              </div>
              {error && <p className="text-red-500">{error}</p>}
              <button
                onClick={handleRegister}
                disabled={!termsAccepted}
                className="w-full bg-[#4ade80] text-white py-2 px-4 rounded text-center hover:bg-[#36b55c] disabled:bg-gray-500 disabled:cursor-not-allowed transition mb-2"
              >
                {!termsAccepted
                  ? "Aceite os Termos para Continuar"
                  : "Criar Usuário"}
              </button>
              {!termsAccepted && (
                <p className="text-gray-400 text-sm text-center">
                  Você precisa aceitar os termos de uso para se cadastrar
                </p>
              )}
            </form>
          ) : (
            <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
              <div>
                <label
                  htmlFor="confirmationCode"
                  className="text-gray-400 block text-sm font-medium mb-1"
                >
                  Confirmation Code *
                </label>
                <input
                  id="confirmationCode"
                  type="text"
                  value={confirmationCode}
                  onChange={(e) => setConfirmationCode(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-[#444444] text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              {error && <p className="text-red-500">{error}</p>}
              <button
                onClick={handleConfirmRegister}
                className="w-full bg-[#4ade80] text-white py-2 px-4 rounded text-center hover:bg-[#36b55c] transition"
              >
                Confirmar Registro
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default SignUp;
