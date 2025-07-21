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
  selectedMachine,
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
  console.log((selectedMachine??[1])[0])

  return (
    <div className="w-full  py-2 flex justify-between items-center bg-[#13131]">
      <div className="relative bg-gray-700 border-b border-gray-600 rounded flex-none w-fit px-8 items-center flex text-center ">
        <div className="text-white">{getDisplayName((selectedMachine??[1])[0])}</div>
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
