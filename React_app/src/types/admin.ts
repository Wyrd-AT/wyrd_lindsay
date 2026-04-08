/**
 * Tipos para o sistema administrativo
 */

export interface Revenda {
  id?: string;     // retornado pela API (FastAPI ignora chaves com _)
  doc_id?: string; // alias explícito sem underscore
  _id?: string;    // mantido por compatibilidade
  _rev?: string;
  type: "revenda";
  email: string;
  name: string;
  domain: string;
  status: "pending" | "active" | "rejected";
  created_at: string;
  cnpj?: string;
  cnpj_revenda?: string;
  cnpj_admin?: string;
}

export interface Cliente {
  id?: string;
  doc_id?: string;
  _id?: string;
  _rev?: string;
  type: "cliente";
  email: string;
  name: string;
  status: "pending" | "active" | "rejected";
  created_at: string;
  revenda_id?: string;
  documento?: string;
  cnpj_cliente?: string;
  cnpj_admin?: string;
  cnpj_revenda?: string;
  sub_role?: "superusuario" | "gerente" | "comum";
}

export interface Pivo {
  _id: string;
  _rev?: string;
  type: "pivo";
  name: string;
  status: "active" | "inactive" | "maintenance" | "alarmed";
  owner_id: string; // cliente_id
  created_at: string;
  last_data?: string;
}

export interface AdminStats {
  totalRevendas: number;
  activeRevendas: number;
  pendingRevendas: number;
  rejectedRevendas: number;
  totalClientes: number;
  activeClientes: number;
  pendingClientes: number;
  rejectedClientes: number;
  totalPivos: number;
  activePivos: number;
  alarmadoPivos: number;
  maintenancePivos: number;
}

export interface RevendaStats {
  totalClientes: number;
  activeClientes: number;
  pendingClientes: number;
  totalPivos: number;
  activePivos: number;
  alarmadoPivos: number;
}

export interface ClienteStats {
  totalPivos: number;
  activePivos: number;
  alarmadoPivos: number;
  maintenancePivos: number;
}
