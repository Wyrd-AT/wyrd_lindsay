import React, { useRef, useState, useEffect } from "react";
import { useAuthStore } from "../../stores/new/authStore";
import {
  formatPhoneMask,
  getRawPhone,
  isPhoneValid,
} from "../../utils/phoneUtils"; // [NOVO] Import das funções

export const CreateRevendaModal = ({ closeModal, onSuccess }) => {
  const adminUser = useAuthStore((state) => state.user);

  const nameRef = useRef();
  const emailRef = useRef();
  const passwordRef = useRef();

  const isSuperadmin = adminUser?.type === "superadmin";

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [documento, setDocumento] = useState("");
  const [phoneNumber, setPhoneNumber] = useState(""); // [NOVO] Estado do telemóvel
  const [selectedAdminCnpj, setSelectedAdminCnpj] = useState(
    adminUser?.cnpj || "",
  );
  const [adminsList, setAdminsList] = useState([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  // Formata CPF ou CNPJ conforme a digitação
  const formatDocumento = (value) => {
    const digits = value.replace(/\D/g, "").slice(0, 14);
    if (digits.length <= 11) {
      return digits
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    }
    return digits
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1/$2")
      .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  };

  // Valida se tem 11, 14 ou 0 dígitos
  const isDocumentoValid = (() => {
    const digits = documento.replace(/\D/g, "");
    return digits.length === 11 || digits.length === 14 || digits.length === 0;
  })();

  // Password criteria states
  const [passwordCriteria, setPasswordCriteria] = useState({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false,
  });

  // Update password criteria on change
  const handlePasswordChange = (e) => {
    const pwd = e.target.value;
    setPassword(pwd);

    setPasswordCriteria({
      minLength: pwd.length >= 8,
      hasUppercase: /[A-Z]/.test(pwd),
      hasLowercase: /[a-z]/.test(pwd),
      hasNumber: /[0-9]/.test(pwd),
      hasSpecialChar: /[!@#$%^&*(),.?":{}|<>[\]\\-_+=`~]/.test(pwd),
    });
  };

  const isPasswordValid = Object.values(passwordCriteria).every(
    (v) => v === true,
  );

  // Carregar lista de admins quando superadmin
  useEffect(() => {
    if (!isSuperadmin) return;
    const loadAdmins = async () => {
      setLoadingAdmins(true);
      try {
        const { fetchAdmins } = await import("../../api/new/fastapi-admin");
        const response = await fetchAdmins();
        if (response && response.admins) {
          setAdminsList(response.admins);
        }
      } catch (err) {
        console.error("Erro ao carregar admins:", err);
      } finally {
        setLoadingAdmins(false);
      }
    };
    loadAdmins();
  }, [isSuperadmin]);

  // Preencher campos automaticamente com dados do admin
  useEffect(() => {
    if (adminUser && adminUser.domain) {
      // Sugerir email: gerente@{domain}
      if (emailRef.current) {
        emailRef.current.value = `gerente@${adminUser.domain}`;
      }
    }
  }, [adminUser]);

  // Close on ESC
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        closeModal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeModal]);

  // Close on backdrop click
  const onBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      closeModal();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const name = nameRef.current.value.trim();
    const email = emailRef.current.value.trim();

    if (!name) {
      setError("Por favor, informe um nome.");
      return;
    }

    if (!email) {
      setError("Por favor, informe um email.");
      return;
    }

    if (!documento) {
      setError("Por favor, informe um CNPJ ou CPF.");
      return;
    }

    // Validar CNPJ/CPF (remove caracteres especiais para contar os números)
    const cnpjDigits = documento.replace(/\D/g, "");
    // Aceitar CNPJ (14 dígitos) ou CPF (11 dígitos)
    if (cnpjDigits.length !== 14 && cnpjDigits.length !== 11) {
      setError("CNPJ deve conter 14 dígitos ou CPF deve conter 11 dígitos.");
      return;
    }

    if (!isPasswordValid) {
      setError("Senha não atende aos critérios de segurança.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Import the API function dynamically to avoid circular dependencies
      const { createRevenda } = await import("../../api/new/fastapi-admin");

      const response = await createRevenda({
        email,
        password,
        name,
        cnpj_revenda: documento,
        cnpj_admin: selectedAdminCnpj || adminUser?.cnpj,
        phone_number: getRawPhone(phoneNumber), // [NOVO] Limpa a máscara antes de enviar
      });

      if (response && response.revenda_id) {
        if (onSuccess) {
          onSuccess(response);
        }
        closeModal();
      } else {
        setError("Erro ao criar revenda.");
      }
    } catch (err) {
      console.error("Erro ao criar revenda:", err);
      setError(
        err.message || "Não foi possível criar a revenda. Tente novamente.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const CriteriaCheck = ({ label, isValid }) => (
    <div className="flex items-center text-sm mb-1">
      <span className={isValid ? "text-green-400" : "text-red-400"}>
        {isValid ? "✓" : "✗"}
      </span>
      <span className="ml-2 text-gray-300">{label}</span>
    </div>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
      onClick={onBackdropClick}
    >
      <form
        onSubmit={handleSubmit}
        className="bg-[#444444] p-6 rounded-md shadow-md w-11/12 max-w-md max-h-[90vh] overflow-y-auto"
      >
        <header className="flex justify-between items-start mb-6 pb-4 border-b border-gray-600">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-white">Criar Revenda</h2>

            {adminUser && (
              <div className="mt-3 space-y-2">
                {/* Dados do Admin (Logado) */}
                <div className="text-xs bg-green-900/30 border border-green-700 rounded p-2">
                  <p className="font-semibold text-green-400 mb-1">
                    👤 Seus Dados (Admin Logado)
                  </p>
                  <p className="text-gray-300">
                    Email:{" "}
                    <span className="text-green-300">{adminUser.email}</span>
                  </p>
                  {adminUser.cnpj && (
                    <p className="text-gray-300">
                      CNPJ:{" "}
                      <span className="text-green-300">{adminUser.cnpj}</span>
                    </p>
                  )}
                  {adminUser.domain && (
                    <p className="text-gray-300">
                      Domínio:{" "}
                      <span className="text-green-300">{adminUser.domain}</span>
                    </p>
                  )}
                </div>

                {/* Dados da Revenda (A ser criada) */}
                <div className="text-xs bg-blue-900/30 border border-blue-700 rounded p-2">
                  <p className="font-semibold text-blue-400 mb-1">
                    🏢 Dados da Revenda (A Criar)
                  </p>
                  <p className="text-gray-300 text-xs">
                    Preencha os campos abaixo com os dados da nova revenda
                  </p>
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={closeModal}
            aria-label="Fechar"
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </header>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

        <label className="block text-white mb-4">
          Nome da Revenda *
          <input
            ref={nameRef}
            type="text"
            autoFocus
            placeholder="Ex: Revenda Sul, Revenda Rio, etc"
            className="w-full text-black px-3 py-2 border rounded-md mt-1 focus:outline-none"
            disabled={isSaving}
            required
          />
          <span className="text-xs text-gray-400">
            Nome único da revenda a ser criada
          </span>
        </label>

        <label className="block text-white mb-4">
          Email da Revenda *
          <div className="flex gap-2 items-center mt-1">
            <input
              ref={emailRef}
              type="email"
              placeholder="gerente@wyrd.com.br"
              className="flex-1 text-black px-3 py-2 border rounded-md focus:outline-none"
              disabled={isSaving}
              required
            />
            {adminUser?.domain && emailRef.current?.value && (
              <span className="text-xs bg-green-600 text-white px-2 py-1 rounded whitespace-nowrap">
                ✓ Sugerido
              </span>
            )}
          </div>
          <span className="text-xs text-gray-400">
            Email único para a revenda
          </span>
        </label>

        {/* [NOVO] CAMPO DE TELEMÓVEL COM MÁSCARA */}
        <label className="block text-white mb-4">
          Celular / WhatsApp *
          <input
            type="tel"
            required
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(formatPhoneMask(e.target.value))}
            className={`w-full text-black px-3 py-2 border rounded-md mt-1 focus:outline-none focus:ring-2 focus:ring-green-500 ${
              phoneNumber && !isPhoneValid(phoneNumber) ? "border-red-500" : ""
            }`}
            placeholder="+55 (11) 99999-9999"
            disabled={isSaving}
          />
          {phoneNumber && !isPhoneValid(phoneNumber) && (
            <span className="text-xs text-red-400 block mt-1">
              Número incompleto.
            </span>
          )}
        </label>

        <label className="block text-white mb-4">
          CNPJ ou CPF da Revenda *
          <input
            type="text"
            value={documento}
            onChange={(e) => setDocumento(formatDocumento(e.target.value))}
            placeholder="XX.XXX.XXX/0001-XX ou XXX.XXX.XXX-XX"
            className={`w-full text-black px-3 py-2 border rounded-md mt-1 focus:outline-none ${
              documento && !isDocumentoValid ? "border-red-500" : ""
            }`}
            disabled={isSaving}
            required
          />
          <span className="text-xs text-gray-400">
            CNPJ (14 dígitos) ou CPF (11 dígitos) - com ou sem formatação
          </span>
          {documento && !isDocumentoValid && (
            <span className="text-xs text-red-400 block mt-1">
              Documento incompleto ({documento.replace(/\D/g, "").length}{" "}
              dígitos informados)
            </span>
          )}
        </label>

        {isSuperadmin && (
          <label className="block text-white mb-4">
            Vincular ao Admin *
            <select
              value={selectedAdminCnpj}
              onChange={(e) => setSelectedAdminCnpj(e.target.value)}
              className="w-full text-black px-3 py-2 border rounded-md mt-1 focus:outline-none"
              disabled={isSaving || loadingAdmins}
              required
            >
              <option value="">-- Selecione um admin --</option>
              {loadingAdmins ? (
                <option disabled>Carregando admins...</option>
              ) : (
                adminsList.map((admin) => (
                  <option key={admin._id} value={admin.cnpj_admin}>
                    {admin.name} ({admin.email}) - CNPJ: {admin.cnpj_admin}
                  </option>
                ))
              )}
            </select>
            <span className="text-xs text-gray-400">
              Selecione o admin responsável por esta revenda
            </span>
          </label>
        )}

        <label className="block text-white mb-4">
          Senha *
          <div className="relative mt-1">
            <input
              ref={passwordRef}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={handlePasswordChange}
              placeholder="Senha segura"
              className={`w-full text-black px-3 py-2 border rounded-md focus:outline-none pr-10 ${
                password && !isPasswordValid ? "border-red-500" : ""
              }`}
              disabled={isSaving}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-2.5 text-gray-600 hover:text-gray-800 focus:outline-none"
              disabled={isSaving}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? "👁️" : "👁️‍🗨️"}
            </button>
          </div>
        </label>

        {password && (
          <div className="mb-4 p-3 bg-[#333333] rounded text-sm">
            <p className="text-white mb-2">Critérios de senha:</p>
            <CriteriaCheck
              label="Mínimo 8 caracteres"
              isValid={passwordCriteria.minLength}
            />
            <CriteriaCheck
              label="Letra maiúscula (A-Z)"
              isValid={passwordCriteria.hasUppercase}
            />
            <CriteriaCheck
              label="Letra minúscula (a-z)"
              isValid={passwordCriteria.hasLowercase}
            />
            <CriteriaCheck
              label="Número (0-9)"
              isValid={passwordCriteria.hasNumber}
            />
            <CriteriaCheck
              label="Caractere especial (!@#$...)"
              isValid={passwordCriteria.hasSpecialChar}
            />
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={closeModal}
            className="px-4 py-2 border border-gray-500 rounded-md text-white hover:bg-gray-600"
            disabled={isSaving}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={
              isSaving ||
              !isPasswordValid ||
              !isDocumentoValid ||
              !documento ||
              !isPhoneValid(phoneNumber)
            }
            className={`
              px-4 py-2 rounded-md text-black font-medium
              ${
                isSaving ||
                !isPasswordValid ||
                !isDocumentoValid ||
                !documento ||
                !isPhoneValid(phoneNumber)
                  ? "bg-gray-500 cursor-not-allowed"
                  : "bg-[#08cb7c] hover:bg-green-600"
              }
            `}
          >
            {isSaving ? "Criando..." : "Criar Revenda"}
          </button>
        </div>
      </form>
    </div>
  );
};
