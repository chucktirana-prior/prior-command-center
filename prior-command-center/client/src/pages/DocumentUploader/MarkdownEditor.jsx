import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function MarkdownEditor({ value, onChange }) {
  return (
    <div className="markdown-editor">
      <label>Article Body</label>
      <div className="markdown-split">
        <div className="markdown-input">
          <div className="pane-label">Markdown</div>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
          />
        </div>
        <div className="markdown-preview">
          <div className="pane-label">Preview</div>
          <div className="preview-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
