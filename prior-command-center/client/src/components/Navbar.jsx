import { Link, useLocation } from 'react-router-dom';
import apps from '../config/apps.json';

export default function Navbar() {
  const location = useLocation();
  const currentApp = apps.find((a) => a.route === location.pathname);

  return (
    <nav className="border-b border-prior-border bg-white/60 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-3 no-underline">
            <span className="text-xl font-bold tracking-wide text-prior-black font-serif">
              PRIOR
            </span>
            <span className="text-sm text-prior-muted font-serif">
              Command Center
            </span>
          </Link>

          {currentApp && (
            <div className="flex items-center gap-2 text-sm text-prior-body">
              <span className="text-prior-border">/</span>
              <span>{currentApp.title}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs text-prior-muted font-serif">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </span>
        </div>
      </div>
    </nav>
  );
}
