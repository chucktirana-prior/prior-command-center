import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Placeholder from './pages/Placeholder';
import DocumentUploader from './pages/DocumentUploader';
import Analytics from './pages/Analytics';
import ReportGenerator from './pages/ReportGenerator';
import Assistant from './pages/Assistant';
import LocationMonitor from './pages/LocationMonitor';
import apps from './config/apps.json';

const PAGE_MAP = {
  uploader: DocumentUploader,
  analytics: Analytics,
  reports: ReportGenerator,
  assistant: Assistant,
  locations: LocationMonitor,
};

export default function App() {
  return (
    <div className="min-h-screen bg-prior-cream">
      <Navbar />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          {apps.map((app) => {
            const Page = PAGE_MAP[app.id] || Placeholder;
            return (
              <Route
                key={app.id}
                path={app.route}
                element={<Page title={app.title} />}
              />
            );
          })}
        </Routes>
      </main>
    </div>
  );
}
