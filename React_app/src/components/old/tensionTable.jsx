// src/components/TabelaTensao.jsx
import React from 'react';

export default function TabelaTensao({ mts }) {
  // mts é um array de objetos, cada um representando um MT com tensão e status (ok ou off)
  return (
    <table style={styles.table}>
      <thead>
        <tr>
          <th style={styles.th}>MT</th>
          <th style={styles.th}>Tensão</th>
          <th style={styles.th}>Status</th>
        </tr>
      </thead>
      <tbody>
        {mts.map((mt, index) => (
          <tr key={index}>
            <td style={styles.td}>MT {index + 1}</td>
            <td style={styles.td}>{mt.tensao} V</td>
            <td style={styles.td}>{mt.ok ? 'ON' : 'OFF'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const styles = {
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '1rem'
  },
  th: {
    border: '1px solid #ccc',
    padding: '8px',
    background: '#f2f2f2'
  },
  td: {
    border: '1px solid #ccc',
    padding: '8px'
  }
};
