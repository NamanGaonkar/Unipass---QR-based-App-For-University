import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Clipboard from '@react-native-clipboard/clipboard';

const TeacherQRGenerator = ({ teacherId, teacherName, backendBaseUrl, onLogout }) => {
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [qrPayload, setQrPayload] = useState(null);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [generatingQr, setGeneratingQr] = useState(false);
  const [error, setError] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [attendanceSummary, setAttendanceSummary] = useState({ count: 0, students: [] });
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const lastSeenCountRef = useRef(0);

  const activeSessionKey = useMemo(() => {
    if (!selectedSubject || !qrPayload?.epoch) {
      return '';
    }

    const subjectIdentity = qrPayload?.subjectId || selectedSubject;
    const issuedAt = String(qrPayload?.issuedAt || '');
    return `${String(teacherId || '').toUpperCase()}|${subjectIdentity}|${String(qrPayload.epoch)}|${issuedAt}`;
  }, [selectedSubject, qrPayload?.epoch, qrPayload?.issuedAt, qrPayload?.subjectId, teacherId]);

  const selectedSubjectMeta = useMemo(
    () => subjects.find((item) => item.code === selectedSubject),
    [subjects, selectedSubject]
  );

  const qrText = useMemo(() => (qrPayload ? JSON.stringify(qrPayload) : ''), [qrPayload]);

  const fetchSubjects = useCallback(async () => {
    setLoadingSubjects(true);
    setError('');

    try {
      const response = await fetch(`${backendBaseUrl}/api/teacher/subjects`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to load subjects.');
      }

      const allSubjects = Array.isArray(data.subjects) ? data.subjects : [];
      setSubjects(allSubjects);
      if (allSubjects.length > 0) {
        setSelectedSubject((current) => current || allSubjects[0].code);
      }
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoadingSubjects(false);
    }
  }, [backendBaseUrl]);

  const generateQr = useCallback(async () => {
    if (!selectedSubject) {
      setError('Pick a subject first.');
      return;
    }

    setGeneratingQr(true);
    setError('');

    try {
      const response = await fetch(`${backendBaseUrl}/api/teacher/generate-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId,
          teacherName,
          subjectCode: selectedSubject,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to generate QR.');
      }

      setQrPayload(data.qrPayload);
      setRemainingSeconds(Number(data.expiresInSeconds || 0));
    } catch (genError) {
      setError(genError.message);
    } finally {
      setGeneratingQr(false);
    }
  }, [backendBaseUrl, selectedSubject, teacherId, teacherName]);

  const copyQrJson = useCallback(async () => {
    if (!qrText) {
      Alert.alert('No QR yet', 'Generate a subject QR first.');
      return;
    }

    await Clipboard.setString(qrText);
    Alert.alert('Copied', 'QR JSON copied. Paste it in Student app JSON test box.');
  }, [qrText]);

  const fetchAttendanceSummary = useCallback(async () => {
    if (!selectedSubject || !qrPayload?.epoch) {
      setAttendanceSummary({ count: 0, students: [] });
      return;
    }

    setLoadingAttendance(true);
    try {
      const queryParts = [
        `teacherId=${encodeURIComponent(String(teacherId || ''))}`,
        `subjectCode=${encodeURIComponent(String(selectedSubject || ''))}`,
        `epoch=${encodeURIComponent(String(qrPayload.epoch))}`,
      ];

      if (qrPayload?.subjectId) {
        queryParts.push(`subjectId=${encodeURIComponent(String(qrPayload.subjectId))}`);
      }

      const response = await fetch(`${backendBaseUrl}/api/teacher/attendance-summary?${queryParts.join('&')}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to fetch attendance summary.');
      }

      const incomingStudents = Array.isArray(data.students) ? data.students : [];
      const incomingCount = Number(data.count || 0);

      setAttendanceSummary((previous) => {
        const mergedById = new Map();

        [...incomingStudents, ...(previous.students || [])].forEach((entry) => {
          const fallbackId = `${String(entry.studentId || '')}-${String(entry.markedAt || '')}`;
          const entryId = String(entry.attendanceId || fallbackId);
          if (!mergedById.has(entryId)) {
            mergedById.set(entryId, {
              ...entry,
              attendanceId: entryId,
            });
          }
        });

        const mergedStudents = Array.from(mergedById.values()).sort(
          (a, b) => Number(b.markedAt || 0) - Number(a.markedAt || 0)
        );

        return {
          count: Math.max(incomingCount, mergedStudents.length),
          students: mergedStudents,
        };
      });
    } catch (summaryError) {
      setError(summaryError.message);
    } finally {
      setLoadingAttendance(false);
    }
  }, [backendBaseUrl, qrPayload?.epoch, qrPayload?.subjectId, selectedSubject, teacherId]);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  useEffect(() => {
    setQrPayload(null);
    setRemainingSeconds(0);
    setAttendanceSummary({ count: 0, students: [] });
    lastSeenCountRef.current = 0;
  }, [selectedSubject]);

  useEffect(() => {
    setAttendanceSummary({ count: 0, students: [] });
    lastSeenCountRef.current = 0;
  }, [activeSessionKey]);

  useEffect(() => {
    if (!qrPayload?.epoch) {
      return;
    }

    const previous = Number(lastSeenCountRef.current || 0);
    const current = Number(attendanceSummary.count || 0);
    if (current > previous) {
      const delta = current - previous;
      Alert.alert('Attendance Update', `${delta} new student${delta > 1 ? 's' : ''} marked.`);
    }
    lastSeenCountRef.current = current;
  }, [attendanceSummary.count, qrPayload?.epoch]);

  useEffect(() => {
    if (!qrPayload) {
      return;
    }

    const timer = setInterval(() => {
      const next = Math.max(0, Math.floor((Number(qrPayload.expiresAt) - Date.now()) / 1000));
      setRemainingSeconds(next);
    }, 1000);

    return () => clearInterval(timer);
  }, [qrPayload]);

  useEffect(() => {
    fetchAttendanceSummary();
  }, [fetchAttendanceSummary]);

  useEffect(() => {
    const poller = setInterval(fetchAttendanceSummary, 4000);
    return () => clearInterval(poller);
  }, [fetchAttendanceSummary]);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <Text style={styles.title}>Teacher QR Console</Text>
          <Text style={styles.subtitle}>{teacherName} • {teacherId}</Text>
          <Text style={styles.subtitleMuted}>Subject session broadcaster</Text>
        </View>

        <View style={styles.subjectCard}>
          <View style={styles.subjectHeaderRow}>
            <Text style={styles.sectionTitle}>Choose Subject</Text>
            <TouchableOpacity style={styles.inlineButton} onPress={fetchSubjects}>
              <Text style={styles.inlineButtonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
          {loadingSubjects ? (
            <ActivityIndicator color="#245ad7" />
          ) : subjects.length === 0 ? (
            <Text style={styles.infoText}>No subjects found. Add from dashboard first.</Text>
          ) : (
            <View style={styles.subjectGrid}>
              {subjects.map((item) => {
                const active = item.code === selectedSubject;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.subjectButton, active && styles.subjectButtonActive]}
                    onPress={() => setSelectedSubject(item.code)}
                  >
                    <Text style={[styles.subjectCode, active && styles.subjectCodeActive]}>{item.code}</Text>
                    <Text style={[styles.subjectName, active && styles.subjectNameActive]}>{item.name}</Text>
                    <Text style={[styles.subjectSemester, active && styles.subjectSemesterActive]}>
                      Sem {item.semester || '-'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.generateButton} onPress={generateQr} disabled={generatingQr || loadingSubjects}>
          <Text style={styles.generateButtonText}>{generatingQr ? 'Generating...' : 'Generate Live QR'}</Text>
        </TouchableOpacity>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {qrPayload ? (
          <View style={styles.qrCard}>
            <View style={styles.qrChipRow}>
              <View style={styles.chipBlue}><Text style={styles.chipTextBlue}>Epoch {qrPayload.epoch}</Text></View>
              <View style={styles.chipAmber}><Text style={styles.chipTextAmber}>{remainingSeconds}s left</Text></View>
            </View>
            <QRCode value={qrText} size={230} />
            <Text style={styles.qrMeta}>{selectedSubjectMeta?.name || qrPayload.subjectName}</Text>
            <Text style={styles.qrMetaSmall}>Students can scan or paste this JSON in Student app.</Text>

            <TouchableOpacity style={styles.copyButton} onPress={copyQrJson}>
              <Text style={styles.copyButtonText}>Copy QR JSON</Text>
            </TouchableOpacity>

            <Text selectable style={styles.jsonPreview}>{qrText}</Text>
          </View>
        ) : (
          <Text style={styles.infoText}>Generate a QR after selecting a subject.</Text>
        )}

        <View style={styles.attendanceCard}>
          <View style={styles.attendanceHeaderRow}>
            <Text style={styles.attendanceTitle}>Live Attendance</Text>
            <TouchableOpacity style={styles.inlineButton} onPress={fetchAttendanceSummary}>
              <Text style={styles.inlineButtonText}>{loadingAttendance ? 'Loading...' : 'Refresh'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.attendanceCount}>{attendanceSummary.count} students marked</Text>
          {attendanceSummary.students.length === 0 ? (
            <Text style={styles.attendanceEmpty}>No students marked yet for this subject/session.</Text>
          ) : (
            attendanceSummary.students.map((entry) => (
              <View key={entry.attendanceId} style={styles.attendanceRow}>
                <View>
                  <Text style={styles.attendanceName}>{entry.studentName}</Text>
                  <Text style={styles.attendanceMeta}>{entry.studentId}</Text>
                </View>
                <Text style={styles.attendanceMeta}>{new Date(entry.markedAt).toLocaleTimeString()}</Text>
              </View>
            ))
          )}
        </View>

        <TouchableOpacity style={styles.secondaryButton} onPress={onLogout}>
          <Text style={styles.secondaryButtonText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 14,
    paddingBottom: 26,
  },
  heroCard: {
    backgroundColor: '#43c6c9',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#32aeb0',
    padding: 15,
    marginBottom: 12,
  },
  title: {
    fontSize: 27,
    fontWeight: '900',
    color: '#082d40',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#11435a',
    textAlign: 'center',
    fontWeight: '800',
  },
  subtitleMuted: {
    marginTop: 4,
    fontSize: 12,
    color: '#1c5366',
    textAlign: 'center',
  },
  subjectCard: {
    backgroundColor: '#4f8ec6',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#3a79b1',
  },
  subjectHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#e8f6ff',
    letterSpacing: 0.4,
  },
  inlineButton: {
    backgroundColor: '#d7efff',
    borderWidth: 1,
    borderColor: '#b7e0ff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  inlineButtonText: {
    color: '#114a6c',
    fontWeight: '800',
    fontSize: 12,
  },
  subjectGrid: {
    gap: 8,
  },
  subjectButton: {
    borderWidth: 1,
    borderColor: '#7cb2df',
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#eaf6ff',
  },
  subjectButtonActive: {
    borderColor: '#e8fbff',
    backgroundColor: '#d8f1ff',
  },
  subjectCode: {
    fontSize: 12,
    color: '#124f75',
    fontWeight: '900',
  },
  subjectCodeActive: {
    color: '#093d5b',
  },
  subjectName: {
    marginTop: 2,
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '700',
  },
  subjectNameActive: {
    color: '#0f172a',
  },
  subjectSemester: {
    marginTop: 3,
    fontSize: 11,
    color: '#334155',
  },
  subjectSemesterActive: {
    color: '#0f172a',
  },
  generateButton: {
    marginTop: 12,
    backgroundColor: '#5f5897',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  generateButtonText: {
    color: '#f8f7ff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  errorText: {
    marginTop: 10,
    color: '#dc2626',
    fontWeight: '700',
    textAlign: 'center',
  },
  infoText: {
    marginTop: 12,
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
  },
  qrCard: {
    marginTop: 14,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#dbeafe',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#4f8ec6',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  qrChipRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chipBlue: {
    backgroundColor: '#dbeafe',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  chipAmber: {
    backgroundColor: '#fef3c7',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  chipTextBlue: {
    color: '#1d4ed8',
    fontSize: 11,
    fontWeight: '700',
  },
  chipTextAmber: {
    color: '#b45309',
    fontSize: 11,
    fontWeight: '700',
  },
  qrMeta: {
    marginTop: 6,
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '800',
    textAlign: 'center',
  },
  qrMetaSmall: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  copyButton: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#c5b4ef',
    backgroundColor: '#f0ebff',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  copyButtonText: {
    color: '#4c1d95',
    fontWeight: '900',
    fontSize: 13,
  },
  jsonPreview: {
    width: '100%',
    marginTop: 2,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    color: '#334155',
    fontSize: 11,
    lineHeight: 16,
  },
  secondaryButton: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#ddd6fe',
    borderRadius: 10,
    backgroundColor: '#faf5ff',
  },
  secondaryButtonText: {
    color: '#4338ca',
    fontWeight: '800',
  },
  attendanceCard: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    backgroundColor: '#eef2ff',
    padding: 12,
  },
  attendanceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  attendanceTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#312e81',
  },
  attendanceCount: {
    marginTop: 8,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '800',
    color: '#4338ca',
  },
  attendanceEmpty: {
    fontSize: 12,
    color: '#5b5f8e',
  },
  attendanceRow: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#dbe2ff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attendanceName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e1b4b',
  },
  attendanceMeta: {
    fontSize: 11,
    color: '#4c4f7d',
  },
});

export default TeacherQRGenerator;
