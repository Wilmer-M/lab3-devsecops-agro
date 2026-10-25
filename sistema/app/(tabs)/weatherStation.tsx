import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useData } from "../../context/dataContext";

/* =========================
    HELPERS (TUS CÁLCULOS ORIGINALES)
========================= */
function getLastValidValue(data?: (number | null)[]) {
  if (!data || data.length === 0) return null;
  const valid = data.filter((v) => Number.isFinite(v)) as number[];
  return valid.length ? valid[valid.length - 1] : null;
}

function getTrend(data?: (number | null)[]) {
  if (!data) return 0;
  const valid = data.filter((v) => Number.isFinite(v)) as number[];
  if (valid.length < 2) return 0;
  const last = valid[valid.length - 1];
  const prev = valid[valid.length - 2];
  if (last > prev) return 1;
  if (last < prev) return -1;
  return 0;
}

function calculateRainProbability(sensor: any) {
  if (!sensor) return 0;
  const humedad = getLastValidValue(sensor?.Humedad);
  const presion = getLastValidValue(sensor?.Presion) ?? 1015;
  if (humedad === null) return 0;
  const trend = getTrend(sensor?.Humedad);
  let prob = (humedad / 100) * 0.5 + (1010 - presion) * 0.03;
  if (trend === 1) prob += 0.2;
  if (trend === -1) prob -= 0.1;
  return Math.max(0, Math.min(1, prob));
}

function getRainLabel(prob: number) {
  if (prob < 0.3) return { text: "Baja", color: "#22c55e" };
  if (prob < 0.6) return { text: "Media", color: "#f59e0b" };
  return { text: "Alta", color: "#ef4444" };
}

/* =========================
    COMPONENTE PRINCIPAL
========================= */
export default function Clima() {
  const { data } = useData();

  const hasData = data?.clima && Object.keys(data.clima).length > 0;
  const sensores = hasData ? Object.keys(data.clima) : [];

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER - ESTILO INDEX */}
        <View style={styles.headerContainer}>
          <Text style={styles.title}>Estación Meteorológica</Text>
          <Text style={styles.subtitle}>
            Monitoreo climático en tiempo real
          </Text>
        </View>

        {!hasData ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Text style={styles.emptyIcon}>🌦️</Text>
            </View>
            <Text style={styles.emptyTitle}>Sin Datos Climáticos</Text>
            <Text style={styles.emptyDescription}>
              No se han detectado registros de clima en la base de datos. Importa el archivo Excel climático desde Perfil para activar esta sección.
            </Text>
          </View>
        ) : (
          sensores.map((sensor) => {
            const sensorData = data.clima[sensor];
            const temp = getLastValidValue(sensorData?.Temperatura ?? []);
            const humedad = getLastValidValue(sensorData?.Humedad ?? []);
            const presion = getLastValidValue(sensorData?.Presion ?? []);
            const lluvia = getLastValidValue(sensorData?.Lluvia ?? []);

            // Cálculos dinámicos
            const prob = calculateRainProbability(sensorData);
            const rain = getRainLabel(prob);

            return (
              <View key={sensor} style={styles.sensorBlock}>
                {/* BANNER DE ESTACIÓN DE MONITOREO */}
                <View style={styles.stationHeaderBanner}>
                  <Text style={styles.stationTitleText}>{sensor.toUpperCase()}</Text>
                  <View style={styles.stationBadge}>
                    <Text style={styles.stationBadgeText}>ESTACIÓN METEOROLÓGICA</Text>
                  </View>
                </View>

                {/* PREDICCIÓN DE LLUVIA (CARD DINÁMICA) */}
                <View style={styles.rainPredictionCard}>
                  <View style={styles.iconContainer}>
                    <Text style={{ fontSize: 24 }}>
                      {prob > 0.6 ? "🌧" : "☁️"}
                    </Text>
                  </View>
                  <View style={styles.rainInfo}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text style={styles.rainTitle}>Predicción de Lluvia</Text>
                      <Text style={[styles.probText, { color: rain.color }]}>
                        {(prob * 100).toFixed(0)}%
                      </Text>
                    </View>
                    <Text style={styles.rainSubtitle}>
                      Probabilidad {rain.text}.{" "}
                      {prob > 0.6
                        ? "Ajuste de riego recomendado por posibles precipitaciones."
                        : "Sin variaciones críticas de riego recomendadas."}
                    </Text>
                  </View>
                </View>

                {/* TEMPERATURA ACTUAL (CARD DESTACADA) */}
                <View style={styles.tempHeroCard}>
                  <Text style={styles.heroLabel}>TEMPERATURA ACTUAL</Text>
                  <View style={styles.tempRow}>
                    <Text style={styles.tempValue}>
                      {temp !== null ? temp : "--"}
                    </Text>
                    <Text style={styles.tempUnit}>°C</Text>
                  </View>
                  <View style={styles.conditionBadge}>
                    <Text style={styles.conditionText}>
                      {temp !== null && temp > 18 && temp < 30
                        ? "✨ Condición: Óptima para siembra"
                        : "⚠️ Condición: Monitorear temperatura"}
                    </Text>
                  </View>
                </View>

                {/* GRID DE MÉTRICAS (USANDO TUS DATOS REALES) */}
                <View style={styles.metricsGrid}>
                  <MetricSmallCard
                    icon="💧"
                    label="Humedad actual"
                    value={humedad !== null ? `${humedad}%` : "--"}
                    badge="LIVE"
                  />
                  <MetricSmallCard
                    icon="⚖️"
                    label="Presión"
                    value={presion !== null ? presion : "--"}
                    unit="mb"
                  />
                  <MetricSmallCard
                    icon="🌧"
                    label="Lluvia"
                    value={lluvia !== null ? lluvia : "--"}
                    unit="mm"
                  />
                  <MetricSmallCard
                    icon="💨"
                    label="Estación"
                    value={sensor.split(" ")[1] || "S/N"}
                    unit=""
                  />
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* =========================
    COMPONENTES HIJOS
 ========================= */
function MetricSmallCard({ icon, label, value, unit, badge }: any) {
  return (
    <View style={styles.smallCard}>
      <View style={styles.smallCardHeader}>
        <Text style={{ fontSize: 18 }}>{icon}</Text>
        {badge && (
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={styles.smallCardLabel}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "baseline" }}>
        <Text style={styles.smallCardValue}>{value}</Text>
        {unit && <Text style={styles.smallCardUnit}> {unit}</Text>}
      </View>
    </View>
  );
}

/* =========================
    ESTILOS (BASADOS EN TU DISEÑO)
 ========================= */
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#eef2f7",
  },
  scroll: { padding: 16, paddingTop: 24 },
  headerContainer: { marginBottom: 20 },
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
  sensorBlock: { marginBottom: 32 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  emptyText: { color: "#94a3b8", fontSize: 16, fontWeight: "600" },
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
    backgroundColor: "#f0f9ff", // celeste muy suave
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
    color: "#0c4a6e", // azul oscuro clima
    marginBottom: 8,
    textAlign: "center",
  },
  emptyDescription: {
    textAlign: "center",
    color: "#475569",
    fontSize: 13,
    lineHeight: 20,
  },

  // BANNER DE ESTACIÓN (COMO EXPLORE/INDEX PERO MANTENIENDO ESTÉTICA DE CLIMA EN AZUL/CELESTE)
  stationHeaderBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingHorizontal: 4,
    marginTop: 10,
  },
  stationBadge: {
    backgroundColor: "#e0f2fe", // Celeste suave para clima
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  stationBadgeText: {
    color: "#0369a1", // Azul oscuro para clima
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  stationTitleText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
  },

  rainPredictionCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#e0f2fe", // celeste muy suave
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  rainInfo: { flex: 1 },
  rainTitle: { fontSize: 16, fontWeight: "800", color: "#1e293b" },
  probText: { fontSize: 16, fontWeight: "800" },
  rainSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
    lineHeight: 16,
  },

  tempHeroCard: {
    backgroundColor: "#16a34a", // Verde primario de la app
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    shadowColor: "#16a34a",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  heroLabel: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
    opacity: 0.8,
  },
  tempRow: { flexDirection: "row", alignItems: "flex-start", marginTop: 10 },
  tempValue: {
    fontSize: 72,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -2,
  },
  tempUnit: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    marginTop: 15,
    marginLeft: 5,
  },
  conditionBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 15,
  },
  conditionText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  smallCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1,
  },
  smallCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  liveBadge: {
    backgroundColor: "#dcfce7", // Verde suave para live badge
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  liveBadgeText: { fontSize: 9, fontWeight: "900", color: "#166534" },
  smallCardLabel: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "600",
    marginBottom: 4,
  },
  smallCardValue: { fontSize: 22, fontWeight: "800", color: "#1e293b" },
  smallCardUnit: { fontSize: 12, color: "#94a3b8", fontWeight: "700" },
});
