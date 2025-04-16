// src/components/CommandForm.jsx
import React, { useState } from 'react';

export default function CommandForm({ irrigadorId, onCommandSubmit }) {
  const [command, setCommand] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // Chama a função de envio do comando (a ser implementada)
    onCommandSubmit(irrigadorId, command);
    setCommand('');
  };

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <label>
        Enviar Comando para {irrigadorId}:
        <select
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          style={styles.select}
        >
          <option value="">Selecione um comando</option>
          <option value="reset">Reset</option>
          <option value="alarme">Alarme</option>
          <option value="clean">Clean</option>
          <option value="offset">Offset</option>
          {/* Adicione outros comandos conforme necessário */}
        </select>
      </label>
      <button type="submit" style={styles.button}>Enviar</button>
    </form>
  );
}

const styles = {
  form: {
    marginTop: '1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  select: {
    padding: '0.5rem'
  },
  button: {
    padding: '0.5rem 1rem',
    cursor: 'pointer'
  }
};
