import React from "react";

export default function ResetPass() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#272727]">
      <div className="bg-[#313131] p-8 rounded-lg shadow-md w-96">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img
            src="/fieldnet.svg"
            alt="FieldNet Logo"
            width="150"
            height="50"
          />
        </div>

        {/* Título */}
        <h2 className="text-green-400 text-2xl font-semibold text-center mb-4">
          Account Recovery
        </h2>
        <hr className="border-green-400 mb-4" />

        {/* Formulário */}
        <form>
          <div className="mb-4">
            <label className="text-gray-400 block text-sm font-medium mb-1">
              USERNAME
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 bg-[#444444] text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-[#444444] text-white py-2 px-4 rounded hover:bg-gray-600 transition"
          >
            Reset Password
          </button>
        </form>

        {/* Informação adicional */}
        <div className="flex justify-between mt-4 text-white text-sm">
          If you are unable to remember your username or email address, please email FieldNET support.
        </div>
      </div>
    </div>
  );
}
