import { useState, useRef, useEffect, useCallback } from 'react';

const SUGGESTED_PROMPTS = [
  'How is our email performance trending this week?',
  'Which Instagram content type is driving the most engagement?',
  'What are our top-performing web pages right now?',
  'Are there any concerning trends I should know about?',
  'Compare our social and email engagement rates.',
  'What should we focus on this week?',
];

export default function Assistant() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || isStreaming) return;

    setError(null);
    const userMessage = { role: 'user', content: text.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsStreaming(true);

    // Add placeholder for assistant response
    const assistantMessage = { role: 'assistant', content: '' };
    setMessages([...newMessages, assistantMessage]);

    try {
      const abortController = new AbortController();
      abortRef.current = abortController;

      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'text') {
              fullText += data.text;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: fullText };
                return updated;
              });
            } else if (data.type === 'error') {
              throw new Error(data.error);
            }
            // data.type === 'done' — stream complete
          } catch (parseErr) {
            if (parseErr.message !== 'Unexpected end of JSON input') throw parseErr;
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message);
      // Remove empty assistant message on error
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && !last.content) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [messages, isStreaming]);

  function handleSubmit(e) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function handleNewChat() {
    if (abortRef.current) abortRef.current.abort();
    setMessages([]);
    setInput('');
    setError(null);
    setIsStreaming(false);
    inputRef.current?.focus();
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold font-serif text-prior-black">AI Assistant</h1>
          <p className="text-sm text-prior-muted mt-0.5 font-serif">
            Ask questions about your marketing data
          </p>
        </div>
        {!isEmpty && (
          <button
            onClick={handleNewChat}
            className="text-sm text-prior-muted hover:text-prior-black font-serif
                       transition-colors border border-prior-border px-4 py-2 rounded-lg
                       hover:bg-white"
          >
            New Conversation
          </button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full pb-8">
            <div className="text-prior-muted mb-2">
              <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24"
                   stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227
                         1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133
                         a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233
                         2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228
                         A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746
                         2.25 5.14 2.25 6.741v6.018z" />
              </svg>
            </div>
            <h2 className="text-lg font-serif text-prior-black mb-1">
              What would you like to know?
            </h2>
            <p className="text-sm text-prior-muted font-serif mb-8">
              Ask about your email, web, or social performance
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl w-full">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="text-left text-sm font-serif text-prior-body
                             bg-white border border-prior-border rounded-xl px-4 py-3
                             hover:border-prior-mid hover:text-prior-black
                             transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6 pb-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-5 py-3 font-serif text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-prior-black text-white'
                      : 'bg-white border border-prior-border text-prior-black'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <AssistantMessage content={msg.content} isStreaming={isStreaming && i === messages.length - 1} />
                  ) : (
                    <span>{msg.content}</span>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm font-serif mb-3 flex-shrink-0">
          {error}
        </div>
      )}

      {/* Input area */}
      <form onSubmit={handleSubmit} className="flex-shrink-0 pt-3 border-t border-prior-border">
        <div className="flex gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your data..."
            rows={1}
            disabled={isStreaming}
            className="flex-1 resize-none rounded-xl border border-prior-border px-4 py-3
                       text-sm font-serif text-prior-black placeholder:text-prior-muted
                       focus:outline-none focus:border-prior-mid
                       disabled:opacity-50 disabled:bg-prior-cream"
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="bg-prior-black text-white px-5 py-3 rounded-xl text-sm font-serif
                       hover:bg-prior-black/90 transition-colors
                       disabled:opacity-40 flex-shrink-0"
          >
            {isStreaming ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10"
                        stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              'Send'
            )}
          </button>
        </div>
        <p className="text-[11px] text-prior-muted mt-2 text-center font-serif">
          Responses are based on your synced analytics data
        </p>
      </form>
    </div>
  );
}

/* --- Assistant message rendering with basic markdown --- */

function AssistantMessage({ content, isStreaming }) {
  if (!content && isStreaming) {
    return (
      <span className="flex items-center gap-1.5 text-prior-muted py-1">
        <span className="w-1.5 h-1.5 bg-prior-muted rounded-full animate-pulse" />
        <span className="w-1.5 h-1.5 bg-prior-muted rounded-full animate-pulse [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 bg-prior-muted rounded-full animate-pulse [animation-delay:300ms]" />
      </span>
    );
  }

  const lines = content.split('\n');

  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        if (!line.trim()) return <br key={i} />;

        // Bullet points
        if (line.match(/^[-*]\s/)) {
          const text = line.replace(/^[-*]\s/, '');
          return (
            <div key={i} className="flex gap-2">
              <span className="text-prior-muted mt-0.5 flex-shrink-0">&#8226;</span>
              <span dangerouslySetInnerHTML={{ __html: inlineMd(text) }} />
            </div>
          );
        }

        // Numbered list items
        if (line.match(/^\d+\.\s/)) {
          const num = line.match(/^(\d+)\.\s/)[1];
          const text = line.replace(/^\d+\.\s/, '');
          return (
            <div key={i} className="flex gap-2">
              <span className="text-prior-muted mt-0.5 flex-shrink-0 text-xs w-4 text-right">{num}.</span>
              <span dangerouslySetInnerHTML={{ __html: inlineMd(text) }} />
            </div>
          );
        }

        // Bold header lines (entirely **bold**)
        const headerMatch = line.match(/^\*\*(.+)\*\*$/);
        if (headerMatch) {
          return <p key={i} className="font-bold mt-1">{headerMatch[1]}</p>;
        }

        return <p key={i} dangerouslySetInnerHTML={{ __html: inlineMd(line) }} />;
      })}
      {isStreaming && content && (
        <span className="inline-block w-1 h-4 bg-prior-black animate-pulse ml-0.5 -mb-0.5" />
      )}
    </div>
  );
}

function inlineMd(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}
