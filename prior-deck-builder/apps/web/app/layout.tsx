import './globals.css';
import Link from 'next/link';
import type { ReactNode } from 'react';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <nav className="nav">
            <Link className="brand" href="/">Prior Deck Builder</Link>
            <div className="nav-links">
              <Link href="/">Dashboard</Link>
              <Link href="/new">New Deck</Link>
            </div>
          </nav>
          {children}
        </div>
      </body>
    </html>
  );
}
