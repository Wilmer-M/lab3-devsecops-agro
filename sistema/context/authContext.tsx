import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { AppState, AppStateStatus, View, Modal, StyleSheet, Text, Pressable, Platform } from "react-native";
import { BlurView } from "expo-blur";
import * as Linking from "expo-linking";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Constants from "expo-constants";
import { initDB, addLogEntry } from "../utils/db";
import { generateSecret, verifyTOTP } from "../utils/totp";
import { comparePassword, hashPassword, isHashed, isExpoHash } from "../utils/crypto";
import { useNotification } from "./notificationContext";

const getApiUrl = () => {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(":")[0];
    return `http://${ip}:3000`;
  }
  return "http://localhost:3000";
};

export type User = {
  id: number;
  username: string;
  nombre: string;
  rol: "admin" | "agricultor" | "superadmin";
  finca: string;
  correo?: string;
  mfa_secret?: string;
  mfa_tipo?: "totp" | "email";
  organizacion_id?: number | null;
};

type AuthContextType = {
  user: User | null;
  activeUserId: number | null;
  farmers: User[];
  organizaciones: any[];
  logEntries: any[];
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string; requireMfa?: boolean; mfaSecret?: string; correo?: string; mfaTipo?: "totp" | "email" }>;
  verifyMfaAndLogin: (username: string, code: string, mfaTipo?: "totp" | "email") => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  register: (username: string, password: string, nombre: string, finca: string, correo?: string, mfaSecret?: string, mfaTipo?: "totp" | "email") => Promise<{ success: boolean; error?: string; mfaSecret?: string }>;
  selectFarmer: (id: number | null) => void;
  loadFarmers: () => Promise<void>;
  loadLogEntries: () => Promise<void>;
  loadOrganizaciones: () => Promise<void>;
  deleteFarmer: (id: number) => Promise<{ success: boolean; error?: string }>;
  updateFarmer: (id: number, username: string, nombre: string, finca: string, correo: string, password?: string, mfaTipo?: "totp" | "email") => Promise<{ success: boolean; error?: string }>;
  createOrganizacion: (nombre: string) => Promise<{ success: boolean; error?: string }>;
  deleteOrganizacion: (id: number) => Promise<{ success: boolean; error?: string }>;
  updateOrganizacion: (id: number, nombre: string) => Promise<{ success: boolean; error?: string }>;
  registerAdminOrganizacion: (username: string, password: string, nombre: string, correo: string, organizacionId: number, mfaTipo?: "totp" | "email") => Promise<{ success: boolean; error?: string; mfaSecret?: string }>;
  updateAdminOrganizacion: (id: number, username: string, nombre: string, correo: string, password?: string, mfaTipo?: "totp" | "email") => Promise<{ success: boolean; error?: string }>;
  deleteAdminOrganizacion: (id: number) => Promise<{ success: boolean; error?: string }>;
  enviarOtpRecuperacion: (username: string) => Promise<{ success: boolean; error?: string; correo?: string }>;
  restablecerContrasenaConEmail: (username: string, otpCode: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  loadingSession: boolean;
  restablecerContrasenaConTotp: (username: string, totpCode: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  resetInactivityTimer: () => void;
  MFA_BLOCK_SECONDS: number;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showToast } = useNotification();
  const [user, setUser] = useState<User | null>(null);
  const [activeUserId, setActiveUserId] = useState<number | null>(null);
  const [farmers, setFarmers] = useState<User[]>([]);
  const [loadingSession, setLoadingSession] = useState(true);
  const [organizaciones, setOrganizaciones] = useState<any[]>([]);
  const [logEntries, setLogEntries] = useState<any[]>([]);
  const MFA_BLOCK_SECONDS = 300;

  // Estados para advertencia de inactividad
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningCountdown, setWarningCountdown] = useState(10);

  const lastInteractionTime = useRef<number>(Date.now());
  const lastDbUpdateTime = useRef<number>(0);
  const countdownIntervalRef = useRef<any>(null);
  const INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 1 hora en milisegundos

  // Actualizar última actividad en la base de datos
  const updateDbActivity = async () => {
    if (user) {
      try {
        const db = await initDB();
        await db.runAsync(
          "UPDATE sesion_activa SET ultima_actividad = ? WHERE usuario_id = ?",
          [new Date().toISOString(), user.id]
        );
      } catch (e) {
        console.error("Error al actualizar actividad en BD:", e);
      }
    }
  };

  // Restablecer el temporizador de inactividad
  const resetInactivityTimer = () => {
    if (showWarningModal) return; // Ignorar toques accidentales mientras el modal de advertencia está activo
    lastInteractionTime.current = Date.now();
    const now = Date.now();
    // Limitar las escrituras a la base de datos a un máximo de una vez cada 5 segundos
    if (user && now - lastDbUpdateTime.current > 5000) {
      lastDbUpdateTime.current = now;
      updateDbActivity();
    }
  };

  // Cerrar la sesión por inactividad
  const handleInactivityLogout = async () => {
    try {
      const db = await initDB();
      await db.runAsync("DELETE FROM sesion_activa");
    } catch (e) {
      console.error("Error al borrar sesión activa por inactividad:", e);
    }
    setUser(null);
    setActiveUserId(null);
    setFarmers([]);
    showToast(
      "Sesión Expirada",
      "Tu sesión ha sido cerrada automáticamente debido a inactividad.",
      "warning"
    );
  };

  const keepSessionActive = () => {
    setShowWarningModal(false);
    lastInteractionTime.current = Date.now();
    const now = Date.now();
    lastDbUpdateTime.current = now;
    updateDbActivity();
  };

  const closeSessionNow = async () => {
    setShowWarningModal(false);
    await logout();
  };

  // Cargar lista de agricultores para la vista del Administrador
  const loadFarmers = async () => {
    try {
      const db = await initDB();
      const rows: any[] = await db.getAllAsync(
        "SELECT id, username, nombre, rol, finca, correo, mfa_secret, mfa_tipo, organizacion_id FROM usuarios WHERE rol = 'agricultor' ORDER BY nombre ASC"
      );
      setFarmers(rows);
    } catch (error) {
      console.error("Error al cargar agricultores:", error);
    }
  };

  // 1. Restaurar sesión activa al arrancar la app
  useEffect(() => {
    const checkActiveSession = async () => {
      try {
        const db = await initDB();
        const session: any = await db.getFirstAsync("SELECT * FROM sesion_activa LIMIT 1");
        if (session) {
          const lastAct = new Date(session.ultima_actividad).getTime();
          const elapsed = Date.now() - lastAct;
          if (elapsed < INACTIVITY_TIMEOUT) {
            // Cargar usuario
            const row: any = await db.getFirstAsync(
              "SELECT id, username, nombre, rol, finca, correo, mfa_secret, mfa_tipo, organizacion_id FROM usuarios WHERE id = ?",
              [session.usuario_id]
            );
            if (row) {
              const loggedUser: User = {
                id: row.id,
                username: row.username,
                nombre: row.nombre,
                rol: row.rol,
                finca: row.finca,
                correo: row.correo,
                mfa_secret: row.mfa_secret,
                mfa_tipo: row.mfa_tipo,
                organizacion_id: row.organizacion_id,
              };
              setUser(loggedUser);
              if (loggedUser.rol === "admin" || loggedUser.rol === "superadmin") {
                setActiveUserId(null);
                const farmersRows: any[] = await db.getAllAsync(
                  "SELECT id, username, nombre, rol, finca, correo, mfa_secret, mfa_tipo, organizacion_id FROM usuarios WHERE rol = 'agricultor' ORDER BY nombre ASC"
                );
                setFarmers(farmersRows);
                if (loggedUser.rol === "superadmin") {
                  const orgRows: any[] = await db.getAllAsync(
                    "SELECT id, nombre, fecha_registro FROM organizaciones ORDER BY nombre ASC"
                  );
                  setOrganizaciones(orgRows);
                }
              } else {
                setActiveUserId(loggedUser.id);
              }
              // Actualizar actividad
              await db.runAsync(
                "UPDATE sesion_activa SET ultima_actividad = ? WHERE usuario_id = ?",
                [new Date().toISOString(), row.id]
              );
              lastInteractionTime.current = Date.now();
              lastDbUpdateTime.current = Date.now();
            } else {
              // Limpiar sesión inválida
              await db.runAsync("DELETE FROM sesion_activa");
            }
          } else {
            // Limpiar sesión expirada
            await db.runAsync("DELETE FROM sesion_activa");
          }
        }
      } catch (err) {
        console.error("Error al restaurar sesión activa:", err);
      } finally {
        setLoadingSession(false);
      }
    };
    checkActiveSession();
  }, []);

  // 2. Controlar la inactividad periódica en primer plano (Comprobación cada 1s)
  useEffect(() => {
    let interval: any = null;
    if (user) {
      lastInteractionTime.current = Date.now();
      lastDbUpdateTime.current = Date.now();
      updateDbActivity();

      interval = setInterval(() => {
        const elapsed = Date.now() - lastInteractionTime.current;
        if (elapsed > INACTIVITY_TIMEOUT) {
          handleInactivityLogout();
          setShowWarningModal(false);
        } else if (elapsed > INACTIVITY_TIMEOUT - 10000 && !showWarningModal) {
          const remainingSeconds = Math.max(1, Math.ceil((INACTIVITY_TIMEOUT - elapsed) / 1000));
          setWarningCountdown(remainingSeconds);
          setShowWarningModal(true);
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [user, showWarningModal]);

  // 2b. Manejar la cuenta regresiva del modal de advertencia
  useEffect(() => {
    if (showWarningModal) {
      countdownIntervalRef.current = setInterval(() => {
        setWarningCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current);
            handleInactivityLogout();
            setShowWarningModal(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [showWarningModal]);

  // 3. Controlar transiciones de AppState (segundo plano / primer plano)
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === "background" && user) {
        try {
          const db = await initDB();
          await db.runAsync(
            "UPDATE sesion_activa SET ultima_actividad = ? WHERE usuario_id = ?",
            [new Date().toISOString(), user.id]
          );
        } catch (e) {
          console.error("Error al actualizar actividad al ir al background:", e);
        }
      } else if (nextAppState === "active" && user) {
        const elapsed = Date.now() - lastInteractionTime.current;
        if (elapsed > INACTIVITY_TIMEOUT) {
          handleInactivityLogout();
          setShowWarningModal(false);
        } else if (elapsed > INACTIVITY_TIMEOUT - 10000) {
          const remainingSeconds = Math.max(1, Math.ceil((INACTIVITY_TIMEOUT - elapsed) / 1000));
          setWarningCountdown(remainingSeconds);
          setShowWarningModal(true);
        } else {
          lastInteractionTime.current = Date.now();
          lastDbUpdateTime.current = Date.now();
          updateDbActivity();
        }
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [user]);



  const login = async (username: string, password: string) => {
    try {
      const db = await initDB();
      const row: any = await db.getFirstAsync(
        "SELECT id, username, nombre, rol, finca, password, correo, mfa_secret, mfa_tipo, organizacion_id, intentos_fallidos, bloqueado_hasta FROM usuarios WHERE username = ?",
        [username.trim().toLowerCase()]
      );

      if (!row) {
        return { success: false, error: "Credenciales incorrectas" };
      }

      // Verificar bloqueo temporal
      if (row.bloqueado_hasta) {
        const lockTime = new Date(row.bloqueado_hasta).getTime();
        const now = Date.now();
        if (now < lockTime) {
          const remainingSeconds = Math.ceil((lockTime - now) / 1000);
          return {
            success: false,
            error: `Demasiados intentos. Inténtalo de nuevo en ${remainingSeconds} s.`
          };
        } else {
          // El tiempo de bloqueo ya expiró, restablecemos
          await db.runAsync(
            "UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = '' WHERE id = ?",
            [row.id]
          );
          row.intentos_fallidos = 0;
          row.bloqueado_hasta = "";
        }
      }

      const isStoredHashed = isHashed(row.password);
      const isMatch = isStoredHashed ? await comparePassword(password, row.password) : (row.password === password);

      if (isMatch) {
        // Credenciales correctas, restablecer intentos
        if (!isStoredHashed) {
          // Migrar contraseña legada (texto plano) al formato bcrypt
          const newHash = await hashPassword(password);
          await db.runAsync(
            "UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = '', password = ? WHERE id = ?" ,
            [newHash, row.id]
          );
        } else if (isExpoHash(row.password)) {
          // Migrar contraseña $expo$ legacy a bcrypt
          const newHash = await hashPassword(password);
          await db.runAsync(
            "UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = '', password = ? WHERE id = ?",
            [newHash, row.id]
          );
        } else {
          await db.runAsync(
            "UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = '' WHERE id = ?",
            [row.id]
          );
        }

        await addLogEntry(db, row.id, row.username, "login_password_ok", "Contraseña verificada correctamente");

        // MFA checks
        if (row.mfa_tipo === "email") {
          let userEmail = row.correo ? row.correo.trim() : "";
          if (!userEmail) {
            if (row.mfa_secret) {
              return { success: true, requireMfa: true, mfaSecret: row.mfa_secret, correo: "", mfaTipo: "totp" as const };
            }
            return { success: false, error: "No tienes correo ni MFA configurado. Comunícate con el administrador." };
          }
          const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
          const expiraEn = new Date(Date.now() + 5 * 60 * 1000).toISOString();
          await db.runAsync("DELETE FROM codigos_otp_email WHERE usuario_id = ?", [row.id]);
          await db.runAsync(
            "INSERT INTO codigos_otp_email (usuario_id, codigo, expira_en) VALUES (?, ?, ?)",
            [row.id, otpCode, expiraEn]
          );
          try {
            await fetch(`${getApiUrl()}/api/enviar-otp`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ correo: userEmail, codigo: otpCode, nombre: row.nombre })
            });
          } catch (e) {
            console.warn("Error al llamar al endpoint de envío OTP:", e);
          }
          return { success: true, requireMfa: true, mfaSecret: "", correo: row.correo, mfaTipo: "email" as const };
        }

        if (row.mfa_secret) {
          return { success: true, requireMfa: true, mfaSecret: row.mfa_secret, correo: row.correo, mfaTipo: "totp" as const };
        }

        // Si no tiene MFA, inicia sesión directamente
        const loggedUser: User = {
          id: row.id,
          username: row.username,
          nombre: row.nombre,
          rol: row.rol,
          finca: row.finca,
          correo: row.correo,
          mfa_secret: row.mfa_secret,
          mfa_tipo: row.mfa_tipo,
          organizacion_id: row.organizacion_id,
        };

        // Crear sesión activa en SQLite
        await db.runAsync("DELETE FROM sesion_activa");
        await db.runAsync(
          "INSERT INTO sesion_activa (usuario_id, fecha_inicio, ultima_actividad) VALUES (?, ?, ?)",
          [row.id, new Date().toISOString(), new Date().toISOString()]
        );

        setUser(loggedUser);
        if (loggedUser.rol === "admin" || loggedUser.rol === "superadmin") {
          setActiveUserId(null);
          const farmersRows: any[] = await db.getAllAsync(
            "SELECT id, username, nombre, rol, finca, correo, mfa_secret, mfa_tipo, organizacion_id FROM usuarios WHERE rol = 'agricultor' ORDER BY nombre ASC"
          );
          setFarmers(farmersRows);
          if (loggedUser.rol === "superadmin") {
            const orgRows: any[] = await db.getAllAsync(
              "SELECT id, nombre, fecha_registro FROM organizaciones ORDER BY nombre ASC"
            );
            setOrganizaciones(orgRows);
          }
        } else {
          setActiveUserId(loggedUser.id);
        }
        return { success: true };
      } else {
        // Contraseña incorrecta, registrar intento fallido
        const newFailed = (row.intentos_fallidos || 0) + 1;
        await addLogEntry(db, row.id, row.username, "login_fail", `Intento de inicio de sesión fallido (intento ${newFailed}/5)`);
        if (newFailed >= 5) {
          const lockUntil = new Date(Date.now() + 60 * 1000).toISOString(); // 60 segundos
          await db.runAsync(
            "UPDATE usuarios SET intentos_fallidos = ?, bloqueado_hasta = ? WHERE id = ?",
            [5, lockUntil, row.id]
          );
          return {
            success: false,
            error: "Credenciales bloqueadas. Inténtalo de nuevo en 1 minuto."
          };
        } else {
          await db.runAsync(
            "UPDATE usuarios SET intentos_fallidos = ? WHERE id = ?",
            [newFailed, row.id]
          );
          return {
            success: false,
            error: `Credenciales incorrectas. Intento ${newFailed} de 5.`
          };
        }
      }
    } catch (error) {
      console.error("Error al iniciar sesión:", error);
      return { success: false, error: "Error en la base de datos" };
    }
  };

  const verifyMfaAndLogin = async (username: string, code: string, mfaTipo?: "totp" | "email") => {
    try {
      const db = await initDB();
      const row: any = await db.getFirstAsync(
        "SELECT id, username, nombre, rol, finca, correo, mfa_secret, mfa_tipo, organizacion_id FROM usuarios WHERE username = ?",
        [username.trim().toLowerCase()]
      );

      if (!row) {
        return { success: false, error: "Error en la autenticación MFA" };
      }

      // Check MFA attempt limit
      const mfaIntentos: any = await db.getFirstAsync(
        "SELECT intentos, bloqueado_hasta FROM mfa_intentos WHERE usuario_id = ?",
        [row.id]
      );

      if (mfaIntentos) {
        if (mfaIntentos.bloqueado_hasta) {
          const lockTime = new Date(mfaIntentos.bloqueado_hasta).getTime();
          const now = Date.now();
          if (now < lockTime) {
            const remainingSeconds = Math.ceil((lockTime - now) / 1000);
            await addLogEntry(db, row.id, row.username, "mfa_blocked", `MFA bloqueado temporalmente (faltan ${remainingSeconds}s)`);
            return { success: false, error: `Demasiados intentos MFA. Inténtalo de nuevo en ${remainingSeconds} segundos.` };
          } else {
            await db.runAsync("DELETE FROM mfa_intentos WHERE usuario_id = ?", [row.id]);
          }
        }
      }

      let isValid = false;

      if (mfaTipo === "email" || row.mfa_tipo === "email") {
        // Email OTP verification from codigos_otp_email table
        const otpRow: any = await db.getFirstAsync(
          "SELECT codigo, expira_en FROM codigos_otp_email WHERE usuario_id = ? ORDER BY id DESC LIMIT 1",
          [row.id]
        );

        if (!otpRow) {
          await addLogEntry(db, row.id, row.username, "mfa_fail", "Intento MFA email fallido: no hay código OTP registrado");
          return { success: false, error: "No hay código de verificación pendiente. Solicita uno nuevo." };
        }

        if (new Date(otpRow.expira_en).getTime() < Date.now()) {
          await db.runAsync("DELETE FROM codigos_otp_email WHERE usuario_id = ?", [row.id]);
          await addLogEntry(db, row.id, row.username, "mfa_fail", "Intento MFA email fallido: código OTP expirado");
          return { success: false, error: "El código de verificación ha expirado. Solicita uno nuevo." };
        }

        isValid = otpRow.codigo === code.trim();

        if (isValid) {
          await db.runAsync("DELETE FROM codigos_otp_email WHERE usuario_id = ?", [row.id]);
        }
      } else {
        // TOTP verification
        if (!row.mfa_secret) {
          await addLogEntry(db, row.id, row.username, "mfa_fail", "Intento MFA TOTP fallido: no hay secreto MFA configurado");
          return { success: false, error: "Error en la autenticación MFA" };
        }
        isValid = verifyTOTP(row.mfa_secret, code);
      }

      if (!isValid) {
        // Track failed MFA attempt
        const newAttempts = (mfaIntentos?.intentos || 0) + 1;
        if (newAttempts >= 3) {
          const lockUntil = new Date(Date.now() + MFA_BLOCK_SECONDS * 1000).toISOString();
          await db.runAsync(
            "INSERT OR REPLACE INTO mfa_intentos (usuario_id, intentos, bloqueado_hasta) VALUES (?, ?, ?)",
            [row.id, newAttempts, lockUntil]
          );
          await addLogEntry(db, row.id, row.username, "mfa_blocked", `MFA bloqueado tras ${newAttempts} intentos fallidos`);
          return { success: false, error: `Demasiados intentos MFA. Inténtalo de nuevo en ${MFA_BLOCK_SECONDS} segundos.` };
        } else {
          await db.runAsync(
            "INSERT OR REPLACE INTO mfa_intentos (usuario_id, intentos) VALUES (?, ?)",
            [row.id, newAttempts]
          );
          await addLogEntry(db, row.id, row.username, "mfa_fail", `Código MFA incorrecto (intento ${newAttempts}/3)`);
          return { success: false, error: "Código de verificación incorrecto o expirado" };
        }
      }

      // Valid MFA - reset attempts
      await db.runAsync("DELETE FROM mfa_intentos WHERE usuario_id = ?", [row.id]);
      await db.runAsync(
        "UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = '' WHERE id = ?",
        [row.id]
      );
      await addLogEntry(db, row.id, row.username, "mfa_ok", "Autenticación MFA exitosa");

      // Crear sesión activa en SQLite
      await db.runAsync("DELETE FROM sesion_activa");
      await db.runAsync(
        "INSERT INTO sesion_activa (usuario_id, fecha_inicio, ultima_actividad) VALUES (?, ?, ?)",
        [row.id, new Date().toISOString(), new Date().toISOString()]
      );

      const loggedUser: User = {
        id: row.id,
        username: row.username,
        nombre: row.nombre,
        rol: row.rol,
        finca: row.finca,
        correo: row.correo,
        mfa_secret: row.mfa_secret,
        mfa_tipo: row.mfa_tipo,
        organizacion_id: row.organizacion_id,
      };
      setUser(loggedUser);
      if (loggedUser.rol === "admin" || loggedUser.rol === "superadmin") {
        setActiveUserId(null);
        const farmersRows: any[] = await db.getAllAsync(
          "SELECT id, username, nombre, rol, finca, correo, mfa_secret, mfa_tipo, organizacion_id FROM usuarios WHERE rol = 'agricultor' ORDER BY nombre ASC"
        );
        setFarmers(farmersRows);
        if (loggedUser.rol === "superadmin") {
          const orgRows: any[] = await db.getAllAsync(
            "SELECT id, nombre, fecha_registro FROM organizaciones ORDER BY nombre ASC"
          );
          setOrganizaciones(orgRows);
        }
      } else {
        setActiveUserId(loggedUser.id);
      }
      return { success: true };
    } catch (error) {
      console.error("Error en verifyMfaAndLogin:", error);
      return { success: false, error: "Error al procesar el código MFA" };
    }
  };

  const register = async (username: string, password: string, nombre: string, finca: string, correo = "", mfaSecret = "", mfaTipo: "totp" | "email" = "totp") => {
    try {
      const db = await initDB();
      
      // Validaciones básicas de seguridad en campos
      if (!username.trim() || !password || !nombre.trim() || !finca.trim()) {
        return { success: false, error: "Todos los campos son requeridos" };
      }

      // Validar si el usuario ya existe - Consulta parametrizada
      const existing: any = await db.getFirstAsync(
        "SELECT id FROM usuarios WHERE username = ?",
        [username.trim().toLowerCase()]
      );
      if (existing) {
        return { success: false, error: "El nombre de usuario ya está registrado" };
      }

      // Si no se pasó secreto MFA, lo generamos para asegurar la cuenta
      const finalMfaSecret = mfaSecret || generateSecret();

      const hashedPassword = await hashPassword(password);

      // Registro con consulta parametrizada
      await db.runAsync(
        "INSERT INTO usuarios (username, password, nombre, rol, finca, correo, mfa_secret, mfa_tipo, intentos_fallidos, bloqueado_hasta) VALUES (?, ?, ?, 'agricultor', ?, ?, ?, ?, 0, '')",
        [username.trim().toLowerCase(), hashedPassword, nombre, finca, correo.trim(), finalMfaSecret, mfaTipo]
      );

      // Get the new user's id for logging
      const newUser: any = await db.getFirstAsync(
        "SELECT id FROM usuarios WHERE username = ?",
        [username.trim().toLowerCase()]
      );
      if (newUser) {
        await addLogEntry(db, newUser.id, username.trim().toLowerCase(), "register", `Agricultor registrado: ${nombre}`);
      }
      
      // Recargar agricultores si el administrador está logueado y crea una cuenta
      if (user?.rol === "admin" || user?.rol === "superadmin") {
        await loadFarmers();
      }
      
      return { success: true, mfaSecret: finalMfaSecret };
    } catch (error) {
      console.error("Error al registrar agricultor:", error);
      return { success: false, error: "Error al guardar el agricultor en la base de datos" };
    }
  };

  const logout = async () => {
    try {
      const db = await initDB();
      if (user) {
        await addLogEntry(db, user.id, user.username, "logout", "Sesión cerrada por el usuario");
      }
      await db.runAsync("DELETE FROM sesion_activa");
    } catch (e) {
      console.error("Error al eliminar sesión en logout:", e);
    }
    setUser(null);
    setActiveUserId(null);
    setFarmers([]);
    setOrganizaciones([]);
    setLogEntries([]);
  };

  const selectFarmer = (id: number | null) => {
    setActiveUserId(id);
  };

  const deleteFarmer = async (id: number) => {
    try {
      const db = await initDB();
      // Get farmer info before deleting
      const farmer: any = await db.getFirstAsync("SELECT username, nombre FROM usuarios WHERE id = ?", [id]);
      // Eliminar datos relacionados para limpiar en cascada
      await db.runAsync("DELETE FROM lecturas_suelo WHERE usuario_id = ?", [id]);
      await db.runAsync("DELETE FROM lecturas_clima WHERE usuario_id = ?", [id]);
      await db.runAsync("DELETE FROM historial_nutrientes WHERE usuario_id = ?", [id]);
      // Eliminar el usuario agricultor
      await db.runAsync("DELETE FROM usuarios WHERE id = ?", [id]);
      
      if (farmer) {
        await addLogEntry(db, user?.id || 0, user?.username || "unknown", "delete_farmer", `Agricultor eliminado: ${farmer.nombre} (${farmer.username})`);
      }
      
      // Si el agricultor eliminado estaba activo, limpiamos el activeUserId
      if (activeUserId === id) {
        setActiveUserId(null);
      }
      
      await loadFarmers();
      return { success: true };
    } catch (error) {
      console.error("Error al eliminar agricultor:", error);
      return { success: false, error: "Error al eliminar el agricultor de la base de datos" };
    }
  };

  const updateFarmer = async (
    id: number,
    username: string,
    nombre: string,
    finca: string,
    correo: string,
    password?: string,
    mfaTipo?: "totp" | "email"
  ) => {
    try {
      const db = await initDB();

      // Verificar si el usuario ya existe con ese username (pero con diferente id)
      const existing: any = await db.getFirstAsync(
        "SELECT id FROM usuarios WHERE username = ? AND id != ?",
        [username.trim().toLowerCase(), id]
      );
      if (existing) {
        return { success: false, error: "El nombre de usuario ya está registrado por otro agricultor" };
      }

      if (password && password.trim().length > 0) {
        const hashedPassword = await hashPassword(password);
        if (mfaTipo) {
          await db.runAsync(
            "UPDATE usuarios SET username = ?, password = ?, nombre = ?, finca = ?, correo = ?, mfa_tipo = ? WHERE id = ?",
            [username.trim().toLowerCase(), hashedPassword, nombre.trim(), finca.trim(), correo.trim(), mfaTipo, id]
          );
        } else {
          await db.runAsync(
            "UPDATE usuarios SET username = ?, password = ?, nombre = ?, finca = ?, correo = ? WHERE id = ?",
            [username.trim().toLowerCase(), hashedPassword, nombre.trim(), finca.trim(), correo.trim(), id]
          );
        }
      } else {
        if (mfaTipo) {
          await db.runAsync(
            "UPDATE usuarios SET username = ?, nombre = ?, finca = ?, correo = ?, mfa_tipo = ? WHERE id = ?",
            [username.trim().toLowerCase(), nombre.trim(), finca.trim(), correo.trim(), mfaTipo, id]
          );
        } else {
          await db.runAsync(
            "UPDATE usuarios SET username = ?, nombre = ?, finca = ?, correo = ? WHERE id = ?",
            [username.trim().toLowerCase(), nombre.trim(), finca.trim(), correo.trim(), id]
          );
        }
      }

      await addLogEntry(db, user?.id || 0, user?.username || "unknown", "update_farmer", `Agricultor actualizado: ${nombre} (${username})`);
      await loadFarmers();
      return { success: true };
    } catch (error) {
      console.error("Error al actualizar agricultor:", error);
      return { success: false, error: "Error al actualizar la base de datos" };
    }
  };

  const restablecerContrasenaConTotp = async (username: string, totpCode: string, newPassword: string) => {
    try {
      const db = await initDB();
      const row: any = await db.getFirstAsync(
        "SELECT id, mfa_secret FROM usuarios WHERE username = ?",
        [username.trim().toLowerCase()]
      );

      if (!row) {
        return { success: false, error: "El usuario ingresado no existe." };
      }

      if (!row.mfa_secret) {
        return { success: false, error: "Esta cuenta no tiene configurada la verificación en dos pasos (MFA) para recuperación." };
      }

      // Validar el código TOTP
      const isValid = verifyTOTP(row.mfa_secret, totpCode);
      if (!isValid) {
        return { success: false, error: "Código de verificación incorrecto o expirado." };
      }

      // Hashear y actualizar contraseña, limpiar bloqueos e intentos
      const hashedPassword = await hashPassword(newPassword);
      await db.runAsync(
        "UPDATE usuarios SET password = ?, intentos_fallidos = 0, bloqueado_hasta = '' WHERE id = ?",
        [hashedPassword, row.id]
      );

      return { success: true };
    } catch (error) {
      console.error("Error en restablecerContrasenaConTotp:", error);
      return { success: false, error: "Error al restablecer la contraseña." };
    }
  };

  const loadLogEntries = async () => {
    try {
      const db = await initDB();
      const rows: any[] = await db.getAllAsync(
        "SELECT * FROM log_sucesos ORDER BY fecha DESC LIMIT 100"
      );
      setLogEntries(rows);
    } catch (error) {
      console.error("Error al cargar entradas de log:", error);
    }
  };

  const loadOrganizaciones = async () => {
    try {
      const db = await initDB();
      const rows: any[] = await db.getAllAsync(
        "SELECT id, nombre, fecha_registro FROM organizaciones ORDER BY nombre ASC"
      );
      setOrganizaciones(rows);
    } catch (error) {
      console.error("Error al cargar organizaciones:", error);
    }
  };

  const createOrganizacion = async (nombre: string) => {
    try {
      const db = await initDB();
      const existing: any = await db.getFirstAsync(
        "SELECT id FROM organizaciones WHERE nombre = ?",
        [nombre.trim()]
      );
      if (existing) {
        return { success: false, error: "La organización ya existe" };
      }
      await db.runAsync(
        "INSERT INTO organizaciones (nombre, fecha_registro) VALUES (?, ?)",
        [nombre.trim(), new Date().toISOString()]
      );
      await loadOrganizaciones();
      if (user) {
        await addLogEntry(db, user.id, user.username, "create_organizacion", `Organización creada: ${nombre.trim()}`);
      }
      return { success: true };
    } catch (error) {
      console.error("Error al crear organización:", error);
      return { success: false, error: "Error al crear la organización" };
    }
  };

  const deleteOrganizacion = async (id: number) => {
    try {
      const db = await initDB();
      const org: any = await db.getFirstAsync("SELECT nombre FROM organizaciones WHERE id = ?", [id]);
      await db.runAsync("DELETE FROM organizaciones WHERE id = ?", [id]);
      if (org && user) {
        await addLogEntry(db, user.id, user.username, "delete_organizacion", `Organización eliminada: ${org.nombre}`);
      }
      await loadOrganizaciones();
      return { success: true };
    } catch (error) {
      console.error("Error al eliminar organización:", error);
      return { success: false, error: "Error al eliminar la organización" };
    }
  };

  const updateOrganizacion = async (id: number, nombre: string) => {
    try {
      const db = await initDB();
      const existing: any = await db.getFirstAsync(
        "SELECT id FROM organizaciones WHERE nombre = ? AND id != ?",
        [nombre.trim(), id]
      );
      if (existing) {
        return { success: false, error: "Ya existe otra organización con ese nombre" };
      }
      const oldOrg: any = await db.getFirstAsync("SELECT nombre FROM organizaciones WHERE id = ?", [id]);
      await db.runAsync(
        "UPDATE organizaciones SET nombre = ? WHERE id = ?",
        [nombre.trim(), id]
      );
      if (oldOrg && user) {
        await addLogEntry(db, user.id, user.username, "update_organizacion", `Organización renombrada: ${oldOrg.nombre} → ${nombre.trim()}`);
      }
      await loadOrganizaciones();
      return { success: true };
    } catch (error) {
      console.error("Error al actualizar organización:", error);
      return { success: false, error: "Error al actualizar la organización" };
    }
  };

  const registerAdminOrganizacion = async (username: string, password: string, nombre: string, correo: string, organizacionId: number, mfaTipo: "totp" | "email" = "totp") => {
    try {
      const db = await initDB();
      if (!username.trim() || !password || !nombre.trim() || !correo.trim()) {
        return { success: false, error: "Todos los campos son requeridos" };
      }
      const existing: any = await db.getFirstAsync(
        "SELECT id FROM usuarios WHERE username = ?",
        [username.trim().toLowerCase()]
      );
      if (existing) {
        return { success: false, error: "El nombre de usuario ya está registrado" };
      }
      const mfaSecret = generateSecret();
      const hashedPassword = await hashPassword(password);
      await db.runAsync(
        "INSERT INTO usuarios (username, password, nombre, rol, finca, correo, mfa_secret, mfa_tipo, organizacion_id, intentos_fallidos, bloqueado_hasta) VALUES (?, ?, ?, 'admin', '', ?, ?, ?, ?, 0, '')",
        [username.trim().toLowerCase(), hashedPassword, nombre, correo.trim(), mfaSecret, mfaTipo, organizacionId]
      );
      if (user) {
        await addLogEntry(db, user.id, user.username, "register_admin", `Administrador de organización registrado: ${nombre} (${username})`);
      }
      return { success: true, mfaSecret };
    } catch (error) {
      console.error("Error al registrar administrador de organización:", error);
      return { success: false, error: "Error al registrar el administrador" };
    }
  };

  const updateAdminOrganizacion = async (id: number, username: string, nombre: string, correo: string, password?: string, mfaTipo?: "totp" | "email") => {
    try {
      const db = await initDB();
      const existing: any = await db.getFirstAsync(
        "SELECT id FROM usuarios WHERE username = ? AND id != ?",
        [username.trim().toLowerCase(), id]
      );
      if (existing) {
        return { success: false, error: "El nombre de usuario ya está registrado por otro administrador" };
      }
      if (password && password.trim().length > 0) {
        const hashedPassword = await hashPassword(password);
        if (mfaTipo) {
          await db.runAsync(
            "UPDATE usuarios SET username = ?, password = ?, nombre = ?, correo = ?, mfa_tipo = ? WHERE id = ?",
            [username.trim().toLowerCase(), hashedPassword, nombre.trim(), correo.trim(), mfaTipo, id]
          );
        } else {
          await db.runAsync(
            "UPDATE usuarios SET username = ?, password = ?, nombre = ?, correo = ? WHERE id = ?",
            [username.trim().toLowerCase(), hashedPassword, nombre.trim(), correo.trim(), id]
          );
        }
      } else {
        if (mfaTipo) {
          await db.runAsync(
            "UPDATE usuarios SET username = ?, nombre = ?, correo = ?, mfa_tipo = ? WHERE id = ?",
            [username.trim().toLowerCase(), nombre.trim(), correo.trim(), mfaTipo, id]
          );
        } else {
          await db.runAsync(
            "UPDATE usuarios SET username = ?, nombre = ?, correo = ? WHERE id = ?",
            [username.trim().toLowerCase(), nombre.trim(), correo.trim(), id]
          );
        }
      }
      if (user) {
        await addLogEntry(db, user.id, user.username, "update_admin", `Administrador actualizado: ${nombre} (${username})`);
      }
      return { success: true };
    } catch (error) {
      console.error("Error al actualizar administrador:", error);
      return { success: false, error: "Error al actualizar el administrador" };
    }
  };

  const deleteAdminOrganizacion = async (id: number) => {
    try {
      const db = await initDB();
      const admin: any = await db.getFirstAsync("SELECT username, nombre FROM usuarios WHERE id = ?", [id]);
      await db.runAsync("DELETE FROM usuarios WHERE id = ?", [id]);
      if (admin && user) {
        await addLogEntry(db, user.id, user.username, "delete_admin", `Administrador eliminado: ${admin.nombre} (${admin.username})`);
      }
      return { success: true };
    } catch (error) {
      console.error("Error al eliminar administrador:", error);
      return { success: false, error: "Error al eliminar el administrador" };
    }
  };

  const enviarOtpRecuperacion = async (username: string) => {
    try {
      const db = await initDB();
      const row: any = await db.getFirstAsync(
        "SELECT id, correo, nombre FROM usuarios WHERE username = ?",
        [username.trim().toLowerCase()]
      );
      if (!row) {
        return { success: false, error: "El usuario no existe" };
      }
      if (!row.correo) {
        return { success: false, error: "El usuario no tiene correo electrónico registrado" };
      }
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await db.runAsync("DELETE FROM codigos_otp_email WHERE usuario_id = ?", [row.id]);
      await db.runAsync(
        "INSERT INTO codigos_otp_email (usuario_id, codigo, expira_en) VALUES (?, ?, ?)",
        [row.id, otp, expiresAt]
      );
      try {
        await fetch(`${getApiUrl()}/api/enviar-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ correo: row.correo, codigo: otp, nombre: row.nombre }),
        });
      } catch (e) {
        console.warn("Error al llamar al endpoint de envío OTP:", e);
      }
      await addLogEntry(db, row.id, username, "otp_sent", `OTP de recuperación enviado al correo ${row.correo}`);
      return { success: true, correo: row.correo };
    } catch (error) {
      console.error("Error al enviar OTP de recuperación:", error);
      return { success: false, error: "Error al procesar la solicitud de recuperación" };
    }
  };

  const restablecerContrasenaConEmail = async (username: string, otpCode: string, newPassword: string) => {
    try {
      const db = await initDB();
      const row: any = await db.getFirstAsync(
        "SELECT id FROM usuarios WHERE username = ?",
        [username.trim().toLowerCase()]
      );
      if (!row) {
        return { success: false, error: "El usuario no existe" };
      }
      const otpRow: any = await db.getFirstAsync(
        "SELECT codigo, expira_en FROM codigos_otp_email WHERE usuario_id = ? ORDER BY id DESC LIMIT 1",
        [row.id]
      );
      if (!otpRow) {
        return { success: false, error: "No hay código de verificación pendiente. Solicita uno nuevo." };
      }
      if (new Date(otpRow.expira_en).getTime() < Date.now()) {
        await db.runAsync("DELETE FROM codigos_otp_email WHERE usuario_id = ?", [row.id]);
        return { success: false, error: "El código de verificación ha expirado. Solicita uno nuevo." };
      }
      if (otpRow.codigo !== otpCode.trim()) {
        return { success: false, error: "Código de verificación incorrecto." };
      }
      await db.runAsync("DELETE FROM codigos_otp_email WHERE usuario_id = ?", [row.id]);
      const hashedPassword = await hashPassword(newPassword);
      await db.runAsync(
        "UPDATE usuarios SET password = ?, intentos_fallidos = 0, bloqueado_hasta = '' WHERE id = ?",
        [hashedPassword, row.id]
      );
      await addLogEntry(db, row.id, username, "password_reset", "Contraseña restablecida mediante OTP por correo electrónico");
      return { success: true };
    } catch (error) {
      console.error("Error en restablecerContrasenaConEmail:", error);
      return { success: false, error: "Error al restablecer la contraseña" };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        activeUserId,
        farmers,
        organizaciones,
        logEntries,
        login,
        logout,
        register,
        selectFarmer,
        loadFarmers,
        loadLogEntries,
        loadOrganizaciones,
        deleteFarmer,
        updateFarmer,
        createOrganizacion,
        deleteOrganizacion,
        updateOrganizacion,
        registerAdminOrganizacion,
        updateAdminOrganizacion,
        deleteAdminOrganizacion,
        verifyMfaAndLogin,
        enviarOtpRecuperacion,
        restablecerContrasenaConEmail,
        loadingSession,
        restablecerContrasenaConTotp,
        resetInactivityTimer,
        MFA_BLOCK_SECONDS,
      }}
    >
      <View
        style={{ flex: 1 }}
        onStartShouldSetResponderCapture={() => {
          resetInactivityTimer();
          return false; // Permitir que los toques fluyan a los componentes hijos
        }}
      >
        {children}

        {/* MODAL DE ADVERTENCIA DE INACTIVIDAD */}
        <Modal
          visible={showWarningModal}
          transparent
          animationType="fade"
          onRequestClose={keepSessionActive}
        >
          <View style={modalStyles.backdrop}>
            {Platform.OS !== "web" ? (
              <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(15, 23, 42, 0.4)" }]} />
            )}
            <View style={modalStyles.modalBox}>
              <View style={modalStyles.iconContainer}>
                <MaterialIcons name="timer" size={32} color="#ca8a04" />
              </View>
              <Text style={modalStyles.modalTitle}>¿Sigues ahí?</Text>
              <Text style={modalStyles.modalDesc}>
                Tu sesión se cerrará automáticamente por inactividad en:
              </Text>
              
              <Text style={modalStyles.countdownText}>
                {warningCountdown} <Text style={modalStyles.countdownSub}>segundos</Text>
              </Text>

              <View style={modalStyles.btnRow}>
                <Pressable
                  style={[modalStyles.btn, modalStyles.btnLogout]}
                  onPress={closeSessionNow}
                >
                  <Text style={modalStyles.btnTextLogout}>Salir</Text>
                </Pressable>
                
                <Pressable
                  style={[modalStyles.btn, modalStyles.btnKeep]}
                  onPress={keepSessionActive}
                >
                  <Text style={modalStyles.btnTextKeep}>Continuar</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </AuthContext.Provider>
  );
};

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.25)",
    padding: 24,
  },
  modalBox: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    shadowColor: "#0f172a",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#fef9c3",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 8,
  },
  modalDesc: {
    fontSize: 12,
    color: "#475569",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  countdownText: {
    fontSize: 32,
    fontWeight: "900",
    color: "#ca8a04",
    marginBottom: 24,
  },
  countdownSub: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
  },
  btnRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnLogout: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  btnTextLogout: {
    color: "#475569",
    fontWeight: "700",
    fontSize: 13,
  },
  btnKeep: {
    backgroundColor: "#16a34a",
  },
  btnTextKeep: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 13,
  },
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return context;
};
