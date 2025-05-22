// components/SelectExport.jsx
import React, { useState, useEffect, useMemo } from "react";
import Select, { components } from "react-select";
import { IoMdDownload } from "react-icons/io";
import { FaBolt, FaRegEnvelope, FaTimes } from "react-icons/fa";
import { FiAlertTriangle } from "react-icons/fi";
import { useNavigate, useLocation } from "react-router-dom";

export default function SelectExport({
  machines = [],           // ex. ["IRRIGADOR 1", ...]
  onclick_details,
  onExport,
  onAlarm,
  onTension,
  onMessage,
  onMachineChange,
  redirectBase = "/maquina"
}) {
  const navigate = useNavigate();
  const location = useLocation();

  // 1) monta as opções
  const options = useMemo(
    () => machines.map(m => ({ value: m, label: m })),
    [machines]
  );

  // 2) estado de seleção e de input text
  const [selectedOption, setSelectedOption] = useState(null);
  const [inputValue, setInputValue] = useState("");

  // 3) quando muda a rota ou a lista, define valor padrão
  useEffect(() => {
    if (!options.length) return;
    const last = location.pathname.split("/").pop();
    const match = options.find(
      o => o.value.replace(/^IRRIGADOR\s*/, "") === last
    );
    setSelectedOption(match || options[0]);
  }, [location.pathname, options]);

  // 4) onChange de seleção
  const handleChange = opt => {
    setSelectedOption(opt);
    onMachineChange?.(opt?.value || "");
    const machineId = (opt?.value || "").replace(/^IRRIGADOR\s*/, "");
    navigate(`${redirectBase}/${machineId}`);
  };

  // 5) custom ClearIndicator: só limpa o texto digitado, não a seleção
  const ClearIndicator = props => {
    const {
      innerProps: { ref, ...restInner } = {}
    } = props;
    return (
      <components.ClearIndicator {...props}>
        <FaTimes
          {...restInner}
          ref={ref}
          onMouseDown={e => {
            e.preventDefault();
            e.stopPropagation();
            // limpa apenas o texto digitado
            setInputValue("");
          }}
        />
      </components.ClearIndicator>
    );
  };

  return (
    <div className="w-full px-8 py-2 flex justify-between items-center bg-[#13131]">
      {/* wrapper igualzinho ao seu antigo, para manter bg-gray-700, border-b, rounded */}
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
          // não use isClearable – nós já temos o ClearIndicator customizado
          placeholder="Selecione ou digite o irrigador…"
          components={{ ClearIndicator }}
          styles={{
              // 1) faz o container do react-select preencher 100% do wrapper
              container: base => ({
                ...base,
                width: "100%",
              }),
              // 2) força o controle a distribuir espaço entre valor e ícones
              control: base => ({
                ...base,
                background: "transparent",
                border: "none",
                boxShadow: "none",
                minHeight: "auto",
                "&:hover": { border: "none" },
                cursor: "text",
                justifyContent: "space-between",  // seta sempre à direita
              }),
              // 3) esconde overflow e não quebra linha no valor
              valueContainer: base => ({
                ...base,
                padding: "0.25rem 1rem",
                overflow: "hidden",
                whiteSpace: "nowrap",
              }),
              singleValue: base => ({
                ...base,
                color: "#fff",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",            // título numa linha só
              }),
              input: base => ({
                ...base,
                margin: 0,
                color: "#fff",
                padding: 0,
                flex: "1 1 0px",
                minWidth: 0,                      // não deixa empurrar o container
              }),
              // 4) nas opções também só uma linha
              option: (base, state) => ({
                ...base,
                background: state.isFocused ? "#3A4452" : "#4B5563",
                color: "#fff",
                cursor: "pointer",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }),
              // 5) ícones
              dropdownIndicator: base => ({
                ...base,
                padding: "0 8px",
                color: "#fff",
              }),
              clearIndicator: base => ({
                ...base,
                padding: "0 8px",
                color: "#fff",
                cursor: "pointer",
              }),
              indicatorSeparator: () => ({ display: "none" }),
              menu: base => ({
                ...base,
                marginTop: 0,
                background: "#4B5563",
              }),
            }}
        />
      </div>

      {/* botões de ação */}
      <div className="flex items-center gap-3">
        <button
          onClick={onAlarm}
          className="bg-gray-700 text-white text-sm font-medium px-4 py-1 border border-gray-600 rounded-full flex items-center gap-2 hover:bg-gray-600 transition"
        >
          <FiAlertTriangle size={16} /> Alarme
        </button>
        <button
          onClick={onTension}
          className="bg-gray-700 text-white text-sm font-medium px-4 py-1 border border-gray-600 rounded-full flex items-center gap-2 hover:bg-gray-600 transition"
        >
          <FaBolt size={16} /> Tensão
        </button>
        <button
          onClick={onExport}
          className="bg-gray-700 text-white text-sm font-medium px-4 py-1 border border-gray-600 rounded-full flex items-center gap-2 hover:bg-gray-600 transition"
        >
          <IoMdDownload /> Exportar
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
