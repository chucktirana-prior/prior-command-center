import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { API_BASE_URL } from '../config';

export default function StartScreen({ navigation }) {
  const [pdfAsset, setPdfAsset] = useState(null);
  const [imageAssets, setImageAssets] = useState([]);
  const [loading, setLoading] = useState(false);

  async function pickPdf() {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      setPdfAsset(result.assets[0]);
    }
  }

  async function pickImages() {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'image/*',
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets?.length) {
      setImageAssets(result.assets);
    }
  }

  async function handleSubmit() {
    if (!pdfAsset) return;
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('pdfFile', {
        uri: pdfAsset.uri,
        name: pdfAsset.name,
        type: 'application/pdf',
      });

      const res = await fetch(`${API_BASE_URL}/api/parse`, {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to parse document');
      }

      const data = await res.json();
      navigation.navigate('Review', { parsedData: data, imageAssets });
    } catch (err) {
      Alert.alert('Parse Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.subtitle}>Article Uploader</Text>

      <Text style={styles.label}>Article PDF</Text>
      <TouchableOpacity style={styles.dropZone} onPress={pickPdf} disabled={loading}>
        <Text style={pdfAsset ? styles.fileName : styles.prompt}>
          {pdfAsset ? pdfAsset.name : 'Tap to select a PDF'}
        </Text>
      </TouchableOpacity>

      <Text style={[styles.label, { marginTop: 20 }]}>Article Images (optional)</Text>
      <TouchableOpacity style={styles.dropZone} onPress={pickImages} disabled={loading}>
        {imageAssets.length > 0 ? (
          <View>
            <Text style={styles.fileName}>
              {imageAssets.length} image{imageAssets.length !== 1 ? 's' : ''} selected
            </Text>
            <Text style={styles.imageNames} numberOfLines={2}>
              {imageAssets.map((a) => a.name).join(', ')}
            </Text>
          </View>
        ) : (
          <Text style={styles.prompt}>Tap to select images</Text>
        )}
      </TouchableOpacity>

      {imageAssets.length > 0 && (
        <TouchableOpacity onPress={() => setImageAssets([])} style={styles.clearBtn}>
          <Text style={styles.clearBtnText}>Clear images</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.primaryBtn, (!pdfAsset || loading) && styles.btnDisabled]}
        onPress={handleSubmit}
        disabled={!pdfAsset || loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryBtnText}>Parse Document</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: '#f5f5f0',
    flexGrow: 1,
  },
  subtitle: {
    fontSize: 13,
    letterSpacing: 3,
    color: '#666',
    textTransform: 'uppercase',
    marginBottom: 32,
    textAlign: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#333',
    marginBottom: 8,
  },
  dropZone: {
    borderWidth: 2,
    borderColor: '#ccc',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  prompt: {
    color: '#999',
    fontSize: 15,
  },
  fileName: {
    color: '#1a1a1a',
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
  },
  imageNames: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  clearBtn: {
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  clearBtnText: {
    color: '#999',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  primaryBtn: {
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 1,
  },
});
