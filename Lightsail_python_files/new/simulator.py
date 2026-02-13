#!/usr/bin/env python3
"""
Simulador de envio de vetores de tensão e alertas via MQTT.

Formatos suportados:
- Vetor Tensão: LIND01A;2025-01-20T10:30:00;120.51;119.80;118.91;...
- Vetor Alerta/Evento: LIND01;2025-01-20T10:30:00;A011  (tipo A, monitor 01, estado 1 = alarmado)

Uso:
    python simulator.py --help
    python simulator.py tensao --irrigador LIND01 --tipo A
    python simulator.py alerta --irrigador LIND01 --monitor 01 --estado 1
    python simulator.py loop --irrigador LIND01 --intervalo 5
"""

import argparse
import json
import random
import time
from datetime import datetime
from zoneinfo import ZoneInfo

import paho.mqtt.client as mqtt
from dotenv import load_dotenv
import os

load_dotenv()

BR_TZ = ZoneInfo("America/Sao_Paulo")

# Configurações MQTT do .env ou defaults
MQTT_BROKER = os.getenv("MQTT_BROKER", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_TOPIC = os.getenv("MQTT_TOPIC", "lindsay/#")
MQTT_USERNAME = os.getenv("MQTT_USERNAME")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD")


def get_timestamp() -> str:
    """Retorna timestamp ISO formatado."""
    return datetime.now(BR_TZ).isoformat()


def gerar_vetor_tensao(irrigador_id: str, tipo: str, valores_custom: list = None) -> str:
    """
    Gera payload de vetor tensão.

    Args:
        irrigador_id: ID do irrigador (ex: LIND01)
        tipo: Tipo do vetor (A, B, C ou D)
        valores_custom: Lista opcional de tuplas (voltage, status) para cada monitor

    Returns:
        Payload no formato: LIND01A;2025-01-20T10:30:00;120.51;119.80;...

    Ranges de monitores por tipo:
        A: monitores 1-7
        B: monitores 8-14
        C: monitores 15-21
        D: monitores 22-28
    """
    if tipo not in ['A', 'B', 'C', 'D']:
        raise ValueError(f"Tipo inválido: {tipo}. Use A, B, C ou D.")

    timestamp = get_timestamp()

    # Gera 7 leituras por tipo
    leituras = []
    for i in range(7):
        if valores_custom and i < len(valores_custom):
            voltage, status = valores_custom[i]
        else:
            # Gera valores aleatórios realistas
            # Tensão normal: 110-130V, status 0 (OK)
            # Tensão baixa: 30-50V, status 1 (Alarmado)
            if random.random() < 0.1:  # 10% chance de tensão baixa
                voltage = round(random.uniform(30, 50), 1)
                status = 1
            else:
                voltage = round(random.uniform(110, 130), 1)
                status = 0

        # Formato: "120.51" (4 casas de voltagem + status)
        leituras.append(f"{voltage}{status}")

    # Monta payload
    payload = f"{irrigador_id}{tipo};{timestamp};" + ";".join(leituras)
    return payload


def gerar_vetor_sw(irrigador_id: str, monitores_custom: dict = None) -> str:
    """
    Gera payload de vetor SW (status/switches).

    Args:
        irrigador_id: ID do irrigador (ex: LIND01)
        monitores_custom: Dict opcional com dados por monitor

    Returns:
        Payload no formato: LIND01;2025-01-20T10:30:00;0;0;000;0000;0000;...
    """
    timestamp = get_timestamp()

    # Flags gerais
    painel_1 = random.choice([0, 1])
    painel_2 = random.choice([0, 1])
    lampada = random.choice([0, 1])
    sirene = random.choice([0, 1])
    manutencao = random.choice([0, 1])

    # Formato compacto: P1;P2;LSM;monitores...
    lsm = f"{lampada}{sirene}{manutencao}"

    # Gera 14 monitores (formato: FFAS - fim_curso_1, fim_curso_2, armadilha, status)
    monitores = []
    for i in range(14):
        if monitores_custom and f"monitor_{i+1:02d}" in monitores_custom:
            m = monitores_custom[f"monitor_{i+1:02d}"]
            token = f"{m['fim_de_curso_1']}{m['fim_de_curso_2']}{m['armadilha']}{m['status']}"
        else:
            # Valores aleatórios
            fc1 = random.choice([0, 1])
            fc2 = random.choice([0, 1])
            arm = random.choice([0, 1])
            status = random.choice([0, 1])
            token = f"{fc1}{fc2}{arm}{status}"
        monitores.append(token)

    payload = f"{irrigador_id};{timestamp};{painel_1};{painel_2};{lsm};" + ";".join(monitores)
    return payload


def gerar_evento_alerta(
    irrigador_id: str,
    tipo_evento: str = "A",
    monitor: str = "01",
    estado: str = "1",
    armadilha: str = ""
) -> str:
    """
    Gera payload de evento/alerta.

    Args:
        irrigador_id: ID do irrigador (ex: LIND01)
        tipo_evento: Tipo do evento (A=tensão, E=ausente, B=FC1, C=FC2, D=memória)
        monitor: Número do monitor (01-14, 17, 18)
        estado: Estado do alarme (0=OK, 1=Alarmado, 2=Reconhecido, 3=Resolvido, 9=Ausente)
        armadilha: Flag de armadilha (opcional)
            Payload no formato: EMBEST;2025-01-20T10:30:00;E171

    Returns:
        Payload no formato: LIND01;2025-01-20T10:30:00;A011
    """
    timestamp = get_timestamp()

    # Monta código do evento
    evento = f"{tipo_evento}{monitor}{estado}"
    if armadilha:
        evento += armadilha

    payload = f"{irrigador_id};{timestamp};{evento}"
    return payload


def criar_cliente_mqtt() -> mqtt.Client:
    """Cria e configura cliente MQTT."""
    client = mqtt.Client(client_id=f"simulator_{int(time.time())}", protocol=mqtt.MQTTv311)

    if MQTT_USERNAME and MQTT_PASSWORD:
        client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

    def on_connect(client, userdata, flags, rc):
        if rc == 0:
            print(f"[OK] Conectado ao broker MQTT {MQTT_BROKER}:{MQTT_PORT}")
        else:
            print(f"[ERRO] Falha ao conectar: rc={rc}")

    def on_publish(client, userdata, mid):
        print(f"[OK] Mensagem publicada (mid={mid})")

    client.on_connect = on_connect
    client.on_publish = on_publish

    return client


def publicar_mqtt(client: mqtt.Client, topic: str, payload: str, qos: int = 1):
    """Publica mensagem no MQTT."""
    result = client.publish(topic, payload, qos=qos)
    print(f"[INFO] Publicando em '{topic}':")
    print(f"       {payload}")
    return result


def cmd_tensao(args):
    """Comando para enviar vetor de tensão."""
    client = criar_cliente_mqtt()
    client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
    client.loop_start()
    time.sleep(1)  # Aguarda conexão

    # Gera valores customizados se especificados
    valores = None
    if args.baixa:
        # Simula tensão baixa em monitor específico
        valores = [(round(random.uniform(110, 130), 1), 0) for _ in range(7)]
        idx = int(args.baixa) - 1 if args.baixa.isdigit() else 0
        if 0 <= idx < 7:
            valores[idx] = (round(random.uniform(30, 45), 1), 1)

    payload = gerar_vetor_tensao(args.irrigador, args.tipo, valores)
    topic = f"lindsay/{args.irrigador}/tensao"

    publicar_mqtt(client, topic, payload)

    time.sleep(1)
    client.loop_stop()
    client.disconnect()
    print("[OK] Vetor de tensão enviado!")


def cmd_sw(args):
    """Comando para enviar vetor SW."""
    client = criar_cliente_mqtt()
    client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
    client.loop_start()
    time.sleep(1)

    payload = gerar_vetor_sw(args.irrigador)
    topic = f"lindsay/{args.irrigador}/sw"

    publicar_mqtt(client, topic, payload)

    time.sleep(1)
    client.loop_stop()
    client.disconnect()
    print("[OK] Vetor SW enviado!")


def cmd_alerta(args):
    """Comando para enviar evento/alerta."""
    client = criar_cliente_mqtt()
    client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
    client.loop_start()
    time.sleep(1)

    payload = gerar_evento_alerta(
        args.irrigador,
        tipo_evento=args.tipo,
        monitor=args.monitor,
        estado=args.estado,
        armadilha=args.armadilha or ""
    )
    topic = f"lindsay/{args.irrigador}/eventos"

    publicar_mqtt(client, topic, payload)

    time.sleep(1)
    client.loop_stop()
    client.disconnect()
    print("[OK] Evento/alerta enviado!")


def cmd_loop(args):
    """Comando para envio contínuo em loop."""
    client = criar_cliente_mqtt()
    client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
    client.loop_start()
    time.sleep(1)

    print(f"[INFO] Iniciando loop de simulação para {args.irrigador}")
    print(f"[INFO] Intervalo: {args.intervalo}s | Ctrl+C para parar")
    print("-" * 60)

    contador = 0
    tipos_tensao = ['A', 'B', 'C', 'D']

    try:
        while True:
            contador += 1

            # Alterna entre os tipos de vetor tensão
            tipo = tipos_tensao[contador % 4]

            # Envia vetor de tensão
            payload_tensao = gerar_vetor_tensao(args.irrigador, tipo)
            topic_tensao = f"lindsay/{args.irrigador}/tensao"
            publicar_mqtt(client, topic_tensao, payload_tensao)

            # A cada 4 ciclos, envia também um vetor SW
            if contador % 4 == 0:
                payload_sw = gerar_vetor_sw(args.irrigador)
                topic_sw = f"lindsay/{args.irrigador}/sw"
                publicar_mqtt(client, topic_sw, payload_sw)

            # A cada 10 ciclos, simula um alerta (10% chance)
            if contador % 10 == 0 and random.random() < 0.3:
                monitor = f"{random.randint(1, 14):02d}"
                payload_alerta = gerar_evento_alerta(
                    args.irrigador,
                    tipo_evento=random.choice(['A', 'E']),
                    monitor=monitor,
                    estado="1"
                )
                topic_alerta = f"lindsay/{args.irrigador}/eventos"
                publicar_mqtt(client, topic_alerta, payload_alerta)

            print(f"[INFO] Ciclo {contador} completo. Aguardando {args.intervalo}s...")
            print("-" * 60)
            time.sleep(args.intervalo)

    except KeyboardInterrupt:
        print("\n[INFO] Loop interrompido pelo usuário.")
    finally:
        client.loop_stop()
        client.disconnect()
        print("[OK] Desconectado.")


def cmd_batch(args):
    """Comando para envio em lote de múltiplos alertas."""
    client = criar_cliente_mqtt()
    client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
    client.loop_start()
    time.sleep(1)

    print(f"[INFO] Enviando {args.quantidade} alertas para {args.irrigador}")
    print("-" * 60)

    for i in range(args.quantidade):
        monitor = f"{(i % 14) + 1:02d}"
        payload = gerar_evento_alerta(
            args.irrigador,
            tipo_evento=args.tipo,
            monitor=monitor,
            estado=args.estado
        )
        topic = f"lindsay/{args.irrigador}/eventos"
        publicar_mqtt(client, topic, payload)

        if args.delay > 0:
            time.sleep(args.delay)

    time.sleep(1)
    client.loop_stop()
    client.disconnect()
    print(f"[OK] {args.quantidade} alertas enviados!")


def main():
    parser = argparse.ArgumentParser(
        description="Simulador de vetores de tensão e alertas Lindsay",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemplos:
  # Enviar vetor de tensão tipo A
  python simulator.py tensao --irrigador LIND01 --tipo A

  # Enviar vetor de tensão com monitor em baixa tensão
  python simulator.py tensao --irrigador LIND01 --tipo A --baixa 3

  # Enviar vetor SW
  python simulator.py sw --irrigador LIND01

  # Enviar alerta (monitor 01 alarmado)
  python simulator.py alerta --irrigador LIND01 --monitor 01 --estado 1

  # Enviar alerta de torre ausente
  python simulator.py alerta --irrigador LIND01 --tipo E --monitor 05 --estado 1

  # Loop contínuo a cada 5 segundos
  python simulator.py loop --irrigador LIND01 --intervalo 5

  # Enviar 10 alertas em lote
  python simulator.py batch --irrigador LIND01 --quantidade 10

Tipos de evento:
  A = Tensão baixa (<50V)
  B = Fim-de-curso 1 (SW1)
  C = Fim-de-curso 2 (SW2)
  D = Memória de tensão baixa
  E = Torre ausente

Estados:
  0 = OK
  1 = Alarmado
  2 = Reconhecido
  3 = Resolvido
  9 = Ausente
        """
    )

    subparsers = parser.add_subparsers(dest="comando", help="Comando a executar")

    # Subcomando: tensao
    parser_tensao = subparsers.add_parser("tensao", help="Enviar vetor de tensão")
    parser_tensao.add_argument("--irrigador", "-i", required=True, help="ID do irrigador (ex: LIND01)")
    parser_tensao.add_argument("--tipo", "-t", default="A", choices=['A', 'B', 'C', 'D'],
                               help="Tipo do vetor (A, B, C ou D)")
    parser_tensao.add_argument("--baixa", "-b", help="Índice do monitor para simular tensão baixa (1-7)")
    parser_tensao.set_defaults(func=cmd_tensao)

    # Subcomando: sw
    parser_sw = subparsers.add_parser("sw", help="Enviar vetor SW (status)")
    parser_sw.add_argument("--irrigador", "-i", required=True, help="ID do irrigador (ex: LIND01)")
    parser_sw.set_defaults(func=cmd_sw)

    # Subcomando: alerta
    parser_alerta = subparsers.add_parser("alerta", help="Enviar evento/alerta")
    parser_alerta.add_argument("--irrigador", "-i", required=True, help="ID do irrigador (ex: LIND01)")
    parser_alerta.add_argument("--tipo", "-t", default="A", choices=['A', 'B', 'C', 'D', 'E'],
                               help="Tipo do evento")
    parser_alerta.add_argument("--monitor", "-m", default="01", help="Número do monitor (01-14, 17, 18)")
    parser_alerta.add_argument("--estado", "-e", default="1", choices=['0', '1', '2', '3', '9'],
                               help="Estado do alarme")
    parser_alerta.add_argument("--armadilha", "-a", help="Flag de armadilha (opcional)")
    parser_alerta.set_defaults(func=cmd_alerta)

    # Subcomando: loop
    parser_loop = subparsers.add_parser("loop", help="Envio contínuo em loop")
    parser_loop.add_argument("--irrigador", "-i", required=True, help="ID do irrigador (ex: LIND01)")
    parser_loop.add_argument("--intervalo", "-n", type=float, default=5.0,
                             help="Intervalo entre envios em segundos")
    parser_loop.set_defaults(func=cmd_loop)

    # Subcomando: batch
    parser_batch = subparsers.add_parser("batch", help="Envio em lote de alertas")
    parser_batch.add_argument("--irrigador", "-i", required=True, help="ID do irrigador (ex: LIND01)")
    parser_batch.add_argument("--quantidade", "-q", type=int, default=10, help="Quantidade de alertas")
    parser_batch.add_argument("--tipo", "-t", default="A", choices=['A', 'B', 'C', 'D', 'E'],
                              help="Tipo do evento")
    parser_batch.add_argument("--estado", "-e", default="1", choices=['0', '1', '2', '3', '9'],
                              help="Estado do alarme")
    parser_batch.add_argument("--delay", "-d", type=float, default=0.5,
                              help="Delay entre envios em segundos")
    parser_batch.set_defaults(func=cmd_batch)

    args = parser.parse_args()

    if not args.comando:
        parser.print_help()
        return

    args.func(args)

if __name__ == "__main__":
    main()
