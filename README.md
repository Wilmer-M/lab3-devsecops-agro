# LAB-TE2-03: DevSecOps y Arquitecturas Cloud-Native
**Sistema AgroSmart: Monitoreo Inteligente de Cultivos y Sensores IoT**  
*Facultad de Ingeniería de Sistemas Computacionales - Universidad Tecnológica de Panamá*  
*Asignatura: Tópicos Especiales 2*

---

## 📌 Descripción del Proyecto
Este repositorio implementa la automatización, contenerización y despliegue seguro del sistema **AgroSmart**, aplicando prácticas avanzadas de **DevSecOps** (desplazamiento de la seguridad a la izquierda) y principios **Cloud-Native** sobre un clúster local de Kubernetes (`kind`).

El sistema original (móvil y analítica de sensores agrícolas) se desacopla mediante un microservicio de consulta de datos (`servicio/app/main.py`) que expone endpoints protegidos para telemetría de suelo (`lecturas_suelo`), métricas operativas de Prometheus y sondas de salud.

---

## 🏗️ Estructura del Repositorio

```text
├── sistema/                        # Código original del sistema AgroSmart (React Native / Mock)
├── servicio/                       # Microservicio desacoplado (FastAPI)
│   ├── app/
│   │   └── main.py                 # API REST (/health, /api/resumen, /metrics)
│   ├── seed/
│   │   └── sistema.db              # Base de datos SQLite inicializada con datos ficticios
│   ├── requirements.txt            # Dependencias fijadas (fastapi, uvicorn, prometheus-client)
│   ├── Dockerfile                  # Contenedor endurecido (non-root, imagen slim, sin cache)
│   ├── docker-compose.yml          # Orquestación local con capacidades mínimas y read-only
│   ├── .dockerignore
│   └── .env.example
├── k8s/                            # Manifiestos declarativos de Kubernetes
│   ├── deployment.yaml             # Despliegue con 2 réplicas, sondas y límites de recursos
│   └── service.yaml                # Servicio NodePort (30080 -> 8000)
├── policy/                         # Políticas como código (Conftest / Open Policy Agent)
│   ├── docker/
│   │   └── dockerfile.rego         # Validación de imagen base, tags y directivas USER/ADD
│   └── k8s/
│       └── deployment.rego         # Validación de réplicas, sondas, límites y ServiceAccount
├── .github/
│   ├── workflows/
│   │   └── devsecops.yml           # Pipeline CI/CD endurecido con SHAs inmutables
│   └── dependabot.yml              # Actualizaciones automatizadas semanales
├── kind-config.yaml                # Configuración del clúster local kind
├── INFORME_LAB_TE2_03_DEVSECOPS.md # Informe técnico formal (6 a 10 págs)
├── .gitignore
└── README.md
```

---

## 🛡️ Controles de Seguridad en el Pipeline CI/CD
El pipeline (`.github/workflows/devsecops.yml`) ejecuta de forma automatizada:
1. **Detección de Secretos:** `gitleaks` (evita credenciales filtradas en código e historial).
2. **SAST:** `Semgrep` con reglas `p/owasp-top-ten` para análisis estático de vulnerabilidades.
3. **SCA y Misconfig:** `Trivy` escaneando el sistema de archivos (`HIGH,CRITICAL`).
4. **Políticas como Código:** `Conftest` (OPA / Rego) validando `Dockerfile` y `k8s/deployment.yaml`.
5. **Seguridad en la Imagen:** `Trivy` escaneando la imagen construida.
6. **Prueba Dinámica de Humo:** Verificación en caliente de `/health` y `/api/resumen` (401 sin API_KEY y 200 con clave).
7. **SBOM:** Generación de inventario en formato CycloneDX (`sbom.cdx.json`).
8. **Endurecimiento Supply Chain:** Fijación de dependencias de acciones por commit SHA de 40 caracteres (mitigación caso Trivy CVE-2026-33634).

---

## 🚀 Guía Rápida de Ejecución Local

### 1. Probar Servicio con Docker Compose
```bash
cd servicio
cp .env.example .env
# Asigne una clave segura a API_KEY en .env
docker compose up --build -d

# Validar salud y endpoints
curl -i http://localhost:8000/health
curl -i http://localhost:8000/api/resumen                           # Respuesta esperada: 401
curl -i -H "X-API-Key: su_clave" http://localhost:8000/api/resumen  # Respuesta esperada: 200
docker compose logs api
docker compose down
```

### 2. Validar con Podman (Comparación Rootless)
```bash
# Construir imagen reutilizando el Dockerfile
podman build -t sistema-api:podman-1.0 servicio

# Ejecutar contenedor
podman run -d --name sistema-api-podman -p 8000:8000 -e API_KEY="CLAVE_PRUEBA" sistema-api:podman-1.0
curl -i http://localhost:8000/health
curl -i -H "X-API-Key: CLAVE_PRUEBA" http://localhost:8000/api/resumen
podman stop sistema-api-podman && podman rm sistema-api-podman
```

### 3. Evaluar Políticas OPA / Conftest
```bash
# Auditar Dockerfile
docker run --rm -v "${PWD}:/project" openpolicyagent/conftest test servicio/Dockerfile --policy policy/docker

# Auditar Manifiestos de Kubernetes
docker run --rm -v "${PWD}:/project" openpolicyagent/conftest test k8s --policy policy/k8s
```

### 4. Desplegar en Kubernetes Local (`kind`)
```bash
# 1. Crear clúster con mapeo de puerto
kind create cluster --name devsecops --config kind-config.yaml

# 2. Cargar imagen construida
kind load docker-image sistema-api:1.0 --name devsecops

# 3. Crear secreto de API_KEY
kubectl create secret generic api-secreto --from-literal=API_KEY="clave-segura-k8s-12345"

# 4. Desplegar manifiestos
kubectl apply -f k8s/

# 5. Verificar estado
kubectl rollout status deployment/sistema-api
kubectl get pods -o wide
curl -i http://localhost:8080/health
```

---

## 👥 Integrantes del Proyecto
* Grupo de Trabajo - Tópicos Especiales 2.
