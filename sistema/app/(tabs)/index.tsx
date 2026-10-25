import { BlurView } from "expo-blur";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SensorChart from "../../components/SensorChart";
import { useData } from "../../context/dataContext";
import { useAuth } from "../../context/authContext";
import { getAllData, initDB } from "../../utils/db";

type Metric = "Humedad" | "Nitrogeno" | "Fosforo" | "Potasio";
const metricTabs: Metric[] = ["Humedad", "Nitrogeno", "Fosforo", "Potasio"];

const tabLabels: Record<Metric, string> = {
  Humedad: "Humedad",
  Nitrogeno: "Nitrógeno",
  Fosforo: "Fósforo",
  Potasio: "Potasio",
};

export default function Dashboard() {
  const { data, setData } = useData();
  const { user, activeUserId } = useAuth();

  const [activeMetric, setActiveMetric] = useState<Metric>("Humedad");
  const [loading, setLoading] = useState(false);

  // Cargar datos desde SQLite al cambiar el agricultor activo (o inicial)
  useEffect(() => {
    const loadUserData = async () => {
      if (activeUserId === null) {
        setData({ suelo: {}, clima: {} });
        return;
      }
      try {
        setLoading(true);
        const db = await initDB();
        const storedData = await getAllData(db, activeUserId);
        setData(storedData);
      } catch (err) {
        console.error("Error cargando BD:", err);
      } finally {
        setLoading(false);
      }
    };
    loadUserData();
  }, [activeUserId]);

  const hasData = data?.suelo && Object.keys(data.suelo).length > 0;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      {/* PROGRESO */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <BlurView intensity={60} tint="light" style={styles.blur}>
            <View style={styles.loaderBox}>
              <ActivityIndicator size="large" color="#16a34a" />
              <Text style={{ marginTop: 6, color: "#64748b" }}>
                Cargando datos...
              </Text>
            </View>
          </BlurView>
        </View>
      )}

      <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        
        {/* HEADER */}
        <View style={styles.headerCard}>
          <Text style={styles.title}>Sensores de Suelo</Text>
          <Text style={styles.subtitle}>
            Análisis detallado de salud radicular y nutrientes
          </Text>
        </View>

        {/* CONTENIDO INTERACTIVO O PLACEHOLDERS */}
        {user?.rol === "admin" && activeUserId === null ? (
          /* PLACEHOLDER ADMIN SIN AGRICULTOR SELECCIONADO */
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🚜</Text>
            <Text style={styles.emptyTitle}>Panel de Administración</Text>
            <Text style={styles.emptyDescription}>
              Por favor, selecciona un agricultor en la pestaña **Admin** de la barra inferior para visualizar sus mediciones de suelo y clima.
            </Text>
          </View>
        ) : !hasData ? (
          /* EMPTY STATE (SIN DATOS) */
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🌱</Text>
            <Text style={styles.emptyTitle}>Sin registros disponibles</Text>
            <Text style={styles.emptyDescription}>
              No se han encontrado registros. Puedes importar los archivos Excel desde tu perfil.
            </Text>
          </View>
        ) : (
          /* MÉTRICAS Y GRÁFICAS */
          <>
            {/* TABS DE MÉTRICAS */}
            <ScrollView horizontal contentContainerStyle={styles.tabsWrapper} showsHorizontalScrollIndicator={false}>
              <View style={styles.tabsContainer}>
                {metricTabs.map((tab) => (
                  <Pressable
                    key={tab}
                    onPress={() => setActiveMetric(tab)}
                    style={[
                      styles.tabPill,
                      activeMetric === tab && styles.tabActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tabText,
                        activeMetric === tab && styles.tabTextActive,
                      ]}
                    >
                      {tabLabels[tab]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            {/* GRÁFICAS */}
            {Object.keys(data.suelo).map((sensor) => (
              <View key={sensor} style={{ marginBottom: 32 }}>
                <View style={styles.stationHeaderBanner}>
                  <Text style={styles.stationTitleText}>{sensor.toUpperCase()}</Text>
                  <View style={styles.stationBadge}>
                    <Text style={styles.stationBadgeText}>ESTACIÓN DE MONITOREO</Text>
                  </View>
                </View>

                <SensorChart
                  title={sensor}
                  labels={data.suelo[sensor]?.fechas || []}
                  realData={data.suelo[sensor]?.[activeMetric] || []}
                  metric={activeMetric}
                />
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#eef2f7",
  },
  headerCard: {
    marginBottom: 20,
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
  adminCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
    marginBottom: 16,
    shadowColor: "#0f172a",
    shadowOpacity: 0.02,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  adminHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  adminTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  adminIcon: {
    fontSize: 22,
  },
  adminTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e293b",
  },
  adminSubtitle: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  adminArrow: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "700",
  },
  adminContent: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 16,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  clearBtnInline: {
    alignItems: "center",
    marginTop: 14,
    paddingVertical: 4,
  },
  clearTextInline: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginVertical: 10,
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 8,
  },
  emptyDescription: {
    textAlign: "center",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyActions: {
    width: "100%",
  },
  primaryBtn: {
    backgroundColor: "#16a34a",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  secondaryBtn: {
    backgroundColor: "#f8fafc",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  secondaryBtnText: {
    color: "#334155",
    fontWeight: "700",
    fontSize: 14,
  },
  tabsWrapper: {
    marginBottom: 16,
  },
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: "#e2e8f0",
    borderRadius: 16,
    padding: 4,
  },
  tabPill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  tabActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tabText: {
    color: "#475569",
    fontWeight: "600",
    fontSize: 13,
  },
  tabTextActive: {
    color: "#1e293b",
    fontWeight: "700",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  blur: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  loaderBox: {
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingVertical: 24,
    paddingHorizontal: 36,
    borderRadius: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  loaderText: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: "700",
    color: "#14532d",
  },
  stationHeaderBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingHorizontal: 4,
    marginTop: 10,
  },
  stationBadge: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  stationBadgeText: {
    color: "#166534",
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
});
