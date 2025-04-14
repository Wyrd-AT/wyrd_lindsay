import React from "react";
import BodyContent from "../components/body/index";
import Card from "../components/card";
import Header from "../components/header";
import SearchBar from "../components/searchbar";
import Sidebar from "../components/sidebar";

export default function HomePageRevenda() {
  // Cria um array de 18 itens para replicar o Card
  const cards = Array.from({ length: 18 });

  return (
    <div className="w-full h-screen text-white flex bg-[#313131]">
      <Sidebar />

      <BodyContent>
        <Header page="" />

        {/* Seção rolável com barra de rolagem personalizada */}
        <div
          className="
            flex 
            flex-wrap 
            p-4
            justify-around 
            max-h-[80vh]
            overflow-auto 
            scrollbar 
            scrollbar-thin 
            scrollbar-thumb-red-500 
            scrollbar-track-gray-800
          "
        >
          {cards.map((_, index) => (
            <a href="/maquina" key={index} className="w-1/4 m-4">
              <Card />
            </a>
          ))}
        </div>
      </BodyContent>

      <SearchBar />
    </div>
  );
}
