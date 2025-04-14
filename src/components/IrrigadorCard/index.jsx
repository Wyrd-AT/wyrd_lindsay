// src/components/IrrigadorCard.jsx
import React from 'react';
import { Link } from 'react-router-dom';

export default function IrrigadorCard({ irrigador }) {
  // irrigador deve ter pelo menos um id e algum status resumido
  return (
    <div style={styles.card}>
      <h2>{irrigador.id}</h2>
      <p>Status: {irrigador.status}</p>
      <Link to={`/irrigador/${irrigador.id}`} style={styles.link}>Ver Detalhes</Link>
    </div>
  );
}

const styles = {
  card: {
    border: '1px solid #ccc',
    padding: '1rem',
    borderRadius: '8px',
    marginBottom: '1rem',
    boxShadow: '2px 2px 8px rgba(0,0,0,0.1)',
  },
  link: {
    color: '#007bff',
    textDecoration: 'none',
  },
};
