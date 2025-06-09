import { useContext } from "react";
import { BiSearch } from "react-icons/bi";
import { FiFilter } from "react-icons/fi";
import { SearchContext } from "../pages/homeClient";

function SearchBar() {
  const { searchTerm, setSearchTerm } = useContext(SearchContext);

  return (
    <div className="h-screen bg-[#444444] py-6 md:py-8 px-4 md:px-8 flex flex-col items-start">
      {/* Campo de pesquisa */}
      <div className="relative mb-6 w-full max-w-[400px]">
        <input
          type="text"
          placeholder="pesquise por um cliente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full py-2 pl-3 pr-10 rounded-md bg-[#333333] text-sm md:text-base placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        {/* Ícone de pesquisa no canto direito do input */}
        <BiSearch
          size={20}
          className="absolute right-3 top-2 md:top-2 text-green-500 cursor-pointer"
        />
      </div>

      {/* Filtros */}
      <div className="flex items-center text-sm md:text-base">
        <FiFilter size={20} />
        <div className="px-2">Filtros</div>
      </div>
    </div>
  );
}

export default SearchBar;
