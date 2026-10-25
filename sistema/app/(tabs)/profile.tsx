import { Buffer } from "buffer";
import { BlurView } from "expo-blur";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useData } from "../../context/dataContext";
import { useHistory } from "../../context/historyContext";
import { useAuth } from "../../context/authContext";
import { useNotification } from "../../context/notificationContext";
import { clearDatabase, getAllData, initDB, saveClimaData, saveSueloData } from "../../utils/db";
import { exportDatabaseFile } from "../../utils/exporter";
import { parseExcelFromBuffer } from "../../utils/excelParser";
import { parseExcelClima } from "../../utils/excelParserClima";
import { generateSecret } from "../../utils/totp";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

export default function PerfilScreen() {
  const { setData } = useData();
  const { clearHistory } = useHistory();
  const { user, activeUserId, farmers, organizaciones, logout } = useAuth();
  const { showToast, showConfirm } = useNotification();

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mfaTipo, setMfaTipo] = useState<"none" | "totp" | "email">((user?.mfa_tipo as "none" | "totp" | "email") || "none");
  const [organizacionNombre, setOrganizacionNombre] = useState<string>("");
  const [editCorreo, setEditCorreo] = useState<string>("");
  const [savingCorreo, setSavingCorreo] = useState(false);
  const [showMfaSecret, setShowMfaSecret] = useState(false);
  const [mfaSecretCode, setMfaSecretCode] = useState("");
  const [exportingDB, setExportingDB] = useState(false);

  useEffect(() => {
    if (user) {
      setMfaTipo((user.mfa_tipo as "none" | "totp" | "email") || "none");
      if (!editCorreo && user.correo) setEditCorreo(user.correo);
      if (user.organizacion_id) {
        initDB().then(async (db) => {
          try {
            const org: any = await db.getFirstAsync("SELECT nombre FROM organizaciones WHERE id = ?", [user.organizacion_id!]);
            if (org) {
              setOrganizacionNombre(org.nombre);
            }
          } catch (e) {
            console.error("Error al cargar nombre de la organización:", e);
          }
        });
      }
    }
  }, [user]);

  const handleUpdateMfaTipo = async (tipo: "none" | "totp" | "email") => {
    if (!user) return;
    try {
      const db = await initDB();
      if (tipo === "totp") {
        const secret = user.mfa_secret || generateSecret();
        if (!user.mfa_secret) {
          await db.runAsync("UPDATE usuarios SET mfa_secret = ? WHERE id = ?", [secret, user.id]);
          user.mfa_secret = secret;
        }
        await db.runAsync("UPDATE usuarios SET mfa_tipo = ? WHERE id = ?", [tipo, user.id]);
        setMfaSecretCode(secret);
        setShowMfaSecret(true);
      } else {
        await db.runAsync("UPDATE usuarios SET mfa_tipo = ? WHERE id = ?", [tipo, user.id]);
      }
      setMfaTipo(tipo);
      user.mfa_tipo = tipo === "none" ? undefined : tipo;
      if (tipo === "none") {
        showToast("2FA Desactivado", "La verificación en dos pasos ha sido desactivada.", "warning");
      } else if (tipo === "totp") {
        showToast("Seguridad Actualizada", "App de Autenticación (TOTP) configurada.", "success");
      } else {
        showToast("Seguridad Actualizada", "Código por Correo electrónico configurado.", "success");
      }
    } catch (e) {
      console.error("Error al actualizar tipo MFA:", e);
      showToast("Error", "No se pudo actualizar la configuración de seguridad.", "error");
    }
  };

  const handleSaveCorreo = async () => {
    if (!user) return;
    const correoTrimmed = editCorreo.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(correoTrimmed)) {
      showToast("Correo Inválido", "Por favor ingresa un correo electrónico válido.", "warning");
      return;
    }
    setSavingCorreo(true);
    try {
      const db = await initDB();
      await db.runAsync("UPDATE usuarios SET correo = ? WHERE id = ?", [correoTrimmed, user.id]);
      user.correo = correoTrimmed;
      showToast("Correo Actualizado", `Tu correo ha sido guardado: ${correoTrimmed}`, "success");
    } catch (e) {
      showToast("Error", "No se pudo guardar el correo.", "error");
    } finally {
      setSavingCorreo(false);
    }
  };

  // Obtener iniciales para el avatar
  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  const readFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ],
    });

    if (result.canceled) return null;

    const uri = result.assets[0].uri;

    if (Platform.OS === "web") {
      const res = await fetch(uri);
      const arrayBuffer = await res.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } else {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return Buffer.from(base64, "base64");
    }
  };

  const pickExcelSuelo = async () => {
    if (activeUserId === null) {
      showToast("Selección Requerida", "Por favor selecciona un agricultor activo primero.", "warning");
      return;
    }
    try {
      setLoading(true);
      setProgress(0.2);

      const buffer = await readFile();
      if (!buffer) return;

      setProgress(0.6);

      const parsed = await parseExcelFromBuffer(buffer);

      if (parsed) {
        const db = await initDB();
        await saveSueloData(db, parsed, activeUserId);

        const validatedData = await getAllData(db, activeUserId);
        setData(validatedData);
      }

      setProgress(1);
      showToast("Éxito", "Datos de suelo cargados correctamente.", "success");
    } catch (err) {
      console.error("Error suelo:", err);
      showToast("Error", "No se pudo cargar el archivo de suelo.", "error");
    } finally {
      setTimeout(() => {
        setLoading(false);
        setProgress(0);
      }, 400);
    }
  };

  const pickExcelClima = async () => {
    if (activeUserId === null) {
      showToast("Selección Requerida", "Por favor selecciona un agricultor activo primero.", "warning");
      return;
    }
    try {
      setLoading(true);
      setProgress(0.2);

      const buffer = await readFile();
      if (!buffer) return;

      setProgress(0.6);

      const parsed = await parseExcelClima(buffer);

      if (parsed) {
        const db = await initDB();
        await saveClimaData(db, parsed, activeUserId);

        const validatedData = await getAllData(db, activeUserId);
        setData(validatedData);
      }

      setProgress(1);
      showToast("Éxito", "Datos de clima cargados correctamente.", "success");
    } catch (err) {
      console.error("Error clima:", err);
      showToast("Error", "No se pudo cargar el archivo de clima.", "error");
    } finally {
      setTimeout(() => {
        setLoading(false);
        setProgress(0);
      }, 400);
    }
  };

  const handleExportDB = async () => {
    setExportingDB(true);
    const result = await exportDatabaseFile();
    if (!result.success) {
      showToast("Error", result.error || "No se pudo exportar la base de datos.", "error");
    }
    setExportingDB(false);
  };

  const handleClearDB = async () => {
    if (activeUserId === null) return;
    showConfirm(
      "Limpiar Datos",
      "¿Estás seguro de que quieres borrar todos los registros de este agricultor? Esta acción no se puede deshacer.",
      async () => {
        try {
          const db = await initDB();
          await clearDatabase(db, activeUserId);
          setData({ suelo: {}, clima: {} });
          clearHistory();
          showToast("Éxito", "Datos limpiados correctamente.", "success");
        } catch (err) {
          console.error("Error al limpiar:", err);
          showToast("Error", "No se pudo limpiar la base de datos.", "error");
        }
      },
      undefined,
      true
    );
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      {/* PROGRESO DE CARGA */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <BlurView intensity={60} tint="light" style={styles.blur}>
            <View style={styles.loaderBox}>
              <ActivityIndicator size="large" color="#16a34a" />
              {progress > 0 && (
                <Text style={styles.loaderText}>
                  {Math.round(progress * 100)}%
                </Text>
              )}
              <Text style={{ marginTop: 6, color: "#64748b" }}>
                Cargando datos...
              </Text>
            </View>
          </BlurView>
        </View>
      )}

      <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        
        {/* HEADER DE LA SECCIÓN */}
        <View style={styles.headerContainer}>
          <Text style={styles.title}>Perfil</Text>
          <Text style={styles.subtitle}>Detalles de tu cuenta y configuración de datos</Text>
        </View>

        {/* TARJETA DE PERFIL PREMIUM */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{getInitials(user?.nombre)}</Text>
          </View>
          
          <Text style={styles.userName}>{user?.nombre}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>
              {user?.rol === "superadmin"
                ? "👑 SUPER ADMINISTRADOR"
                : user?.rol === "admin"
                ? "🏢 ADMINISTRADOR DE INSTITUCIÓN"
                : "🚜 AGRICULTOR"}
            </Text>
          </View>

          <View style={styles.detailsList}>
            {organizacionNombre ? (
              <View style={styles.detailRow}>
                <MaterialIcons name="business" size={18} color="#1d4ed8" />
                <Text style={styles.detailText}>Institución / Org: <Text style={[styles.detailBold, { color: "#1d4ed8" }]}>{organizacionNombre}</Text></Text>
              </View>
            ) : null}

            {user?.finca ? (
              <View style={styles.detailRow}>
                <MaterialIcons name="landscape" size={18} color="#64748b" />
                <Text style={styles.detailText}>Finca: <Text style={styles.detailBold}>{user.finca}</Text></Text>
              </View>
            ) : null}

            <View style={styles.detailRow}>
              <MaterialIcons name="account-circle" size={18} color="#64748b" />
              <Text style={styles.detailText}>Usuario: <Text style={styles.detailBold}>{user?.username}</Text></Text>
            </View>

            {user?.correo ? (
              <View style={styles.detailRow}>
                <MaterialIcons name="email" size={18} color="#64748b" />
                <Text style={styles.detailText}>Email: <Text style={styles.detailBold}>{user.correo}</Text></Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* VISTA CONDICIONAL SEGÚN EL ROL DE USUARIO */}
        {user?.rol === "agricultor" ? (
          <View style={styles.dataCard}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="cloud-upload" size={24} color="#16a34a" />
              <Text style={styles.cardTitle}>Importar Mediciones</Text>
            </View>
            <Text style={styles.cardDescription}>
              Sube los reportes Excel generados por los sensores de tu finca para actualizar las gráficas.
            </Text>

            <View style={styles.buttonRow}>
              <Pressable
                style={[styles.actionBtn, { backgroundColor: "#1e3a8a" }]}
                onPress={pickExcelSuelo}
              >
                <MaterialIcons name="description" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.actionBtnText}>Datos de Suelo</Text>
              </Pressable>

              <Pressable
                style={[styles.actionBtn, { backgroundColor: "#0284c7" }]}
                onPress={pickExcelClima}
              >
                <MaterialIcons name="wb-sunny" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.actionBtnText}>Clima</Text>
              </Pressable>
            </View>
          </View>
        ) : user?.rol === "admin" ? (
          <View style={styles.dataCard}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="business-center" size={24} color="#1d4ed8" />
              <Text style={styles.cardTitle}>Gestión de Institución</Text>
            </View>
            <Text style={styles.cardDescription}>
              Perteneces a <Text style={{ fontWeight: "800", color: "#1d4ed8" }}>{organizacionNombre || "tu Organización asignada"}</Text>. Supervisas la actividad de los agricultores y sensores asignados a tu institución.
            </Text>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
              <View style={{ flex: 1, backgroundColor: "#eff6ff", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#bfdbfe", alignItems: "center" }}>
                <Text style={{ fontSize: 20, fontWeight: "900", color: "#1d4ed8" }}>{farmers.length}</Text>
                <Text style={{ fontSize: 11, color: "#3b82f6", fontWeight: "700", marginTop: 2 }}>Agricultores a Cargo</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: "#f0fdf4", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#bbf7d0", alignItems: "center" }}>
                <Text style={{ fontSize: 20, fontWeight: "900", color: "#16a34a" }}>Activo</Text>
                <Text style={{ fontSize: 11, color: "#15803d", fontWeight: "700", marginTop: 2 }}>Estado de Cuenta</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.dataCard}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="admin-panel-settings" size={24} color="#ca8a04" />
              <Text style={styles.cardTitle}>Control Global de Plataforma</Text>
            </View>
            <Text style={styles.cardDescription}>
              Cuenta de nivel Super Admin. Posees control total para crear organizaciones, asignar administradores institucionales y gestionar agricultores a nivel nacional.
            </Text>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
              <View style={{ flex: 1, backgroundColor: "#fef9c3", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#fde047", alignItems: "center" }}>
                <Text style={{ fontSize: 20, fontWeight: "900", color: "#ca8a04" }}>{organizaciones.length}</Text>
                <Text style={{ fontSize: 11, color: "#a16207", fontWeight: "700", marginTop: 2 }}>Instituciones Registradas</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: "#eff6ff", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#bfdbfe", alignItems: "center" }}>
                <Text style={{ fontSize: 20, fontWeight: "900", color: "#1d4ed8" }}>{farmers.length}</Text>
                <Text style={{ fontSize: 11, color: "#3b82f6", fontWeight: "700", marginTop: 2 }}>Total Agricultores</Text>
              </View>
            </View>

            <Pressable
              style={[styles.actionBtn, { backgroundColor: "#475569", marginTop: 16 }]}
              onPress={handleExportDB}
              disabled={exportingDB}
            >
              <MaterialIcons name="storage" size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.actionBtnText}>
                {exportingDB ? "Exportando..." : "Descargar Base de Datos"}
              </Text>
            </Pressable>
          </View>
        )}

        <View style={styles.dataCard}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="security" size={22} color="#16a34a" />
            <Text style={styles.cardTitle}>Verificación en Dos Pasos (2FA)</Text>
          </View>
          <Text style={styles.cardDescription}>
            {mfaTipo === "none"
              ? "Aún no has configurado la verificación en dos pasos. Es recomendable activarla para mayor seguridad."
              : "Elige cómo deseas validar tu identidad al iniciar sesión en el sistema."}
          </Text>

          {(() => {
            const mfaActive = mfaTipo;
            return (
              <>
                <View style={styles.mfaOptionContainer}>
                  <Pressable
                    style={[styles.mfaOptionBtn, mfaActive === "totp" && styles.mfaOptionActive]}
                    onPress={() => handleUpdateMfaTipo("totp")}
                  >
                    <MaterialIcons
                      name="phonelink-setup"
                      size={18}
                      color={mfaActive === "totp" ? "#16a34a" : "#64748b"}
                    />
                    <Text style={[styles.mfaOptionText, mfaActive === "totp" && styles.mfaOptionActiveText]}>
                      App Auth
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[styles.mfaOptionBtn, mfaActive === "email" && styles.mfaOptionActive]}
                    onPress={() => handleUpdateMfaTipo("email")}
                  >
                    <MaterialIcons
                      name="email"
                      size={18}
                      color={mfaActive === "email" ? "#16a34a" : "#64748b"}
                    />
                    <Text style={[styles.mfaOptionText, mfaActive === "email" && styles.mfaOptionActiveText]}>
                      Correo OTP
                    </Text>
                  </Pressable>
                </View>

                {mfaActive !== "none" && (
                  <Pressable
                    onPress={() => handleUpdateMfaTipo("none")}
                    style={{ marginTop: 12, alignSelf: "center" }}
                  >
                    <Text style={{ fontSize: 12, color: "#94a3b8", textDecorationLine: "underline" }}>
                      Desactivar verificación en dos pasos
                    </Text>
                  </Pressable>
                )}
              </>
            );
          })()}

          <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: "#f1f5f9", paddingTop: 12 }}>
            <Text style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>
              {user?.correo
                ? `Correo actual: ${user.correo} — Cambiar:`
                : "Registra un correo para poder usar la verificación por email:"}
            </Text>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <TextInput
                style={[styles.inputField, { flex: 1 }]}
                value={editCorreo}
                onChangeText={setEditCorreo}
                placeholder="correo@ejemplo.com"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Pressable
                onPress={handleSaveCorreo}
                disabled={savingCorreo}
                style={{ backgroundColor: "#16a34a", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 }}
              >
                {savingCorreo
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <MaterialIcons name="save" size={20} color="#fff" />}
              </Pressable>
            </View>
          </View>
        </View>

        {user?.rol === "agricultor" ? (
          <View style={styles.dangerCard}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="warning" size={22} color="#dc2626" />
              <Text style={[styles.cardTitle, { color: "#dc2626" }]}>Zona de Peligro</Text>
            </View>
            <Text style={styles.cardDescription}>
              Estas acciones vaciarán de manera permanente la información histórica cargada en tu finca.
            </Text>
            
            <Pressable style={styles.clearBtn} onPress={handleClearDB}>
              <MaterialIcons name="delete-forever" size={18} color="#dc2626" style={{ marginRight: 6 }} />
              <Text style={styles.clearBtnText}>Reiniciar mis mediciones</Text>
            </Pressable>
          </View>
        ) : null}

        {/* SECCIÓN DE CUENTA / LOGOUT */}
        <Pressable style={styles.logoutBtn} onPress={logout}>
          <MaterialIcons name="exit-to-app" size={20} color="#dc2626" style={{ marginRight: 8 }} />
          <Text style={styles.logoutBtnText}>Cerrar Sesión</Text>
        </Pressable>

      </ScrollView>

      {/* MODAL MOSTRAR CLAVE TOTP */}
      <Modal visible={showMfaSecret} transparent animationType="fade" onRequestClose={() => setShowMfaSecret(false)}>
        <View style={styles.mfaBackdrop}>
          <View style={styles.mfaContainer}>
            <View style={styles.mfaHeader}>
              <MaterialIcons name="security" size={32} color="#16a34a" />
              <Text style={styles.mfaTitle}>Autenticación TOTP Activada</Text>
            </View>
            <Text style={styles.mfaDesc}>
              Escanea o ingresa esta clave secreta en tu aplicación de autenticación (Google Authenticator, Authy, etc.):
            </Text>

            <View style={styles.mfaSecretBox}>
              <Text style={styles.mfaSecretLabel}>CLAVE SECRETA MFA:</Text>
              <Text selectable={true} style={styles.mfaSecretCode}>{mfaSecretCode}</Text>
            </View>

            <Pressable
              style={styles.mfaCopyBtn}
              onPress={async () => {
                try {
                  await Clipboard.setStringAsync(mfaSecretCode);
                  showToast("Copiado", "La clave secreta ha sido copiada al portapapeles.", "success");
                } catch (e) {
                  console.error("Error al copiar:", e);
                  showToast("Error", "No se pudo copiar la clave.", "error");
                }
              }}
            >
              <MaterialIcons name="content-copy" size={16} color="#16a34a" />
              <Text style={styles.mfaCopyBtnText}>Copiar Clave Secreta</Text>
            </Pressable>

            <Text style={styles.mfaInstructions}>
              Una vez configurado en tu app, usa los códigos de 6 dígitos que genere para iniciar sesión.
            </Text>

            <Pressable style={styles.mfaCloseBtn} onPress={() => setShowMfaSecret(false)}>
              <Text style={styles.mfaCloseBtnText}>Listo</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#eef2f7",
  },
  headerContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#0f172a",
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 18,
  },
  profileCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOpacity: 0.03,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 3,
    borderColor: "#16a34a",
  },
  avatarText: {
    fontSize: 28,
    fontWeight: "900",
    color: "#166534",
  },
  userName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 6,
    textAlign: "center",
  },
  roleBadge: {
    backgroundColor: "#f1f5f9",
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 20,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#475569",
    letterSpacing: 0.5,
  },
  detailsList: {
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 16,
    gap: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  detailText: {
    fontSize: 13,
    color: "#64748b",
  },
  detailBold: {
    fontWeight: "700",
    color: "#334155",
  },
  dataCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 1,
  },
  dangerCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#fee2e2",
    shadowColor: "#0f172a",
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1e293b",
  },
  cardDescription: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 18,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  clearBtn: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#fca5a5",
    backgroundColor: "#fef2f2",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  clearBtnText: {
    color: "#dc2626",
    fontWeight: "700",
    fontSize: 13,
  },
  mfaOptionContainer: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  mfaOptionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    backgroundColor: "#f8fafc",
  },
  mfaOptionActive: {
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4",
  },
  mfaOptionText: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
  },
  mfaOptionActiveText: {
    color: "#16a34a",
    fontWeight: "700",
  },
  logoutBtn: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#fca5a5",
    paddingVertical: 14,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
    shadowColor: "#0f172a",
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 1,
  },
  logoutBtnText: {
    color: "#dc2626",
    fontSize: 14,
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
  inputField: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1e293b",
  },
  mfaBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    padding: 24,
  },
  mfaContainer: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#0f172a",
    shadowOpacity: 0.2,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  mfaHeader: {
    alignItems: "center",
    marginBottom: 16,
  },
  mfaTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
    marginTop: 10,
    textAlign: "center",
  },
  mfaDesc: {
    fontSize: 12,
    color: "#475569",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  mfaSecretBox: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  mfaSecretLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#166534",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  mfaSecretCode: {
    fontSize: 20,
    fontWeight: "900",
    color: "#15803d",
    letterSpacing: 2,
  },
  mfaCopyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4",
    marginBottom: 12,
  },
  mfaCopyBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#16a34a",
  },
  mfaInstructions: {
    fontSize: 10,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 15,
    marginBottom: 16,
  },
  mfaCloseBtn: {
    backgroundColor: "#16a34a",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  mfaCloseBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
});
