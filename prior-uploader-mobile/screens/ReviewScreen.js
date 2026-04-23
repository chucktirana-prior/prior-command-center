import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { API_BASE_URL } from '../config';

function deriveLocationFields(locationValue) {
  const raw = String(locationValue || '').trim();
  if (!raw) return { locationLabel: '', country: '', region: '' };
  const parts = raw.split(/(?:\s*[|/]\s*|\s*,\s*)/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { locationLabel: raw, region: parts[0], country: parts[parts.length - 1] };
  }
  return { locationLabel: raw, country: raw, region: '' };
}

export default function ReviewScreen({ route, navigation }) {
  const { parsedData, imageAssets } = route.params;
  const derivedLocation = deriveLocationFields(parsedData.location);

  const [fields, setFields] = useState({
    title: parsedData.title || '',
    subtitle: parsedData.subtitle || '',
    slug: parsedData.slug || '',
    homepageExcerpt: parsedData.homepageExcerpt || '',
    metaTitle: parsedData.metaTitle || '',
    metaDescription: parsedData.metaDescription || '',
    articleBody: parsedData.articleBody || '',
    heroCaption: parsedData.heroCaption || '',
    locationLabel: derivedLocation.locationLabel,
    country: derivedLocation.country,
    region: derivedLocation.region,
    datePublished: '',
    updatedAt: '',
    hideFromLatestArticles: false,
    isFreeContent: false,
  });

  const [keywords, setKeywords] = useState(parsedData.keywords || []);
  const [keywordInput, setKeywordInput] = useState('');
  const [authorName, setAuthorName] = useState(parsedData.authorName || '');
  const [categoryInput, setCategoryInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  function updateField(name, value) {
    setFields((prev) => ({ ...prev, [name]: value }));
  }

  function addKeyword() {
    const kw = keywordInput.trim();
    if (kw && !keywords.includes(kw)) {
      setKeywords((prev) => [...prev, kw]);
    }
    setKeywordInput('');
  }

  function removeKeyword(kw) {
    setKeywords((prev) => prev.filter((k) => k !== kw));
  }

  async function handleSave() {
    setSaving(true);
    setSaveStatus('');

    try {
      let heroImageAssetId = null;
      let indexImageAssetId = null;

      if (imageAssets.length > 0) {
        setSaveStatus(`Uploading ${imageAssets.length} image${imageAssets.length !== 1 ? 's' : ''}...`);

        const formData = new FormData();
        imageAssets.forEach((asset, i) => {
          formData.append('images', {
            uri: asset.uri,
            name: asset.name,
            type: asset.mimeType || 'image/jpeg',
          });
        });
        formData.append('meta', JSON.stringify(
          imageAssets.map((_, i) => ({ figureIndex: i === 0 ? -1 : i === 1 ? -2 : i - 2, fileName: imageAssets[i].name, title: imageAssets[i].name }))
        ));

        const uploadRes = await fetch(`${API_BASE_URL}/api/contentful/upload-images`, {
          method: 'POST',
          body: formData,
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json();
          throw new Error(errData.error || 'Failed to upload images');
        }

        const uploadResult = await uploadRes.json();
        for (const asset of uploadResult.assets) {
          if (asset.figureIndex === -1) heroImageAssetId = asset.assetId;
          else if (asset.figureIndex === -2) indexImageAssetId = asset.assetId;
        }
      }

      setSaveStatus('Creating draft...');
      const payload = {
        ...fields,
        keywords,
        authorId: null,
        categoryIds: [],
        heroImageAssetId,
        indexImageAssetId,
        relatedArticleIds: [],
      };

      const res = await fetch(`${API_BASE_URL}/api/contentful/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to create draft');
      }

      const result = await res.json();
      navigation.navigate('Confirmation', { result });
    } catch (err) {
      Alert.alert('Save Error', err.message);
    } finally {
      setSaving(false);
      setSaveStatus('');
    }
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>

      <SectionHeader title="Article Metadata" />

      <Field label="Title">
        <TextInput style={styles.input} value={fields.title} onChangeText={(v) => updateField('title', v)} />
      </Field>
      <Field label="Subtitle">
        <TextInput style={styles.input} value={fields.subtitle} onChangeText={(v) => updateField('subtitle', v)} />
      </Field>
      <Field label="Slug">
        <TextInput style={styles.input} value={fields.slug} onChangeText={(v) => updateField('slug', v)} autoCapitalize="none" />
      </Field>
      <Field label="Homepage Excerpt">
        <TextInput style={[styles.input, styles.multiline]} value={fields.homepageExcerpt} onChangeText={(v) => updateField('homepageExcerpt', v)} multiline numberOfLines={3} />
      </Field>
      <Field label="Hero Caption">
        <TextInput style={styles.input} value={fields.heroCaption} onChangeText={(v) => updateField('heroCaption', v)} />
      </Field>
      <View style={styles.row}>
        <View style={styles.halfField}>
          <Text style={styles.label}>Country</Text>
          <TextInput style={styles.input} value={fields.country} onChangeText={(v) => updateField('country', v)} />
        </View>
        <View style={[styles.halfField, { marginLeft: 12 }]}>
          <Text style={styles.label}>Region</Text>
          <TextInput style={styles.input} value={fields.region} onChangeText={(v) => updateField('region', v)} />
        </View>
      </View>

      <SectionHeader title="Author" />
      <Field label="Author Name">
        <TextInput style={styles.input} value={authorName} onChangeText={setAuthorName} placeholder="e.g. Jane Smith" />
      </Field>

      <SectionHeader title="Dates" />
      <View style={styles.row}>
        <View style={styles.halfField}>
          <Text style={styles.label}>Date Published</Text>
          <TextInput style={styles.input} value={fields.datePublished} onChangeText={(v) => updateField('datePublished', v)} placeholder="YYYY-MM-DD" />
        </View>
        <View style={[styles.halfField, { marginLeft: 12 }]}>
          <Text style={styles.label}>Updated At</Text>
          <TextInput style={styles.input} value={fields.updatedAt} onChangeText={(v) => updateField('updatedAt', v)} placeholder="YYYY-MM-DD" />
        </View>
      </View>

      <SectionHeader title="SEO" />
      <Field label="Meta Title">
        <TextInput style={styles.input} value={fields.metaTitle} onChangeText={(v) => updateField('metaTitle', v)} />
      </Field>
      <Field label="Meta Description">
        <TextInput style={[styles.input, styles.multiline]} value={fields.metaDescription} onChangeText={(v) => updateField('metaDescription', v)} multiline numberOfLines={2} />
      </Field>
      <Field label="Keywords">
        <View style={styles.tagRow}>
          {keywords.map((kw) => (
            <TouchableOpacity key={kw} style={styles.tag} onPress={() => removeKeyword(kw)}>
              <Text style={styles.tagText}>{kw} ×</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={keywordInput}
            onChangeText={setKeywordInput}
            placeholder="Add keyword"
            onSubmitEditing={addKeyword}
            returnKeyType="done"
          />
          <TouchableOpacity style={styles.addBtn} onPress={addKeyword}>
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
      </Field>

      <SectionHeader title="Article Body" />
      <Field label="Body (Markdown)">
        <TextInput
          style={[styles.input, styles.bodyInput]}
          value={fields.articleBody}
          onChangeText={(v) => updateField('articleBody', v)}
          multiline
          textAlignVertical="top"
        />
      </Field>

      <SectionHeader title="Settings" />
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Hide from Latest Articles</Text>
        <Switch
          value={fields.hideFromLatestArticles}
          onValueChange={(v) => updateField('hideFromLatestArticles', v)}
        />
      </View>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Is Free Content</Text>
        <Switch
          value={fields.isFreeContent}
          onValueChange={(v) => updateField('isFreeContent', v)}
        />
      </View>

      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.goBack()} disabled={saving}>
          <Text style={styles.secondaryBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.primaryBtn, saving && styles.btnDisabled]} onPress={handleSave} disabled={saving}>
          {saving ? (
            <View style={styles.savingRow}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={[styles.primaryBtnText, { marginLeft: 8 }]}>{saveStatus || 'Saving...'}</Text>
            </View>
          ) : (
            <Text style={styles.primaryBtnText}>Save as Draft</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function SectionHeader({ title }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function Field({ label, children }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: '#f5f5f0' },
  container: { padding: 20, paddingBottom: 48 },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#999',
    marginTop: 28,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  fieldGroup: { marginBottom: 16 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1a1a1a',
  },
  multiline: { height: 80, textAlignVertical: 'top' },
  bodyInput: { height: 220 },
  row: { flexDirection: 'row', marginBottom: 16 },
  halfField: { flex: 1 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8, gap: 6 },
  tag: {
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: { color: '#fff', fontSize: 12 },
  inputRow: { flexDirection: 'row', gap: 8 },
  addBtn: {
    backgroundColor: '#555',
    borderRadius: 6,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  toggleLabel: { fontSize: 14, color: '#333' },
  actionBar: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 32,
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  secondaryBtnText: { color: '#555', fontWeight: '600', fontSize: 14 },
  primaryBtn: {
    flex: 2,
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  savingRow: { flexDirection: 'row', alignItems: 'center' },
});
