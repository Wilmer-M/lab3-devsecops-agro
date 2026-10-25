import hmac
import json
import logging
import os
import socket
import sqlite3
from fastapi import FastAPI, Header, HTTPException, Response
from prometheus_client import CONTENT_TYPE_LATEST, Counter, generate_latest

API_KEY = os.environ["API_KEY"]  # secreto: se inyecta, nunca va en el código
DB_PATH = os.getenv("DB_PATH", "/data/sistema.db")


class JsonFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps({
            "ts": self.formatTime(record),
            "nivel": record.levelname,
            "mensaje": record.getMessage(),
        })


handler = logging.StreamHandler()
handler.setFormatter(JsonFormatter())
log = logging.getLogger("servicio")
log.addHandler(handler)
log.setLevel(logging.INFO)

app = FastAPI(title="Servicio AgroSmart - Monitoreo de Suelo")
PETICIONES = Counter(
    "peticiones_total", "Peticiones por ruta y codigo", ["ruta", "codigo"]
)


@app.get("/health")
def health():
    return {"estado": "ok"}


@app.get("/api/resumen")
def resumen(x_api_key: str = Header(default="")):
    if not hmac.compare_digest(x_api_key, API_KEY):
        PETICIONES.labels("/api/resumen", "401").inc()
        log.warning("acceso no autorizado a /api/resumen")
        raise HTTPException(status_code=401, detail="No autorizado")

    con = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    try:
        total = con.execute("SELECT COUNT(*) FROM lecturas_suelo").fetchone()[0]
    finally:
        con.close()

    PETICIONES.labels("/api/resumen", "200").inc()
    log.info("resumen consultado")
    return {"total_registros": total, "instancia": socket.gethostname()}


@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
