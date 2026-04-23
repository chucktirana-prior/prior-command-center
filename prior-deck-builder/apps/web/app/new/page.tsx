'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../components/api';

const initialState = {
  title: '',
  deckType: 'client',
  audience: '',
  keyMessages: ['', '', ''],
  slideCount: 8,
  additionalContext: '',
};

export default function NewDeckPage() {
  const router = useRouter();
  const [form, setForm] = useState(initialState);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  return (
    <div className="panel">
      <div className="eyebrow">New Deck Brief</div>
      <h1 style={{ fontSize: '2.4rem', margin: '8px 0 20px' }}>Create a new presentation draft</h1>
      <div className="form-grid">
        <label className="field">
          <span>Deck title</span>
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        </label>
        <label className="field">
          <span>Deck type</span>
          <select value={form.deckType} onChange={(event) => setForm({ ...form, deckType: event.target.value })}>
            <option value="client">Client-facing</option>
            <option value="internal">Internal</option>
          </select>
        </label>
        <label className="field full">
          <span>Audience</span>
          <input value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value })} />
        </label>
        {form.keyMessages.map((message, index) => (
          <label className="field" key={index}>
            <span>Key message {index + 1}</span>
            <input
              value={message}
              onChange={(event) => {
                const next = [...form.keyMessages];
                next[index] = event.target.value;
                setForm({ ...form, keyMessages: next });
              }}
            />
          </label>
        ))}
        <label className="field">
          <span>Slide count</span>
          <input
            type="number"
            min={5}
            max={15}
            value={form.slideCount}
            onChange={(event) => setForm({ ...form, slideCount: Number(event.target.value) })}
          />
        </label>
        <label className="field full">
          <span>Additional context</span>
          <textarea className="large" value={form.additionalContext} onChange={(event) => setForm({ ...form, additionalContext: event.target.value })} />
        </label>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
        <button
          className="button"
          disabled={isPending}
          onClick={() => {
            setError('');
            startTransition(async () => {
              try {
                const response = await apiFetch<{ deck: { _id: string } }>('/api/decks', {
                  method: 'POST',
                  body: JSON.stringify({
                    ...form,
                    keyMessages: form.keyMessages.filter(Boolean),
                  }),
                });
                router.push(`/decks/${response.deck._id}`);
              } catch (nextError) {
                setError(nextError instanceof Error ? nextError.message : 'Unable to create deck');
              }
            });
          }}
        >
          Create deck
        </button>
      </div>
      {error ? <p className="muted" style={{ color: '#7c1e1e' }}>{error}</p> : null}
    </div>
  );
}
