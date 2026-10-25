import Constants from "expo-constants";

import type { AssistantDataSummary } from "./agriculturalAssistant";

const getApiUrl = () => {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) return `http://${hostUri.split(":")[0]}:3000`;
  return "http://localhost:3000";
};

export const askAgriculturalAssistant = async ({
  question,
  farmerId,
  sessionId,
  dataSummary,
}: {
  question: string;
  farmerId: number;
  sessionId: string;
  dataSummary: AssistantDataSummary;
}): Promise<string> => {
  const response = await fetch(`${getApiUrl()}/api/agricultural-assistant`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, farmerId, sessionId, dataSummary }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || "No se pudo consultar al asistente.");
  if (!body?.answer || typeof body.answer !== "string") {
    throw new Error("El asistente no devolvió una respuesta válida.");
  }
  return body.answer;
};
