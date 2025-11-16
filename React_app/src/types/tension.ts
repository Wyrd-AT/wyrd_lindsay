/**
 * Tipos otimizados para dados de tensão
 * Elimina conversões string ↔ objeto desnecessárias
 */

export type TensionSide = 'A' | 'B' | 'C' | 'D';

export interface MonitorReading {
  voltage: number;
  status: 0 | 1 | 2 | 3 | 9; // 0=Normal, 1=Alerta, 2=Crítico, 3=Off, 9=Ausente
}

export interface TensionPoint {
  timestamp: Date;
  timestampMs: number; // Pre-computed para performance
  side: TensionSide;
  readings: MonitorReading[]; // Array ordenado de leituras
}

export interface MergedTensionPoint {
  timestamp: Date;
  timestampMs: number;
  values: number[]; // Array de tensões (NaN para valores ausentes)
}

export interface TensionDataset {
  points: MergedTensionPoint[];
  equipmentNames: string[];
  minVoltage: number;
  maxVoltage: number;
}

export type Period = 'last24h' | 'last7d' | 'last30d' | 'all';
