import { notFound } from 'next/navigation';
import { apiFetch } from '../../../components/api';
import { DeckEditor } from '../../../components/deck-editor';

export default async function DeckDetailPage({ params }: { params: { id: string } }) {
  const response = await apiFetch<{ deck?: any }>(`/api/decks/${params.id}`).catch(() => ({ deck: undefined }));
  if (!response.deck) {
    notFound();
  }

  return <DeckEditor initialDeck={response.deck} />;
}
