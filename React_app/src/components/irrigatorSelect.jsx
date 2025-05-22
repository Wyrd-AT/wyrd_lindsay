import React, { useMemo } from 'react';
import Select from 'react-select';

function IrrigatorSelect({ parsed, syncTimestamp, onSelect }) {
  const options = useMemo(() => {
    const ids = Array.from(new Set(parsed.map(m => m.irrigadorId)));
    return ids.map(id => ({
      value: id,
      label: `IRRIGADOR ${id}`
    }));
  }, [parsed, syncTimestamp]);

  const handleChange = option => {
    onSelect(option ? option.value : null);
  };

  return (
    <Select
      options={options}
      isClearable
      isSearchable
      placeholder="Selecione ou digite o ID do irrigador"
      onChange={handleChange}
      noOptionsMessage={() => 'Nenhum irrigador encontrado'}
      styles={{
        container: base => ({ ...base, width: 300 }),
      }}
    />
  );
}