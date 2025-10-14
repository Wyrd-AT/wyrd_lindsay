import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import mqtt from "mqtt";

const MQTTContext = createContext();

export function MQTTProvider({
  children,
  brokerUrl = "ws://localhost:9001",
  options = {},
}) {
  const defaultOptions = {
    clientId: `reactApp_${Math.random().toString(16).substring(2, 8)}`,
    clean: true,
    reconnectPeriod: 1000,
    connectTimeout: 30 * 1000,
    ...options,
  };

  const [client, setClient] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [messages, setMessages] = useState({});
  const [isConnected, setIsConnected] = useState(false);

  const clientRef = useRef(null);

  useEffect(() => {
    console.log("Iniciando conexão MQTT no Provider...");
    setConnectionStatus("connecting");

    const mqttClient = mqtt.connect(brokerUrl, defaultOptions);
    setClient(mqttClient);
    clientRef.current = mqttClient;

    mqttClient.on("connect", () => {
      console.log("MQTT Provider: Conectado!");
      setConnectionStatus("connected");
      setIsConnected(true);
    });

    mqttClient.on("disconnect", () => {
      console.log("MQTT Provider: Desconectado");
      setConnectionStatus("disconnected");
      setIsConnected(false);
    });

    mqttClient.on("error", (err) => {
      console.error("MQTT Provider: Erro de conexão:", err);
      setConnectionStatus("error");
      setIsConnected(false);
    });

    mqttClient.on("reconnect", () => {
      console.log("MQTT Provider: Reconectando...");
      setConnectionStatus("reconnecting");
      setIsConnected(false);
    });

    mqttClient.on("offline", () => {
      console.log("MQTT Provider: Offline");
      setConnectionStatus("offline");
      setIsConnected(false);
    });

    mqttClient.on("message", (topic, message) => {
      try {
        const payload = message.toString();
        console.log(
          `MQTT Provider: Mensagem recebida em '${topic}' -> '${payload}'`,
        );

        setMessages((prev) => ({
          ...prev,
          [topic]: {
            payload,
            timestamp: Date.now(),
          },
        }));
      } catch (error) {
        console.error("MQTT Provider: Erro ao processar mensagem:", error);
      }
    });

    return () => {
      console.log("MQTT Provider: Finalizando conexão...");
      if (mqttClient) {
        mqttClient.end(true);
      }
    };
  }, [brokerUrl]);

  const publish = useCallback((topic, payload, options = {}) => {
    const defaultPublishOptions = { qos: 1, retain: false, ...options };

    return new Promise((resolve, reject) => {
      if (!clientRef.current || !clientRef.current.connected) {
        const error = new Error(
          "Cliente não conectado. Não foi possível publicar.",
        );
        console.error("MQTT Provider:", error.message);
        reject(error);
        return;
      }

      clientRef.current.publish(
        topic,
        payload,
        defaultPublishOptions,
        (error) => {
          if (error) {
            console.error("MQTT Provider: Falha na publicação:", error);
            reject(error);
          } else {
            console.log(
              `MQTT Provider: Publicado em '${topic}' -> '${payload}'`,
            );
            resolve();
          }
        },
      );
    });
  }, []);

  const subscribe = useCallback((topic, options = {}) => {
    const defaultSubscribeOptions = { qos: 1, ...options };

    return new Promise((resolve, reject) => {
      if (!clientRef.current || !clientRef.current.connected) {
        const error = new Error(
          "Cliente não conectado. Não foi possível se inscrever.",
        );
        console.error("MQTT Provider:", error.message);
        reject(error);
        return;
      }

      clientRef.current.subscribe(
        topic,
        defaultSubscribeOptions,
        (error, granted) => {
          if (error) {
            console.error(
              `MQTT Provider: Falha ao inscrever em '${topic}':`,
              error,
            );
            reject(error);
          } else {
            console.log(
              `MQTT Provider: Inscrito em '${topic}' com QoS ${granted[0].qos}`,
            );
            resolve(granted);
          }
        },
      );
    });
  }, []);

  const value = {
    client,
    connectionStatus,
    isConnected,
    messages,
    publish,
    subscribe,
  };

  return <MQTTContext.Provider value={value}>{children}</MQTTContext.Provider>;
}

export function useMQTT() {
  const context = useContext(MQTTContext);
  if (!context) {
    throw new Error("useMQTT deve ser usado dentro de um MQTTProvider");
  }
  return context;
}
