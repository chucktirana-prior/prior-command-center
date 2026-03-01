import { Link } from 'react-router-dom';

export default function Placeholder({ title }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <h2 className="text-2xl font-bold text-prior-black font-serif mb-3">
        {title}
      </h2>
      <p className="text-prior-body font-serif mb-8">
        This tool is under construction.
      </p>
      <Link
        to="/"
        className="text-sm text-prior-body hover:text-prior-black font-serif underline"
      >
        Back to Home
      </Link>
    </div>
  );
}
