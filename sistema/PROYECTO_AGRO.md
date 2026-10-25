# Proyecto AgroSmart: Monitoreo Inteligente y Predicción Climática

## Título
**AgroSmart**: Sistema de Soporte a Decisiones Agrícolas Basado en Sensores IoT y Análisis de Datos en Tiempo Real.

---

## Justificación
El sector agrícola se enfrenta hoy a un desafío sin precedentes: la **inestabilidad climática**. Los patrones tradicionales de siembra y cosecha, basados en la experiencia generacional e intuición, están fallando debido a cambios drásticos en el régimen de lluvias, temperaturas extremas y variaciones en la composición del suelo.

Esta "desorientación climática" se traduce directamente en:
*   **Pérdidas totales o parciales de cultivos** por siembras en momentos inadecuados.
*   **Desperdicio de recursos** (agua y fertilizantes) al no conocer el estado real del suelo.
*   **Incapacidad de reacción** ante eventos meteorológicos adversos.

La tecnología de sensores y el análisis de datos emergen como la única vía para devolver la certidumbre al agricultor, transformando datos invisibles en decisiones estratégicas.

---

## Qué persigue el proyecto
El objetivo central es **eliminar la incertidumbre en la gestión agrícola**. El proyecto busca:
1.  **Digitalizar el entorno físico**: Convertir las variables del suelo y el clima en datos precisos y accionables.
2.  **Centralizar la información**: Proveer una aplicación móvil (React Native) que actúe como el "cerebro" del cultivo, eliminando la dependencia de hojas de cálculo manuales.
3.  **Optimizar la producción**: Facilitar que el agricultor sepa exactamente *cuándo* sembrar, *cuánto* regar y *cómo* está respondiendo su cultivo en tiempo real.

---

## Estado Actual (Fase 1 Finalizada)
El proyecto ha superado la etapa inicial de arquitectura, logrando:
*   **Captura y Validación**: Implementación de algoritmos BVA para el filtrado de lecturas erróneas.
*   **Monitoreo en Tiempo Real**: Dashboard funcional para visualización de humedad y temperatura.
*   **Persistencia de Datos**: Migración exitosa de modelos basados en Excel a una base de datos local estructurada.

---

## Objetivos

### A Corto Plazo (Refinamiento y Consolidación)
*   **Estabilización en Campo**: Realizar pruebas de estrés en el entorno real para asegurar la robustez de la comunicación entre sensores y app.
*   **Configuración de Umbrales**: Permitir al usuario definir rangos de alerta personalizados (pH, humedad) según el tipo de cultivo específico.
*   **Reportes Analíticos**: Desarrollar funciones de exportación y gráficas comparativas avanzadas para el análisis de tendencias históricas.

### A Mediano Plazo
*   **Sistemas de Alerta Temprana**: Configurar notificaciones push automáticas cuando las variables (como humedad o pH) salgan de los rangos óptimos.
*   **Análisis Predictivo**: Utilizar el historial de datos para predecir tendencias y sugerir ventanas óptimas de siembra.
*   **Automatización de Riego**: Integrar el control de actuadores (bombas de agua) que respondan automáticamente a los datos de los sensores de humedad.

---

## Equipo necesario para realizar el proyecto

### Hardware (IoT & Estaciones)
*   **Sensores de Suelo**: Sensores capacitivos de humedad, sensores de temperatura de suelo (DS18B20) y sensores de pH.
*   **Estación Climatológica**: Anemómetro (viento), Pluviómetro (lluvia), Barómetro (presión) y sensor UV.
*   **Procesamiento**: Microcontroladores (ESP32) para los nodos de sensores y una Raspberry Pi como Gateway central.
*   **Conectividad**: Módulos LoRaWAN (largo alcance en campo) o Wi-Fi/GSM según la ubicación.

### Software & Herramientas
*   **Desarrollo Móvil**: React Native + Expo + TypeScript.
*   **Gestión de Datos**: SQLite para persistencia local y PostgreSQL (o InfluxDB para series temporales) en la nube.
*   **Validación**: Algoritmos de Boundary Value Analysis (BVA) para limpieza de datos.
*   **Backend**: Node.js para la API de sincronización de sensores.

### Recursos Humanos
*   **Desarrollador de Software**: Para la lógica de la app, base de datos y validaciones.
*   **Especialista en IoT/Electrónica**: Para el montaje, calibración y mantenimiento de los sensores físicos.
*   **Consultor Agronómico**: Para definir los umbrales críticos de cada tipo de cultivo y validar las recomendaciones del sistema.
