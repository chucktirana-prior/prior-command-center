import { Link } from 'react-router-dom';

export default function ConfirmationScreen({ result, onReset }) {
  const contentfulUrl = `https://app.contentful.com/spaces/${result.spaceId}/environments/${result.environment}/entries/${result.entryId}`;

  return (
    <div className="confirmation-screen">
      <div className="confirmation-card">
        <div className="success-icon">&#10003;</div>
        <h1>Draft Created</h1>
        <p>Your article has been saved as a draft in Contentful.</p>

        <a
          href={contentfulUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary"
        >
          Open in Contentful
        </a>

        <p className="reminder">
          Don't forget to add the hero image and publish when ready.
        </p>

        <button type="button" className="btn-secondary" onClick={onReset}>
          Upload Another
        </button>

        <Link to="/" className="btn-back-hub">
          Back to Hub
        </Link>
      </div>
    </div>
  );
}
