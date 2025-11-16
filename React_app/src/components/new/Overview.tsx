// app/(pivo)/[pivoId]/overview.tsx
import React, { useEffect, useMemo, useState } from 'react';


// 👉 dados: usar as funções que fizemos
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { useIrrigadores } from '../../stores/new/dataStoreIrrigadores';
import useMessageStore from '../../stores/new/messageStore';
import { getRecentAll, RecentSWDoc, RecentTensaoDoc } from '../../hooks/new/getRecent';
import { useAuthStore } from '../../stores/new/authStore';
import { StatusCard } from './statusCard';
import StatusAlarmModal from './statusAlarmModal';
import { DeviceCard, Irrigador, monitoresToVoltageMap, OverviewProps, parseBrToMs, parseSwVectorOverview, sendCommand } from '../../helpers/helperOverview';





const SW_UPDATE_DELAY_MS = 10000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Overview({ pivoId }: OverviewProps) {
    const navigate = useNavigate();


    const { isAuthenticated, user } = useAuthStore();
    useEffect(() => {
        if (!isAuthenticated) {
            navigate("/login");
        }
    }, [isAuthenticated, navigate]);


    const email = user?.email ?? '';
    const domainAndTld = email.split('@')[1] ?? '';
    const companyId = domainAndTld.split('.')[0] ?? '';
    const [isOpen, setIsOpen] = useState(true);
    const [activeCard, setActiveCard] = useState(null);


    const [loading, setLoading] = useState(false);
    const [responseMsg, setResponseMsg] = useState('');
    const [localManOverride, setLocalManOverride] = useState<null | boolean>(null);
    const [isSaving, setIsSaving] = useState(false);

    const irrigadores = useIrrigadores(companyId);

    /* ----------------- Carregar snapshots via getRecentAll ----------------- */
    const [swDoc, setSwDoc] = useState<RecentSWDoc | null>(null);
    const [tA, setTA] = useState<RecentTensaoDoc | null>(null);
    const [tB, setTB] = useState<RecentTensaoDoc | null>(null);
    const [loadingAny, setLoadingAny] = useState(false);
    const [errorAny, setErrorAny] = useState<string | null>(null);

    useEffect(() => {
        let alive = true;
        (async () => {
            if (!pivoId) return;
            setLoadingAny(true);
            setErrorAny(null);
            try {
                const all = await getRecentAll('lindsay-data', String(pivoId));
                if (!alive) return;
                setSwDoc(all.sw ?? null);
                setTA(all.tensao.A ?? null);
                setTB(all.tensao.B ?? null);
            } catch (e: any) {
                if (alive) setErrorAny(e?.message ?? 'Falha ao carregar snapshots recentes');
            } finally {
                if (alive) setLoadingAny(false);
            }
        })();
        return () => { alive = false; };
    }, [pivoId]);

    const parsed_sw = useMemo(() => parseSwVectorOverview(swDoc?.data), [swDoc]);

    const lastUpdate = useMemo(() => {
        // tenta SW.updated_at, depois SW.data.timestamp (ISO ou BR)
        if (swDoc?.updated_at) {
            const d = new Date(swDoc.updated_at);
            if (!isNaN(d.getTime())) {
                return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
            }
        }
        const ts = swDoc?.data?.timestamp;
        if (ts) {
            // se for ISO, Date.parse funciona; se for BR, usa parseBrToMs
            const msISO = Date.parse(ts);
            const ms = Number.isNaN(msISO) ? parseBrToMs(ts) : msISO;
            if (!Number.isNaN(ms)) {
                return new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
            }
        }
        return '—';
    }, [swDoc]);

    const selectedDoc = useMemo<Irrigador | undefined>(
        () => (irrigadores as Irrigador[]).find((doc) => String(doc.codigo) === String(pivoId)),
        [irrigadores, pivoId]
    );

    if (!selectedDoc) {
        return (
            <div style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#313131' }}>
                <p style={{ color: '#fff' }}>Carregando dados da máquina...</p>
            </div>
        );
    }

    /* ----------------- Tensão: média de A e B por monitor ----------------- */
    const voltA = useMemo(() => monitoresToVoltageMap(tA || undefined), [tA]);
    const voltB = useMemo(() => monitoresToVoltageMap(tB || undefined), [tB]);

    const tensionValues = useMemo(() => {
        const N = parsed_sw?.monitores?.length ?? 0;
        const out: (number | null)[] = Array.from({ length: N }, () => null);

        for (let mt = 1; mt <= N; mt++) {
            const a = voltA.get(mt);
            const b = voltB.get(mt);
            const val =
                Number.isFinite(a as number) && Number.isFinite(b as number) ? ((a as number) + (b as number)) / 2
                    : Number.isFinite(a as number) ? (a as number)
                        : Number.isFinite(b as number) ? (b as number)
                            : null;

            if (val == null) continue;
            const idx = mt - 1;
            if (idx >= 0 && idx < N) out[idx] = val;
        }
        return out;
    }, [voltA, voltB, parsed_sw?.monitores?.length]);

    /* ----------------- manutenção & nomes ----------------- */
    const isInMaintenance = useMemo(
        () => (localManOverride !== null ? localManOverride : parsed_sw?.status_manutencao === '1'),
        [localManOverride, parsed_sw]
    );

    const equipamentoNames = useMemo(() => {
        const arr = Array.isArray(selectedDoc.equipamentos) ? selectedDoc.equipamentos : [];
        if (arr.length >= 2) return arr;
        return ['Painel 1', 'Painel 2'];
    }, [selectedDoc.equipamentos]);

    /* ----------------- cards ----------------- */
    const cards: DeviceCard[] = useMemo(() => {
        if (!parsed_sw) return [];

        const base: DeviceCard[] = [
            { id: 'painel-1', title: equipamentoNames[0] ?? 'Painel 1', statuses: [{ label: 'status', value: parsed_sw.painel_1 }] },
            { id: 'painel-2', title: equipamentoNames[1] ?? 'Painel 2', statuses: [{ label: 'status', value: parsed_sw.painel_2 ?? parsed_sw.painel_1 }] },
        ];

        // para monitores além dos 2 painéis, use os nomes extras de equipamentos
        const dynamics: DeviceCard[] = (equipamentoNames.slice(2)).map((name, i) => {
            const m = parsed_sw.monitores?.[i];
            const tVal = tensionValues[i];

            if (!m) {
                return { id: `${name}-${i}`, title: name, statuses: [{ label: 'status', value: '9' }] }; // Ausente
            }

            return {
                id: `${name}-${i}`,
                title: name,
                statuses: [
                    { label: 'SW1', value: m.statusSw1 },
                    { label: 'SW2', value: m.statusSw2 },
                    { label: 'Falha por tensão', value: m.armadilha },
                    { label: 'Tensão SW', value: m.statusTensao },
                    ...(Number.isFinite(tVal as number) ? [{ label: 'Tensão (V)', value: (tVal as number).toFixed(2) }] : []),
                ],
            };
        });

        return [...base, ...dynamics].filter((card) => card.title !== 'Ausente');
    }, [equipamentoNames, parsed_sw, tensionValues]);

    /* ----------------- ações & modal (inalterado) ----------------- */
    const handleSolicitarStatus = () => {
        try {
        sendCommand('sw', 'Status solicitado com sucesso!', 'Falha ao solicitar status.', pivoId, setResponseMsg, setLoading, loading);
        } finally {
            setIsSaving(false);
        }}
    const handleSirene = async () => {
        try {
            await sendCommand('sirene', 'Sirene disparada com sucesso!', 'Falha ao disparar sirene.', pivoId, setResponseMsg, setLoading, loading);
        } finally {
            setIsSaving(false);
        }
        sendCommand('sirene', 'Sirene disparada com sucesso!', 'Falha ao disparar sirene.', pivoId, setResponseMsg, setLoading, loading);
    }
    const handleToggleManutencao = async () => {
        const current = isInMaintenance;
        const next = !current;
        setLocalManOverride(next);
        setIsSaving(true);
        try {
            await sendCommand('man', 'Modo alternado!', 'Falha ao alternar.', pivoId, setResponseMsg, setLoading, loading);
        } catch {
            setLocalManOverride(current);
        } finally {
            setIsSaving(false);
        }
    };




    return (
        <>
            <details
                className="bg-[#222] text-white p-4 rounded-md w-full mt-4"
                open={isOpen}
                onToggle={(e) => setIsOpen(e.target.open)}
            >
                <summary
                    className="flex items-center justify-between cursor-pointer font-semibold text-lg mb-2 select-none"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center gap-2">
                        <span className="uppercase">Status de Alarmes</span>
                        {/* BOTÃO TOGGLE: Desativar/Reativar Geral */}
                        <div className="flex items-center gap-3">
                            {/* SWITCH */}
                            <span className="group relative select-none uppercase">
                                {loading || isSaving
                                    ? "Enviando..."
                                    : isInMaintenance
                                        ? ": Em Manutenção"
                                        : ": Monitorando"}


                            </span>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={isInMaintenance}
                                aria-label="Alternar manutenção geral"
                                onClick={handleToggleManutencao}
                                disabled={loading || isSaving}
                                // ⬇️ adicionei "group"
                                className={clsx(
                                    "group relative inline-flex h-6 w-12 flex-shrink-0 cursor-pointer rounded-full transition-colors",
                                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-400",
                                    "disabled:cursor-not-allowed disabled:opacity-60",
                                    isInMaintenance ? "bg-red-600 hover:bg-red-700" : "bg-gray-600 hover:bg-gray-700"
                                )}
                                // fallback nativo (opcional)
                                title={
                                    loading || isSaving
                                        ? "…"
                                        : isInMaintenance
                                            ? "Clique se deseja voltar a monitorar"
                                            : "Clique se deseja entrar em modo de manutenção"
                                }
                                // liga o botão ao tooltip para leitores de tela
                                aria-describedby="tip-switch"
                            >
                                <span
                                    aria-hidden="true"
                                    className={clsx(
                                        "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition",
                                        isInMaintenance ? "translate-x-7" : "translate-x-1"
                                    )}
                                />

                                {/* Tooltip */}
                                <span
                                    id="tip-switch"
                                    role="tooltip"
                                    aria-hidden="true"
                                    className={clsx(
                                        "pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2",
                                        "whitespace-nowrap rounded px-2 py-1 text-xs bg-black text-white",
                                        "opacity-0 transition",
                                        // ⬇️ mostra no hover e no foco via teclado
                                        "group-hover:opacity-100 group-focus-visible:opacity-100"
                                    )}
                                >
                                    {loading || isSaving
                                        ? "…"
                                        : isInMaintenance
                                            ? "Clique se deseja voltar a monitorar"
                                            : "Clique se deseja entrar em modo de manutenção"}
                                </span>
                            </button>


                            {/* RÓTULO DINÂMICO */}

                        </div>
                        <button
                            type="button"
                            onClick={handleSolicitarStatus}
                            disabled={loading || isSaving}
                            className="px-3 bg-green-600 hover:bg-green-700 rounded text-sm py-1 disabled:opacity-60"
                        >
                            {loading ? "..." : "Solicitar Status"}
                        </button>
                        <button
                            type="button"
                            onClick={handleSirene}
                            disabled={loading || isSaving}
                            className="px-3 bg-yellow-600 hover:bg-yellow-700 rounded text-sm py-1 disabled:opacity-60"
                        >
                            {loading ? "..." : "Disparar Sirene"}
                        </button>



                    </div>
                    {isOpen ? <FiChevronUp size={20} /> : <FiChevronDown size={20} />}
                </summary>

                {responseMsg && <div className="mt-2 text-sm">{responseMsg}</div>}

                {swDoc && (
                    <div className="mb-4 text-sm text-gray-300">
                        Última atualização carregada em:{" "}
                        {lastUpdate}
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                    {cards.map((c) => (
                        <StatusCard key={c.title} {...c} onClick={() => setActiveCard(c)} isInMaintenance={isInMaintenance} />
                    ))}
                </div>
            </details>

            {activeCard && (
                <StatusAlarmModal
                    isOpen={!!activeCard}
                    onClose={() => setActiveCard(null)}
                    selectedMachine={pivoId}
                    card={activeCard}
                />
            )}
        </>
    );
}
