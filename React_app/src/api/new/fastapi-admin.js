/**
 * Admin API Functions - Create revendas and clientes
 * These functions require admin authentication (Bearer token)
 */

import apiClient from './apiClient';

/**
 * Create a revenda via admin
 * @param {Object} data - { email, password, name, cnpj_revenda, cnpj_admin }
 * @returns {Promise<Object>} Response with revenda_id and status
 */
export const createRevenda = async (data) => {
  try {
    const response = await apiClient.post('/revendas', {
      email: data.email,
      password: data.password,
      name: data.name,
      cnpj_revenda: data.cnpj_revenda,  // ← CNPJ da revenda
      cnpj_admin: data.cnpj_admin,      // ← CNPJ do admin para associação
    });
    return response.data;
  } catch (error) {
    const errorMsg = error.response?.data?.detail || error.message;
    throw new Error(errorMsg);
  }
};

/**
 * Create a cliente via admin
 * @param {Object} data - { email, password, name, revenda_id? }
 * @returns {Promise<Object>} Response with cliente_id and status
 */
export const createCliente = async (data) => {
  try {
    const response = await apiClient.post('/clientes', {
      email: data.email,
      password: data.password,
      name: data.name,
      revenda_id: data.revenda_id || null,
    });
    return response.data;
  } catch (error) {
    const errorMsg = error.response?.data?.detail || error.message;
    throw new Error(errorMsg);
  }
};

/**
 * Fetch revendas (with optional status filter)
 * @param {string} status - 'active', 'pending', or 'all'
 * @returns {Promise<Object>} Response with revendas list
 */
export const fetchRevendas = async (status = 'active') => {
  try {
    let url = '/revendas';
    if (status === 'pending') {
      url = '/revendas/pending';
    }
    const response = await apiClient.get(url);
    return response.data;
  } catch (error) {
    const errorMsg = error.response?.data?.detail || error.message;
    throw new Error(errorMsg);
  }
};

/**
 * Fetch clientes (with optional status filter)
 * @param {string} status - 'active', 'pending', or 'all'
 * @returns {Promise<Object>} Response with clientes list
 */
export const fetchClientes = async (status = 'active') => {
  try {
    let url = '/clientes';
    if (status === 'pending') {
      url = '/clientes/pending';
    }
    const response = await apiClient.get(url);
    return response.data;
  } catch (error) {
    const errorMsg = error.response?.data?.detail || error.message;
    throw new Error(errorMsg);
  }
};
