import { BlurView } from "expo-blur";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useAuth } from "../../context/authContext";
import { useData } from "../../context/dataContext";
import { useHistory } from "../../context/historyContext";
import { useNotification } from "../../context/notificationContext";
import { clearDatabase, initDB } from "../../utils/db";
import { exportUserDataToCSV, exportDatabaseFile } from "../../utils/exporter";

export default function ReportesScreen() {
  const {
    user,
    activeUserId,
    farmers,
    selectFarmer,
  } = useAuth();
  const { setData } = useData();
  const { clearHistory } = useHistory();
  const { showToast, showConfirm } = useNotification();

  const [loading, setLoading] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const handleClearDB = async () => {
    if (activeUserId === null) return;
    showConfirm(
      "Limpiar Datos",
      "¿Estás seguro de que quieres borrar todos los registros de este agricultor? Esta acción no se puede deshacer.",
      async () => {
        try {
          setLoading(true);
          const db = await initDB();
          await clearDatabase(db, activeUserId);
          setData({ suelo: {}, clima: {} });
          clearHistory();
          showToast("Éxito", "Datos limpiados correctamente.", "success");
        } catch (err) {
          console.error("Error al limpiar:", err);
          showToast("Error", "No se pudo limpiar la base de datos.", "error");
        } finally {
          setLoading(false);
        }
      },
      undefined,
      true
    );
  };

  const handleExport = async (type: "suelo" | "clima") => {
    if (activeUserId === null) return;
    const activeFarmer = farmers.find((f) => f.id === activeUserId);
    const exportName = activeFarmer ? activeFarmer.username : "agricultor";

    try {
      setLoading(true);
      const db = await initDB();
      const res = await exportUserDataToCSV(db, activeUserId, exportName, type);
      if (res.success) {
        showToast("Éxito", "Archivo CSV exportado y guardado correctamente.", "success");
      } else {
        showToast("Error", res.error || "No se pudo exportar.", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Error", "Ocurrió un error inesperado al exportar.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleExportDatabase = async () => {
    try {
      setLoading(true);
      const res = await exportDatabaseFile();
      if (res.success) {
        showToast("Éxito", "Base de datos exportada correctamente.", "success");
      } else {
        showToast("Error", res.error || "No se pudo exportar la base de datos.", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Error", "Ocurrió un error inesperado al exportar la base de datos.", "error");
    } finally {
      setLoading(false);
    }
  };

  const currentSelectedFarmer = farmers.find((f) => f.id === activeUserId);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      {/* LOADING OVERLAY */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <BlurView intensity={60} tint="light" style={styles.blur}>
            <View style={styles.loaderBox}>
              <ActivityIndicator size="large" color="#16a34a" />
              <Text style={{ marginTop: 8, color: "#475569", fontWeight: "600" }}>
                Procesando...
              </Text>
            </View>
          </BlurView>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={{ paddingVertical: 12, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* HEADER PANEL */}
          <View style={styles.headerContainer}>
            <Text style={styles.title}>Reportes y Descargas</Text>
            <Text style={styles.subtitle}>
              Exportación de planillas de sensores y respaldos de bases de datos
            </Text>
          </View>

          {currentSelectedFarmer ? (
            /* SECCIÓN 1: FARMER SELECCIONADO Y ACCIONES DE REPORTES */
            <View style={styles.listContainer}>
              {/* SELECTION BAR HEADER */}
              <View style={styles.activeFarmerBanner}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activeBannerLabel}>Finca en Gestión</Text>
                  <Text style={styles.activeBannerName}>
                    {currentSelectedFarmer.finca} • {currentSelectedFarmer.nombre}
                  </Text>
                </View>
                <Pressable
                  style={styles.deselectBtn}
                  onPress={() => {
                    selectFarmer(null);
                    showToast("Finca Cerrada", "Se ha cerrado la gestión del agricultor.", "info");
                  }}
                >
                  <MaterialIcons name="swap-horiz" size={16} color="#475569" />
                  <Text style={styles.deselectBtnText}>Cambiar</Text>
                </Pressable>
              </View>

              {/* EXPORTS SECTION - SLEEK & SIMPLE */}
              <View style={styles.reportsSection}>
                <Text style={styles.sectionTitle}>Descargar Reportes (CSV)</Text>
                
                <Pressable
                  style={styles.reportCard}
                  onPress={() => handleExport("suelo")}
                >
                  <View style={[styles.reportIconContainer, { backgroundColor: "#eff6ff" }]}>
                    <MaterialIcons name="analytics" size={24} color="#1d4ed8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reportTitle}>Reporte de Suelo</Text>
                    <Text style={styles.reportSubtitle}>Historial de humedad, pH y nutrientes</Text>
                  </View>
                  <MaterialIcons name="file-download" size={20} color="#1d4ed8" />
                </Pressable>

                <Pressable
                  style={styles.reportCard}
                  onPress={() => handleExport("clima")}
                >
                  <View style={[styles.reportIconContainer, { backgroundColor: "#f0fdf4" }]}>
                    <MaterialIcons name="wb-sunny" size={24} color="#15803d" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reportTitle}>Reporte de Clima</Text>
                    <Text style={styles.reportSubtitle}>Historial de temperatura y humedad ambiental</Text>
                  </View>
                  <MaterialIcons name="file-download" size={20} color="#15803d" />
                </Pressable>
              </View>

              {/* COLLAPSIBLE ADVANCED SECTION */}
              <View style={styles.advancedContainer}>
                <Pressable
                  style={styles.advancedHeader}
                  onPress={() => setIsAdvancedOpen(!isAdvancedOpen)}
                >
                  <MaterialIcons name="settings" size={18} color="#64748b" />
                  <Text style={styles.advancedHeaderText}>Opciones Avanzadas</Text>
                  <MaterialIcons
                    name={isAdvancedOpen ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                    size={20}
                    color="#64748b"
                    style={{ marginLeft: "auto" }}
                  />
                </Pressable>

                {isAdvancedOpen && (
                  <View style={styles.advancedContent}>
                    {/* DOWNLOAD DB FILE */}
                    <View style={styles.advancedItem}>
                      <Text style={styles.advancedItemTitle}>Copia de Seguridad (.db)</Text>
                      <Text style={styles.advancedItemDesc}>
                        Exporta la base de datos completa del dispositivo.
                      </Text>
                      <Pressable
                        style={styles.advancedBtn}
                        onPress={handleExportDatabase}
                      >
                        <MaterialIcons name="storage" size={16} color="#475569" />
                        <Text style={styles.advancedBtnText}>Exportar Base de Datos</Text>
                      </Pressable>
                    </View>

                    {/* DANGER RESET */}
                    <View style={[styles.advancedItem, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                      <Text style={[styles.advancedItemTitle, { color: "#dc2626" }]}>
                        Zona de Peligro
                      </Text>
                      <Text style={styles.advancedItemDesc}>
                        Borra permanentemente todo el historial y recomendaciones de este agricultor.
                      </Text>
                      <Pressable
                        style={styles.advancedDangerBtn}
                        onPress={handleClearDB}
                      >
                        <MaterialIcons name="delete-forever" size={16} color="#dc2626" />
                        <Text style={styles.advancedDangerBtnText}>Reiniciar Datos</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            </View>
          ) : (
            /* SECCIÓN 2: NINGÚN AGRICULTOR SELECCIONADO (EMPTY STATE CON BOTÓN) */
            <View style={styles.emptyStateContainer}>
              <View style={styles.emptyIllustrationContainer}>
                <MaterialIcons name="description" size={64} color="#cbd5e1" />
              </View>
              <Text style={styles.emptyStateTitle}>Ninguna finca seleccionada</Text>
              <Text style={styles.emptyStateDesc}>
                Para poder descargar reportes en CSV o realizar acciones de base de datos, primero selecciona una finca en el panel principal.
              </Text>
              <Pressable
                style={styles.goToFincasBtn}
                onPress={() => (router as any).push("/farmerManagement")}
              >
                <MaterialIcons name="chevron-left" size={20} color="#fff" />
                <Text style={styles.goToFincasBtnText}>Ir a Panel de Fincas</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  headerContainer: {
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 3,
    color: "#64748b",
    fontSize: 12,
    lineHeight: 16,
  },
  activeFarmerBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 20,
  },
  activeBannerLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  activeBannerName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1e293b",
    marginTop: 2,
  },
  deselectBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f1f5f9",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  deselectBtnText: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "700",
  },
  listContainer: {
    marginHorizontal: 16,
  },
  reportsSection: {
    marginBottom: 20,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  reportCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOpacity: 0.02,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  reportIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1e293b",
  },
  reportSubtitle: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  advancedContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  advancedHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: "#f8fafc",
    gap: 8,
  },
  advancedHeaderText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
  },
  advancedContent: {
    padding: 16,
    backgroundColor: "#ffffff",
    gap: 16,
  },
  advancedItem: {
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 14,
    gap: 6,
  },
  advancedItemTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
  advancedItemDesc: {
    fontSize: 11,
    color: "#64748b",
    lineHeight: 16,
  },
  advancedBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignSelf: "flex-start",
    marginTop: 4,
  },
  advancedBtnText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "700",
  },
  advancedDangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    alignSelf: "flex-start",
    marginTop: 4,
  },
  advancedDangerBtnText: {
    fontSize: 12,
    color: "#dc2626",
    fontWeight: "700",
  },
  emptyStateContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 48,
    marginHorizontal: 16,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginTop: 10,
    shadowColor: "#0f172a",
    shadowOpacity: 0.02,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  emptyIllustrationContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyStateDesc: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  goToFincasBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#16a34a",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 6,
    shadowColor: "#16a34a",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  goToFincasBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
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
});
