#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HistoryService — consultas de histórico no CouchDB (tensão, SW, eventos, alertas)
"""

import math
from typing import Any, Dict, List, Optional

import couchdb


class HistoryService:
    def __init__(self, db: couchdb.Database):
        self.db = db

    # ------------------------------------------------------------------ #
    # Helpers internos
    # ------------------------------------------------------------------ #

    def _build_ts_filter(self, selector: Dict, start_ts: Optional[str], end_ts: Optional[str]) -> None:
        """Adiciona filtro de timestamp ao selector Mango (in-place)."""
        if start_ts or end_ts:
            ts: Dict[str, str] = {}
            if start_ts:
                ts["$gte"] = start_ts
            if end_ts:
                ts["$lte"] = end_ts
            selector["timestamp"] = ts

    def _run_find(self, query: Dict) -> List[Dict]:
        """Executa db.find() e retorna lista de documentos."""
        result = self.db.find(query)
        return list(result)

    def _count_docs(self, selector: Dict) -> int:
        """Conta documentos sem buscar todos os campos (fields=["_id"])."""
        result = self._run_find({
            "selector": selector,
            "fields": ["_id"],
            "limit": 100_000,
        })
        return len(result)

    def _aggregate_tension(self, points: List[Dict], max_points: int) -> List[Dict]:
        """
        Downsample por bucket — escolhe o elemento do meio de cada grupo.
        Preserva dados reais sem interpolação.
        """
        if len(points) <= max_points:
            return points
        step = math.ceil(len(points) / max_points)
        result = []
        for i in range(0, len(points), step):
            group = points[i : i + step]
            mid = group[len(group) // 2]
            result.append(mid)
        return result

    # ------------------------------------------------------------------ #
    # Tensão
    # ------------------------------------------------------------------ #

    def _query_tension_tipo(
        self,
        irrigador_id: str,
        tipo: str,
        start_ts: Optional[str],
        end_ts: Optional[str],
    ) -> List[Dict]:
        selector: Dict[str, Any] = {
            "table": "tensao_raw",
            "irrigadorId": irrigador_id,
            "tipo": tipo,
        }
        self._build_ts_filter(selector, start_ts, end_ts)
        return self._run_find({
            "selector": selector,
            "sort": [{"timestamp": "asc"}],
            "use_index": "idx_tensao_raw_irrigador_tipo_ts",
            "limit": 100_000,
        })

    def get_tension_history(
        self,
        irrigador_id: str,
        tipo: Optional[str],
        start_ts: Optional[str],
        end_ts: Optional[str],
        max_points: int = 1000,
    ) -> Dict:
        if not tipo or tipo == "both":
            points_a = self._query_tension_tipo(irrigador_id, "A", start_ts, end_ts)
            points_b = self._query_tension_tipo(irrigador_id, "B", start_ts, end_ts)
            points = sorted(points_a + points_b, key=lambda p: p.get("timestamp", ""))
        else:
            points = self._query_tension_tipo(irrigador_id, tipo, start_ts, end_ts)

        total_raw = len(points)
        aggregated_points = self._aggregate_tension(points, max_points)
        return {
            "points": aggregated_points,
            "total_raw": total_raw,
            "aggregated": len(aggregated_points) < total_raw,
        }

    # ------------------------------------------------------------------ #
    # Eventos
    # ------------------------------------------------------------------ #

    def get_events_history(
        self,
        irrigador_id: str,
        event_type: Optional[str],
        start_ts: Optional[str],
        end_ts: Optional[str],
        skip: int,
        limit: int,
    ) -> Dict:
        selector: Dict[str, Any] = {
            "table": "events",
            "irrigadorId": irrigador_id,
        }
        if event_type:
            selector["eventType"] = event_type
        self._build_ts_filter(selector, start_ts, end_ts)

        count_selector = dict(selector)
        total = self._count_docs(count_selector)

        items = self._run_find({
            "selector": selector,
            "sort": [{"timestamp": "desc"}],
            "use_index": "idx_events_irrigador_eventType_ts",
            "limit": limit,
            "skip": skip,
        })
        return {"total": total, "skip": skip, "limit": limit, "items": items}

    # ------------------------------------------------------------------ #
    # SW
    # ------------------------------------------------------------------ #

    def get_sw_history(
        self,
        irrigador_id: str,
        start_ts: Optional[str],
        end_ts: Optional[str],
        skip: int,
        limit: int,
    ) -> Dict:
        selector: Dict[str, Any] = {
            "table": "sw_raw",
            "irrigadorId": irrigador_id,
        }
        self._build_ts_filter(selector, start_ts, end_ts)

        items = self._run_find({
            "selector": selector,
            "sort": [{"timestamp": "desc"}],
            "use_index": "idx_sw_raw_irrigador_ts",
            "limit": limit,
            "skip": skip,
        })
        return {"skip": skip, "limit": limit, "items": items}

    # ------------------------------------------------------------------ #
    # Alertas (eventos sem filtro de tipo)
    # ------------------------------------------------------------------ #

    def get_alerts_history(
        self,
        irrigador_id: str,
        start_ts: Optional[str],
        end_ts: Optional[str],
        skip: int,
        limit: int,
        monitor: Optional[str] = None,
    ) -> Dict:
        selector: Dict[str, Any] = {
            "table": "events",
            "irrigadorId": irrigador_id,
        }
        if monitor is not None:
            selector["monitor"] = monitor
        self._build_ts_filter(selector, start_ts, end_ts)

        total = self._count_docs(dict(selector))
        items = self._run_find({
            "selector": selector,
            "sort": [{"timestamp": "desc"}],
            "use_index": "idx_events_irrigador_eventType_ts",
            "limit": limit,
            "skip": skip,
        })
        return {"total": total, "skip": skip, "limit": limit, "items": items}
