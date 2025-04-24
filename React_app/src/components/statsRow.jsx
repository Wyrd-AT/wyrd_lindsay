// novo componente de estatísticas mockadas
function StatsRow() {
    return (
      <div className="flex flex-wrap justify-center gap-6 px-6 mb-8">
        {/** Card genérico segue layout 234×116 */}
        <div className="relative w-[234px] h-[116px] bg-[rgba(128,128,128,0.55)] shadow-lg rounded-lg">
          <p className="absolute top-4 left-4 text-sm font-normal">INSTALAÇÃO</p>
          <p className="absolute top-10 left-4 text-2xl font-bold">21/03/2024</p>
        </div>
        <div className="relative w-[234px] h-[116px] bg-[rgba(128,128,128,0.55)] shadow-lg rounded-lg">
          <p className="absolute top-4 left-4 text-sm font-normal">Última manutenção</p>
          <p className="absolute top-10 left-4 text-2xl font-bold">02/02/2025</p>
        </div>
        <div className="relative w-[234px] h-[116px] bg-[rgba(128,128,128,0.55)] shadow-lg rounded-lg">
          <p className="absolute top-4 left-4 text-sm font-normal">Total de Alertas</p>
          <p className="absolute top-10 left-4 text-3xl font-bold">21</p>
          <div className="absolute bottom-4 left-4 flex items-center gap-2 text-xs font-light">
            <span className="inline-block w-2 h-2 bg-white rounded-full" />
            <span>25,5% no último mês</span>
          </div>
        </div>
        <div className="relative w-[234px] h-[116px] bg-[rgba(128,128,128,0.55)] shadow-lg rounded-lg">
          <p className="absolute top-4 left-4 text-sm font-normal">Tempo de resposta</p>
          <p className="absolute top-10 left-4 text-3xl font-bold">1h</p>
          <div className="absolute bottom-4 left-4 flex items-center gap-2 text-xs font-light">
            <span className="inline-block w-2 h-2 bg-white rounded-full" />
            <span>15,5% no último mês</span>
          </div>
        </div>
        <div className="relative w-[234px] h-[116px] bg-[rgba(128,128,128,0.55)] shadow-lg rounded-lg">
          <p className="absolute top-4 left-4 text-sm font-normal">Localização</p>
          <p className="absolute top-10 left-4 text-2xl font-bold">Fazenda A</p>
        </div>
      </div>
    );
  }

  export default StatsRow;