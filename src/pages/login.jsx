import React from "react";

export default function Login() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#272727]">
      <div className="bg-[#313131] p-8 rounded-lg shadow-md w-96">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img src="/fieldnet.svg" alt="FieldNet Logo" width="150" height="50" />
        </div>

        {/* Título */}
        <h2 className="text-green-400 text-2xl font-semibold text-center mb-4">
          Sign in
        </h2>
        <hr className="border-green-400 mb-4" />

        {/* Formulário */}
        <form>
          <div className="mb-4">
            <label htmlFor="username" className="text-gray-400 block text-sm font-medium mb-1">
              USERNAME
            </label>
            <input
              id="username"
              type="text"
              className="w-full px-3 py-2 bg-[#444444] text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="password" className="text-gray-400 block text-sm font-medium mb-1">
              PASSWORD
            </label>
            <input
              id="password"
              type="password"
              className="w-full px-3 py-2 bg-[#444444] text-white border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Botão de Sign In */}
          <a
            href="/homeRevenda"
            className="block w-full bg-[#444444] text-white py-2 px-4 rounded text-center hover:bg-gray-600 transition"
          >
            SIGN IN
          </a>
        </form>

        {/* Links de navegação */}
        <div className="flex justify-between mt-4 text-green-400 text-sm">
          <a href="#" className="hover:underline">
            Demo
          </a>
          <a href="/resetPass" className="hover:underline">
            Reset Password
          </a>
        </div>
      </div>
    </div>
  );
}
