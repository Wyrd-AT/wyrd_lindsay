// components/CustomDatePicker.jsx
import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

export default function CustomDatePicker({ value, onChange, label }) {
  const [startDate, setStartDate] = useState(value || new Date());

  const handleChange = (date) => {
    setStartDate(date);
    onChange(date);
  };

  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-sm text-gray-300">{label}</label>
      <DatePicker
        selected={startDate}
        onChange={handleChange}
        showTimeSelect
        dateFormat="yyyy-MM-dd HH:mm"
        className="bg-[#2b2b2b] text-white p-2 rounded border border-green-500 focus:outline-none focus:border-green-600 w-full"
        calendarClassName="!bg-[#2b2b2b] !text-white border border-green-500 rounded"
        dayClassName={(date) =>
          'hover:!bg-green-500 hover:!text-white focus:!bg-green-600'
        }
        timeClassName={() => 'hover:!bg-green-500 hover:!text-white'}
      />
    </div>
  );
}
