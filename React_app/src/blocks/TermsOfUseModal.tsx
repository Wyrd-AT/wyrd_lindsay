import React, { useState } from "react";
import { X } from "lucide-react";

interface TermsOfUseModalProps {
  onAccept: () => void;
  onReject: () => void;
}

const TermsOfUseModal: React.FC<TermsOfUseModalProps> = ({
  onAccept,
  onReject,
}) => {
  const [accepted, setAccepted] = useState(false);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-[#313131] rounded-lg p-8 w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-[#4ade80]">Termos de Uso</h2>
          <button
            onClick={onReject}
            className="text-gray-400 hover:text-gray-200 transition"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto mb-6 text-gray-300 text-sm space-y-4 pr-2">
          <section>
            <h3 className="text-[#4ade80] font-semibold mb-2">
              1. Sobre a Aplicação
            </h3>
            <p>
              O objetivo desta aplicação é exclusivamente emitir alertas sobre
              possíveis situações de risco ou anomalias detectadas. A plataforma
              funciona como um sistema de monitoramento e notificação para
              auxiliar na tomada de decisões.
            </p>
          </section>

          <section>
            <h3 className="text-[#4ade80] font-semibold mb-2">
              2. Limitação de Responsabilidade
            </h3>
            <p>
              <strong>
                A aplicação NÃO se responsabiliza por furtos, roubos ou qualquer
                outro tipo de prejuízo material ou pessoal.
              </strong>{" "}
              Os alertas emitidos são baseados em dados e padrões detectados e
              devem ser interpretados como avisos informativos, não como
              garantias de segurança.
            </p>
          </section>

          <section>
            <h3 className="text-[#4ade80] font-semibold mb-2">
              3. Uso da Plataforma
            </h3>
            <p>O usuário reconhece que:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>
                Os alertas são notificações informativas e não devem ser
                considerados como diagnósticos definitivos
              </li>
              <li>
                A responsabilidade por ações tomadas com base nos alertas é
                exclusivamente do usuário
              </li>
              <li>A aplicação não garante a precisão 100% dos alertas</li>
              <li>
                Deve-se sempre exercer bom senso e julgamento próprio ao
                interpretar os alertas
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-[#4ade80] font-semibold mb-2">
              4. Consentimento
            </h3>
            <p>
              Ao criar uma conta e usar esta aplicação, você concorda com todos
              os termos acima descritos.
            </p>
          </section>
        </div>

        <div className="space-y-4">
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="w-5 h-5 mt-1 accent-[#4ade80] cursor-pointer"
            />
            <span className="text-gray-400 text-sm">
              Eu li e concordo com os termos de uso acima *
            </span>
          </label>

          <div className="flex gap-3">
            <button
              onClick={onReject}
              className="flex-1 bg-gray-600 text-white py-2 px-4 rounded hover:bg-gray-700 transition font-medium"
            >
              Rejeitar
            </button>
            <button
              onClick={onAccept}
              disabled={!accepted}
              className="flex-1 bg-[#4ade80] text-white py-2 px-4 rounded hover:bg-[#36b55c] disabled:bg-gray-500 disabled:cursor-not-allowed transition font-medium"
            >
              Aceitar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsOfUseModal;
