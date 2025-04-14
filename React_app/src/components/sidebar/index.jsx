import React from "react";
import { BiHomeAlt } from "react-icons/bi";

function SideBar() {
  return (
    <div className="w-[100px] md:w-[100px] bg-[#444444] py-8 px-4 flex flex-col items-center">
      <img 
        src="/FieldNetLogo.png" 
        alt="FieldNet Logo" 
        width="150" 
        height="150" 
        className="mb-4"
      />
      <BiHomeAlt size={40} />
    </div>
  );
}

export default SideBar;
