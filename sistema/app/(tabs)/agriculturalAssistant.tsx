import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/authContext";
import { useData } from "../../context/dataContext";
import { buildAssistantDataSummary } from "../../utils/agriculturalAssistant";
import { askAgriculturalAssistant } from "../../utils/agriculturalAssistantApi";

type Message = { id: string; role: "user" | "assistant"; text: string };
const quickQuestions = ["¿Qué necesita atención hoy?", "¿Qué sensor está más crítico?", "¿Qué debo revisar primero?"];

export default function AgriculturalAssistant() {
  const { data } = useData();
  const { activeUserId } = useAuth();
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([{ id: "welcome", role: "assistant", text: "Estoy listo para ayudarte a entender el estado de tu cultivo con las últimas mediciones disponibles." }]);
  const [isSending, setIsSending] = useState(false);
  const summary = useMemo(() => buildAssistantDataSummary(data), [data]);
  const hasData = summary.stations.length > 0;

  const send = async (value = question) => {
    const clean = value.trim();
    if (!clean || isSending || activeUserId === null) return;
    setMessages((current) => [...current, { id: `u-${Date.now()}`, role: "user", text: clean }]);
    setQuestion(""); setIsSending(true);
    try {
      const answer = await askAgriculturalAssistant({ question: clean, farmerId: activeUserId, sessionId: `farmer-${activeUserId}`, dataSummary: summary });
      setMessages((current) => [...current, { id: `a-${Date.now()}`, role: "assistant", text: answer }]);
    } catch (error) {
      setMessages((current) => [...current, { id: `e-${Date.now()}`, role: "assistant", text: error instanceof Error ? error.message : "No se pudo consultar al asistente." }]);
    } finally { setIsSending(false); }
  };

  return <SafeAreaView edges={["top", "left", "right"]} style={s.safe}><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.safe}>
    <View style={s.header}><View style={s.avatar}><MaterialIcons name="psychology" size={25} color="#fff" /></View><View><Text style={s.title}>Asistente de cultivo</Text><Text style={s.subtitle}>● Analiza tus últimas mediciones</Text></View></View>
    {!hasData && <View style={s.notice}><MaterialIcons name="info-outline" size={18} color="#92400e" /><Text style={s.noticeText}>Importa datos desde Perfil para obtener respuestas basadas en tus sensores.</Text></View>}
    <ScrollView style={s.chat} contentContainerStyle={s.messages} showsVerticalScrollIndicator={false}>
      {messages.map((m) => <View key={m.id} style={[s.row, m.role === "user" && s.userRow]}>{m.role === "assistant" && <View style={s.miniAvatar}><MaterialIcons name="psychology" size={14} color="#166534" /></View>}<View style={[s.bubble, m.role === "user" ? s.userBubble : s.assistantBubble]}>{m.role === "assistant" && <Text style={s.name}>ASISTENTE AGRÍCOLA</Text>}<Text style={m.role === "user" ? s.userText : s.assistantText}>{m.text}</Text></View></View>)}
      {isSending && <View style={s.row}><View style={s.miniAvatar}><MaterialIcons name="psychology" size={14} color="#166534" /></View><View style={[s.bubble, s.assistantBubble, s.loading]}><ActivityIndicator size="small" color="#16a34a" /><Text style={s.assistantText}>Analizando las lecturas…</Text></View></View>}
    </ScrollView>
    <View style={s.quick}><Text style={s.quickLabel}>CONSULTAS RÁPIDAS</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.quickList}>{quickQuestions.map((item) => <Pressable key={item} disabled={!hasData || isSending} onPress={() => send(item)} style={[s.chip, (!hasData || isSending) && s.disabled]}><Text style={s.chipText}>{item}</Text></Pressable>)}</ScrollView></View>
    <View style={s.composer}><TextInput value={question} onChangeText={setQuestion} placeholder="Escribe tu consulta…" placeholderTextColor="#94a3b8" style={s.input} multiline editable={!isSending && hasData} maxLength={800} /><Pressable onPress={() => send()} disabled={!question.trim() || isSending || !hasData} style={[s.send, (!question.trim() || isSending || !hasData) && s.disabledSend]}><MaterialIcons name="arrow-upward" size={21} color="#fff" /></Pressable></View>
  </KeyboardAvoidingView></SafeAreaView>;
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#f1f5f9"}, header:{alignItems:"center",backgroundColor:"#fff",borderBottomColor:"#e2e8f0",borderBottomWidth:1,flexDirection:"row",gap:12,padding:16}, avatar:{alignItems:"center",backgroundColor:"#15803d",borderRadius:16,height:48,justifyContent:"center",width:48}, title:{color:"#0f172a",fontSize:19,fontWeight:"800"}, subtitle:{color:"#64748b",fontSize:12,fontWeight:"600",marginTop:4}, notice:{alignItems:"flex-start",backgroundColor:"#fef3c7",borderRadius:12,flexDirection:"row",gap:8,margin:16,marginBottom:0,padding:12},noticeText:{color:"#78350f",flex:1,fontSize:12,lineHeight:17},chat:{flex:1},messages:{gap:14,padding:16},row:{alignItems:"flex-end",flexDirection:"row",gap:8,maxWidth:"94%"},userRow:{alignSelf:"flex-end",flexDirection:"row-reverse"},miniAvatar:{alignItems:"center",backgroundColor:"#dcfce7",borderRadius:12,height:28,justifyContent:"center",width:28},bubble:{borderRadius:18,paddingHorizontal:14,paddingVertical:11},assistantBubble:{backgroundColor:"#fff",borderBottomLeftRadius:5,borderColor:"#e2e8f0",borderWidth:1,flex:1},userBubble:{backgroundColor:"#15803d",borderBottomRightRadius:5},name:{color:"#15803d",fontSize:10,fontWeight:"800",marginBottom:5},assistantText:{color:"#334155",fontSize:14,lineHeight:20},userText:{color:"#fff",fontSize:14,lineHeight:20},loading:{alignItems:"center",flexDirection:"row",gap:8},quick:{backgroundColor:"#fff",borderTopColor:"#e2e8f0",borderTopWidth:1,paddingTop:10},quickLabel:{color:"#64748b",fontSize:10,fontWeight:"800",letterSpacing:.8,marginBottom:8,marginHorizontal:16},quickList:{gap:8,paddingBottom:12,paddingHorizontal:16},chip:{backgroundColor:"#f0fdf4",borderColor:"#bbf7d0",borderRadius:12,borderWidth:1,paddingHorizontal:11,paddingVertical:9},chipText:{color:"#166534",fontSize:12,fontWeight:"700"},disabled:{opacity:.5},composer:{alignItems:"flex-end",backgroundColor:"#fff",borderTopColor:"#e2e8f0",borderTopWidth:1,flexDirection:"row",gap:10,padding:12},input:{backgroundColor:"#f8fafc",borderColor:"#cbd5e1",borderRadius:16,borderWidth:1,color:"#0f172a",flex:1,fontSize:14,maxHeight:105,minHeight:46,paddingHorizontal:13,paddingVertical:10},send:{alignItems:"center",backgroundColor:"#15803d",borderRadius:15,height:46,justifyContent:"center",width:46},disabledSend:{backgroundColor:"#94a3b8"}
});
