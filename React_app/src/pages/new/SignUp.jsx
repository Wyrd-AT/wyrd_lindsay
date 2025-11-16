import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { signUp } from "../../api/new/auth";

const SignUp = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // Step 1: Cadastro, Step 2: Confirmação
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [error, setError] = useState("");
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showPassword, setShowPassword] = useState(false);


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
      await signUp(email, password, "1"); // Registro usando o serviço de autenticação
      setStep(2); // Avança para a etapa de confirmação
    } catch (error) {
      console.error("Registration error:", error);
      setError("Registration failed. Please try again.");
    }
  };

  const handleConfirmRegister = async () => {
    try {
      await confirmSignUp(email, confirmationCode); // Confirmação de código
      setShowSuccessPopup(true); // Exibe popup de sucesso
      handleCloseSuccessPopup()
    } catch (error) {
      setError("Invalid confirmation code. Please try again.");
    }
  };

  const validateForm = () => {
    if (name.length < 2) {
      setError("Name must be at least 2 characters long");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Mais robusto para validação de email
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return false;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return false;
    }
    return true;
  };

  const handleCloseSuccessPopup = () => {
    setShowSuccessPopup(false);
    navigate("/"); // Redireciona para a página de login após cadastro bem-sucedido
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#272727]">
      <div className="w-3/5 h-full flex align-middle justify-center items-center">
        <div className="bg-[#313131] p-8 rounded-lg shadow-md w-96 relative">
          <div className="flex justify-center mb-6">
            <img src="/fieldnet.svg" alt="FieldNet Logo" width="150" height="50" />
          </div>

          <h2 className="text-[#4ade80] text-2xl font-semibold text-center mb-4">Novo Usuário</h2>
          <hr className="border-[#4ade80] mb-4" />

          {step === 1 ? (
            <form onSubmit={(e) => e.preventDefault()}>
              <div>
                <label htmlFor="name" className="text-gray-400 block text-sm font-medium mb-1">Name *</label>
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
                <label htmlFor="email" className="text-gray-400 block text-sm font-medium mb-1">Email *</label>
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
                <label htmlFor="password" className="text-gray-400 block text-sm font-medium mb-1">Password *</label>
                <div className="relative"> {/* 1: container relative */}
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}  // altera o tipo conforme o estado
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
                <p className={passwordCriteria.containsUpperCase ? 'text-green-600' : 'text-red-600'}>
                  {passwordCriteria.containsUpperCase ? '✅' : '❌'} At least 1 uppercase letter
                </p>
                <p className={passwordCriteria.containsLowerCase ? 'text-green-600' : 'text-red-600'}>
                  {passwordCriteria.containsLowerCase ? '✅' : '❌'} At least 1 lowercase letter
                </p>
                <p className={passwordCriteria.containsNumber ? 'text-green-600' : 'text-red-600'}>
                  {passwordCriteria.containsNumber ? '✅' : '❌'} At least 1 number
                </p>
                <p className={passwordCriteria.containsSpecialChar ? 'text-green-600' : 'text-red-600'}>
                  {passwordCriteria.containsSpecialChar ? '✅' : '❌'} At least 1 special character
                </p>
              </div>
              {error && <p className="text-red-500">{error}</p>}
              <button
                onClick={handleRegister}
                className="w-full bg-[#4ade80] text-white py-2 px-4 rounded text-center hover:bg-[#36b55c] transition mb-2"
              >
                Criar Usuário
              </button>
            </form>
          ) : (
            <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
              <div>
                <label htmlFor="confirmationCode" className="text-gray-400 block text-sm font-medium mb-1">Confirmation Code *</label>
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
