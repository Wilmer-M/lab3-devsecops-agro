import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
  Modal,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

type NotificationType = "success" | "error" | "warning" | "info";

type ToastState = {
  visible: boolean;
  title: string;
  message: string;
  type: NotificationType;
};

type ConfirmState = {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
  isDestructive?: boolean;
};

type NotificationContextType = {
  showToast: (title: string, message: string, type?: NotificationType) => void;
  showConfirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
    isDestructive?: boolean
  ) => void;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    title: "",
    message: "",
    type: "info",
  });

  const [confirm, setConfirm] = useState<ConfirmState>({
    visible: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const slideAnim = useRef(new Animated.Value(-150)).current;
  const timeoutRef = useRef<any>(null);

  const showToast = (title: string, message: string, type: NotificationType = "info") => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setToast({
      visible: true,
      title,
      message,
      type,
    });

    Animated.spring(slideAnim, {
      toValue: Platform.OS === "ios" ? 44 : 20,
      useNativeDriver: true,
      tension: 40,
      friction: 8,
    }).start();

    timeoutRef.current = setTimeout(() => {
      hideToast();
    }, 4000);
  };

  const hideToast = () => {
    Animated.timing(slideAnim, {
      toValue: -150,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    });
  };

  const showConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
    isDestructive = false
  ) => {
    setConfirm({
      visible: true,
      title,
      message,
      onConfirm: () => {
        setConfirm((prev) => ({ ...prev, visible: false }));
        onConfirm();
      },
      onCancel: () => {
        setConfirm((prev) => ({ ...prev, visible: false }));
        if (onCancel) onCancel();
      },
      isDestructive,
    });
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const getToastIcon = (type: NotificationType) => {
    switch (type) {
      case "success":
        return "check-circle";
      case "error":
        return "error";
      case "warning":
        return "warning";
      case "info":
      default:
        return "info";
    }
  };

  const getToastColors = (type: NotificationType) => {
    switch (type) {
      case "success":
        return {
          bg: "#f0fdf4",
          border: "#16a34a",
          text: "#15803d",
          iconColor: "#16a34a",
        };
      case "error":
        return {
          bg: "#fef2f2",
          border: "#dc2626",
          text: "#b91c1c",
          iconColor: "#dc2626",
        };
      case "warning":
        return {
          bg: "#fefce8",
          border: "#ca8a04",
          text: "#a16207",
          iconColor: "#ca8a04",
        };
      case "info":
      default:
        return {
          bg: "#f0f9ff",
          border: "#0284c7",
          text: "#0369a1",
          iconColor: "#0284c7",
        };
    }
  };

  const colors = getToastColors(toast.type);

  return (
    <NotificationContext.Provider value={{ showToast, showConfirm }}>
      {children}

      {toast.visible && (
        <Animated.View
          style={[
            styles.toastWrapper,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Pressable
            style={[
              styles.toastContent,
              {
                backgroundColor: colors.bg,
                borderLeftColor: colors.border,
              },
            ]}
            onPress={hideToast}
          >
            <MaterialIcons
              name={getToastIcon(toast.type)}
              size={22}
              color={colors.iconColor}
              style={styles.toastIcon}
            />
            <View style={styles.toastTextContainer}>
              {toast.title ? (
                <Text style={[styles.toastTitle, { color: colors.text }]}>
                  {toast.title}
                </Text>
              ) : null}
              <Text style={styles.toastMessage}>{toast.message}</Text>
            </View>
            <Pressable onPress={hideToast} style={styles.closeToastBtn}>
              <MaterialIcons name="close" size={16} color="#94a3b8" />
            </Pressable>
          </Pressable>
        </Animated.View>
      )}

      <Modal
        visible={confirm.visible}
        transparent
        animationType="fade"
        onRequestClose={confirm.onCancel}
      >
        <View style={styles.modalBackdrop}>
          {Platform.OS !== "web" ? (
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(15, 23, 42, 0.5)" }]} />
          )}
          <View style={styles.confirmBox}>
            <View style={styles.confirmHeader}>
              <View
                style={[
                  styles.confirmIconContainer,
                  confirm.isDestructive
                    ? { backgroundColor: "#fee2e2" }
                    : { backgroundColor: "#e8f5e9" },
                ]}
              >
                <MaterialIcons
                  name={confirm.isDestructive ? "report-problem" : "help-outline"}
                  size={24}
                  color={confirm.isDestructive ? "#dc2626" : "#16a34a"}
                />
              </View>
              <Text style={styles.confirmTitle}>{confirm.title}</Text>
            </View>

            <Text style={styles.confirmMessage}>{confirm.message}</Text>

            <View style={styles.confirmActions}>
              <Pressable
                style={[styles.confirmBtn, styles.cancelBtn]}
                onPress={confirm.onCancel}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.confirmBtn,
                  confirm.isDestructive ? styles.destructiveBtn : styles.successBtn,
                ]}
                onPress={confirm.onConfirm}
              >
                <Text style={styles.confirmBtnText}>Aceptar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification debe usarse dentro de NotificationProvider");
  }
  return context;
};

const styles = StyleSheet.create({
  toastWrapper: {
    position: "absolute",
    top: 0,
    left: 16,
    right: 16,
    zIndex: 10000,
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  toastContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderLeftWidth: 6,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.04)",
  },
  toastIcon: {
    marginRight: 10,
  },
  toastTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  toastTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  toastMessage: {
    fontSize: 12,
    color: "#475569",
    lineHeight: 16,
  },
  closeToastBtn: {
    padding: 4,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.3)",
    padding: 24,
  },
  confirmBox: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#0f172a",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  confirmHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  confirmIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    flex: 1,
  },
  confirmMessage: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
    marginBottom: 24,
  },
  confirmActions: {
    flexDirection: "row",
    gap: 12,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtn: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cancelBtnText: {
    color: "#475569",
    fontWeight: "700",
    fontSize: 13,
  },
  successBtn: {
    backgroundColor: "#16a34a",
  },
  destructiveBtn: {
    backgroundColor: "#dc2626",
  },
  confirmBtnText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 13,
  },
});
