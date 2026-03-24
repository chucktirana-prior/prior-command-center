import { useEffect, useState } from 'react';
import AppCard from '../components/AppCard';
import apps from '../config/apps.json';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Home() {
  const [tokenRotation, setTokenRotation] = useState(null);

  useEffect(() => {
    let active = true;

    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (active) {
          setTokenRotation(data?.contentful?.tokenRotation || null);
        }
      })
      .catch(() => {
        if (active) {
          setTokenRotation(null);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const rotationTone = tokenRotation?.status === 'expired'
    ? 'border-red-300 bg-red-50 text-red-900'
    : tokenRotation?.status === 'urgent'
      ? 'border-amber-300 bg-amber-50 text-amber-900'
      : tokenRotation?.status === 'warning'
        ? 'border-yellow-300 bg-yellow-50 text-yellow-900'
        : 'border-prior-border bg-white text-prior-black';

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-prior-black font-serif mb-2">
          {getGreeting()}
        </h1>
        <p className="text-prior-body font-serif">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      <div className={`mb-8 rounded-2xl border p-5 shadow-sm ${rotationTone}`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] font-sans opacity-70">
              Contentful Token
            </p>
            {tokenRotation?.tracked ? (
              <>
                <h2 className="text-2xl font-bold font-serif">
                  {tokenRotation.daysRemaining > 0
                    ? `${tokenRotation.daysRemaining} day${tokenRotation.daysRemaining === 1 ? '' : 's'} remaining`
                    : 'Rotation overdue'}
                </h2>
                <p className="font-serif opacity-80">
                  Rotated {tokenRotation.rotatedAt}. Rotate again by {tokenRotation.dueAt}.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold font-serif">
                  Rotation tracking not set
                </h2>
                <p className="font-serif opacity-80">
                  Add <code>CONTENTFUL_CMA_TOKEN_ROTATED_AT</code> in <code>.env</code> to track the 90-day limit.
                </p>
              </>
            )}
          </div>
          <div className="text-sm font-serif opacity-75">
            90-day Contentful max
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {apps.map((app) => (
          <AppCard key={app.id} app={app} />
        ))}
      </div>
    </div>
  );
}
