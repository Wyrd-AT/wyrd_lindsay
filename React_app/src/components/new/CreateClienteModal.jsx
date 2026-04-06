import { useRef, useState, useEffect } from "react";
import {
  formatPhoneMask,
  getRawPhone,
  isPhoneValid,
} from "../../utils/phoneUtils"; // [NOVO] Import

export const CreateClienteModal = ({
  closeModal,
  onSuccess,
  revendas = [],
  showRevendaField = true,
}) => {
  const nameRef = useRef();
  const emailRef = useRef();
  const revendaSelectRef = useRef();
  const passwordRef = useRef();

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loadingRevendas, setLoadingRevendas] = useState(false);
  const [revendasList, setRevendasList] = useState(revendas);
  const [documento, setDocumento] = useState("");
  const [subRole, setSubRole] = useState("superusuario");
  const [phoneNumber, setPhoneNumber] = useState("");

  // Formata CPF (XXX.XXX.XXX-XX) ou CNPJ (XX.XXX.XXX/XXXX-XX)
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

  const isDocumentoValid = (() => {
    const digits = documento.replace(/\D/g, "");
    return digits.length === 11 || digits.length === 14;
  })();

  const [passwordCriteria, setPasswordCriteria] = useState({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false,
  });

  useEffect(() => {
    if (!showRevendaField) return;

    const loadRevendas = async () => {
      if (revendasList.length === 0) {
        setLoadingRevendas(true);
        try {
          const { fetchRevendas } = await import("../../api/new/fastapi-admin");
          const response = await fetchRevendas("active");
          if (response && response.revendas) {
            setRevendasList(response.revendas);
          }
        } catch (err) {
          console.error("Erro ao carregar revendas:", err);
        } finally {
          setLoadingRevendas(false);
        }
      }
    };
    loadRevendas();
  }, [showRevendaField, revendasList.length]);

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

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        closeModal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeModal]);

  const onBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      closeModal();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const name = nameRef.current.value.trim();
    const email = emailRef.current.value.trim();
    const revendaId =
      showRevendaField && revendaSelectRef.current
        ? revendaSelectRef.current.value || null
        : null;

    if (showRevendaField && !revendaId) {
      setError("Por favor, selecione uma revenda.");
      return;
    }

    if (!name) {
      setError("Por favor, informe um nome.");
      return;
    }

    if (!email) {
      setError("Por favor, informe um email.");
      return;
    }

    if (!isDocumentoValid) {
      setError("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.");
      return;
    }

    if (!isPasswordValid) {
      setError("Senha não atende aos critérios de segurança.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const { createCliente } = await import("../../api/new/fastapi-admin");

      const response = await createCliente({
        email,
        password,
        name,
        cnpj_cliente: documento.replace(/\D/g, ""),
        revenda_id: revendaId,
        sub_role: subRole,
        phone_number: getRawPhone(phoneNumber), // [NOVO] Limpa máscara antes de enviar
      });

      if (response && response.cliente_id) {
        if (onSuccess) {
          onSuccess(response);
        }
        closeModal();
      } else {
        setError("Erro ao criar cliente.");
      }
    } catch (err) {
      console.error("Erro ao criar cliente:", err);
      setError(
        err.message || "Não foi possível criar o cliente. Tente novamente.",
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
        <header className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">Criar Cliente</h2>
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
          Nome *
          <input
            ref={nameRef}
            type="text"
            autoFocus
            placeholder="Nome do Cliente"
            className="w-full text-black px-3 py-2 border rounded-md mt-1 focus:outline-none"
            disabled={isSaving}
            required
          />
        </label>

        <label className="block text-white mb-4">
          Email *
          <input
            ref={emailRef}
            type="email"
            placeholder="cliente@fazenda.com"
            className="w-full text-black px-3 py-2 border rounded-md mt-1 focus:outline-none"
            disabled={isSaving}
            required
          />
        </label>

        {/* [NOVO] CAMPO COM MÁSCARA */}
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
          CNPJ ou CPF do Cliente *
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
            CNPJ (14 dígitos) ou CPF (11 dígitos) — com ou sem formatação
          </span>
          {documento && !isDocumentoValid && (
            <span className="text-xs text-red-400 block mt-1">
              Documento incompleto ({documento.replace(/\D/g, "").length}{" "}
              dígitos informados)
            </span>
          )}
        </label>

        {showRevendaField && (
          <label className="block text-white mb-4">
            Revenda *
            <select
              ref={revendaSelectRef}
              defaultValue=""
              className="w-full text-black px-3 py-2 border rounded-md mt-1 focus:outline-none"
              disabled={isSaving || loadingRevendas}
              required
            >
              <option value="" disabled>
                -- Selecione uma revenda --
              </option>
              {loadingRevendas ? (
                <option disabled>Carregando revendas...</option>
              ) : (
                revendasList.map((revenda) => (
                  <option key={revenda._id} value={revenda._id}>
                    {revenda.name}
                  </option>
                ))
              )}
            </select>
            <span className="text-xs text-gray-400">
              Obrigatório - Selecione a revenda responsável por este cliente
            </span>
          </label>
        )}

        <label className="block text-white mb-4">
          Tipo de Usuário *
          <select
            value={subRole}
            onChange={(e) => setSubRole(e.target.value)}
            className="w-full text-black px-3 py-2 border rounded-md mt-1 focus:outline-none"
            disabled={isSaving}
          >
            <option value="superusuario">Superusuário</option>
            <option value="gerente">Gerente</option>
            <option value="comum">Comum</option>
          </select>
          <span className="text-xs text-gray-400">
            Superusuário: acesso total · Gerente: gerencia pivôs · Comum: apenas
            visualiza
          </span>
        </label>

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
              !isPhoneValid(phoneNumber)
            } // [NOVO] Trava o botão
            className={`
              px-4 py-2 rounded-md text-black font-medium
              ${
                isSaving ||
                !isPasswordValid ||
                !isDocumentoValid ||
                !isPhoneValid(phoneNumber)
                  ? "bg-gray-500 cursor-not-allowed"
                  : "bg-[#08cb7c] hover:bg-green-600"
              }
            `}
          >
            {isSaving ? "Criando..." : "Criar Cliente"}
          </button>
        </div>
      </form>
    </div>
  );
};
