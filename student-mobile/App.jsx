import React, { useMemo, useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';

const getBackendBase = () => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000';
  }
  return 'http://localhost:5000';
};

const App = () => {
  const [permission, requestPermission] = useCameraPermissions();
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [qrRawText, setQrRawText] = useState('');
  const [scanEnabled, setScanEnabled] = useState(false);
  const [status, setStatus] = useState('Scan teacher QR or paste QR JSON for testing.');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const backendBaseUrl = useMemo(() => getBackendBase(), []);

  const parseQrPayload = (raw) => {
    const text = String(raw || '').trim();
    if (!text) {
      throw new Error('QR is empty.');
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error('QR payload is not valid JSON.');
    }
  };

  const submitAttendance = async (payloadText) => {
    if (isSubmitting) {
      return;
    }

    setError('');
    setIsSubmitting(true);

    const normalizedStudentId = studentId.trim().toUpperCase();
    const normalizedStudentName = studentName.trim();

    if (!normalizedStudentId || !normalizedStudentName) {
      setError('Enter student ID and student name first.');
      setIsSubmitting(false);
      return;
    }

    let qrPayload;
    try {
      qrPayload = parseQrPayload(payloadText);
    } catch (parseError) {
      setError(parseError.message);
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`${backendBaseUrl}/api/student/mark-attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: normalizedStudentId,
          studentName: normalizedStudentName,
          qrPayload,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Attendance request failed.');
      }

      setStatus(
        `Marked: ${data.attendance.subjectCode} with ${data.attendance.teacherName} at ${new Date(data.attendance.markedAt).toLocaleTimeString()}`
      );
      Alert.alert(
        'Attendance Marked',
        `${data.attendance.subjectCode} marked successfully at ${new Date(data.attendance.markedAt).toLocaleTimeString()}`
      );
      setQrRawText(payloadText);
      setScanEnabled(false);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const pasteFromClipboard = async () => {
    try {
      const copiedText = await Clipboard.getStringAsync();
      if (!copiedText || !copiedText.trim()) {
        setError('Clipboard is empty. Copy QR JSON from teacher app first.');
        return;
      }

      setError('');
      setQrRawText(copiedText);
      setStatus('Pasted JSON from clipboard. Tap Submit Pasted QR.');
    } catch (clipboardError) {
      setError('Unable to read clipboard.');
    }
  };

  const handleScanned = ({ data }) => {
    if (!scanEnabled || isSubmitting) {
      return;
    }

    const text = String(data || '');
    setScanEnabled(false);
    setStatus('QR scanned. Verifying attendance...');
    setQrRawText(text);
    submitAttendance(text);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>UniPass Student</Text>
          <Text style={styles.heroSubtitle}>Passwordless attendance</Text>
          <Text style={styles.heroHint}>Scan teacher QR from live class window.</Text>
        </View>

        <View style={styles.cardBlue}>
          <Text style={styles.sectionTitle}>Student Profile</Text>
          <TextInput
            value={studentId}
            onChangeText={setStudentId}
            placeholder="Student ID (e.g., 23EC17)"
            autoCapitalize="characters"
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />
          <TextInput
            value={studentName}
            onChangeText={setStudentName}
            placeholder="Student Name"
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />
        </View>

        <View style={styles.cardPurple}>
          <Text style={styles.sectionTitleLight}>Manual JSON Test</Text>
          <TextInput
            value={qrRawText}
            onChangeText={setQrRawText}
            placeholder="Paste teacher QR JSON here"
            placeholderTextColor="#c7d2fe"
            multiline
            style={[styles.inputDark, styles.textArea]}
          />

          <TouchableOpacity style={styles.pasteButton} onPress={pasteFromClipboard}>
            <Text style={styles.pasteButtonText}>Paste from Clipboard</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.primaryButton} onPress={() => submitAttendance(qrRawText)} disabled={isSubmitting}>
            {isSubmitting ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.primaryButtonText}>Submit Pasted QR</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.cardTeal}>
          <View style={styles.scanHeaderRow}>
            <Text style={styles.sectionTitleLight}>Camera Scanner</Text>
            <TouchableOpacity
              style={styles.scanToggleButton}
              onPress={() => {
                setCameraError('');
                setScanEnabled((prev) => {
                  const next = !prev;
                  setStatus(next ? 'Scanner active. Point camera to teacher QR.' : 'Scanner stopped.');
                  return next;
                });
              }}
            >
              <Text style={styles.scanToggleText}>{scanEnabled ? 'Stop Scan' : 'Start QR Scan'}</Text>
            </TouchableOpacity>
          </View>

          {!permission ? (
            <Text style={styles.lightHint}>Checking camera permission...</Text>
          ) : !permission.granted ? (
            <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
              <Text style={styles.permissionButtonText}>Allow Camera</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.cameraFrame}>
              <CameraView
                style={styles.camera}
                facing="back"
                onMountError={(evt) => setCameraError(evt?.nativeEvent?.message || 'Camera mount failed.')}
                onBarcodeScanned={scanEnabled ? handleScanned : undefined}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              />
              <View style={styles.scanOverlay} pointerEvents="none" />
            </View>
          )}

          {cameraError ? <Text style={styles.errorTextLight}>{cameraError}</Text> : null}
          <Text style={styles.lightHint}>Tip: keep QR centered and hold device steady for 1-2 seconds.</Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Text style={styles.statusText}>{status}</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 14,
    gap: 12,
    paddingBottom: 28,
  },
  heroCard: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#43c6c9',
    borderWidth: 1,
    borderColor: '#30aeb3',
  },
  heroTitle: {
    fontSize: 32,
    color: '#06233b',
    fontWeight: '900',
    textAlign: 'center',
  },
  heroSubtitle: {
    marginTop: 2,
    fontSize: 14,
    color: '#0a3d5f',
    textAlign: 'center',
    fontWeight: '700',
  },
  heroHint: {
    marginTop: 6,
    fontSize: 12,
    color: '#123f57',
    textAlign: 'center',
  },
  cardBlue: {
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#4f8ec6',
    borderWidth: 1,
    borderColor: '#3a78b0',
  },
  cardPurple: {
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#5f5897',
    borderWidth: 1,
    borderColor: '#514984',
  },
  cardTeal: {
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#4bbdc0',
    borderWidth: 1,
    borderColor: '#36a8ad',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#e8f3ff',
    marginBottom: 8,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  sectionTitleLight: {
    fontSize: 13,
    fontWeight: '900',
    color: '#f8fbff',
    marginBottom: 8,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderColor: '#8eb5d7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0f172a',
    backgroundColor: '#f8fbff',
    marginBottom: 8,
  },
  inputDark: {
    borderWidth: 1,
    borderColor: '#7f7ac2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#eef2ff',
    backgroundColor: '#4f4884',
    marginBottom: 10,
  },
  textArea: {
    minHeight: 105,
    textAlignVertical: 'top',
  },
  primaryButton: {
    borderRadius: 10,
    backgroundColor: '#c8ecff',
    paddingVertical: 12,
    alignItems: 'center',
  },
  pasteButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cac4ff',
    backgroundColor: '#ece9ff',
    paddingVertical: 11,
    alignItems: 'center',
    marginBottom: 8,
  },
  pasteButtonText: {
    color: '#3f3380',
    fontWeight: '800',
  },
  primaryButtonText: {
    color: '#14314a',
    fontWeight: '800',
  },
  scanHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  scanToggleButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dffcff',
    backgroundColor: '#8fe7ea',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  scanToggleText: {
    color: '#11414f',
    fontSize: 12,
    fontWeight: '800',
  },
  permissionButton: {
    borderRadius: 10,
    backgroundColor: '#dffcff',
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  permissionButtonText: {
    color: '#0e3e4f',
    fontWeight: '800',
  },
  cameraFrame: {
    height: 280,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#dffcff',
    marginBottom: 8,
  },
  camera: {
    flex: 1,
  },
  scanOverlay: {
    position: 'absolute',
    top: '18%',
    left: '15%',
    right: '15%',
    bottom: '18%',
    borderWidth: 2,
    borderColor: '#dffcff',
    borderRadius: 12,
  },
  lightHint: {
    color: '#e8f8ff',
    fontSize: 12,
    lineHeight: 17,
  },
  errorText: {
    color: '#dc2626',
    fontWeight: '700',
    backgroundColor: '#fff0f0',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    padding: 10,
  },
  errorTextLight: {
    color: '#fef2f2',
    fontWeight: '700',
    marginBottom: 6,
  },
  statusText: {
    color: '#065f46',
    fontSize: 12,
    lineHeight: 18,
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
});

export default App;
