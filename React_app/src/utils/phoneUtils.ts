// src/utils/phoneUtils.ts

/**
 * Aplica a máscara de celular brasileiro (padrão E.164 visual)
 * Exemplo de saída: +55 (11) 99999-9999
 */
export const formatPhoneMask = (value: string): string => {
  if (!value) return "";

  // 1. Remove tudo que não for número
  let numbers = value.replace(/\D/g, "");

  // 2. Se apagou tudo, retorna vazio
  if (numbers.length === 0) return "";

  // 3. Garante que o número comece com 55 (DDI do Brasil)
  // if (!numbers.startsWith("55") && numbers.length > 0) {
  //   numbers = "55" + numbers;
  // }

  // 4. Limita a 13 dígitos (55 + DDD + 9 dígitos)
  numbers = numbers.slice(0, 13);

  // 5. Constrói a máscara gradativamente
  let masked = "+" + numbers.substring(0, 2); // +55

  if (numbers.length > 2) {
    masked += " (" + numbers.substring(2, 4); // +55 (XX
  }
  if (numbers.length > 4) {
    masked += ") " + numbers.substring(4, 9); // +55 (XX) XXXXX
  }
  if (numbers.length > 9) {
    masked += "-" + numbers.substring(9, 13); // +55 (XX) XXXXX-XXXX
  }

  return masked;
};

/**
 * Remove a máscara para enviar para a API (Backend)
 * Exemplo de saída: +5511999999999
 */
export const getRawPhone = (maskedValue: string): string => {
  if (!maskedValue) return "";
  const numbers = maskedValue.replace(/\D/g, "");
  return numbers ? `+${numbers}` : "";
};

/**
 * Valida se o telefone tem a quantidade correta de dígitos para o Brasil
 * Aceita Fixo (12 dígitos no total) ou Celular (13 dígitos no total)
 */
export const isPhoneValid = (maskedValue: string): boolean => {
  if (!maskedValue) return false;
  const numbers = maskedValue.replace(/\D/g, "");
  // 55 + DDD(2) + Fixo(8) = 12 || 55 + DDD(2) + Celular(9) = 13
  return numbers.length === 12 || numbers.length === 13;
};
