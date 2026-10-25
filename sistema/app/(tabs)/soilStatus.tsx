import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useData } from "../../context/dataContext";

/* =========================
   TIPOS Y CONFIGURACIÓN
========================= */
type Metric = "Humedad" | "Nitrogeno" | "Fosforo" | "Potasio";

const METRIC_CONFIG: Record<Metric, { label: string; unit: string; scaleMax: number }> = {
  Humedad: { label: "Humedad", unit: "%", scaleMax: 100 },
  Nitrogeno: { label: "Nitrógeno", unit: "mg/kg", scaleMax: 60 },
  Fosforo: { label: "Fósforo", unit: "mg/kg", scaleMax: 45 },
  Potasio: { label: "Potasio", unit: "mg/kg", scaleMax: 300 },
};

/* =========================
   HELPERS
========================= */
function getLastValidValue(data?: (number | null)[]) {
  if (!data || data.length === 0) return null;
  const last = [...data].reverse().find((v) => Number.isFinite(v));
  return last ?? null;
}

function evaluateMetric(metric: Metric, value: number) {
  switch (metric) {
    case "Humedad":
      if (value < 30)
        return { label: "Muy Baja", color: "#ffffff", bg: "#dc2626" };
      if (value < 50) return { label: "Baja", color: "#ffffff", bg: "#f97316" };
      if (value <= 70)
        return { label: "Óptima", color: "#ffffff", bg: "#16a34a" };
      return { label: "Alta", color: "#ffffff", bg: "#2563eb" };
    case "Nitrogeno":
      if (value < 10)
        return { label: "Muy Bajo", color: "#ffffff", bg: "#dc2626" };
      if (value < 20) return { label: "Bajo", color: "#ffffff", bg: "#f97316" };
      if (value <= 40)
        return { label: "Óptimo", color: "#ffffff", bg: "#16a34a" };
      return { label: "Exceso", color: "#ffffff", bg: "#7c3aed" };
    case "Fosforo":
      if (value < 5)
        return { label: "Muy Bajo", color: "#ffffff", bg: "#dc2626" };
      if (value < 15) return { label: "Bajo", color: "#ffffff", bg: "#f97316" };
      if (value <= 30)
        return { label: "Óptimo", color: "#ffffff", bg: "#16a34a" };
      return { label: "Alto", color: "#ffffff", bg: "#2563eb" };
    case "Potasio":
      if (value < 50)
        return { label: "Muy Bajo", color: "#ffffff", bg: "#dc2626" };
      if (value < 100)
        return { label: "Bajo", color: "#ffffff", bg: "#f97316" };
      if (value <= 200)
        return { label: "Óptimo", color: "#ffffff", bg: "#16a34a" };
      return { label: "Exceso", color: "#ffffff", bg: "#7c3aed" };
    default:
      return { label: "N/A", color: "#64748b", bg: "#f1f5f9" };
  }
}

function getAdvice(metric: Metric, value: number): string | null {
  switch (metric) {
    case "Humedad":
      if (value < 50) return "Aumenta el riego para evitar estrés hídrico.";
      if (value > 70) return "Reduce el riego para evitar encharcamiento.";
      return null;
    case "Nitrogeno":
      if (value < 20) return "Aplica fertilizante nitrogenado.";
      if (value > 40) return "Exceso de nitrógeno puede afectar el cultivo.";
      return null;
    case "Fosforo":
      if (value < 15) return "Considera fertilización fosfatada.";
      if (value > 30) return "Fósforo alto puede bloquear micronutrientes.";
      return null;
    case "Potasio":
      if (value < 100) return "Refuerza potasio para mejorar resistencia.";
      if (value > 200) return "Potasio en exceso, reduce aplicación.";
      return null;
    default:
      return null;
  }
}

/* =========================
   COMPONENTES HIJOS
========================= */
function MetricRow({ title, value }: { title: Metric; value: number }) {
  const status = evaluateMetric(title, value);
  const config = METRIC_CONFIG[title];
  const fillPercent = Math.min((value / config.scaleMax) * 100, 100);

  return (
    <View style={[styles.metricCard, { backgroundColor: status.bg, borderColor: status.bg }]}>
      <View style={styles.metricHeader}>
        <Text style={styles.metricLabel}>{config.label}</Text>
        <Text style={styles.metricValue}>
          {value.toFixed(1)}<Text style={styles.metricUnit}> {config.unit}</Text>
        </Text>
        <Text style={styles.metricStatus}>{status.label}</Text>
      </View>

      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, { width: `${fillPercent}%` }]} />
      </View>
      <View style={styles.meterLabels}>
        <Text style={styles.meterLabel}>Baja</Text>
        <Text style={styles.meterLabel}>Media</Text>
        <Text style={styles.meterLabel}>Alta</Text>
      </View>
    </View>
  );
}

/* =========================
   COMPONENTE PRINCIPAL
========================= */
export default function Info() {
  const { data } = useData();

  const hasData = data?.suelo && Object.keys(data.suelo).length > 0;
  const metrics: Metric[] = ["Humedad", "Nitrogeno", "Fosforo", "Potasio"];

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER - SIGUIENDO LA GUÍA DEL INDEX */}
        <View style={styles.headerCard}>
          <Text style={styles.title}>Estado general del suelo</Text>
          <Text style={styles.subtitle}>
            Monitoreo y alertas sobre la composición química del terreno
          </Text>
          <Pressable
            onPress={() => router.push("/agriculturalAssistant")}
            style={styles.assistantButton}
          >
            <View style={styles.assistantButtonIcon}>
              <MaterialIcons name="chat-bubble-outline" size={20} color="#ffffff" />
            </View>
            <View style={styles.assistantButtonContent}>
              <Text style={styles.assistantButtonText}>Consultar asistente</Text>
              <Text style={styles.assistantButtonHint}>Pregunta sobre tus mediciones</Text>
            </View>
            <MaterialIcons name="arrow-forward" size={20} color="#ffffff" />
          </Pressable>
        </View>

        {!hasData ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Sin Datos de Suelo</Text>
            <Text style={styles.emptyDescription}>
              No se han cargado lecturas de los sensores en el suelo. Importa el archivo Excel desde Perfil para conocer el estado nutricional y recibir recomendaciones.
            </Text>
          </View>
        ) : (
          Object.keys(data.suelo).map((sensor) => {
            const sensorData = data.suelo[sensor];
            const advices: string[] = [];

            metrics.forEach((m) => {
              const val = getLastValidValue(sensorData?.[m]);
              if (val !== null) {
                const advice = getAdvice(m, val);
                if (advice) advices.push(advice);
              }
            });

            const hasAlerts = advices.length > 0;

            return (
              <View key={sensor} style={styles.sensorSection}>
                {/* ZONA Y BADGE */}
                <View style={styles.sensorHeader}>
                  <View>
                    <Text style={styles.zoneText}>ESTACIÓN</Text>
                    <Text style={styles.sensorName}>{sensor}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: hasAlerts ? "#fee2e2" : "#dcfce7" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        { color: hasAlerts ? "#b91c1c" : "#166534" },
                      ]}
                    >
                      {hasAlerts ? "ATENCIÓN REQUERIDA" : "NIVELES ÓPTIMOS"}
                    </Text>
                  </View>
                </View>

                {/* TARJETAS DE MÉTRICAS */}
                <View style={styles.metricsGrid}>
                  {metrics.map((m) => {
                    const val = getLastValidValue(sensorData?.[m]);
                    return val !== null ? (
                      <MetricRow key={m} title={m} value={val} />
                    ) : null;
                  })}
                </View>

                {/* ALERTAS/CONSEJOS */}
                {hasAlerts && (
                  <View style={styles.adviceContainer}>
                    <View style={styles.adviceHeader}>
                      <View style={styles.adviceIcon}>
                        <Text style={styles.adviceIconText}>!</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.adviceHeaderTitle}>Acciones recomendadas</Text>
                        <Text style={styles.adviceSubtitle}>Revisa estos puntos para mejorar la condición del suelo.</Text>
                      </View>
                    </View>
                    <View style={styles.adviceList}>
                      {advices.map((text, idx) => (
                        <View key={idx} style={styles.adviceItem}>
                          <View style={styles.adviceDot} />
                          <Text style={styles.adviceText}>{text}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#eef2f7", // Fondo suave del index
  },
  scroll: {
    padding: 16,
  },
  headerCard: {
    marginBottom: 20,
  },
  assistantButton: {
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: "#15803d",
    borderRadius: 16,
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    padding: 12,
    shadowColor: "#14532d",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  assistantButtonIcon: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 12,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  assistantButtonContent: {
    flex: 1,
  },
  assistantButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  assistantButtonHint: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 11,
    marginTop: 2,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 18,
  },
  sensorSection: {
    marginBottom: 28,
  },
  sensorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  zoneText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#94a3b8",
    letterSpacing: 1,
  },
  sensorName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1e293b",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  adviceContainer: {
    backgroundColor: "#fff",
    borderColor: "#e2e8f0",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  adviceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  adviceIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff7ed",
  },
  adviceIconText: {
    color: "#ea580c",
    fontSize: 16,
    fontWeight: "900",
  },
  adviceHeaderTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1e293b",
  },
  adviceSubtitle: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 2,
  },
  adviceList: {
    gap: 8,
    marginTop: 14,
  },
  adviceItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  adviceDot: {
    backgroundColor: "#f97316",
    borderRadius: 4,
    height: 8,
    marginTop: 5,
    width: 8,
  },
  adviceText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
    lineHeight: 18,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  metricCard: {
    width: "48%",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
  metricHeader: {
    alignItems: "center",
    marginBottom: 12,
  },
  metricLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
  },
  metricStatus: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 3,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    marginTop: 6,
  },
  metricUnit: {
    fontSize: 11,
    color: "rgba(255,255,255,0.82)",
    fontWeight: "600",
  },
  meterTrack: {
    height: 12,
    backgroundColor: "rgba(255,255,255,0.28)",
    borderRadius: 99,
    overflow: "hidden",
    position: "relative",
  },
  meterFill: {
    height: "100%",
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  meterLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  meterLabel: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 9,
    fontWeight: "700",
  },
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
    marginTop: 8,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#f0fdf4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#14532d",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyDescription: {
    textAlign: "center",
    color: "#475569",
    fontSize: 13,
    lineHeight: 20,
  },
});
