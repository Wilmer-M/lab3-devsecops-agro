import React from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { useAuth } from "../../context/authContext";

export default function LogScreen() {
  const { logEntries, loadLogEntries } = useAuth();

  React.useEffect(() => {
    loadLogEntries();
  }, []);

  const tipoConfig: Record<string, { color: string; icon: keyof typeof MaterialIcons.glyphMap }> = {
    login_success: { color: "#16a34a", icon: "login" },
    login_password_ok: { color: "#2563eb", icon: "lock" },
    login_fail: { color: "#dc2626", icon: "warning" },
    logout: { color: "#64748b", icon: "logout" },
    mfa_fail: { color: "#d97706", icon: "vpn-key" },
    mfa_blocked: { color: "#dc2626", icon: "block" },
    register: { color: "#8b5cf6", icon: "person-add" },
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.headerSection}>
        <Text style={styles.title}>Log de Sucesos</Text>
        <Text style={styles.subtitle}>Registro de eventos e ingresos al sistema</Text>
      </View>

      <FlatList
        data={logEntries}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={logEntries.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <MaterialIcons size={48} name="list-alt" color="#94a3b8" />
            <Text style={styles.emptyTitle}>Sin registros</Text>
            <Text style={styles.emptyDescription}>No hay eventos registrados aún.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const cfg = tipoConfig[item.tipo] || { color: "#64748b", icon: "circle" as keyof typeof MaterialIcons.glyphMap };
          return (
            <View style={styles.card}>
              <View style={styles.cardLeft}>
                <View style={[styles.iconCircle, { backgroundColor: cfg.color + "18" }]}>
                  <MaterialIcons size={20} name={cfg.icon} color={cfg.color} />
                </View>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardRow}>
                  <Text style={styles.username}>{item.username}</Text>
                  <Text style={[styles.tipo, { color: cfg.color }]}>{item.tipo}</Text>
                </View>
                <Text style={styles.detalle}>{item.detalle}</Text>
                <Text style={styles.fecha}>
                  {new Date(item.fecha).toLocaleString("es-PA", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: true,
                  })}
                </Text>
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#eef2f7" },
  headerSection: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: "800", color: "#0f172a" },
  subtitle: { fontSize: 14, color: "#64748b", marginTop: 4 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  emptyContainer: { flex: 1, justifyContent: "center", paddingHorizontal: 16 },
  emptyCard: { alignItems: "center", paddingVertical: 48 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#64748b", marginTop: 12 },
  emptyDescription: { fontSize: 14, color: "#94a3b8", marginTop: 4 },
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardLeft: { marginRight: 12, justifyContent: "center" },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  cardBody: { flex: 1 },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  username: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  tipo: { fontSize: 11, fontWeight: "600", textTransform: "uppercase" },
  detalle: { fontSize: 13, color: "#475569", marginTop: 2 },
  fecha: { fontSize: 11, color: "#94a3b8", marginTop: 4 },
});
