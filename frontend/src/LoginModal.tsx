import { useState } from "react";
import { login, signup, type AuthUser } from "./api";

export function LoginModal({
  onClose,
  onSuccess,
  initialMode = "login",
}: {
  onClose: () => void;
  onSuccess: (user: AuthUser) => void;
  initialMode?: "login" | "signup";
}) {
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = mode === "signup" ? await signup(username, password) : await login(username, password);
      onSuccess(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{mode === "signup" ? "Join the warren" : "Welcome back"}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="login-form">
          <input
            className="search"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
          <input
            className="search"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="err">{error}</p>}
          {notice && <p className="notice">{notice}</p>}
          <button className="btn-primary full" type="submit" disabled={busy}>
            {busy ? "…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        {mode === "login" && (
          <button
            type="button"
            className="link-btn forgot"
            onClick={() =>
              setNotice("Password reset by email is coming soon — for now, ask the site admin to reset it.")
            }
          >
            Forgot password?
          </button>
        )}

        <p className="auth-switch">
          {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
          <button
            className="link-btn"
            onClick={() => {
              setMode(mode === "signup" ? "login" : "signup");
              setError(null);
            }}
          >
            {mode === "signup" ? "Sign in" : "Create one"}
          </button>
        </p>
      </div>
    </div>
  );
}
