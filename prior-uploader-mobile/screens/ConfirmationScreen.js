import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';

export default function ConfirmationScreen({ route, navigation }) {
  const { result } = route.params;
  const contentfulUrl = `https://app.contentful.com/spaces/${result.spaceId}/environments/${result.environment}/entries/${result.entryId}`;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.checkCircle}>
          <Text style={styles.checkMark}>✓</Text>
        </View>

        <Text style={styles.heading}>Draft Created</Text>
        <Text style={styles.body}>Your article has been saved as a draft in Contentful.</Text>

        <TouchableOpacity style={styles.primaryBtn} onPress={() => Linking.openURL(contentfulUrl)}>
          <Text style={styles.primaryBtnText}>Open in Contentful</Text>
        </TouchableOpacity>

        <Text style={styles.reminder}>Review images and publish when ready.</Text>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => navigation.navigate('Start')}
        >
          <Text style={styles.secondaryBtnText}>Upload Another</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f0',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkMark: { color: '#fff', fontSize: 28, fontWeight: '700' },
  heading: { fontSize: 22, fontWeight: '700', color: '#1a1a1a', marginBottom: 10 },
  body: { fontSize: 15, color: '#555', textAlign: 'center', marginBottom: 28, lineHeight: 22 },
  primaryBtn: {
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    paddingVertical: 14,
    paddingHorizontal: 28,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14, letterSpacing: 0.5 },
  reminder: { color: '#999', fontSize: 13, marginBottom: 24 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 28,
    width: '100%',
    alignItems: 'center',
  },
  secondaryBtnText: { color: '#555', fontWeight: '600', fontSize: 14 },
});
