/**
 * Hook de Comandos - Integração FastAPI
 * ====================================
 *
 * Gerencia envio de comandos para irrigadores/pivôs
 *
 * Uso:
 *   const { sendCommand, commands, loading, error } = useCommandsAPI();
 *   await sendCommand(irrigadorId, 'start', { duration: 60 });
 */

import { useState, useCallback } from "react";
import { commands as commandsAPI } from "@/api/new/fastapi-api";

export interface Command {
  _id: string;
  irrigadorId: string;
  command: string;
  status: "pending" | "scheduled" | "published" | "cancelled";
  created_at: string;
  published?: boolean;
  timer_minutes?: number;
  [key: string]: any;
}

interface UseCommandsAPIReturn {
  // Enviar comandos
  sendCommand: (
    irrigadorId: string,
    command: string,
    params?: Record<string, any>,
    pivoId?: string,
    timerMinutes?: number,
  ) => Promise<any>;

  // Quick commands
  startPivo: (
    irrigadorId: string,
    pivoId: string,
    duration?: number,
    flowRate?: number,
  ) => Promise<any>;
  stopPivo: (irrigadorId: string, pivoId: string) => Promise<any>;
  pausePivo: (irrigadorId: string, pivoId: string) => Promise<any>;
  emergencyStop: (irrigadorId: string, pivoId: string) => Promise<any>;
  scheduleCommand: (
    irrigadorId: string,
    command: string,
    delayMinutes: number,
    params?: Record<string, any>,
  ) => Promise<any>;

  // Listar e gerenciar
  listCommands: (irrigadorId?: string, status?: string) => Promise<void>;
  getCommand: (commandId: string) => Promise<Command | null>;
  cancelCommand: (commandId: string) => Promise<any>;

  // State
  commands: Command[];
  lastCommand: Command | null;
  loading: boolean;
  error: string | null;
  clearError: () => void;
}

/**
 * Hook para gerenciar comandos da API
 */
export const useCommandsAPI = (): UseCommandsAPIReturn => {
  const [commands, setCommands] = useState<Command[]>([]);
  const [lastCommand, setLastCommand] = useState<Command | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCommand = useCallback(
    async (
      irrigadorId: string,
      command: string,
      params: Record<string, any> = {},
      pivoId: string = "",
      timerMinutes: number = 0,
    ) => {
      try {
        setLoading(true);
        setError(null);

        const result = await commandsAPI.sendCommand(
          irrigadorId,
          command,
          params,
          pivoId,
          timerMinutes,
        );

        setLastCommand(result);
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro desconhecido";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Quick commands
  const startPivo = useCallback(
    (irrigadorId: string, pivoId: string, duration = 60, flowRate = 80) => {
      return sendCommand(
        irrigadorId,
        "start",
        { duration, flow_rate: flowRate },
        pivoId,
      );
    },
    [sendCommand],
  );

  const stopPivo = useCallback(
    (irrigadorId: string, pivoId: string) => {
      return sendCommand(irrigadorId, "stop", {}, pivoId);
    },
    [sendCommand],
  );

  const pausePivo = useCallback(
    (irrigadorId: string, pivoId: string) => {
      return sendCommand(irrigadorId, "pause", {}, pivoId);
    },
    [sendCommand],
  );

  const emergencyStop = useCallback(
    (irrigadorId: string, pivoId: string) => {
      return sendCommand(irrigadorId, "emergency_stop", {}, pivoId);
    },
    [sendCommand],
  );

  const scheduleCommand = useCallback(
    (
      irrigadorId: string,
      command: string,
      delayMinutes: number,
      params: Record<string, any> = {},
    ) => {
      return sendCommand(irrigadorId, command, params, "", delayMinutes);
    },
    [sendCommand],
  );

  // Listar comandos
  const listCommands = useCallback(
    async (irrigadorId?: string, status?: string) => {
      try {
        setLoading(true);
        setError(null);

        const response = await commandsAPI.listCommands(irrigadorId, status);

        setCommands(response.commands || []);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro desconhecido";
        setError(message);
        console.error("❌ Erro ao carregar comandos:", message);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Obter comando específico
  const getCommand = useCallback(
    async (commandId: string): Promise<Command | null> => {
      try {
        setLoading(true);
        setError(null);

        const response = await commandsAPI.getCommand(commandId);
        return response.command || null;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro desconhecido";
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Cancelar comando
  const cancelCommand = useCallback(async (commandId: string) => {
    try {
      setLoading(true);
      setError(null);

      const result = await commandsAPI.cancelCommand(commandId);

      // Atualizar lista local
      setCommands((prev) =>
        prev.map((c) =>
          c._id === commandId ? { ...c, status: "cancelled" } : c,
        ),
      );

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    sendCommand,
    startPivo,
    stopPivo,
    pausePivo,
    emergencyStop,
    scheduleCommand,
    listCommands,
    getCommand,
    cancelCommand,
    commands,
    lastCommand,
    loading,
    error,
    clearError,
  };
};

export default useCommandsAPI;
