// context/historyContext.tsx
import { createContext, ReactNode, useContext, useState, useEffect } from "react";
import { initDB, saveHistoryItem, getHistory } from "../utils/db";
import { useAuth } from "./authContext";

export type HistoryItem = {
  sensor: string;
  elemento: "N" | "P" | "K";
  cantidad: number;
  fecha: string;
};

type HistoryContextType = {
  historyItems: HistoryItem[];
  addHistory: (item: HistoryItem) => void;
  clearHistory: () => void;
};

const HistoryContext = createContext<HistoryContextType | null>(null);

export function HistoryProvider({ children }: { children: ReactNode }) {
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const { activeUserId } = useAuth();

  // Cargar historial inicial desde SQLite
  useEffect(() => {
    const loadHistory = async () => {
      if (activeUserId === null) {
        setHistoryItems([]);
        return;
      }
      try {
        const db = await initDB();
        const savedHistory = await getHistory(db, activeUserId);
        setHistoryItems(savedHistory);
      } catch (error) {
        console.error("Error al cargar historial desde la BD:", error);
      }
    };
    loadHistory();
  }, [activeUserId]);

  const addHistory = async (item: HistoryItem) => {
    if (activeUserId === null) return;
    
    // Insertar al inicio de la lista para mantener el orden cronológico descendente
    setHistoryItems((prev) => [item, ...prev]); 
    try {
      const db = await initDB();
      await saveHistoryItem(db, item, activeUserId);
    } catch (error) {
      console.error("Error al guardar en el historial de la BD:", error);
    }
  };

  const clearHistory = () => {
    setHistoryItems([]);
  };

  return (
    <HistoryContext.Provider value={{ historyItems, addHistory, clearHistory }}>
      {children}
    </HistoryContext.Provider>
  );
}

export function useHistory() {
  const ctx = useContext(HistoryContext);
  if (!ctx) {
    throw new Error("useHistory debe usarse dentro de HistoryProvider");
  }
  return ctx;
}
