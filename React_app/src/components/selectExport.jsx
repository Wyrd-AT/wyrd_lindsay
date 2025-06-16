import React, { useState, useEffect, useMemo } from "react";
import Select, { components } from "react-select";
import { IoMdDownload } from "react-icons/io";
import { FaRegEnvelope, FaTimes } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";

export default function SelectExport({
  machines = [],                // ["111111", "222222", ...]
  getDisplayName = (id) => id,  // função para exibir "IRRIGADOR X"
  onclick_details,
  onExport,
  onMessage,
  onMachineChange,
  redirectBase = "/maquina"
}) {
  const navigate = useNavigate();
  const location = useLocation();

  // 1) monta as opções com ID real como value, e displayName como label
  const options = useMemo(
  () =>
    machines
      .filter((id) => typeof id === "string" && id.trim() !== "") // 🧹 remove undefined, null ou string vazia
      .map((id) => ({
        value: id,
        label: getDisplayName(id) || `Irrigador ${id}` // fallback se função falhar
      })),
  [machines, getDisplayName]
);

  const [selectedOption, setSelectedOption] = useState(null);
  const [inputValue, setInputValue] = useState("");

  // 2) define valor inicial com base na URL
  useEffect(() => {
    if (!options.length) return;
    const last = location.pathname.split("/").pop();
    const match = options.find((o) => o.value === last);
    setSelectedOption(match || options[0]);
  }, [location.pathname, options]);

  // 3) onChange de seleção
  const handleChange = (opt) => {
    setSelectedOption(opt);
    onMachineChange?.(opt?.value || "");
    navigate(`${redirectBase}/${opt?.value}`);
  };

  // 4) Clear apenas o texto do input
  const ClearIndicator = (props) => {
    const {
      innerProps: { ref, ...restInner } = {}
    } = props;
    return (
      <components.ClearIndicator {...props}>
        <FaTimes
          {...restInner}
          ref={ref}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setInputValue("");
          }}
        />
      </components.ClearIndicator>
    );
  };

  return (
    <div className="w-full px-8 py-2 flex justify-between items-center bg-[#13131]">
      <div className="relative bg-gray-700 border-b border-gray-600 rounded flex-none w-56 items-center flex mr-4">
        <Select
          options={options}
          value={selectedOption}
          onChange={handleChange}
          inputValue={inputValue}
          onInputChange={(val, { action }) => {
            if (action === "input-change") setInputValue(val);
          }}
          isSearchable
          components={{ ClearIndicator }}
          placeholder="Selecione ou digite o irrigador…"
          styles={{
            container: base => ({ ...base, width: "100%" }),
            control: base => ({
              ...base,
              background: "transparent",
              border: "none",
              boxShadow: "none",
              minHeight: "auto",
              "&:hover": { border: "none" },
              cursor: "text",
              justifyContent: "space-between"
            }),
            valueContainer: base => ({
              ...base,
              padding: "0.25rem 1rem",
              overflow: "hidden",
              whiteSpace: "nowrap"
            }),
            singleValue: base => ({
              ...base,
              color: "#fff",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }),
            input: base => ({
              ...base,
              margin: 0,
              color: "#fff",
              padding: 0,
              flex: "1 1 0px",
              minWidth: 0
            }),
            option: (base, state) => ({
              ...base,
              background: state.isFocused ? "#3A4452" : "#4B5563",
              color: "#fff",
              cursor: "pointer",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }),
            dropdownIndicator: base => ({
              ...base,
              padding: "0 8px",
              color: "#fff"
            }),
            clearIndicator: base => ({
              ...base,
              padding: "0 8px",
              color: "#fff",
              cursor: "pointer"
            }),
            indicatorSeparator: () => ({ display: "none" }),
            menu: base => ({
              ...base,
              marginTop: 0,
              background: "#4B5563"
            })
          }}
        />
      </div>

      {/* botões de ação */}
      <div className="flex items-center gap-3">
        <button
          onClick={onExport}
          className="bg-gray-700 text-white text-sm font-medium px-4 py-1 border border-gray-600 rounded-full flex items-center gap-2 hover:bg-gray-600 transition"
        >
          <IoMdDownload />
        </button>
        <button
          onClick={onMessage}
          className="bg-gray-700 text-white text-sm font-medium px-4 py-1 border border-gray-600 rounded-full flex items-center gap-2 hover:bg-gray-600 transition"
        >
          <FaRegEnvelope size={16} />
        </button>
      </div>
    </div>
  );
}
