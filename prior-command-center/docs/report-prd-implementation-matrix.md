# Performance Report Generator PRD Implementation Matrix

Status: Working engineering matrix  
Source PRD: user-provided Product Requirements Document  
Scope: `prior-command-center` experimental app on `codex-next`  
Last updated: 2026-03-24

## Purpose
This document translates the report PRD into a build-ready matrix against the current `prior-command-center` implementation.

Each requirement is mapped into one of three buckets:

- `Available now`: already supported in the current analytics model or report output
- `Can derive next`: data is present or nearly present, but the report/model still needs implementation work
- `Requires new data/tracking`: not currently reliable because the app lacks the necessary source fields or connector

## Current System Snapshot

### Data sources currently usable
- Klaviyo metadata API
- Klaviyo weekly CSV metrics import
- Google Analytics Data API
- Contentful metadata for uploader/location monitor workflows
- Anthropic for deterministic-ish narrative generation layered on top of internal analytics

### Data sources not yet usable for this PRD
- Search Console / SEO source
- Instagram production analytics
- explicit conversion event source/business-defined conversion mapping
- CTA click tracking
- scroll-depth tracking
- assisted conversion source
- audience segmentation source

### Current analytics model status
- Shared analytics model exists in [`/Users/charleyslaptop2025/Charley's AI folder/prior-command-center/server/services/analytics/model.js`](/Users/charleyslaptop2025/Charley's%20AI%20folder/prior-command-center/server/services/analytics/model.js)
- URL/campaign-rule taxonomy exists in [`/Users/charleyslaptop2025/Charley's AI folder/prior-command-center/server/services/analytics/taxonomy.js`](/Users/charleyslaptop2025/Charley's%20AI%20folder/prior-command-center/server/services/analytics/taxonomy.js)
- GA now stores enriched fields such as `engaged_sessions`, `new_users`, `key_events`, `landing_page_sessions`
- Report generator has started consuming richer GA + Klaviyo rollups

## Requirement Matrix

### 1. Executive KPI Summary

| Requirement | Status | Notes |
|---|---|---|
| Sessions | Available now | In analytics model and report |
| Engaged sessions | Available now | In GA sync/model and report |
| Page views | Available now | In model and report |
| Conversion events | Can derive next | Current proxy is GA `key_events`; business conversion definition still needed |
| Newsletter signups | Requires new data/tracking | No dedicated signup event mapped yet |
| Email CTOR | Available now | Derived from Klaviyo CSV-backed metrics |
| New users % | Available now | Derived from GA fields |
| Returning users % | Available now | Derived from GA total/new users |
| Top converting page | Can derive next | Possible once `key_events` is formalized as a conversion proxy in ranking logic |
| Top traffic source by quality | Available now | In analytics model and partially surfaced |
| Period-over-period deltas | Available now | Shared comparison engine exists |

### 2. Channel Performance

| Requirement | Status | Notes |
|---|---|---|
| Email summary | Available now | Klaviyo CSV + metadata |
| Web summary | Available now | GA sessions/pages/engagement |
| Organic search summary | Can derive next | GA source bucketing exists; report needs clearer section framing |
| Social summary | Requires new data/tracking | Instagram is intentionally empty right now |
| Referral/direct summary | Can derive next | Source normalization exists; report can promote it more clearly |
| Volume by channel | Available now | Channel rollups in analytics model |
| Engagement quality by channel | Available now | Using engaged session rate / engagement rate |
| Conversion contribution by channel | Can derive next | Can use `key_events` proxy now, real conversions later |
| Comparison to prior period | Available now | Backed by analytics comparison layer |

### 3. Content Intelligence

| Requirement | Status | Notes |
|---|---|---|
| Group by content type | Can derive next | Taxonomy exists but report/dashboard usage is still partial |
| Group by content theme | Available now | URL-rule taxonomy + content rollup exists |
| Group by campaign type | Available now | Naming-rule taxonomy + Klaviyo campaign type rollup exists |
| Group by page template | Can derive next | Could be approximated from URL patterns now |
| Group by funnel stage | Can derive next | Taxonomy has early funnel-stage mapping, not deeply surfaced yet |
| Metadata-based classification | Requires new data/tracking | CMS metadata not yet integrated into report taxonomy |
| URL-rule classification | Available now | Implemented |
| Naming-convention classification | Available now | Implemented for campaigns |
| Manual mappings | Requires new data/tracking | No manual taxonomy config UI/table yet |

### 4. Audience Behavior

| Requirement | Status | Notes |
|---|---|---|
| New users | Available now | GA sync/model |
| Returning users | Available now | Derived from total minus new users |
| Returning user % | Available now | Derived metric exists |
| Subscriber growth | Requires new data/tracking | No subscriber-history source yet |
| Net list growth | Requires new data/tracking | No subscriber acquisition/churn source yet |
| Unsubscribe rate | Can derive next | Needs Klaviyo CSV support for unsubscribes or expanded import columns |
| Repeat sessions per user | Can derive next | Could approximate from sessions / users, but not yet modeled explicitly |
| Audience segment performance | Requires new data/tracking | No reliable segment-level input yet |

### 5. Insights and Actions

| Requirement | Status | Notes |
|---|---|---|
| Observation / Driver / Implication / Action structure | Can derive next | Current insights exist but are not consistently structured this way |
| Recommended Actions for Next Period | Can derive next | Report has action language, but not a dedicated final action framework yet |
| Double down on / Fix / Test blocks | Can derive next | Straightforward next report section |

## Metric Matrix

### Email Metrics

| Metric | Status | Notes |
|---|---|---|
| Campaigns sent | Available now | Present but intentionally de-emphasized in report |
| Recipients | Available now | CSV-backed |
| Opens | Available now | CSV-backed when present |
| Unique opens | Requires new data/tracking | Current CSV workflow does not distinguish explicitly |
| Clicks | Available now | CSV-backed when present |
| Unique clicks | Requires new data/tracking | Same limitation as unique opens |
| Open rate | Available now | CSV-backed |
| Click rate | Available now | CSV-backed |
| CTOR | Available now | Derived |
| Unsubscribe rate | Can derive next | Needs CSV importer support if column is present |
| Bounce rate | Available now | CSV-backed |
| Delivered rate | Can derive next | Needs sent/delivered columns from CSV |
| Site sessions from email | Can derive next | GA source rollups can support this more explicitly |
| Conversions from email | Can derive next | Use `key_events` proxy now, real conversion later |
| Segment performance | Requires new data/tracking | Missing segment input |
| Send-time/day performance | Available now | Send day rollup exists |

### Web Metrics

| Metric | Status | Notes |
|---|---|---|
| Page views | Available now | GA |
| Sessions | Available now | GA |
| Engaged sessions | Available now | GA |
| Engagement rate | Available now | GA/model |
| Bounce rate | Available now | GA/model |
| Avg engagement time per session | Available now | GA/model |
| Avg engagement time per page | Can derive next | Need explicit page-level presentation/definition |
| Entrances | Can derive next | Using compatible `landing_page_sessions` proxy instead of true GA `entrances` |
| Exit rate | Requires new data/tracking | Not collected |
| Scroll depth | Requires new data/tracking | Not collected |
| CTA click rate | Requires new data/tracking | Not collected |
| Conversion rate by page | Can derive next | Use `key_events / sessions` or `key_events / landing_page_sessions` |
| Landing page conversion rate | Can derive next | Backed by landing-page sessions + key events |
| Next-page path | Requires new data/tracking | Not collected |
| Top converting pages | Can derive next | Needs explicit ranking based on conversion proxy |

### Source Metrics

| Metric | Status | Notes |
|---|---|---|
| Sessions by source | Available now | GA source rollup |
| Engagement rate by source | Available now | GA source rollup |
| Conversions by source | Can derive next | Use `key_events` proxy |
| Conversion rate by source | Available now | Modeled as proxy via `key_events / sessions` |
| Avg engaged time by source | Available now | GA source rollup |
| New users by source | Available now | GA source rollup |
| Top landing pages by source | Requires new data/tracking | Not currently collected at source+landing-page grain |
| Assisted conversions by source | Requires new data/tracking | No source |

### SEO Metrics

| Metric | Status | Notes |
|---|---|---|
| Organic sessions | Can derive next | Available via GA source bucket |
| Top organic landing pages | Can derive next | Possible once source+landing-page view exists or filtered approximation is added |
| Impressions | Requires new data/tracking | Needs Search Console |
| Clicks | Requires new data/tracking | Needs Search Console |
| CTR | Requires new data/tracking | Needs Search Console |
| Average position | Requires new data/tracking | Needs Search Console |
| Branded vs non-branded split | Requires new data/tracking | Needs search query source |
| Keyword themes | Requires new data/tracking | Needs search query source |
| Gain/loss in visibility | Requires new data/tracking | Needs search history source |

## Data Processing Requirement Status

| Processing Need | Status | Notes |
|---|---|---|
| Normalize source names | Available now | In taxonomy/model |
| Standardize campaign names | Can derive next | Some naming cleanup exists; stronger normalization still needed |
| De-duplicate content identifiers | Can derive next | Basic grouping exists; stronger canonicalization still needed |
| Align timezone logic | Can derive next | Mostly ISO-based, but not explicitly centralized |
| Resolve malformed/null values | Available now | Safe math and null handling in analytics model |
| Map content to taxonomy groups | Available now | URL and campaign naming rules |
| Calculate derived metrics | Available now | CTOR, rates, comparison metrics |
| Compute prior-period comparisons | Available now | Shared comparison layer |
| Apply anomaly/threshold logic | Can derive next | Anomaly pipeline exists but isn’t fully tied to report requirements |

## Insight Generation Requirement Status

| Requirement | Status | Notes |
|---|---|---|
| Deterministic rule-based insight engine | Can derive next | Current insights are LLM-assisted; rules need more explicit structure |
| Significance thresholds | Can derive next | Not consistently enforced across report copy yet |
| Minimum sample size rules | Can derive next | Some suppression logic exists conceptually, not formalized enough |
| Relative peer-group ranking | Can derive next | Possible via channel/content/campaign rollups |
| Historical comparison logic | Available now | Prior-period engine exists |

## Visual Requirement Status

| Visual | Status | Notes |
|---|---|---|
| Trend lines for sessions/page views/conversions | Can derive next | Page-view trend exists in dashboard; PDF trend visuals still limited |
| Channel comparison bars | Can derive next | Data exists; PDF/dashboard visual still pending |
| Content group comparison charts | Can derive next | Data exists; visual pending |
| Email performance scatterplot | Requires new data/tracking | Not implemented |
| Source quality tables | Available now | Started in report and model |
| Top page performance table with engagement/conversion columns | Available now | Recently upgraded |
| New vs returning user visualization | Can derive next | Data exists; visual pending |
| KPI sparklines | Requires new data/tracking | Not implemented yet |

## Recommended Build Order

### Available now: promote immediately
1. Add a dedicated `Recommended Actions for Next Period` section with:
   - `Double down on`
   - `Fix`
   - `Test`
2. Promote channel rollups more clearly in the report:
   - email
   - organic search
   - referral/direct
3. Add explicit top converting page/source ranking using `key_events` as the current conversion proxy
4. Add content-type/theme ranking language consistently across report sections

### Can derive next: highest-value next engineering slice
1. Formalize conversion proxy configuration
   - current default: GA `key_events`
   - later: business-defined conversion event
2. Expand Klaviyo CSV importer to accept:
   - unsubscribes
   - delivered/sent
   - optional segment labels
3. Add source + landing-page quality view
   - top landing pages by channel/source
4. Add deterministic report insight rules:
   - minimum sample thresholds
   - observation/driver/implication/action formatter

### Requires new data/tracking: backlog
1. Search Console integration
2. Newsletter signup event mapping
3. Scroll depth / CTA click tracking
4. Subscriber growth + net list growth source
5. Segment performance source
6. Assisted conversions

## Recommended Immediate Next Slice

If the goal is to maximize report usefulness without new integrations, the best next implementation slice is:

1. `Action Summary Section`
- Add a final report section with:
  - Double down on
  - Fix
  - Test
- Each line should use the current analytics model and structured wording

2. `Conversion Proxy Ranking`
- Use GA `key_events` as the temporary conversion definition
- Add:
  - top converting page
  - top converting source
  - landing page conversion rate
  - source conversion rate callouts

3. `Rule-Based Insight Formatter`
- Build deterministic insight objects with:
  - Observation
  - Driver
  - Implication
  - Action
- Only emit when thresholds and minimum sample sizes are met

4. `Expanded Klaviyo CSV Schema`
- Support unsubscribe and delivered metrics if present in the uploaded export
- Unlock unsubscribe rate and delivered rate in the report

This is the strongest next step because it delivers more of the PRD’s decision-support promise without waiting on Search Console or new tracking instrumentation.
