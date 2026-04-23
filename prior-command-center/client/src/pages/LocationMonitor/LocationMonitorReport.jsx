import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from '@react-pdf/renderer';

// ── Palette matching Prior brand ──────────────────────────────────────────────
const C = {
  black: '#1a1a1a',
  cream: '#f7f4ef',
  border: '#e5e2db',
  muted: '#8a8175',
  body: '#4a4540',
  white: '#ffffff',
  green: '#2d6a4f',
  greenLight: '#d8f3dc',
  greenBorder: '#b7e4c7',
  amber: '#92400e',
  amberLight: '#fffbeb',
  amberBorder: '#fde68a',
  red: '#991b1b',
  redLight: '#fff1f2',
  redBorder: '#fecaca',
  stone: '#57534e',
  stoneBg: '#f5f5f4',
  stoneBorder: '#e7e5e4',
};

const S = StyleSheet.create({
  page: {
    backgroundColor: C.cream,
    fontFamily: 'Helvetica',
    padding: 0,
  },

  // ── Header bar ──────────────────────────────────────────────────────────────
  header: {
    backgroundColor: C.black,
    paddingHorizontal: 40,
    paddingTop: 32,
    paddingBottom: 28,
  },
  headerEyebrow: {
    fontSize: 8,
    letterSpacing: 2,
    color: '#999',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: 'Helvetica-Bold',
    color: C.white,
    letterSpacing: -0.5,
  },
  headerMeta: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 20,
  },
  headerMetaItem: {
    fontSize: 9,
    color: '#aaa',
  },
  headerMetaValue: {
    color: '#fff',
    fontFamily: 'Helvetica-Bold',
  },

  // ── Page body ───────────────────────────────────────────────────────────────
  body: {
    paddingHorizontal: 40,
    paddingTop: 28,
    paddingBottom: 40,
  },

  // ── Section ─────────────────────────────────────────────────────────────────
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: C.black,
    letterSpacing: 0.3,
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },

  // ── Stat grid ───────────────────────────────────────────────────────────────
  statGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 12,
  },
  statLabel: {
    fontSize: 7,
    letterSpacing: 1.5,
    color: C.muted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: C.black,
  },
  statCardDanger: {
    backgroundColor: C.redLight,
    borderColor: C.redBorder,
  },
  statValueDanger: {
    color: C.red,
  },
  statCardWarn: {
    backgroundColor: C.amberLight,
    borderColor: C.amberBorder,
  },
  statValueWarn: {
    color: C.amber,
  },

  // ── Sub-stat row (website/AI) ─────────────────────────────────────────────
  subStatRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  subStatCard: {
    flex: 1,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subStatLabel: {
    fontSize: 8,
    color: C.body,
  },
  subStatValue: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: C.black,
  },

  // ── Table ────────────────────────────────────────────────────────────────────
  table: {
    width: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: C.black,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 2,
  },
  tableHeaderCell: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: C.white,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 2,
  },
  tableRowAlt: {
    backgroundColor: '#fafaf9',
  },
  tableCell: {
    fontSize: 8.5,
    color: C.body,
  },
  tableCellBold: {
    fontFamily: 'Helvetica-Bold',
    color: C.black,
  },
  tableCellMuted: {
    fontSize: 7.5,
    color: C.muted,
    marginTop: 1,
  },

  // ── Column widths ────────────────────────────────────────────────────────────
  colName: { flex: 2.5 },
  colGuide: { flex: 2 },
  colWebStatus: { flex: 1.2 },
  colAiStatus: { flex: 1.2 },
  colMapsStatus: { flex: 1 },

  colGuideName: { flex: 3 },
  colGuidePlaces: { flex: 1 },
  colGuideRisk: { flex: 1.5 },
  colGuideStatus: { flex: 1.5 },

  // ── Badge ────────────────────────────────────────────────────────────────────
  badge: {
    borderRadius: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'capitalize',
  },

  // ── Two-column layout ─────────────────────────────────────────────────────
  twoCol: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  twoColLeft: { flex: 1 },
  twoColRight: { flex: 1 },

  // ── Current Read mini table ──────────────────────────────────────────────
  readRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  readLabel: {
    fontSize: 8.5,
    color: C.body,
  },
  readValue: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: C.black,
  },

  // ── Footer ──────────────────────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7.5,
    color: C.muted,
  },

  emptyNote: {
    fontSize: 8.5,
    color: C.muted,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(value) {
  if (!value) return 'Never';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function prettyStatus(s) {
  if (!s) return 'Pending';
  if (s === 'not_found') return 'Not found';
  return s.replace(/_/g, ' ');
}

function badgeStyle(status) {
  switch (status) {
    case 'open': case 'active': case 'likely_active':
      return { bg: C.greenLight, border: C.greenBorder, text: C.green };
    case 'closed': case 'dead': case 'likely_closed':
      return { bg: C.redLight, border: C.redBorder, text: C.red };
    case 'not_found': case 'suspect': case 'likely_changed': case 'needs_review':
      return { bg: C.amberLight, border: C.amberBorder, text: C.amber };
    case 'error':
      return { bg: '#fff7ed', border: '#fed7aa', text: '#9a3412' };
    default:
      return { bg: C.stoneBg, border: C.stoneBorder, text: C.stone };
  }
}

function Badge({ status }) {
  const { bg, border, text } = badgeStyle(status);
  return (
    <View style={[S.badge, { backgroundColor: bg, borderWidth: 1, borderColor: border }]}>
      <Text style={[S.badgeText, { color: text }]}>{prettyStatus(status)}</Text>
    </View>
  );
}

// ── PDF Document ─────────────────────────────────────────────────────────────

function ReportDocument({ data, filterLabel }) {
  const { summary = {}, places = [], articleRollups = [], recentWebsiteChecks = [], recentAiReviews = [], recentChecks = [] } = data;

  const atRiskPlaces = places.filter((p) =>
    ['suspect', 'error'].includes(p.website_check_status)
    || ['needs_review', 'likely_changed', 'likely_closed'].includes(p.ai_review_status)
    || ['closed', 'not_found', 'error'].includes(p.check_status)
  );

  const reportPlaces = filterLabel === 'All Places' ? places.slice(0, 80) : atRiskPlaces.slice(0, 80);
  const generatedAt = new Date().toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

  return (
    <Document title="Prior Location Monitor Report" author="Prior Command Center">
      <Page size="A4" orientation="landscape" style={S.page}>

        {/* Header */}
        <View style={S.header}>
          <Text style={S.headerEyebrow}>Prior Command Center</Text>
          <Text style={S.headerTitle}>Location Monitor Report</Text>
          <View style={S.headerMeta}>
            <Text style={S.headerMetaItem}>Generated  <Text style={S.headerMetaValue}>{generatedAt}</Text></Text>
            <Text style={S.headerMetaItem}>Filter  <Text style={S.headerMetaValue}>{filterLabel}</Text></Text>
            <Text style={S.headerMetaItem}>Total tracked  <Text style={S.headerMetaValue}>{summary.total || 0}</Text></Text>
          </View>
        </View>

        <View style={S.body}>

          {/* Stat row */}
          <View style={S.statGrid}>
            <View style={S.statCard}>
              <Text style={S.statLabel}>Tracked</Text>
              <Text style={S.statValue}>{summary.total || 0}</Text>
            </View>
            <View style={[S.statCard, atRiskPlaces.length > 0 ? S.statCardDanger : {}]}>
              <Text style={S.statLabel}>At Risk</Text>
              <Text style={[S.statValue, atRiskPlaces.length > 0 ? S.statValueDanger : {}]}>{atRiskPlaces.length}</Text>
            </View>
            <View style={S.statCard}>
              <Text style={S.statLabel}>Open</Text>
              <Text style={S.statValue}>{summary.open_count || 0}</Text>
            </View>
            <View style={[S.statCard, (summary.pending_count || 0) > 0 ? S.statCardWarn : {}]}>
              <Text style={S.statLabel}>Pending</Text>
              <Text style={[S.statValue, (summary.pending_count || 0) > 0 ? S.statValueWarn : {}]}>{summary.pending_count || 0}</Text>
            </View>
            <View style={S.statCard}>
              <Text style={S.statLabel}>Website Active</Text>
              <Text style={S.statValue}>{summary.website_active_count || 0}</Text>
            </View>
            <View style={[S.statCard, (summary.website_suspect_count || 0) > 0 ? S.statCardWarn : {}]}>
              <Text style={S.statLabel}>Website Suspect</Text>
              <Text style={[S.statValue, (summary.website_suspect_count || 0) > 0 ? S.statValueWarn : {}]}>{summary.website_suspect_count || 0}</Text>
            </View>
            <View style={[S.statCard, (summary.ai_needs_review_count || 0) > 0 ? S.statCardWarn : {}]}>
              <Text style={S.statLabel}>AI Needs Review</Text>
              <Text style={[S.statValue, (summary.ai_needs_review_count || 0) > 0 ? S.statValueWarn : {}]}>{summary.ai_needs_review_count || 0}</Text>
            </View>
          </View>

          {/* Two-col: Guides Needing Attention + Current Read */}
          <View style={S.twoCol}>
            <View style={S.twoColLeft}>
              <Text style={S.sectionTitle}>Guides Needing Attention</Text>
              {articleRollups.length === 0 ? (
                <Text style={S.emptyNote}>No rollup data available yet.</Text>
              ) : (
                <View style={S.table}>
                  <View style={S.tableHeader}>
                    <Text style={[S.tableHeaderCell, S.colGuideName]}>Guide</Text>
                    <Text style={[S.tableHeaderCell, S.colGuidePlaces]}>Places</Text>
                    <Text style={[S.tableHeaderCell, S.colGuideRisk]}>Web Risk</Text>
                    <Text style={[S.tableHeaderCell, S.colGuideStatus]}>AI Risk</Text>
                  </View>
                  {articleRollups.slice(0, 12).map((article, i) => (
                    <View key={article.article_id || i} style={[S.tableRow, i % 2 === 1 ? S.tableRowAlt : {}]}>
                      <View style={S.colGuideName}>
                        <Text style={[S.tableCell, S.tableCellBold]}>{article.article_title || '—'}</Text>
                      </View>
                      <Text style={[S.tableCell, S.colGuidePlaces]}>{article.total_places || 0}</Text>
                      <Text style={[S.tableCell, S.colGuideRisk]}>{article.website_at_risk_count || 0}</Text>
                      <Text style={[S.tableCell, S.colGuideStatus]}>{article.ai_at_risk_count || 0}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={S.twoColRight}>
              <Text style={S.sectionTitle}>Current Read</Text>
              {[
                ['Closed by Maps', summary.closed_count || 0],
                ['Not found by Maps', summary.not_found_count || 0],
                ['Website suspect', summary.website_suspect_count || 0],
                ['Website errors', summary.website_error_count || 0],
                ['AI likely closed', summary.ai_closed_count || 0],
                ['AI likely changed', summary.ai_changed_count || 0],
                ['Last import', fmtDate(summary.last_import_at)],
                ['Last website check', fmtDate(summary.website_checked_at)],
                ['Last AI review', fmtDate(summary.ai_reviewed_at)],
              ].map(([label, value]) => (
                <View key={label} style={S.readRow}>
                  <Text style={S.readLabel}>{label}</Text>
                  <Text style={S.readValue}>{String(value)}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Tracked places table */}
          <View style={S.section}>
            <Text style={S.sectionTitle}>
              {filterLabel === 'All Places' ? `All Tracked Locations (showing first ${Math.min(reportPlaces.length, 80)} of ${places.length})` : `Locations Needing Attention (${atRiskPlaces.length} total)`}
            </Text>
            {reportPlaces.length === 0 ? (
              <Text style={S.emptyNote}>No locations match this filter.</Text>
            ) : (
              <View style={S.table}>
                <View style={S.tableHeader}>
                  <Text style={[S.tableHeaderCell, S.colName]}>Business</Text>
                  <Text style={[S.tableHeaderCell, S.colGuide]}>Guide / Section</Text>
                  <Text style={[S.tableHeaderCell, S.colWebStatus]}>Website</Text>
                  <Text style={[S.tableHeaderCell, S.colAiStatus]}>AI Review</Text>
                  <Text style={[S.tableHeaderCell, S.colMapsStatus]}>Maps</Text>
                </View>
                {reportPlaces.map((place, i) => (
                  <View key={place.id} style={[S.tableRow, i % 2 === 1 ? S.tableRowAlt : {}]}>
                    <View style={S.colName}>
                      <Text style={[S.tableCell, S.tableCellBold]}>{place.business_name || '—'}</Text>
                      {place.address ? <Text style={S.tableCellMuted}>{place.address}</Text> : null}
                    </View>
                    <View style={S.colGuide}>
                      <Text style={S.tableCell}>{place.article_title || '—'}</Text>
                      {place.section ? <Text style={S.tableCellMuted}>{place.section}</Text> : null}
                    </View>
                    <View style={S.colWebStatus}>
                      <Badge status={place.website_check_status || 'pending'} />
                    </View>
                    <View style={S.colAiStatus}>
                      <Badge status={place.ai_review_status || 'pending'} />
                    </View>
                    <View style={S.colMapsStatus}>
                      <Badge status={place.check_status || 'pending'} />
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

        </View>

        {/* Footer */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>Prior Command Center — Location Monitor</Text>
          <Text style={S.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

      </Page>
    </Document>
  );
}

// ── Export trigger ────────────────────────────────────────────────────────────

export async function downloadLocationReport(data, filterLabel = 'Needs Attention') {
  const doc = <ReportDocument data={data} filterLabel={filterLabel} />;
  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const date = new Date().toISOString().slice(0, 10);
  a.download = `prior-location-monitor-${date}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
