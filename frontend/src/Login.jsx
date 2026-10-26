import { useState } from "react";
import "./Login.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

function safeNext() {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/";
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      // This endpoint and its response contract must be implemented/confirmed in FastAPI.
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = data.detail;
        throw new Error(typeof detail === "string" ? detail : "Incorrect email or password, or login is unavailable.");
      }
      // Do not save a password or treat a localStorage user object as a session.
      // Confirm the server-issued session before navigating to a protected page.
      const meResponse = await fetch(`${API_URL}/auth/me`, { credentials: "include", cache: "no-store" });
      const me = await meResponse.json().catch(() => ({}));
      const currentUser = me.user || (me.authenticated === true ? me : null);
      if (!meResponse.ok || !currentUser || me.authenticated === false) {
        throw new Error("Login was accepted, but a valid session could not be verified. Check the backend session and CORS settings.");
      }
      window.location.assign(safeNext());
    } catch (err) {
      setError(err.message || "Unable to log in. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="jd-login-page">
      <header className="jd-login-header">
        <a className="jd-login-brand" href="/" aria-label="Jan Drishti home">
          <span className="jd-login-logo">JD</span>
          <span><strong>Jan Drishti</strong><small>Civic Participation Network</small></span>
        </a>
        <a className="jd-login-explore" href="/">Explore public feed <span aria-hidden="true">↗</span></a>
      </header>

      <main className="jd-login-layout">
        <section className="jd-login-story">
          <span className="jd-login-eyebrow"><span className="jd-login-live-dot"/> A MORE ACCOUNTABLE COMMUNITY</span>
          <h1>Your city.<br/><em>Your voice.</em><br/>Your impact.</h1>
          <p>Sign in to report civic issues, follow progress and help create visible change in your community.</p>
          <div className="jd-login-benefits">
            <div><span className="jd-login-benefit-icon">01</span><span><strong>Report what matters</strong><small>Share an issue with its location and evidence.</small></span></div>
            <div><span className="jd-login-benefit-icon">02</span><span><strong>Follow every update</strong><small>Track complaints from submission to resolution.</small></span></div>
            <div><span className="jd-login-benefit-icon">03</span><span><strong>Make progress public</strong><small>Discover civic issues on the open social feed.</small></span></div>
          </div>
          <div className="jd-login-quote"><span>“</span> Better neighborhoods begin with informed citizens.</div>
        </section>

        <section className="jd-login-form-wrap" aria-label="Sign in to Jan Drishti">
          <div className="jd-login-card">
            <div className="jd-login-card-top"><span className="jd-login-card-symbol">✦</span><span className="jd-login-card-tag">CITIZEN PORTAL</span></div>
            <h2>Welcome back</h2>
            <p className="jd-login-subtitle">Enter your registered details to continue.</p>
            {error && <div className="jd-login-error" role="alert">{error}</div>}
            <form onSubmit={handleSubmit}>
              <label htmlFor="jd-login-email">Email address</label>
              <input id="jd-login-email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
              <label htmlFor="jd-login-password">Password</label>
              <div className="jd-login-password-wrap">
                <input id="jd-login-password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} required />
                <button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button>
              </div>
              <button className="jd-login-submit" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in to Jan Drishti"}<span aria-hidden="true">→</span></button>
            </form>
            <p className="jd-login-register">New to Jan Drishti? <a href="/register">Create an account</a></p>
            <div className="jd-login-separator"><span>OR</span></div>
            <a className="jd-login-guest" href="/">Continue browsing without an account <span aria-hidden="true">↗</span></a>
          </div>
          <p className="jd-login-privacy">Your account details are private. Public complaints are visible without logging in.</p>
        </section>
      </main>
      <footer className="jd-login-footer"><span>© Jan Drishti · Civic Participation Network</span><span>Built for stronger communities</span></footer>
    </div>
  );
}
