import { useState } from 'react';
import DateRangePicker from './components/DateRangePicker';
import SyncStatus from './components/SyncStatus';
import OverviewTab from './OverviewTab';
import KlaviyoTab from './KlaviyoTab';
import GoogleAnalyticsTab from './GoogleAnalyticsTab';
import InstagramTab from './InstagramTab';
import InsightsTab from './InsightsTab';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'klaviyo', label: 'Klaviyo' },
  { key: 'ga', label: 'Google Analytics' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'insights', label: 'Insights' },
];

function computeInitialRange() {
  const end = new Date().toISOString().split('T')[0];
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return { preset: '30d', start: start.toISOString().split('T')[0], end };
}

export default function Analytics() {
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState(computeInitialRange);

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-serif text-prior-black">Analytics</h1>
        <div className="flex items-center gap-4">
          <DateRangePicker dateRange={dateRange} onChange={setDateRange} />
          <SyncStatus />
        </div>
      </div>

      {/* Tab strip */}
      <div className="flex gap-1 border-b border-prior-border mb-8">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 pb-3 text-sm font-serif transition-colors ${
              activeTab === tab.key
                ? 'text-prior-black border-b-2 border-prior-black'
                : 'text-prior-muted hover:text-prior-body'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab dateRange={dateRange} onNavigateToInsights={() => setActiveTab('insights')} />}
      {activeTab === 'klaviyo' && <KlaviyoTab dateRange={dateRange} />}
      {activeTab === 'ga' && <GoogleAnalyticsTab dateRange={dateRange} />}
      {activeTab === 'instagram' && <InstagramTab dateRange={dateRange} />}
      {activeTab === 'insights' && <InsightsTab dateRange={dateRange} />}
    </div>
  );
}
