import Link from 'next/link';
import { apiFetch } from '../components/api';

type Deck = {
  _id: string;
  title: string;
  deckType: string;
  status: string;
  updatedAt: string;
};

export default async function HomePage() {
  const response = await apiFetch<{ decks: Deck[] }>('/api/decks').catch(() => ({ decks: [] }));
  const decks = response.decks;

  return (
    <>
      <section className="hero">
        <div className="panel">
          <div className="eyebrow">Internal Presentation Workflow</div>
          <h1 className="title">Build on-brand decks without chasing design support.</h1>
          <p className="muted">
            This starter ships the brief, AI outline, copy review, background build, and signed-download flow in one clean handoff.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
            <Link className="button" href="/new">Create a deck</Link>
            <a className="button-secondary" href="http://localhost:3001/api/health" target="_blank">API health</a>
          </div>
        </div>

        <div className="panel">
          <div className="eyebrow">Handoff Notes</div>
          <ul className="muted">
            <li>Queued jobs are processed by a separate worker.</li>
            <li>Mongo stores deck state, versions, failures, and output metadata.</li>
            <li>Local auth uses `x-user-id`; swap in Auth0/JWT middleware later.</li>
          </ul>
        </div>
      </section>

      <section className="grid three">
        {decks.map((deck) => (
          <Link className="deck-card" key={deck._id} href={`/decks/${deck._id}`}>
            <span className="status-pill">{deck.status}</span>
            <strong>{deck.title}</strong>
            <span className="muted">{deck.deckType}</span>
            <span className="muted">Updated {new Date(deck.updatedAt).toLocaleString()}</span>
          </Link>
        ))}
        {decks.length === 0 ? (
          <div className="panel">
            <strong>No decks yet.</strong>
            <p className="muted">Start by creating a brief, then let the worker handle generation and build tasks in the background.</p>
          </div>
        ) : null}
      </section>
    </>
  );
}
