#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para inspecionar a estrutura real de um documento de irrigador
"""

import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import couchdb
from app.core.config import settings

# Conectar
server = couchdb.Server(settings.COUCHDB_URL)
db = server[settings.COUCHDB_DB]

# Buscar um irrigador
result = db.find({"selector": {"table": "irrigadores"}, "limit": 1})
irrigadores = list(result)

if irrigadores:
    print("Estrutura de um documento de irrigador:")
    print("=" * 80)
    print(json.dumps(irrigadores[0], indent=2, ensure_ascii=False))
else:
    print("Nenhum irrigador encontrado")
