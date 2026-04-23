'use client';

import { useEffect, useState, useTransition } from 'react';
import type { DeckSlide, OutlineSlide } from '@prior/deck-builder-shared';
import { apiFetch } from './api';

type Deck = {
  _id: string;
  title: string;
  status: string;
  outlineVersion: number;
  slidesVersion: number;
  outline: OutlineSlide[];
  slides: DeckSlide[];
  currentJob?: { kind: string; status: string };
  failureDetails?: string;
};

export function DeckEditor({ initialDeck }: { initialDeck: Deck }) {
  const [deck, setDeck] = useState(initialDeck);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [message, setMessage] = useState('');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await apiFetch<{ deck: Deck }>(`/api/decks/${deck._id}`);
        setDeck(response.deck);
      } catch {
        // no-op polling fallback
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [deck._id]);

  async function queue(path: string) {
    setMessage('');
    startTransition(async () => {
      try {
        const response = await apiFetch<{ deck: Deck }>(path, { method: 'POST' });
        setDeck(response.deck);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Unable to start job');
      }
    });
  }

  async function saveOutline() {
    setMessage('');
    startTransition(async () => {
      try {
        const response = await apiFetch<{ deck: Deck }>(`/api/decks/${deck._id}/outline`, {
          method: 'PATCH',
          body: JSON.stringify({
            outlineVersion: deck.outlineVersion,
            outline: deck.outline,
          }),
        });
        setDeck(response.deck);
        setMessage('Outline saved.');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Unable to save outline');
      }
    });
  }

  async function saveSlides() {
    setMessage('');
    startTransition(async () => {
      try {
        const response = await apiFetch<{ deck: Deck }>(`/api/decks/${deck._id}/copy`, {
          method: 'PATCH',
          body: JSON.stringify({
            slidesVersion: deck.slidesVersion,
            slides: deck.slides,
          }),
        });
        setDeck(response.deck);
        setMessage('Slides saved.');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Unable to save slide copy');
      }
    });
  }

  async function fetchDownloadUrl() {
    setMessage('');
    startTransition(async () => {
      try {
        const response = await apiFetch<{ url: string }>(`/api/decks/${deck._id}/download-url`, {
          method: 'POST',
        });
        setDownloadUrl(response.url);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Unable to fetch download URL');
      }
    });
  }

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="panel">
        <div className="eyebrow">Workflow Status</div>
        <h1 style={{ fontSize: '2.2rem', margin: '8px 0 14px' }}>{deck.title}</h1>
        <div className="step-list">
          {[
            { label: 'Outline', value: deck.status },
            { label: 'Copy', value: deck.status },
            { label: 'Build', value: deck.status },
          ].map((step) => (
            <div key={step.label} className="step">
              <strong>{step.label}</strong>
              <span className="status-pill">{step.value}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
          <button className="button" disabled={isPending} onClick={() => queue(`/api/decks/${deck._id}/outline/generate`)}>
            Generate Outline
          </button>
          <button className="button-secondary" disabled={isPending} onClick={() => queue(`/api/decks/${deck._id}/copy/generate`)}>
            Generate Copy
          </button>
          <button className="button-secondary" disabled={isPending} onClick={() => queue(`/api/decks/${deck._id}/build`)}>
            Build Deck
          </button>
          <button className="button-secondary" disabled={isPending || deck.status !== 'complete'} onClick={fetchDownloadUrl}>
            Get Download URL
          </button>
        </div>
        {deck.failureDetails ? <p className="muted" style={{ color: '#7c1e1e' }}>{deck.failureDetails}</p> : null}
        {message ? <p className="muted">{message}</p> : null}
        {downloadUrl ? <p><a href={downloadUrl} target="_blank">Open Download</a></p> : null}
      </div>

      <div className="grid two">
        <div className="panel">
          <div className="eyebrow">Outline Review</div>
          <div className="editor-list" style={{ marginTop: 16 }}>
            {deck.outline.map((slide, index) => (
              <div className="editor-card" key={`${slide.slideNumber}-${slide.layoutId}`}>
                <div className="muted">Slide {slide.slideNumber}</div>
                <input
                  value={slide.title}
                  onChange={(event) => {
                    const next = [...deck.outline];
                    next[index] = { ...slide, title: event.target.value };
                    setDeck({ ...deck, outline: next });
                  }}
                />
                <select
                  value={slide.layoutId}
                  onChange={(event) => {
                    const next = [...deck.outline];
                    next[index] = { ...slide, layoutId: event.target.value as OutlineSlide['layoutId'] };
                    setDeck({ ...deck, outline: next });
                  }}
                >
                  <option value="cover">Cover</option>
                  <option value="text_right_image">Text + Right Image</option>
                  <option value="centered_list">Centred List</option>
                  <option value="section_divider">Section Divider</option>
                  <option value="case_study">Case Study</option>
                  <option value="quote_pullout">Quote / Pullout</option>
                  <option value="close">Close / Thank You</option>
                  <option value="single_column_narrative">Single-Column Narrative</option>
                  <option value="three_column_stats">Three-Column Stats</option>
                  <option value="summary_next_steps">Summary + Next Steps</option>
                </select>
              </div>
            ))}
          </div>
          <button className="button" style={{ marginTop: 16 }} onClick={saveOutline}>Save Outline</button>
        </div>

        <div className="panel">
          <div className="eyebrow">Copy Review</div>
          <div className="editor-list" style={{ marginTop: 16 }}>
            {deck.slides.map((slide, index) => (
              <div className="editor-card" key={`${slide.slideNumber}-${slide.layoutId}`}>
                <div className="muted">Slide {slide.slideNumber}</div>
                <input
                  value={slide.headline}
                  onChange={(event) => {
                    const next = [...deck.slides];
                    next[index] = { ...slide, headline: event.target.value };
                    setDeck({ ...deck, slides: next });
                  }}
                />
                <textarea
                  className="large"
                  value={slide.body}
                  onChange={(event) => {
                    const next = [...deck.slides];
                    next[index] = { ...slide, body: event.target.value };
                    setDeck({ ...deck, slides: next });
                  }}
                />
              </div>
            ))}
          </div>
          <button className="button" style={{ marginTop: 16 }} onClick={saveSlides}>Save Copy</button>
        </div>
      </div>
    </div>
  );
}
