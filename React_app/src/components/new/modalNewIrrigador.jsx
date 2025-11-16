// src/components/ModalIrrigador.jsx
import React, { useRef, useState, useEffect } from 'react'
import { useAuthStore } from '../../stores/new/authStore'
import { useNavigate } from 'react-router-dom'
import useEquipamentos from '../../hooks/new/useEquipaments'
import { useDataStoreIrrigadores } from '../../stores/new/dataStoreIrrigadores'

export const ModalIrrigador = ({ closeModal }) => {
  const nameRef = useRef()
  const apelidoRef = useRef()
  const { isAuthenticated, user } = useAuthStore();
    const navigate = useNavigate();
  
    // 2) Redireciona se não estiver logado
    useEffect(() => {
      if (!isAuthenticated) {
        navigate("/login");
      }
    }, [isAuthenticated, navigate]);
  
    const domainAndTld = user.email.split('@')[1]
    const companyId = domainAndTld.split('.')[0];

  const { list: equipamentos, add, remove, update } = useEquipamentos(16)
  const addIrrigador = useDataStoreIrrigadores(state => state.addIrrigador)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)

  // Fecha no ESC
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') {
        closeModal()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeModal])

  const handleSubmit = async e => {
    e.preventDefault()

    const nome = nameRef.current.value.trim()
    if (!nome) {
      setError('Por favor, informe um nome para o irrigador.')
      return
    }
    const apelido = apelidoRef.current.value.trim()
    if (!apelido) {
      setError('Por favor, informe um apelido para o irrigador.')
      return
    }

    setIsSaving(true)
    setError(null)

    const payload = {
      origin: 'app',
      table: 'irrigadores',
      codigo: nome,
      irrigador:apelido,
      equipamentos,
      companyId:companyId

    }

    try {
      await addIrrigador(payload,companyId)
      closeModal()
    } catch (err) {
      console.error('Falha ao salvar irrigador:', err)
      setError('Não foi possível salvar. Tente novamente.')
    } finally {
      setIsSaving(false)
    }
  }

  // Fecha ao clicar fora do modal
  const onBackdropClick = e => {
    if (e.target === e.currentTarget) {
      closeModal()
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
      onClick={onBackdropClick}
    >
      <form
        onSubmit={handleSubmit}
        className="bg-[#444444] p-6 rounded-md shadow-md w-11/12 max-w-md"
      >
        <header className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">Adicionar Irrigador</h2>
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
          <div className="mb-4 text-red-400">
            {error}
          </div>
        )}

        <label className="block text-white mb-4">
          Código:
          <input
            ref={nameRef}
            name="nome"
            type="text"
            autoFocus
            className="w-full text-black px-3 py-2 border rounded-md mt-1 focus:outline-none"
            placeholder="Digite o código..."
            disabled={isSaving}
          />
        </label>
        <label className="block text-white mb-4">
          Nome:
          <input
            ref={apelidoRef}
            name="nome"
            type="text"
            autoFocus
            className="w-full text-black px-3 py-2 border rounded-md mt-1 focus:outline-none"
            placeholder="Digite o nome..."
            disabled={isSaving}
          />
        </label>

        <fieldset className="mb-4">
          <legend className="text-white mb-2">Equipamentos</legend>
          {equipamentos.map((eq, idx) => (
            <div key={idx} className="flex items-center mb-2">
              <input
                type="text"
                value={eq}
                onChange={e => update(idx, e.target.value)}
                placeholder={`Equipamento ${idx + 1}`}
                className="flex-1 text-black px-3 py-2 border rounded-md focus:outline-none"
                disabled={isSaving}
                required
              />
              {equipamentos.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="ml-2 px-2 py-1 text-sm border border-red-500 rounded"
                  aria-label={`Remover equipamento ${idx + 1}`}
                  disabled={isSaving}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={add}
            disabled={isSaving || equipamentos.length >= 16}
            className="mt-2 text-sm px-3 py-1 border rounded-md"
          >
            + Adicionar equipamento ({equipamentos.length}/16)
          </button>
        </fieldset>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={closeModal}
            className="mr-2 px-4 py-2 border rounded-md"
            disabled={isSaving}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className={`
              px-4 py-2 rounded-md text-white 
              ${isSaving
                ? 'bg-gray-500 cursor-not-allowed'
                : 'bg-[#08cb7c] hover:bg-green-600'}
            `}
          >
            {isSaving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  )
}
