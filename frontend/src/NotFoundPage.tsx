import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <main className="page">
      <div className="empty">
        <img src="/rabbit-hole-logo.png" alt="" className="empty-mark" />
        <h3>Lost down the hole</h3>
        <p>There's nothing at this address. Maybe it fell through.</p>
        <Link to="/" className="btn-primary">
          Back to Watch
        </Link>
      </div>
    </main>
  );
}
