import { FiEdit, FiTrash } from "react-icons/fi";
import { FaRegImage } from "react-icons/fa";
import { FiAlertOctagon } from "react-icons/fi";

const Card = () => {
  return (
    <div className="w-full flex flex-col md:flex-row border-b m-4 justify-around bg-[#39393a]">
      <div className="w-full md:w-1/3 flex justify-center py-4">
        {/* Círculo branco com ícone */}
        <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white flex items-center justify-center">
          <FaRegImage className="text-gray-500" size={24} />
        </div>
      </div>
      <div className="w-full md:w-2/3 flex flex-col justify-center p-4">
        <div className="pb-4 w-full md:w-4/5">
          <div className="text-xs md:text-sm">NOME DO CLIENTE</div>
          <div className="text-xs md:text-sm">emaildo@cliente.com</div>
        </div>
        <div className="flex justify-end">
          <span className="bg-red-500 text-white text-sm md:text-base px-2 py-1 rounded-full flex items-center w-1/3 justify-between">
            <FiAlertOctagon />
            10
          </span>
        </div>
      </div>
    </div>
  );
};

export default Card;
