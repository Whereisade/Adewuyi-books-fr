"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Package2, ShieldCheck } from "lucide-react";
import { ApiError, login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const registeredEmail = new URLSearchParams(window.location.search).get("registered");
    if (registeredEmail) setEmail(registeredEmail);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-layout">
      <section className="login-art-panel">
        <div className="login-art-inner">
          <div className="brand-lockup login-brand">
            <div className="brand-mark"><Package2 size={22} strokeWidth={2.3} /></div>
            <div><div className="brand-name">RentLedger</div><div className="brand-caption">Business workspace</div></div>
          </div>
          <div className="login-hero-copy">
            <div className="eyebrow eyebrow-light"><span className="eyebrow-line" /> A clearer way to work</div>
            <h1>Keep every booking, item and payment <em>in its place.</em></h1>
            <p>A simple workspace for your rental business, from the first booking to the final return.</p>
          </div>
          <div className="login-feature-card">
            <div className="feature-card-icon"><ShieldCheck size={21} /></div>
            <div><strong>Your records, kept separate</strong><span>Each business login sees its own inventory and financial book.</span></div>
            <div className="feature-card-check">✓</div>
          </div>
          <div className="login-decoration"><div className="deco-ring deco-ring-one" /><div className="deco-ring deco-ring-two" /><div className="deco-dot" /></div>
          <div className="login-bottom-note"><span>BOOKINGS</span><i /> <span>INVENTORY</span><i /> <span>FINANCIALS</span></div>
        </div>
      </section>

      <section className="login-form-panel">
        <div className="login-form-wrap">
          <div className="login-mobile-brand brand-lockup">
            <div className="brand-mark"><Package2 size={22} /></div>
            <div><div className="brand-name">RentLedger</div><div className="brand-caption">Business workspace</div></div>
          </div>
          <div className="login-welcome">
            <div className="welcome-icon"><LockKeyhole size={21} /></div>
            <p className="section-kicker">WELCOME BACK</p>
            <h2>Sign in to your workspace</h2>
            <p>Enter the login details assigned to your business.</p>
          </div>
          <form className="login-form" onSubmit={handleSubmit}>
            <label className="field-label" htmlFor="email">Email address</label>
            <div className="input-with-icon"><span className="input-leading">@</span><input id="email" type="email" autoComplete="email" placeholder="Enter your email address" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            <div className="label-row"><label className="field-label" htmlFor="password">Password</label></div>
            <div className="input-with-icon"><LockKeyhole className="input-leading-icon" size={17} /><input id="password" autoComplete="current-password" type={showPassword ? "text" : "password"} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required /><button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
            {error && <div className="form-alert" role="alert">{error}</div>}
            <button className="button button-primary login-submit" type="submit" disabled={submitting}>{submitting ? "Signing in…" : "Sign in to workspace"}<ArrowRight size={18} /></button>
          </form>
          <div className="login-security-note"><ShieldCheck size={16} /><span>Your session is protected. Use the login assigned to your division.</span></div>
          <p className="login-footer">Need an account? <Link href="/signup" className="text-link">Create a division manager account</Link><br />Need help accessing your account? Contact your application administrator.</p>
        </div>
      </section>
    </main>
  );
}
