import React, { useMemo, useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import TeacherQRGenerator from './components/SmartQRGenerator';

const getBackendBase = () => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000';
  }
  return 'http://localhost:5000';
};

const App = () => {
  const [teacherId, setTeacherId] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState('');

  const backendBaseUrl = useMemo(() => getBackendBase(), []);

  const startSession = () => {
    const normalizedTeacherId = teacherId.trim().toUpperCase();
    const normalizedTeacherName = teacherName.trim();

    if (!normalizedTeacherId || !normalizedTeacherName) {
      setError('Enter teacher ID and name to continue.');
      return;
    }

    setError('');
    setTeacherId(normalizedTeacherId);
    setTeacherName(normalizedTeacherName);
    setIsReady(true);
  };

  if (isReady) {
    return (
      <TeacherQRGenerator
        teacherId={teacherId}
        teacherName={teacherName}
        backendBaseUrl={backendBaseUrl}
        onLogout={() => setIsReady(false)}
      />
    );
  }

  return (
    <LinearGradient colors={['#43c6c9', '#4f8ec6', '#5f5897']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.card}>
          <Text style={styles.title}>UniPass Teacher</Text>
          <Text style={styles.subtitle}>Live QR Session Console</Text>
          <Text style={styles.subline}>Choose subject, emit QR, students scan in class window.</Text>

          <Text style={styles.label}>Teacher ID</Text>
          <TextInput
            value={teacherId}
            onChangeText={setTeacherId}
            placeholder="Example: FAC-EC-01"
            placeholderTextColor="#94a3b8"
            autoCapitalize="characters"
            style={styles.input}
          />

          <Text style={styles.label}>Teacher Name</Text>
          <TextInput
            value={teacherName}
            onChangeText={setTeacherName}
            placeholder="Example: Priya Naik"
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity style={styles.primaryButton} onPress={startSession}>
            <Text style={styles.primaryButtonText}>Open QR Console</Text>
          </TouchableOpacity>

          <Text style={styles.footerText}>Passwordless attendance flow with epoch based QR validity.</Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#f8fbff',
    borderRadius: 22,
    padding: 20,
    shadowColor: '#1f2937',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 6,
    fontSize: 14,
    color: '#1e3a8a',
    textAlign: 'center',
    fontWeight: '700',
  },
  subline: {
    marginBottom: 20,
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  label: {
    marginBottom: 6,
    marginTop: 8,
    fontSize: 13,
    color: '#334155',
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  errorText: {
    marginTop: 10,
    color: '#dc2626',
    fontWeight: '600',
  },
  primaryButton: {
    marginTop: 16,
    backgroundColor: '#245ad7',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 15,
    letterSpacing: 0.3,
  },
  footerText: {
    marginTop: 14,
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
  },
});

export default App;
