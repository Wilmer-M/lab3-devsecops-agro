import { BlurView } from "expo-blur";
import * as Clipboard from "expo-clipboard";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useAuth, User } from "../../context/authContext";
import { useNotification } from "../../context/notificationContext";
import { generateSecret } from "../../utils/totp";

export default function AdminPanel() {
  const {
    user,
    activeUserId,
    farmers,
    logout,
    selectFarmer,
    register,
    deleteFarmer,
    updateFarmer,
  } = useAuth();
  const { showToast, showConfirm } = useNotification();

  const [loading, setLoading] = useState(false);
  const [expandedFarmerId, setExpandedFarmerId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Modales
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isMfaModalOpen, setIsMfaModalOpen] = useState(false);
  const [newMfaSecret, setNewMfaSecret] = useState("");
  const [registeredName, setRegisteredName] = useState("");

  // Campos para Registro
  const [regNombre, setRegNombre] = useState("");
  const [regFinca, setRegFinca] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regCorreo, setRegCorreo] = useState("");
  const [regMfaTipo, setRegMfaTipo] = useState<"totp" | "email">("email");
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Campos para Edición
  const [editId, setEditId] = useState<number | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editFinca, setEditFinca] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editCorreo, setEditCorreo] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);

  const checkPasswordStrength = (pwd: string) => {
    return {
      length: pwd.length >= 12,
      hasUpper: /[A-Z]/.test(pwd),
      hasLower: /[a-z]/.test(pwd),
      hasNumber: /[0-9]/.test(pwd),
      hasSpecial: /[^A-Za-z0-9]/.test(pwd),
    };
  };

  const regPwdStrength = checkPasswordStrength(regPassword);
  const isRegPasswordValid =
    regPwdStrength.length &&
    regPwdStrength.hasUpper &&
    regPwdStrength.hasLower &&
    regPwdStrength.hasNumber &&
    regPwdStrength.hasSpecial;

  const editPwdStrength = checkPasswordStrength(editPassword);
  const isEditPasswordValid =
    editPassword.length === 0 || // Opcional
    (editPwdStrength.length &&
      editPwdStrength.hasUpper &&
      editPwdStrength.hasLower &&
      editPwdStrength.hasNumber &&
      editPwdStrength.hasSpecial);

  const handleRegisterFarmer = async () => {
    if (!regUsername.trim() || !regPassword || !regNombre.trim() || !regFinca.trim() || !regCorreo.trim()) {
      showToast("Campos Requeridos", "Por favor completa todos los campos.", "warning");
      return;
    }

    if (/\d/.test(regNombre.trim())) {
      showToast("Nombre Inválido", "El nombre completo no debe contener números.", "error");
      return;
    }

    if (!regCorreo.includes("@") || !regCorreo.includes(".")) {
      showToast("Correo Inválido", "Por favor ingresa un correo electrónico válido.", "error");
      return;
    }

    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(regUsername.trim())) {
      showToast("Usuario Inválido", "Solo se permiten letras, números y guiones bajos.", "error");
      return;
    }

    if (!isRegPasswordValid) {
      showToast("Contraseña Débil", "La contraseña no cumple con los requisitos mínimos de seguridad.", "error");
      return;
    }

    try {
      setLoading(true);
      const mfaSecret = generateSecret();
      const res = await register(regUsername, regPassword, regNombre, regFinca, regCorreo, mfaSecret, regMfaTipo);
      if (res.success) {
        if (regMfaTipo === "totp") {
          setNewMfaSecret(mfaSecret);
          setRegisteredName(regNombre);
          setIsMfaModalOpen(true);
        } else {
          showToast("Éxito", "Agricultor registrado correctamente.", "success");
        }

        setRegNombre("");
        setRegFinca("");
        setRegUsername("");
        setRegPassword("");
        setRegCorreo("");
        setRegMfaTipo("email");
        setIsRegisterOpen(false);
      } else {
        showToast("Error", res.error || "No se pudo registrar.", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Error", "Ocurrió un error inesperado al registrar.", "error");
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (farmer: User) => {
    setEditId(farmer.id);
    setEditNombre(farmer.nombre);
    setEditFinca(farmer.finca);
    setEditUsername(farmer.username);
    setEditCorreo(farmer.correo || "");
    setEditPassword("");
    setShowEditPassword(false);
    setIsEditOpen(true);
  };

  const handleUpdateFarmer = async () => {
    if (editId === null) return;
    if (!editUsername.trim() || !editNombre.trim() || !editFinca.trim() || !editCorreo.trim()) {
      showToast("Campos Requeridos", "Por favor completa todos los campos.", "warning");
      return;
    }

    if (/\d/.test(editNombre.trim())) {
      showToast("Nombre Inválido", "El nombre completo no debe contener números.", "error");
      return;
    }

    if (!editCorreo.includes("@") || !editCorreo.includes(".")) {
      showToast("Correo Inválido", "Por favor ingresa un correo electrónico válido.", "error");
      return;
    }

    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(editUsername.trim())) {
      showToast("Usuario Inválido", "Solo se permiten letras, números y guiones bajos.", "error");
      return;
    }

    if (editPassword.length > 0 && !isEditPasswordValid) {
      showToast("Contraseña Débil", "La nueva contraseña no cumple con los requisitos de seguridad.", "error");
      return;
    }

    try {
      setLoading(true);
      const res = await updateFarmer(
        editId,
        editUsername,
        editNombre,
        editFinca,
        editCorreo,
        editPassword.trim() || undefined
      );

      if (res.success) {
        showToast("Éxito", "Información del agricultor actualizada correctamente.", "success");
        setIsEditOpen(false);
      } else {
        showToast("Error", res.error || "No se pudo actualizar la información.", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Error", "Ocurrió un error inesperado al actualizar.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFarmer = (farmer: User) => {
    showConfirm(
      "Eliminar Agricultor",
      `¿Estás seguro de que quieres eliminar a ${farmer.nombre}? Esta acción no se puede deshacer y borrará permanentemente todos sus datos de suelo, clima e historial.`,
      async () => {
        try {
          setLoading(true);
          const res = await deleteFarmer(farmer.id);
          if (res.success) {
            showToast("Éxito", `El agricultor ${farmer.nombre} ha sido eliminado.`, "success");
          } else {
            showToast("Error", res.error || "No se pudo eliminar al agricultor.", "error");
          }
        } catch (err) {
          console.error(err);
          showToast("Error", "Ocurrió un error inesperado al eliminar.", "error");
        } finally {
          setLoading(false);
        }
      },
      undefined,
      true
    );
  };

  const handleSelectAndManageData = (id: number) => {
    selectFarmer(id);
    router.push("/reports");
    showToast("Finca Seleccionada", "Se ha cargado el agricultor para gestión de datos.", "info");
  };

  const toggleExpand = (id: number) => {
    setExpandedFarmerId((prev) => (prev === id ? null : id));
  };

  // Filtrado de agricultores por buscador
  const filteredFarmers = farmers.filter((farmer) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      farmer.nombre.toLowerCase().includes(query) ||
      farmer.finca.toLowerCase().includes(query) ||
      farmer.username.toLowerCase().includes(query)
    );
  });

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
            <Text style={styles.title}>Panel de Fincas</Text>
            <Text style={styles.subtitle}>
              Administración de agricultores y accesos a reportes
            </Text>
          </View>

          {/* TOOLBAR: SEARCH & ADD */}
          <View style={styles.toolbar}>
            <View style={styles.searchContainer}>
              <MaterialIcons name="search" size={20} color="#94a3b8" style={{ marginRight: 6 }} />
              <TextInput
                placeholder="Buscar agricultor o finca..."
                placeholderTextColor="#94a3b8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={styles.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery("")}>
                  <MaterialIcons name="close" size={18} color="#94a3b8" />
                </Pressable>
              )}
            </View>
            <Pressable
              style={styles.addBtn}
              onPress={() => setIsRegisterOpen(true)}
            >
              <MaterialIcons name="person-add" size={20} color="#fff" />
            </Pressable>
          </View>

          {/* FARMERS LIST CONTAINER */}
          <View style={styles.listContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Agricultores</Text>
              <Text style={styles.sectionCounter}>
                {searchQuery.length > 0 ? `${filteredFarmers.length} encontrados` : `${farmers.length} totales`}
              </Text>
            </View>

            {filteredFarmers.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  {searchQuery.length > 0 
                    ? "No se encontraron resultados para tu búsqueda." 
                    : "No hay agricultores registrados aún."}
                </Text>
              </View>
            ) : (
              filteredFarmers.map((farmer) => {
                const isSelected = farmer.id === activeUserId;
                const isExpanded = expandedFarmerId === farmer.id;
                return (
                  <View
                    key={farmer.id}
                    style={[
                      styles.farmerCard,
                      isSelected && styles.farmerCardSelected,
                    ]}
                  >
                    <Pressable
                      style={styles.farmerCardHeader}
                      onPress={() => toggleExpand(farmer.id)}
                    >
                      <View style={styles.farmerAvatar}>
                        <Text style={styles.avatarText}>
                          {farmer.nombre.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.farmerCardName}>{farmer.nombre}</Text>
                        <Text style={styles.farmerCardSub}>🌾 {farmer.finca} • @{farmer.username}</Text>
                      </View>
                      <View style={styles.headerRightContainer}>
                        {isSelected && (
                          <View style={styles.activeLabel}>
                            <Text style={styles.activeLabelText}>Monitoreado</Text>
                          </View>
                        )}
                        <MaterialIcons
                          name={isExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                          size={22}
                          color="#94a3b8"
                        />
                      </View>
                    </Pressable>

                    {isExpanded && (
                      <>
                        <View style={styles.cardDivider} />
                        
                        <View style={styles.farmerCardBody}>
                          <View style={styles.infoRow}>
                            <MaterialIcons name="mail-outline" size={16} color="#64748b" />
                            <Text style={styles.infoRowText}>{farmer.correo || "Sin correo"}</Text>
                          </View>
                          {farmer.mfa_secret ? (
                            <Pressable
                              style={styles.mfaBadge}
                              onPress={async () => {
                                if (farmer.mfa_secret) {
                                  try {
                                    await Clipboard.setStringAsync(farmer.mfa_secret);
                                    showToast("Copiado", "Clave secreta copiada al portapapeles.", "success");
                                  } catch (e) {
                                    console.error("Error al copiar:", e);
                                    showToast("Error", "No se pudo copiar la clave.", "error");
                                  }
                                }
                              }}
                            >
                              <MaterialIcons name="vpn-key" size={12} color="#15803d" />
                              <Text style={styles.mfaBadgeText}>MFA Secreto: {farmer.mfa_secret}</Text>
                              <MaterialIcons name="content-copy" size={10} color="#15803d" style={{ marginLeft: 4 }} />
                            </Pressable>
                          ) : null}
                        </View>

                        <View style={styles.cardDivider} />

                        <View style={styles.farmerCardActions}>
                          <Pressable
                            style={[styles.farmerActionIconBtn, styles.editActionBtn]}
                            onPress={() => openEditModal(farmer)}
                          >
                            <MaterialIcons name="edit" size={18} color="#0284c7" />
                          </Pressable>

                          <Pressable
                            style={[styles.farmerActionIconBtn, styles.deleteActionBtn]}
                            onPress={() => handleDeleteFarmer(farmer)}
                          >
                            <MaterialIcons name="delete-outline" size={18} color="#dc2626" />
                          </Pressable>

                          <Pressable
                            style={[
                              styles.farmerActionBtn,
                              styles.manageActionBtn,
                              isSelected && { backgroundColor: "#15803d", borderColor: "#15803d" },
                            ]}
                            onPress={() => handleSelectAndManageData(farmer.id)}
                          >
                            <MaterialIcons
                              name="cloud-sync"
                              size={16}
                              color={isSelected ? "#fff" : "#16a34a"}
                            />
                            <Text
                              style={[
                                styles.farmerActionBtnText,
                                { color: isSelected ? "#fff" : "#16a34a" },
                              ]}
                            >
                              {isSelected ? "Gestionando" : "Gestionar"}
                            </Text>
                          </Pressable>
                        </View>
                      </>
                    )}
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>

        {/* FORMULARIO REGISTRAR AGRICULTOR */}
        {isRegisterOpen && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "#ffffff", zIndex: 999 }]}>
            <SafeAreaView style={styles.modalSafe}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Registrar Agricultor</Text>
                <Pressable
                  style={styles.modalCloseBtn}
                  onPress={() => setIsRegisterOpen(false)}
                >
                  <MaterialIcons name="close" size={22} color="#475569" />
                </Pressable>
              </View>

              <ScrollView
                contentContainerStyle={styles.modalFormContent}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Nombre Completo</Text>
                  <TextInput
                    placeholder="Ej. Wilmer Mendoza"
                    placeholderTextColor="#94a3b8"
                    value={regNombre}
                    onChangeText={setRegNombre}
                    style={styles.input}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Nombre de la Finca</Text>
                  <TextInput
                    placeholder="Ej. Hacienda Las Lomas"
                    placeholderTextColor="#94a3b8"
                    value={regFinca}
                    onChangeText={setRegFinca}
                    style={styles.input}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Correo Electrónico</Text>
                  <TextInput
                    placeholder="Ej. agricultor@email.com"
                    placeholderTextColor="#94a3b8"
                    value={regCorreo}
                    onChangeText={setRegCorreo}
                    style={styles.input}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Usuario de Ingreso</Text>
                  <TextInput
                    placeholder="Ej. wmendoza"
                    placeholderTextColor="#94a3b8"
                    value={regUsername}
                    onChangeText={setRegUsername}
                    style={styles.input}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Contraseña</Text>
                  <View style={styles.passwordInputContainer}>
                    <TextInput
                      placeholder="Crea una contraseña segura"
                      placeholderTextColor="#94a3b8"
                      secureTextEntry={!showRegPassword}
                      value={regPassword}
                      onChangeText={setRegPassword}
                      style={styles.passwordField}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <Pressable
                      onPress={() => setShowRegPassword(!showRegPassword)}
                      style={styles.eyeBtn}
                    >
                      <MaterialIcons
                        name={showRegPassword ? "visibility" : "visibility-off"}
                        size={20}
                        color="#64748b"
                      />
                    </Pressable>
                  </View>
                </View>

                {regPassword.length > 0 && (
                  <View style={styles.strengthCard}>
                    <Text style={styles.strengthTitle}>Requisitos de contraseña:</Text>
                    <Text
                      style={[
                        styles.strengthItem,
                        regPwdStrength.length ? styles.strengthValid : styles.strengthInvalid,
                      ]}
                    >
                      {regPwdStrength.length ? "✓" : "✗"} Mínimo 12 caracteres ({regPassword.length}/12)
                    </Text>
                    <Text
                      style={[
                        styles.strengthItem,
                        regPwdStrength.hasUpper ? styles.strengthValid : styles.strengthInvalid,
                      ]}
                    >
                      {regPwdStrength.hasUpper ? "✓" : "✗"} Al menos una mayúscula
                    </Text>
                    <Text
                      style={[
                        styles.strengthItem,
                        regPwdStrength.hasLower ? styles.strengthValid : styles.strengthInvalid,
                      ]}
                    >
                      {regPwdStrength.hasLower ? "✓" : "✗"} Al menos una minúscula
                    </Text>
                    <Text
                      style={[
                        styles.strengthItem,
                        regPwdStrength.hasNumber ? styles.strengthValid : styles.strengthInvalid,
                      ]}
                    >
                      {regPwdStrength.hasNumber ? "✓" : "✗"} Al menos un número
                    </Text>
                    <Text
                      style={[
                        styles.strengthItem,
                        regPwdStrength.hasSpecial ? styles.strengthValid : styles.strengthInvalid,
                      ]}
                    >
                      {regPwdStrength.hasSpecial ? "✓" : "✗"} Al menos un carácter especial
                    </Text>
                  </View>
                )}

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Método de Verificación en Dos Pasos (2FA)</Text>
                  <View style={styles.mfaOptionContainer}>
                    <Pressable
                      style={[styles.mfaOptionBtn, regMfaTipo === "totp" && styles.mfaOptionActive]}
                      onPress={() => setRegMfaTipo("totp")}
                    >
                      <MaterialIcons
                        name="phonelink-setup"
                        size={18}
                        color={regMfaTipo === "totp" ? "#16a34a" : "#64748b"}
                      />
                      <Text style={[styles.mfaOptionText, regMfaTipo === "totp" && styles.mfaOptionActiveText]}>
                        App Auth
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[styles.mfaOptionBtn, regMfaTipo === "email" && styles.mfaOptionActive]}
                      onPress={() => setRegMfaTipo("email")}
                    >
                      <MaterialIcons
                        name="email"
                        size={18}
                        color={regMfaTipo === "email" ? "#16a34a" : "#64748b"}
                      />
                      <Text style={[styles.mfaOptionText, regMfaTipo === "email" && styles.mfaOptionActiveText]}>
                        Correo OTP
                      </Text>
                    </Pressable>
                  </View>
                </View>

                <Pressable
                  style={[
                    styles.submitBtn,
                    !isRegPasswordValid && { backgroundColor: "#94a3b8" },
                  ]}
                  onPress={handleRegisterFarmer}
                  disabled={!isRegPasswordValid}
                >
                  <Text style={styles.submitBtnText}>Registrar en el Sistema</Text>
                </Pressable>
              </ScrollView>
            </SafeAreaView>
          </View>
        )}

        {/* FORMULARIO EDITAR AGRICULTOR */}
        {isEditOpen && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "#ffffff", zIndex: 999 }]}>
            <SafeAreaView style={styles.modalSafe}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Editar Información</Text>
                <Pressable style={styles.modalCloseBtn} onPress={() => setIsEditOpen(false)}>
                  <MaterialIcons name="close" size={22} color="#475569" />
                </Pressable>
              </View>

              <ScrollView
                contentContainerStyle={styles.modalFormContent}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Nombre Completo</Text>
                  <TextInput
                    placeholder="Ej. Wilmer Mendoza"
                    placeholderTextColor="#94a3b8"
                    value={editNombre}
                    onChangeText={setEditNombre}
                    style={styles.input}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Nombre de la Finca</Text>
                  <TextInput
                    placeholder="Ej. Hacienda Las Lomas"
                    placeholderTextColor="#94a3b8"
                    value={editFinca}
                    onChangeText={setEditFinca}
                    style={styles.input}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Correo Electrónico</Text>
                  <TextInput
                    placeholder="Ej. agricultor@email.com"
                    placeholderTextColor="#94a3b8"
                    value={editCorreo}
                    onChangeText={setEditCorreo}
                    style={styles.input}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Usuario de Ingreso</Text>
                  <TextInput
                    placeholder="Ej. wmendoza"
                    placeholderTextColor="#94a3b8"
                    value={editUsername}
                    onChangeText={setEditUsername}
                    style={styles.input}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Nueva Contraseña (Opcional)</Text>
                  <View style={styles.passwordInputContainer}>
                    <TextInput
                      placeholder="Dejar vacío para mantener la actual"
                      placeholderTextColor="#94a3b8"
                      secureTextEntry={!showEditPassword}
                      value={editPassword}
                      onChangeText={setEditPassword}
                      style={styles.passwordField}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <Pressable
                      onPress={() => setShowEditPassword(!showEditPassword)}
                      style={styles.eyeBtn}
                    >
                      <MaterialIcons
                        name={showEditPassword ? "visibility" : "visibility-off"}
                        size={20}
                        color="#64748b"
                      />
                    </Pressable>
                  </View>
                </View>

                {editPassword.length > 0 && (
                  <View style={styles.strengthCard}>
                    <Text style={styles.strengthTitle}>Requisitos de nueva contraseña:</Text>
                    <Text
                      style={[
                        styles.strengthItem,
                        editPwdStrength.length ? styles.strengthValid : styles.strengthInvalid,
                      ]}
                    >
                      {editPwdStrength.length ? "✓" : "✗"} Mínimo 12 caracteres ({editPassword.length}/12)
                    </Text>
                    <Text
                      style={[
                        styles.strengthItem,
                        editPwdStrength.hasUpper ? styles.strengthValid : styles.strengthInvalid,
                      ]}
                    >
                      {editPwdStrength.hasUpper ? "✓" : "✗"} Al menos una mayúscula
                    </Text>
                    <Text
                      style={[
                        styles.strengthItem,
                        editPwdStrength.hasLower ? styles.strengthValid : styles.strengthInvalid,
                      ]}
                    >
                      {editPwdStrength.hasLower ? "✓" : "✗"} Al menos una minúscula
                    </Text>
                    <Text
                      style={[
                        styles.strengthItem,
                        editPwdStrength.hasNumber ? styles.strengthValid : styles.strengthInvalid,
                      ]}
                    >
                      {editPwdStrength.hasNumber ? "✓" : "✗"} Al menos un número
                    </Text>
                    <Text
                      style={[
                        styles.strengthItem,
                        editPwdStrength.hasSpecial ? styles.strengthValid : styles.strengthInvalid,
                      ]}
                    >
                      {editPwdStrength.hasSpecial ? "✓" : "✗"} Al menos un carácter especial
                    </Text>
                  </View>
                )}

                <Pressable
                  style={[
                    styles.submitBtn,
                    !isEditPasswordValid && { backgroundColor: "#94a3b8" },
                  ]}
                  onPress={handleUpdateFarmer}
                  disabled={!isEditPasswordValid}
                >
                  <Text style={styles.submitBtnText}>Guardar Cambios</Text>
                </Pressable>
              </ScrollView>
            </SafeAreaView>
          </View>
        )}

        {/* MODAL MOSTRAR MFA SECRETO AL CREAR */}
        {isMfaModalOpen && (
          <View style={[StyleSheet.absoluteFill, { zIndex: 999 }]}>
            <View style={styles.mfaBackdrop}>
              <View style={styles.mfaContainer}>
                <View style={styles.mfaHeader}>
                  <MaterialIcons name="security" size={32} color="#16a34a" />
                  <Text style={styles.mfaTitle}>Registro Exitoso</Text>
                </View>
                <Text style={styles.mfaDesc}>
                  El agricultor <Text style={{ fontWeight: "700" }}>{registeredName}</Text> ha sido creado.
                  Para asegurar su cuenta, configura el código de verificación de 2 pasos (MFA):
                </Text>

                <View style={styles.mfaSecretBox}>
                  <Text style={styles.mfaSecretLabel}>CLAVE SECRETA MFA:</Text>
                  <Text selectable={true} style={styles.mfaSecretCode}>{newMfaSecret}</Text>
                </View>

                <Pressable
                  style={styles.mfaCopyBtn}
                  onPress={async () => {
                    try {
                      await Clipboard.setStringAsync(newMfaSecret);
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
                  * Ingresa este código de 16 caracteres en Google Authenticator o Authy para generar los tokens temporales de ingreso.
                </Text>

                <Pressable
                  style={styles.mfaCloseBtn}
                  onPress={() => setIsMfaModalOpen(false)}
                >
                  <Text style={styles.mfaCloseBtnText}>Entendido</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  profileAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  profileAvatarText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#166534",
  },
  profileUser: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1e293b",
  },
  profileRole: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
    marginTop: 2,
  },
  logoutBtn: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  logoutBtnText: {
    color: "#dc2626",
    fontSize: 11,
    fontWeight: "700",
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
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#1e293b",
    height: "100%",
  },
  addBtn: {
    width: 46,
    height: 46,
    backgroundColor: "#16a34a",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#16a34a",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  listContainer: {
    marginHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionCounter: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94a3b8",
  },
  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  emptyText: {
    color: "#64748b",
    fontSize: 12,
    fontStyle: "italic",
    textAlign: "center",
  },
  farmerCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 10,
    shadowColor: "#0f172a",
    shadowOpacity: 0.02,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  farmerCardSelected: {
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4",
  },
  farmerCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardDivider: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginVertical: 12,
  },
  headerRightContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  farmerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#166534",
  },
  farmerCardName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1e293b",
  },
  farmerCardSub: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 3,
  },
  activeLabel: {
    backgroundColor: "#dcfce7",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activeLabelText: {
    color: "#15803d",
    fontSize: 10,
    fontWeight: "800",
  },
  farmerCardBody: {
    gap: 8,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  infoRowText: {
    fontSize: 12,
    color: "#475569",
  },
  mfaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#dcfce7",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  mfaBadgeText: {
    fontSize: 10,
    color: "#15803d",
    fontWeight: "700",
  },
  farmerCardActions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  farmerActionIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  farmerActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
  },
  editActionBtn: {
    backgroundColor: "#f0f9ff",
    borderColor: "#bae6fd",
  },
  deleteActionBtn: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
  },
  manageActionBtn: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
  },
  farmerActionBtnText: {
    fontSize: 12,
    fontWeight: "800",
  },
  modalSafe: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalFormContent: {
    padding: 20,
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 13,
    color: "#1e293b",
  },
  passwordInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  passwordField: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 13,
    color: "#1e293b",
  },
  eyeBtn: {
    paddingLeft: 10,
    justifyContent: "center",
  },
  strengthCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 4,
  },
  strengthTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 2,
  },
  strengthItem: {
    fontSize: 10,
    fontWeight: "600",
  },
  strengthValid: {
    color: "#16a34a",
  },
  strengthInvalid: {
    color: "#dc2626",
  },
  submitBtn: {
    backgroundColor: "#16a34a",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  submitBtnText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 14,
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
  mfaBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  mfaContainer: {
    backgroundColor: "#ffffff",
    width: "100%",
    maxWidth: 340,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  mfaHeader: {
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  mfaTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  mfaDesc: {
    fontSize: 12,
    color: "#475569",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  mfaSecretBox: {
    width: "100%",
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    gap: 4,
    marginBottom: 12,
  },
  mfaSecretLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748b",
  },
  mfaSecretCode: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: 1,
  },
  mfaInstructions: {
    fontSize: 10,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 14,
    marginBottom: 20,
  },
  mfaCopyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4",
    marginBottom: 12,
    width: "100%",
  },
  mfaCopyBtnText: {
    fontSize: 12,
    color: "#16a34a",
    fontWeight: "700",
  },
  mfaCloseBtn: {
    backgroundColor: "#16a34a",
    width: "100%",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  mfaCloseBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
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
});
