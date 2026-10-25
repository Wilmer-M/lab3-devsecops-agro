import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * AgroSmart Mobile Client - Architecture Skeleton
 * Este componente representa el cascarón del frontend cliente para
 * demostración de arquitectura, integración con backend-mock y ejecución
 * del pipeline de DevSecOps (SAST, SCA, Dependencias y Políticas).
 */
export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>AgroSmart Client (Skeleton)</Text>
      <Text style={styles.subtitle}>
        Cascarón de interfaz móvil para laboratorio de DevSecOps y monitoreo agroclimático.
      </Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Estado del Sistema</Text>
        <Text style={styles.cardText}>• Backend Mock: Activo (validación BVA y sanitización)</Text>
        <Text style={styles.cardText}>• Microservicio FastAPI: Integrado con Kubernetes y Docker</Text>
        <Text style={styles.cardText}>• Pipeline CI/CD: Controles SAST (Semgrep), SCA (Trivy), Políticas (Conftest)</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F7FAFC',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1A202C',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#4A5568',
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 420,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 8,
  },
  cardText: {
    fontSize: 13,
    color: '#4A5568',
    lineHeight: 20,
  },
});
