/**
 * Página Dedicada: Gerenciar Pivôs
 *
 * Exibe:
 * - Estatísticas de Pivôs (Total, Ativos, Alarmados, Manutenção)
 * - Status de todos os pivôs do sistema
 * - Filtros por status
 */

import React, { useEffect, useState } from 'react';
import { useAuthStore, selectIsActiveUser } from '../../stores/new/authStore';
import Sidebar from '../../components/new/sidebar';
import BodyContent from '../../components/new/body';
import Header from '../../components/new/header';
import PermissionGuard from '../../components/new/PermissionGuard';
import PivosSection from '../../components/new/PivosSection';
import { useAdminStats } from '../../hooks/new/useAdminStats';

interface StatCard {
  label: string;
  value: number;
  subValue: string;
}

interface StatsSectionProps {
  cards: StatCard[];
  loading: boolean;
}

export function GerenciarPivosPage() {
  const authState = useAuthStore();
  const isActiveUser = selectIsActiveUser(authState);

  const {
    stats,
    loading: loadingStats,
    error: statsError,
    fetchStats,
  } = useAdminStats();

  useEffect(() => {
    if (isActiveUser) {
      fetchStats();
    }
  }, [isActiveUser]);

  return (
    <PermissionGuard allowedRoles={['admin']} requireActive>
      <div className="w-full h-full text-dashboard-text-primary flex bg-dashboard-bg-primary">
        <Sidebar />
        <BodyContent>
          <Header page="admin" />

          <div className="flex items-center justify-between px-4 mb-8">
            <h1 className="text-3xl font-bold">Pivôs</h1>
            <button
              onClick={() => {
                fetchStats();
              }}
              className="bg-dashboard-accent p-2 rounded-lg font-bold hover:bg-dashboard-accent-hover transition"
            >
              Atualizar
            </button>
          </div>

          {/* Erros globais */}
          {statsError && (
            <div className="mx-4 mb-6 p-4 bg-red-900 border border-red-700 rounded-lg text-red-100">
              <p className="font-medium">Erro ao carregar dados:</p>
              <p className="text-sm">{statsError}</p>
            </div>
          )}

          {/* Stats Section */}
          <div className="px-4 mb-8">
            <StatsSection
              cards={[
                {
                  label: 'Total de Pivôs',
                  value: stats?.totalPivos || 0,
                  subValue: `${stats?.activePivos || 0} ativos`,
                },
                {
                  label: 'Pivôs Alarmados',
                  value: stats?.alarmadoPivos || 0,
                  subValue: `${stats?.maintenancePivos || 0} em manutenção`,
                },
              ]}
              loading={loadingStats}
            />
          </div>

          {/* Pivôs Section */}
          <div className="px-4 mb-8">
            <div className="bg-dashboard-bg-secondary rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-dashboard-text-primary mb-4">
                Monitoramento de Pivôs
              </h2>
              <PivosSection />
            </div>
          </div>
        </BodyContent>
      </div>
    </PermissionGuard>
  );
}

/**
 * Seção de Estatísticas
 */
function StatsSection({ cards, loading }: StatsSectionProps) {
  if (loading) {
    return (
      <div className="bg-dashboard-bg-secondary rounded-lg p-6 border border-dashboard-border">
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 bg-dashboard-bg-tertiary animate-pulse rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-dashboard-bg-secondary rounded-lg p-6 border border-dashboard-border hover:border-dashboard-accent transition-colors"
        >
          <p className="text-sm text-dashboard-text-secondary font-medium">{card.label}</p>
          <p className="text-4xl font-bold text-dashboard-text-primary mt-2">{card.value}</p>
          <p className="text-xs text-dashboard-text-tertiary mt-1">{card.subValue}</p>
        </div>
      ))}
    </div>
  );
}

export default GerenciarPivosPage;
