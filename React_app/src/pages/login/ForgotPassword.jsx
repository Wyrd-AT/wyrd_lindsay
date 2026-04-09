import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { forgotPassword, confirmForgotPassword } from "../../api/auth.js"; // Serviços

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [step, setStep] = useState(1);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleRequestCode = async () => {
    setError("");
    setMessage("");

    if (!email) {
      setError("Please enter your email address");
      return;
    }

    try {
      await forgotPassword(email); // Solicita o código
      setMessage("A confirmation code has been sent to your email.");
      setStep(2);
    } catch (err) {
      setError("Failed to send confirmation code. Please try again.");
    }
  };

  const handleResetPassword = async () => {
    setError("");
    setMessage("");

    if (!confirmationCode || !newPassword) {
      setError("Please fill in all the fields.");
      return;
    }

    try {
      await confirmForgotPassword(email, confirmationCode, newPassword); // Confirma a senha
      setMessage("Your password has been reset successfully.");
      setTimeout(() => navigate("/"), 3000); // Redireciona para o login após 3 segundos
    } catch (err) {
      setError(
        "Failed to reset password. Please check the code and try again.",
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#272727]">
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
          Forgot Password
        </h2>
        <hr className="border-[#4ade80] mb-4" />
        {step === 1 && (
          <div className="space-y-4">
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
              className="w-full px-3 py-2 bg-[#444444] text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              className="w-full bg-[#444444] text-white py-2 px-4 rounded text-center hover:bg-gray-600 transition mb-2"
              onClick={handleRequestCode}
            >
              Send Confirmation Code
            </button>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label
                htmlFor="confirmationCode"
                className="text-gray-400 block text-sm font-medium mb-1"
              >
                Confirmation Code *
              </label>
              <input
                id="confirmationCode"
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.target.value)}
                required
                className="w-full px-3 py-2 bg-[#444444] text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label
                htmlFor="newPassword"
                className="text-gray-400 block text-sm font-medium mb-1"
              >
                {" "}
                New Password *
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="w-full px-3 py-2 bg-[#444444] text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <button
              className="w-full bg-[#444444] text-white py-2 px-4 rounded text-center hover:bg-gray-600 transition mb-2"
              onClick={handleResetPassword}
            >
              Reset Password
            </button>
          </div>
        )}
        {error && <p className="text-red-500 mt-2">{error}</p>}
        {message && <p className="text-green-500 mt-2">{message}</p>}
      </div>
    </div>
  );
}

export default ForgotPassword;
