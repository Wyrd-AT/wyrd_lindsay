import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "../../stores/new/authStore.ts";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import {
  signIn,
  confirmSignUp,
  resendConfirmationCode,
} from "../../api/new/auth.js";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState("");
  const [confirmLoading, setConfirmLoading] = useState(false);
  const navigate = useNavigate();

  const toggleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); // Clear previous errors

    if (!validateForm(e.currentTarget)) {
      console.warn("⚠️ Form validation failed");
      return;
    }

    try {
      const response = await signIn(email, password);
      //console.log("Login response:", response);
      if (
        response &&
        response.AuthenticationResult &&
        response.AuthenticationResult.AccessToken
      ) {
        // ✅ auth.js JÁ chamou login(user, token) com type + status
        // Não chamar novamente aqui para não sobrescrever!

        // ✅ Redirecionar baseado no status de verificação/termos e tipo
        setTimeout(() => {
          const authState = useAuthStore.getState();
          const userType = authState.user?.type;
          const requiresAction = authState.user?.requires_action;

          // Verificar se precisa de onboarding primeiro
          if (requiresAction === "verify_email") {
            navigate("/verify-email");
            return;
          }
          if (requiresAction === "accept_terms") {
            navigate("/accept-terms");
            return;
          }
          if (authState.user?.status === "pending") {
            navigate("/account-pending");
            return;
          }

          // Redirecionar para a rota apropriada
          if (userType === "admin" || userType === "superadmin") {
            navigate("home");
          } else if (userType === "revenda") {
            navigate("/home");
          } else if (userType === "cliente") {
            navigate("/home");
          } else {
            navigate("/home");
          }
        }, 100);
      } else {
        setError("Invalid response from server");
      }
    } catch (err) {
      console.error("Login error:", err);
      if (err instanceof Error && err.message) {
        if (
          err.message.includes("não confirmada") ||
          err.message.includes("NotConfirmed")
        ) {
          setNeedsConfirmation(true);
          setError(
            "Conta não confirmada. Digite o código enviado para seu email.",
          );
        } else {
          setError(err.message);
        }
      } else {
        setError("Ocorreu um erro. Tente novamente.");
      }
    }
  };

  const handleConfirm = async () => {
    setConfirmLoading(true);
    setError("");
    try {
      await confirmSignUp(email, confirmationCode);
      setNeedsConfirmation(false);
      setConfirmationCode("");
      // Tentar login automaticamente após confirmar
      await handleSubmit({
        preventDefault: () => {},
        currentTarget: document.querySelector("form"),
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Código inválido. Tente novamente.",
      );
    } finally {
      setConfirmLoading(false);
    }
  };

  const validateForm = (form) => {
    const emailInput = form.elements.namedItem("email");
    const passwordInput = form.elements.namedItem("password");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailInput.value)) {
      setError("Please enter a valid email address");
      return false;
    }

    if (passwordInput.value.length < 1) {
      setError("Please enter your password");
      return false;
    }

    return true;
  };

  const setCustomValidity = (e) => {
    const input = e.target;
    switch (input.id) {
      case "email":
        input.setCustomValidity(
          input.validity.typeMismatch
            ? "Please enter a valid email address"
            : "",
        );
        break;
      case "password":
        input.setCustomValidity(
          input.value ? "" : "Please enter your password",
        );
        break;
    }
  };

  const clearCustomValidity = (e) => {
    e.currentTarget.setCustomValidity("");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#272727]">
      <div className="bg-[#313131] p-8 rounded-lg shadow-md w-96 relative">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img
            src="/fieldnet.svg"
            alt="FieldNet Logo"
            width="150"
            height="50"
          />
        </div>

        {/* Title */}
        <h2 className="text-[#4ade80] text-2xl font-semibold text-center mb-4">
          Sign in
        </h2>
        <hr className="border-[#4ade80] mb-4" />

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
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
              onInvalid={setCustomValidity}
              onInput={clearCustomValidity}
              required
              pattern="[^\s@]+@[^\s@]+\.[^\s@]+"
              className="w-full px-3 py-2 bg-[#444444] text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="mb-4 relative">
            <label
              htmlFor="password"
              className="text-gray-400 block text-sm font-medium mb-1"
            >
              Password *
            </label>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onInvalid={setCustomValidity}
              onInput={clearCustomValidity}
              required
              className="w-full px-3 py-2 bg-[#444444] text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              type="button"
              onClick={toggleShowPassword}
              className="absolute inset-y-0 top-6 right-3 flex items-center text-xl"
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>

          {error && <p className="text-red-500">{error}</p>}

          {needsConfirmation && (
            <div className="mt-4 p-4 bg-[#3a3a3a] border border-[#4ade80] rounded">
              <label
                htmlFor="confirmationCode"
                className="text-gray-400 block text-sm font-medium mb-1"
              >
                Codigo de Confirmacao *
              </label>
              <input
                id="confirmationCode"
                type="text"
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.target.value)}
                placeholder="Digite o codigo recebido por email"
                className="w-full px-3 py-2 bg-[#444444] text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-green-500 mb-2"
              />
              <button
                type="button"
                onClick={handleConfirm}
                disabled={confirmLoading || !confirmationCode}
                className="w-full bg-[#4ade80] text-white py-2 px-4 rounded text-center hover:bg-[#36b55c] disabled:bg-gray-500 transition"
              >
                {confirmLoading ? "Confirmando..." : "Confirmar Conta"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await resendConfirmationCode(email);
                    setError("Codigo reenviado! Verifique seu email.");
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : "Erro ao reenviar codigo.",
                    );
                  }
                }}
                className="w-full mt-2 text-[#4ade80] text-sm hover:underline"
              >
                Reenviar codigo
              </button>
            </div>
          )}

          <div className="w-full flex flex-col justify-center items-center mt-4">
            <button
              type="submit"
              className="w-full bg-[#444444] text-white py-2 px-4 rounded text-center hover:bg-gray-600 transition mb-2"
            >
              Sign In
            </button>
            {/* <Link
                to="/signup"
                className="w-full bg-[#444444] text-white py-2 px-4 rounded text-center hover:bg-gray-600 transition"
              >
                <button className="w-full  text-white ">Create Account</button>
              </Link> */}
          </div>

          <p className="text-sm text-gray-500 mt-2">
            * All fields are required
          </p>
        </form>

        <p className=" text-sm text-gray-500 mt-2">
          Forgot your password?{" "}
          <Link
            to="/forgot-password"
            className="text-[#4ade80] hover:underline"
          >
            Click here to reset it
          </Link>
        </p>
      </div>
    </div>
  );
}
