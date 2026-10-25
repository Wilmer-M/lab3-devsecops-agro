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
import { BlurView } from "expo-blur";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../context/authContext";
import { useNotification } from "../context/notificationContext";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

export default function LoginScreen() {
  const {
    login,
    verifyMfaAndLogin,
    enviarOtpRecuperacion,
    restablecerContrasenaConEmail,
    restablecerContrasenaConTotp,
  } = useAuth();
  const { showToast } = useNotification();
  const [loading, setLoading] = useState(false);

  // Campos del formulario
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Estado MFA y bloqueo
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaTipo, setMfaTipo] = useState<"totp" | "email">("totp");
  const [mfaCorreo, setMfaCorreo] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Estados para recuperación de contraseña
  const [isRecovery, setIsRecovery] = useState(false);
  const [recoveryMethod, setRecoveryMethod] = useState<"email" | "totp">("email");
  const [otpSent, setOtpSent] = useState(false);
  const [recoveryOtpCode, setRecoveryOtpCode] = useState("");
  const [recoveryTotpCode, setRecoveryTotpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  const checkPasswordStrength = (pwd: string) => {
    return {
      length: pwd.length >= 12,
      hasUpper: /[A-Z]/.test(pwd),
      hasLower: /[a-z]/.test(pwd),
      hasNumber: /[0-9]/.test(pwd),
      hasSpecial: /[^A-Za-z0-9]/.test(pwd),
    };
  };

  const handleSendRecoveryOtp = async () => {
    if (!username.trim()) {
      showToast("Campos Requeridos", "Ingresa tu nombre de usuario.", "warning");
      return;
    }
    setLoading(true);
    try {
      const res = await enviarOtpRecuperacion(username);
      if (res.success) {
        setOtpSent(true);
        showToast("Código Enviado", res.correo ? `Revisa tu correo (${res.correo})` : "Revisa tu correo electrónico.", "success");
      } else {
        showToast("Error", res.error || "No se pudo enviar el código.", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Error", "Ocurrió un error inesperado.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordWithEmail = async () => {
    if (!username.trim() || !recoveryOtpCode.trim() || !newPassword || !confirmNewPassword) {
      showToast("Campos Requeridos", "Por favor completa todos los campos.", "warning");
      return;
    }
    if (recoveryOtpCode.trim().length !== 6) {
      showToast("Código Inválido", "El código OTP debe tener exactamente 6 dígitos.", "warning");
      return;
    }
    const newPwdStrength = checkPasswordStrength(newPassword);
    const isNewPasswordValid =
      newPwdStrength.length &&
      newPwdStrength.hasUpper &&
      newPwdStrength.hasLower &&
      newPwdStrength.hasNumber &&
      newPwdStrength.hasSpecial;

    if (!isNewPasswordValid) {
      showToast("Contraseña Débil", "Por favor cumple con todos los requisitos de seguridad.", "error");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      showToast("Mapeo Incorrecto", "Las contraseñas no coinciden.", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await restablecerContrasenaConEmail(username, recoveryOtpCode, newPassword);
      if (res.success) {
        showToast("Éxito", "Contraseña restablecida correctamente. Ahora puedes iniciar sesión.", "success");
        resetRecoveryState();
        setPassword("");
        setUsername("");
      } else {
        showToast("Error", res.error || "No se pudo restablecer la contraseña.", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Error", "Ocurrió un error inesperado.", "error");
    } finally {
      setLoading(false);
    }
  };

  const resetRecoveryState = () => {
    setIsRecovery(false);
    setRecoveryMethod("email");
    setOtpSent(false);
    setRecoveryOtpCode("");
    setRecoveryTotpCode("");
    setNewPassword("");
    setConfirmNewPassword("");
  };

  const handleResetPasswordWithTotp = async () => {
    if (!username.trim() || !recoveryTotpCode.trim() || !newPassword || !confirmNewPassword) {
      showToast("Campos Requeridos", "Por favor completa todos los campos.", "warning");
      return;
    }
    if (recoveryTotpCode.trim().length !== 6) {
      showToast("Código Inválido", "El código TOTP debe tener exactamente 6 dígitos.", "warning");
      return;
    }
    const newPwdStrength = checkPasswordStrength(newPassword);
    const isNewPasswordValid =
      newPwdStrength.length &&
      newPwdStrength.hasUpper &&
      newPwdStrength.hasLower &&
      newPwdStrength.hasNumber &&
      newPwdStrength.hasSpecial;

    if (!isNewPasswordValid) {
      showToast("Contraseña Débil", "Por favor cumple con todos los requisitos de seguridad.", "error");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      showToast("Mapeo Incorrecto", "Las contraseñas no coinciden.", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await restablecerContrasenaConTotp(username, recoveryTotpCode, newPassword);
      if (res.success) {
        showToast("Éxito", "Contraseña restablecida correctamente. Ahora puedes iniciar sesión.", "success");
        resetRecoveryState();
        setPassword("");
        setUsername("");
      } else {
        showToast("Error", res.error || "No se pudo restablecer la contraseña.", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Error", "Ocurrió un error inesperado.", "error");
    } finally {
      setLoading(false);
    }
  };



  const handleLogin = async () => {
    if (!username.trim() || !password) {
      showToast("Campos Requeridos", "Por favor ingresa usuario y contraseña.", "warning");
      return;
    }
    setLoading(true);
    try {
      const res = await login(username, password);
      if (res.success) {
        if (res.requireMfa) {
          setMfaRequired(true);
          setMfaCode("");
          setMfaTipo(res.mfaTipo || "totp");
          setMfaCorreo(res.correo || "");
          if (res.mfaTipo === "email") {
            showToast("Código Enviado", "Revisa tu correo electrónico para el código de verificación.", "info");
          } else {
            console.log(`[MFA] Secreto TOTP para @${username}: ${res.mfaSecret}`);
            showToast("Verificación TOTP", "Ingresa el código de tu app autenticadora.", "info");
          }
        }
      } else {
        showToast("Error de Acceso", res.error || "Credenciales incorrectas.", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Error", "Ocurrió un problema inesperado.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async () => {
    if (mfaCode.trim().length !== 6) {
      showToast("Código Inválido", "Por favor ingresa los 6 dígitos del código.", "warning");
      return;
    }
    setLoading(true);
    try {
      const res = await verifyMfaAndLogin(username, mfaCode);
      if (res.success) {
        showToast("Éxito", "Sesión iniciada correctamente.", "success");
      } else {
        showToast("Código Incorrecto", res.error || "El código ingresado no es válido.", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Error", "Ocurrió un problema inesperado al validar.", "error");
    } finally {
      setLoading(false);
    }
  };



  if (mfaRequired) {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.logoSection}>
              <Text style={styles.logoIcon}>🔐</Text>
              <Text style={styles.logoTitle}>Verificación MFA</Text>
              <Text style={styles.logoSubtitle}>Seguridad en Dos Pasos</Text>
            </View>

            <BlurView intensity={70} tint="light" style={styles.blurCard}>
              <Text style={styles.cardTitle}>{mfaTipo === "email" ? "Código Enviado al Correo" : "Introduce el Código TOTP"}</Text>
              <Text style={styles.cardSubtitle}>
                {mfaTipo === "email"
                  ? `Ingresa el código de 6 dígitos enviado a ${mfaCorreo || "tu correo"} para @${username}.`
                  : `Ingresa el código de 6 dígitos generado en tu aplicación (Google Authenticator / Authy) para @${username}.`}
              </Text>

              <View style={styles.form}>
                <Text style={styles.label}>Código de 6 dígitos</Text>
                <TextInput
                  placeholder="000000"
                  placeholderTextColor="#94a3b8"
                  value={mfaCode}
                  onChangeText={setMfaCode}
                  style={[styles.input, { textAlign: "center", fontSize: 22, fontWeight: "bold", letterSpacing: 6 }]}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <Pressable
                  style={styles.btnPrimary}
                  onPress={handleMfaSubmit}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.btnPrimaryText}>Verificar e Ingresar</Text>
                  )}
                </Pressable>

                {mfaTipo === "email" && (
                  <Pressable
                    style={[styles.btnToggle, { marginTop: 0 }]}
                    onPress={async () => {
                      try {
                        setLoading(true);
                        const res = await login(username, password);
                        if (res.requireMfa) {
                          showToast("Código Reenviado", "Revisa tu correo para el nuevo código.", "info");
                        }
                      } catch (e) {
                        showToast("Error", "No se pudo reenviar el código.", "error");
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                  >
                    <Text style={styles.btnToggleText}>Reenviar Código al Correo</Text>
                  </Pressable>
                )}

                <Pressable
                  style={styles.btnToggle}
                  onPress={() => {
                    setMfaRequired(false);
                    setMfaCode("");
                  }}
                >
                  <Text style={styles.btnToggleText}>Regresar a Iniciar Sesión</Text>
                </Pressable>
              </View>
            </BlurView>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Recuperación de contraseña
  if (isRecovery) {
    const newPwdStrength = checkPasswordStrength(newPassword);
    const isNewPasswordValid =
      newPwdStrength.length &&
      newPwdStrength.hasUpper &&
      newPwdStrength.hasLower &&
      newPwdStrength.hasNumber &&
      newPwdStrength.hasSpecial;

    const byEmail = recoveryMethod === "email";
    const canSubmitNewPassword = byEmail
      ? (otpSent && recoveryOtpCode.trim().length === 6 && isNewPasswordValid)
      : (recoveryTotpCode.trim().length === 6 && isNewPasswordValid);

    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.logoSection}>
              <Text style={styles.logoIcon}>🔑</Text>
              <Text style={styles.logoTitle}>Recuperar Cuenta</Text>
              <Text style={styles.logoSubtitle}>Restablecer contraseña</Text>
            </View>

            <BlurView intensity={70} tint="light" style={styles.blurCard}>
              <Text style={styles.cardTitle}>Restablecer Contraseña</Text>

              {/* Selector de método */}
              <View style={{ flexDirection: "row", marginBottom: 16, gap: 8 }}>
                <Pressable
                  onPress={() => { setRecoveryMethod("email"); setOtpSent(false); setRecoveryOtpCode(""); setRecoveryTotpCode(""); }}
                  style={{
                    flex: 1, paddingVertical: 10, borderRadius: 12,
                    backgroundColor: byEmail ? "#16a34a" : "#f1f5f9",
                    alignItems: "center",
                  }}
                >
                  <Text style={{
                    fontSize: 13, fontWeight: "800",
                    color: byEmail ? "#fff" : "#475569",
                  }}>
                    📧 Correo Electrónico
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => { setRecoveryMethod("totp"); setOtpSent(false); setRecoveryOtpCode(""); setRecoveryTotpCode(""); }}
                  style={{
                    flex: 1, paddingVertical: 10, borderRadius: 12,
                    backgroundColor: !byEmail ? "#16a34a" : "#f1f5f9",
                    alignItems: "center",
                  }}
                >
                  <Text style={{
                    fontSize: 13, fontWeight: "800",
                    color: !byEmail ? "#fff" : "#475569",
                  }}>
                    🔐 App Autenticadora
                  </Text>
                </Pressable>
              </View>

              <View style={styles.form}>
                {/* Nombre de Usuario */}
                <Text style={styles.label}>Usuario</Text>
                <TextInput
                  placeholder="Ej. wmendoza"
                  placeholderTextColor="#94a3b8"
                  value={username}
                  onChangeText={setUsername}
                  style={styles.input}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                {byEmail ? (
                  <>
                    {!otpSent ? (
                      <Pressable
                        style={[styles.btnSecondary, { marginTop: 4 }]}
                        onPress={handleSendRecoveryOtp}
                        disabled={loading || !username.trim()}
                      >
                        {loading ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={styles.btnSecondaryText}>Enviar Código OTP al Correo</Text>
                        )}
                      </Pressable>
                    ) : (
                      <>
                        <Text style={styles.label}>Código de 6 dígitos (Correo)</Text>
                        <TextInput
                          placeholder="000000"
                          placeholderTextColor="#94a3b8"
                          value={recoveryOtpCode}
                          onChangeText={setRecoveryOtpCode}
                          style={[styles.input, { textAlign: "center", fontSize: 20, fontWeight: "bold", letterSpacing: 4 }]}
                          keyboardType="number-pad"
                          maxLength={6}
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                        <Pressable
                          style={[styles.btnToggle, { marginTop: -4, marginBottom: 4 }]}
                          onPress={handleSendRecoveryOtp}
                          disabled={loading}
                        >
                          <Text style={[styles.btnToggleText, { fontSize: 12 }]}>Reenviar código</Text>
                        </Pressable>
                      </>
                    )}

                    {/* Nueva Contraseña */}
                    <Text style={styles.label}>Nueva Contraseña</Text>
                    <View style={styles.passwordContainer}>
                      <TextInput
                        placeholder="Crea una nueva contraseña segura"
                        placeholderTextColor="#94a3b8"
                        secureTextEntry={!showNewPassword}
                        value={newPassword}
                        onChangeText={setNewPassword}
                        style={styles.passwordInput}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <Pressable onPress={() => setShowNewPassword(!showNewPassword)} style={styles.eyeBtn}>
                        <MaterialIcons name={showNewPassword ? "visibility" : "visibility-off"} size={20} color="#64748b" />
                      </Pressable>
                    </View>

                    {newPassword.length > 0 && (
                      <View style={styles.strengthContainer}>
                        <Text style={styles.strengthTitle}>Requisitos de contraseña:</Text>
                        <Text style={[styles.strengthItem, newPwdStrength.length ? styles.strengthValid : styles.strengthInvalid]}>
                          {newPwdStrength.length ? "✓" : "✗"} Mínimo 12 caracteres ({newPassword.length}/12)
                        </Text>
                        <Text style={[styles.strengthItem, newPwdStrength.hasUpper ? styles.strengthValid : styles.strengthInvalid]}>
                          {newPwdStrength.hasUpper ? "✓" : "✗"} Al menos una mayúscula
                        </Text>
                        <Text style={[styles.strengthItem, newPwdStrength.hasLower ? styles.strengthValid : styles.strengthInvalid]}>
                          {newPwdStrength.hasLower ? "✓" : "✗"} Al menos una minúscula
                        </Text>
                        <Text style={[styles.strengthItem, newPwdStrength.hasNumber ? styles.strengthValid : styles.strengthInvalid]}>
                          {newPwdStrength.hasNumber ? "✓" : "✗"} Al menos un número
                        </Text>
                        <Text style={[styles.strengthItem, newPwdStrength.hasSpecial ? styles.strengthValid : styles.strengthInvalid]}>
                          {newPwdStrength.hasSpecial ? "✓" : "✗"} Al menos un carácter especial (ej. !@#$)
                        </Text>
                      </View>
                    )}

                    {/* Confirmar Contraseña */}
                    <Text style={styles.label}>Confirmar Contraseña</Text>
                    <View style={styles.passwordContainer}>
                      <TextInput
                        placeholder="Repite la contraseña"
                        placeholderTextColor="#94a3b8"
                        secureTextEntry={!showConfirmNewPassword}
                        value={confirmNewPassword}
                        onChangeText={setConfirmNewPassword}
                        style={styles.passwordInput}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <Pressable onPress={() => setShowConfirmNewPassword(!showConfirmNewPassword)} style={styles.eyeBtn}>
                        <MaterialIcons name={showConfirmNewPassword ? "visibility" : "visibility-off"} size={20} color="#64748b" />
                      </Pressable>
                    </View>

                    <Pressable
                      style={[styles.btnPrimary, !canSubmitNewPassword && { backgroundColor: "#94a3b8" }]}
                      onPress={handleResetPasswordWithEmail}
                      disabled={loading || !canSubmitNewPassword}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.btnPrimaryText}>Restablecer Contraseña</Text>
                      )}
                    </Pressable>
                  </>
                ) : (
                  <>
                    {/* TOTP recovery */}
                    <Text style={styles.label}>Código de 6 dígitos (TOTP)</Text>
                    <TextInput
                      placeholder="000000"
                      placeholderTextColor="#94a3b8"
                      value={recoveryTotpCode}
                      onChangeText={setRecoveryTotpCode}
                      style={[styles.input, { textAlign: "center", fontSize: 20, fontWeight: "bold", letterSpacing: 4 }]}
                      keyboardType="number-pad"
                      maxLength={6}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />

                    {/* Nueva Contraseña */}
                    <Text style={styles.label}>Nueva Contraseña</Text>
                    <View style={styles.passwordContainer}>
                      <TextInput
                        placeholder="Crea una nueva contraseña segura"
                        placeholderTextColor="#94a3b8"
                        secureTextEntry={!showNewPassword}
                        value={newPassword}
                        onChangeText={setNewPassword}
                        style={styles.passwordInput}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <Pressable onPress={() => setShowNewPassword(!showNewPassword)} style={styles.eyeBtn}>
                        <MaterialIcons name={showNewPassword ? "visibility" : "visibility-off"} size={20} color="#64748b" />
                      </Pressable>
                    </View>

                    {newPassword.length > 0 && (
                      <View style={styles.strengthContainer}>
                        <Text style={styles.strengthTitle}>Requisitos de contraseña:</Text>
                        <Text style={[styles.strengthItem, newPwdStrength.length ? styles.strengthValid : styles.strengthInvalid]}>
                          {newPwdStrength.length ? "✓" : "✗"} Mínimo 12 caracteres ({newPassword.length}/12)
                        </Text>
                        <Text style={[styles.strengthItem, newPwdStrength.hasUpper ? styles.strengthValid : styles.strengthInvalid]}>
                          {newPwdStrength.hasUpper ? "✓" : "✗"} Al menos una mayúscula
                        </Text>
                        <Text style={[styles.strengthItem, newPwdStrength.hasLower ? styles.strengthValid : styles.strengthInvalid]}>
                          {newPwdStrength.hasLower ? "✓" : "✗"} Al menos una minúscula
                        </Text>
                        <Text style={[styles.strengthItem, newPwdStrength.hasNumber ? styles.strengthValid : styles.strengthInvalid]}>
                          {newPwdStrength.hasNumber ? "✓" : "✗"} Al menos un número
                        </Text>
                        <Text style={[styles.strengthItem, newPwdStrength.hasSpecial ? styles.strengthValid : styles.strengthInvalid]}>
                          {newPwdStrength.hasSpecial ? "✓" : "✗"} Al menos un carácter especial (ej. !@#$)
                        </Text>
                      </View>
                    )}

                    {/* Confirmar Contraseña */}
                    <Text style={styles.label}>Confirmar Contraseña</Text>
                    <View style={styles.passwordContainer}>
                      <TextInput
                        placeholder="Repite la contraseña"
                        placeholderTextColor="#94a3b8"
                        secureTextEntry={!showConfirmNewPassword}
                        value={confirmNewPassword}
                        onChangeText={setConfirmNewPassword}
                        style={styles.passwordInput}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <Pressable onPress={() => setShowConfirmNewPassword(!showConfirmNewPassword)} style={styles.eyeBtn}>
                        <MaterialIcons name={showConfirmNewPassword ? "visibility" : "visibility-off"} size={20} color="#64748b" />
                      </Pressable>
                    </View>

                    <Pressable
                      style={[styles.btnPrimary, !canSubmitNewPassword && { backgroundColor: "#94a3b8" }]}
                      onPress={handleResetPasswordWithTotp}
                      disabled={loading || !canSubmitNewPassword}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.btnPrimaryText}>Restablecer Contraseña</Text>
                      )}
                    </Pressable>
                  </>
                )}

                <Pressable
                  style={styles.btnToggle}
                  onPress={resetRecoveryState}
                >
                  <Text style={styles.btnToggleText}>Cancelar y Volver</Text>
                </Pressable>
              </View>
            </BlurView>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* LOGO O ELEMENTO GRÁFICO */}
          <View style={styles.logoSection}>
            <Text style={styles.logoIcon}>🌱</Text>
            <Text style={styles.logoTitle}>AgroSmart</Text>
            <Text style={styles.logoSubtitle}>
              Monitoreo Inteligente de Cultivos
            </Text>
          </View>

          {/* CARD DE INGRESO CON BLUR */}
          <BlurView intensity={70} tint="light" style={styles.blurCard}>
            <Text style={styles.cardTitle}>Iniciar Sesión</Text>
            <Text style={styles.cardSubtitle}>
              Ingresa tus credenciales para acceder
            </Text>

            <View style={styles.form}>
              {/* Nombre de Usuario */}
              <Text style={styles.label}>Usuario</Text>
              <TextInput
                placeholder="Ej. wmendoza"
                placeholderTextColor="#94a3b8"
                value={username}
                onChangeText={setUsername}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
              />

              {/* Contraseña */}
              <Text style={styles.label}>Contraseña</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  placeholder="Ingresa tu contraseña"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  style={styles.passwordInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  <MaterialIcons name={showPassword ? "visibility" : "visibility-off"} size={20} color="#64748b" />
                </Pressable>
              </View>

              {/* BOTÓN DE ACCIÓN */}
              <Pressable
                style={styles.btnPrimary}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.btnPrimaryText}>Acceder al Panel</Text>
                )}
              </Pressable>

              {/* ENLACE PARA RECUPERACIÓN DE CONTRASEÑA */}
              <Pressable
                style={[styles.btnToggle, { marginTop: 4 }]}
                onPress={() => {
                  setIsRecovery(true);
                  setUsername("");
                }}
              >
                <Text style={[styles.btnToggleText, { color: "#64748b" }]}>
                  ¿Olvidaste tu contraseña?
                </Text>
              </Pressable>
            </View>
          </BlurView>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#eef2f7",
  },
  keyboardView: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  logoSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoIcon: {
    fontSize: 52,
    marginBottom: 8,
  },
  logoTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: "#0f5228", // Verde agrícola premium
    letterSpacing: -1,
  },
  logoSubtitle: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 4,
    fontWeight: "600",
  },
  blurCard: {
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
    shadowColor: "#0f5228",
    shadowOpacity: 0.05,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
    overflow: "hidden",
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1e293b",
  },
  cardSubtitle: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 4,
    marginBottom: 20,
  },
  form: {
    gap: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    color: "#1e293b",
    marginBottom: 8,
  },
  btnPrimary: {
    backgroundColor: "#16a34a",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    shadowColor: "#16a34a",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  btnPrimaryText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
  },
  btnSecondary: {
    backgroundColor: "#fff",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#16a34a",
  },
  btnSecondaryText: {
    color: "#16a34a",
    fontWeight: "800",
    fontSize: 15,
  },
  btnToggle: {
    alignItems: "center",
    marginTop: 12,
    paddingVertical: 6,
  },
  btnToggleText: {
    color: "#166534",
    fontWeight: "700",
    fontSize: 13,
    textAlign: "center",
  },
  strengthContainer: {
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 8,
    gap: 4,
  },
  strengthTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 4,
  },
  strengthItem: {
    fontSize: 11,
    fontWeight: "600",
  },
  strengthValid: {
    color: "#16a34a",
  },
  strengthInvalid: {
    color: "#dc2626",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 0,
    fontSize: 14,
    color: "#1e293b",
  },
  eyeBtn: {
    paddingLeft: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  eyeText: {
    fontSize: 16,
  },
});
