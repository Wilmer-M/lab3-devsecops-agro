import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useHistory } from "../../context/historyContext";

export default function Historial() {
  const { historyItems } = useHistory();

  const elementoConfig: Record<
    "N" | "P" | "K",
    { nombre: string; color: string; bg: string }
  > = {
    N: { nombre: "Nitrógeno", color: "#16a34a", bg: "#f0fdf4" }, // Green
    P: { nombre: "Fósforo", color: "#2563eb", bg: "#eff6ff" }, // Blue
    K: { nombre: "Potasio", color: "#d97706", bg: "#fff7ed" }, // Amber
  };

  const hasHistory = historyItems.length > 0;

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER - ESTILO INDEX */}
        <View style={styles.headerSection}>
          <Text style={styles.title}>Historial</Text>
          <Text style={styles.subtitle}>
            Registro de macronutrientes aplicados
          </Text>
        </View>

        {!hasHistory ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Text style={styles.emptyIcon}>⏳</Text>
            </View>
            <Text style={styles.emptyTitle}>Historial Vacío</Text>
            <Text style={styles.emptyDescription}>
              Aún no has registrado ninguna aplicación de nutrientes. Puedes simular o guardar aplicaciones desde la pestaña &quot;Curvas Ideales&quot; para realizar el seguimiento del abono en tu cultivo.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>Registros Recientes</Text>
            </View>

            {/* CARDS ESTILO PREMIUM */}
            <View style={styles.cardsColumn}>
              {historyItems.map((item, index) => {
                const config = elementoConfig[item.elemento] || {
                  nombre: "Nutriente",
                  color: "#64748b",
                  bg: "#f1f5f9",
                };

                return (
                  <View key={index} style={styles.card}>
                    <View style={styles.cardContent}>
                      {/* CÍRCULO DEL ELEMENTO QUÍMICO */}
                      <View style={[styles.elementIconCircle, { backgroundColor: config.bg }]}>
                        <Text style={[styles.elementIconText, { color: config.color }]}>
                          {item.elemento}
                        </Text>
                      </View>

                      {/* INFORMACIÓN DE LA APLICACIÓN */}
                      <View style={styles.infoSection}>
                        <Text style={styles.elementName}>{config.nombre}</Text>
                        <Text style={styles.sensorSubtext}>{item.sensor}</Text>
                        <Text style={styles.dateText}>
                          {new Date(item.fecha)
                            .toLocaleString("es-PA", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            })
                            .toLowerCase()}
                        </Text>
                      </View>

                      {/* VALOR APLICADO */}
                      <View style={styles.valueSection}>
                        <Text style={styles.amountText}>
                          +{item.cantidad}
                        </Text>
                        <Text style={styles.unitText}>mg/kg</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#eef2f7", // Fondo igual al index
  },
  scroll: {
    padding: 16, // Padding 16 igual al index
  },
  headerSection: {
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
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1e293b",
    letterSpacing: -0.3,
  },
  cardsColumn: {
    gap: 12,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20, // Rounded cards matching the layout
    padding: 16,
    shadowColor: "#0f172a",
    shadowOpacity: 0.03,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: Platform.OS === "android" ? "hidden" : "visible",
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  elementIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  elementIconText: {
    fontSize: 18,
    fontWeight: "800",
  },
  infoSection: {
    flex: 1,
    gap: 2,
  },
  elementName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1e293b",
  },
  sensorSubtext: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dateText: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "600",
  },
  valueSection: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  amountText: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1e293b",
  },
  unitText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
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
    overflow: Platform.OS === "android" ? "hidden" : "visible",
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#fffbeb", // amber suave
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
    color: "#78350f",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyDescription: {
    textAlign: "center",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 20,
  },
});
