import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SensorChart from "../../components/SensorChart";
import { useData } from "../../context/dataContext";

type Metric = "Nitrogeno" | "Fosforo" | "Potasio";
const metricTabs: Metric[] = ["Nitrogeno", "Fosforo", "Potasio"];

const nutrientMap: Record<Metric, "N" | "P" | "K"> = {
  Nitrogeno: "N",
  Fosforo: "P",
  Potasio: "K",
};

const tabLabels: Record<Metric, string> = {
  Nitrogeno: "Nitrógeno (N)",
  Fosforo: "Fósforo (P)",
  Potasio: "Potasio (K)",
};

export default function ExploreScreen() {
  const { data } = useData();
  const [activeMetric, setActiveMetric] = useState<Metric>("Nitrogeno");
  const [idealValues, setIdealValues] = useState<any>({});

  useEffect(() => {
    if (!data?.suelo) return;

    const getMaxReal = (sensor: string, nutriente: Metric) => {
      const valores =
        data.suelo[sensor]?.[nutriente]?.filter(Number.isFinite) || [];
      return valores.length ? Math.max(...valores) : 1;
    };

    const ideales: any = {};

    for (const sensor of Object.keys(data.suelo)) {
      const fechas: string[] = data.suelo[sensor]?.fechas || [];

      ideales[sensor] = {
        Nitrogeno: fechas.map((_, i) => {
          const p = i / (fechas.length - 1 || 1);
          return getMaxReal(sensor, "Nitrogeno") * (1 - Math.pow(p, 1.5));
        }),
        Fosforo: fechas.map((_, i) => {
          const p = i / (fechas.length - 1 || 1);
          return (
            getMaxReal(sensor, "Fosforo") * (0.6 + 0.4 * Math.sin(Math.PI * p))
          );
        }),
        Potasio: fechas.map((_, i) => {
          const p = i / (fechas.length - 1 || 1);
          return (
            getMaxReal(sensor, "Potasio") * (1 / (1 + Math.exp(-6 * (p - 0.5))))
          );
        }),
      };
    }
    setIdealValues(ideales);
  }, [data]);

  const hasData = data?.suelo && Object.keys(data.suelo).length > 0;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* HEADER */}
        <View style={styles.headerCard}>
          <Text style={styles.title}>Curvas Ideales</Text>
          <Text style={styles.subtitle}>
            Guía comparativa de nutrición óptima y dosificación
          </Text>
        </View>

        {!hasData ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Text style={styles.emptyIcon}>📈</Text>
            </View>
            <Text style={styles.emptyTitle}>Curvas de Nutrición Inactivas</Text>
            <Text style={styles.emptyDescription}>
              No se han cargado datos para calcular las curvas de nutrición ideales. Importa el archivo Excel de suelo desde Perfil para visualizar las curvas comparativas y registrar abonos.
            </Text>
          </View>
        ) : (
          <>
            {/* GUÍA DE COMPARATIVA EXPLICATIVA */}
            <View style={styles.guideCard}>
              <View style={styles.guideIconCircle}>
                <Text style={styles.guideIcon}>💡</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.guideTitle}>¿Cómo usar esta sección?</Text>
                <Text style={styles.guideText}>
                  Compara tus mediciones reales (<Text style={{ fontWeight: "700", color: "#16a34a" }}>línea verde</Text>) con la curva ideal recomendada (<Text style={{ fontWeight: "700", color: "#64748b" }}>línea punteada gris</Text>). Abajo de cada gráfica puedes registrar el abono que hayas aplicado para nivelarlo.
                </Text>
              </View>
            </View>

            {/* TABS DE MÉTRICAS */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tabsWrapper}
            >
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

            {/* LISTADO DE GRÁFICAS */}
            {Object.keys(data.suelo).map((sensor) => (
              <View key={sensor} style={{ marginBottom: 32 }}>
                {/* BANNER DE ESTACIÓN DE MONITOREO */}
                <View style={styles.stationHeaderBanner}>
                  <Text style={styles.stationTitleText}>{sensor.toUpperCase()}</Text>
                  <View style={styles.stationBadge}>
                    <Text style={styles.stationBadgeText}>ESTACIÓN DE MONITOREO</Text>
                  </View>
                </View>

                <SensorChart
                  title={sensor}
                  nutrient={nutrientMap[activeMetric]}
                  labels={data.suelo[sensor]?.fechas || []}
                  realData={data.suelo[sensor]?.[activeMetric] || []}
                  idealData={idealValues[sensor]?.[activeMetric]}
                  showMetrics={false}
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

/* =========================
   ESTILOS REDISEÑADOS
========================= */
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#eef2f7",
  },
  scroll: {
    padding: 16,
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

  // GUÍA INFORMATIVA PREMIUM
  guideCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
    marginBottom: 20,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  guideIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f0fdf4",
    alignItems: "center",
    justifyContent: "center",
  },
  guideIcon: {
    fontSize: 18,
  },
  guideTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 4,
  },
  guideText: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 17,
  },

  // TABS DE NAVEGACIÓN
  tabsWrapper: {
    marginBottom: 20,
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

  // ESTADO VACÍO (CENTRO)
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef2f7",
    padding: 24,
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
    backgroundColor: "#e0e7ff", // indigo muy suave
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
    color: "#312e81", // indigo oscuro
    marginBottom: 8,
    textAlign: "center",
  },
  emptyDescription: {
    textAlign: "center",
    color: "#475569",
    fontSize: 13,
    lineHeight: 20,
  },

  // ESTRUCTURA DE SEPARACIÓN DE SENSORES
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
