import requests
import re
from datetime import datetime
from zoneinfo import ZoneInfo
from typing import Any, Dict, List

BR_TZ = ZoneInfo("America/Sao_Paulo")

# --- mapa de status usado em monitorStatus ---
STATUS_MAP = {
    '0': 'OK',
    '1': 'Alarmado',
    '2': 'Reconhecido',
    '3': 'Resolvido',
    '4': 'Desconhecido',
    '5': 'Desconhecido',
    '6': 'Desconhecido',
    '7': 'Desconhecido',
    '8': 'Desconhecido',
    '9': 'Ausente',
}


def fmt_ts(dt: datetime) -> str:
    """
    Converte um datetime (naive ou aware) para fuso de Brasília,
    remove microssegundos e retorna ISO-format até os segundos.
    """
    # se for naive, assumimos que já veio em horário local de SP
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=BR_TZ)
    else:
        dt = dt.astimezone(BR_TZ)
    return dt.replace(microsecond=0).isoformat(timespec='seconds')


import re
from datetime import datetime
from typing import Any, Dict, List

def parse1_message(message: str) -> Dict[str, Any]:
    """
    Parse de duas formas de mensagem:
      1) monitorStatus (22 campos: irrigadorId;timestamp;20 códigos de status)
      2) tensao      ( 9 campos: irrigadorId+separador;timestamp;7 leituras de tensão)
    Retorna dict com:
      - type: 'monitorStatus' ou 'tensao'
      - irrigadorId: str
      - timestamp: str (formatado por fmt_ts)
      - status: List[Dict[str, Any]] (status ou leituras de tensão)
    """
    parts = message.strip().split(';')

    # --- Caso 1: monitorStatus (22 campos) ---
    if len(parts) == 22:
        irrigador_id, raw_ts, *status_codes = parts
        
        # Timestamp
        ts_iso = raw_ts.replace(' ', 'T')
        try:
            timestamp = datetime.fromisoformat(ts_iso)
        except ValueError:
            raise ValueError(f"Timestamp inválido: {raw_ts!r}")

        # Validação de códigos de status (digits múltiplos)
        if not all(re.fullmatch(r'\d+', code) for code in status_codes):
            raise ValueError(f"Códigos de status inválidos: {status_codes}")

        # Monta status de painéis (2 itens) e mototubos (18 itens)
        painel_status: List[Dict[str, Any]] = [
            {'painel': i + 1, 'status': STATUS_MAP.get(code, 'Desconhecido')}
            for i, code in enumerate(status_codes[:2])
        ]
        mt_status: List[Dict[str, Any]] = [
            {'mt':    i + 1, 'status': STATUS_MAP.get(code, 'Desconhecido')}
            for i, code in enumerate(status_codes[2:])
        ]

        return {
            'type': 'monitorStatus',
            'irrigadorId': irrigador_id,
            'timestamp': fmt_ts(timestamp),
            'status': painel_status + mt_status
        }

    # --- Caso 2: tensao (9 campos) ---
    elif len(parts) == 9:
        irrigador_id_separador, raw_ts, *tensoes = parts

        # Separa ID e letra A/B
        if len(irrigador_id_separador) < 2:
            raise ValueError(f"irrigadorId inválido: {irrigador_id_separador!r}")
        irrigador_id = irrigador_id_separador[:-1]
        separador    = irrigador_id_separador[-1]

        # Timestamp
        ts_iso = raw_ts.replace(' ', 'T')
        try:
            timestamp = datetime.fromisoformat(ts_iso)
        except ValueError:
            raise ValueError(f"Timestamp inválido: {raw_ts!r}")

        # Define número inicial do MT conforme A → 1, B → 8
        if   separador == 'A':
            start_mt = 1
        elif separador == 'B':
            start_mt = 8
        else:
            raise ValueError(f"Separador inválido: {separador!r}")

        # Validação de tensões (float)
        if not all(re.fullmatch(r'\d+(\.\d+)?', t) for t in tensoes):
            raise ValueError(f"Tensões inválidas: {tensoes}")

        # Monta lista de leituras de tensão
        mt_statuses: List[Dict[str, Any]] = []
        for idx, t in enumerate(tensoes):
            voltage_status =t
            voltage = float(voltage_status[:-1])
            status_index = voltage_status[-1]
            status = STATUS_MAP.get(status_index, 'Desconhecido')
            mt_number = start_mt + idx
            mt_statuses.append({
                'mt':      mt_number,
                'voltage': voltage,
                'status':status
            })

        return {
            'type': 'tensao',
            'irrigadorId': irrigador_id,
            'timestamp': fmt_ts(timestamp),
            'status': mt_statuses
        }
    
    elif len(parts) == 3 and re.fullmatch(r'[AE]\d+', parts[2]):
        irrigador_id, raw_ts,ev = parts
        return {
            'type': 'event',
            'irrigadorId': irrigador_id,
            'timestamp': fmt_ts(raw_ts),
            'eventType': 'alarme' if ev[0] == 'A' else 'evento',
            'eventCode': ev[1:],
            'status': 'Não resolvido',
            'description': 'Sem descrição',  # você pode modificar isso mais tarde com informações adicionais
            'responsible': 'A definir',  # também pode ser alterado conforme o caso
            'notifications': {
                'WhatsApp': False,
                'E-mail': False,
                'SMS': False,
                'Ligação': False,
            },
            'snooze_time': None,  # isso pode ser ajustado conforme a lógica
            'snooze_until': None  # ajusta o horário da soneca
        }

    # 3) command simples: exatamente 2 partes e a segunda é só letras
    if len(parts) == 2 and re.fullmatch(r"[A-Za-z]+", parts[1]):
        return {
            'type': 'command',
            'irrigadorId': irrigador_id,
            'command': parts[1].replace("'", ""),
            'timestamp': fmt_ts(timestamp)
        }


    # Qualquer outro comprimento é inválido
    else:
        raise ValueError(f"Número de campos inesperado: {len(parts)} (esperado 22 ou 9)")
  
        