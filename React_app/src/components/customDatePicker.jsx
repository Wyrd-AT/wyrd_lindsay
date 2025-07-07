import React, { useState } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import ptBR from 'date-fns/locale/pt-BR';

import 'react-datepicker/dist/react-datepicker.css';
import '../styles/customDatePicker.css';  // o CSS acima

// registra o locale pt-BR
registerLocale('pt-BR', ptBR);

export default function CustomDatePicker({ value, onChange, label }) {
  const [startDate, setStartDate] = useState(value || new Date());

  const handleChange = (date) => {
    setStartDate(date);
    onChange(date);
  };

  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-xs text-gray-300">{label}</label>
      <DatePicker
        selected={startDate}
        onChange={handleChange}
        locale="pt-BR"                       // ativa pt-BR
        showTimeSelect
        timeCaption="hora"  
        dateFormat="dd/MM/yyyy HH:mm"       // formato BR
        calendarClassName="custom-datepicker"
        className="
          bg-[#2b2b2b] text-white text-xs p-1 rounded
          border border-green-500
          focus:outline-none focus:border-green-600
          w-36 flex-shrink-0
        "
        // como todo o estilo do dia/hora já está no CSS,
        // aqui só garantimos que as classes default não quebrem:
        dayClassName={() => 'react-datepicker__day'}
        timeClassName={() => 'react-datepicker__time-list-item'}
      />
    </div>
  );
}
