import React from "react";


function CardText({ field, value }) {
  return (
    <div className="bg-[#444444] px-4 p-8 rounded-sm w-1/5 flex flex-col justify-center items-center">
      <div>
        <p className="text-xs">{field}</p>
        <h2 className="text-lg">{value}</h2>
      </div>
    </div>
  );
}

export default CardText;
