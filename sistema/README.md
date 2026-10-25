# Cliente Móvil AgroSmart (Cascarón / Mock de Arquitectura)

Este directorio contiene la estructura base y cascarón (*skeleton*) de la aplicación cliente móvil React Native / Expo dentro del ecosistema **AgroSmart**.

## Propósito en este Repositorio

Este repositorio está enfocado en la implementación y validación de la **cadena de suministro de software segura (DevSecOps)**, incluyendo:
- **SAST (Semgrep):** Análisis estático de código fuente con reglas OWASP Top 10.
- **SCA & Configuración (Trivy):** Detección de vulnerabilidades en dependencias y malas configuraciones.
- **Políticas como Código (Conftest / Rego):** Cumplimiento en Dockerfile y manifiestos de Kubernetes.
- **Pipeline de Integración Continua (.github/workflows/devsecops.yml):** Pruebas de humo, escaneo de contenedores y generación de SBOM (CycloneDX).

El código fuente propietario y las pantallas funcionales completas de la aplicación cliente se gestionan de forma reservada en un repositorio privado independiente.

## Contenido de este módulo

- **`app/`**: Cascarón mínimo con la navegación base de Expo Router.
- **`backend-mock/`**: Servidor mock en Node.js que simula la recepción y sanitización de lecturas de sensores con validación BVA (*Boundary Value Analysis*), utilizado para pruebas de integración y seguridad.
- **`package.json`**: Definición de dependencias con políticas de resolución de vulnerabilidades (`overrides`) validadas en el pipeline.
