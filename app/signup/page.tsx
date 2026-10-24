"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole, Package2, ShieldCheck, UserRound } from "lucide-react";

type Division = { code: string; name: string; has_catering_services: boolean };
type SignupPayload = { detail?: string; divisions?: Division[]; password_errors?: string[]; errors?: string[] };

export default function SignupPage() {
  const router = useRouter();
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [divisionCode, setDivisionCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [invitationCode, setInvitationCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [loadingDivisions, setLoadingDivisions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/auth/signup", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({})) as SignupPayload;
        if (!response.ok) throw new Error(payload.detail || "Could not load the signup options.");
        if (!active) return;
        const available = Array.isArray(payload.divisions) ? payload.divisions : [];
        setDivisions(available);
        if (available.length) setDivisionCode(available[0].code);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Could not load the signup options.");
      })
      .finally(() => { if (active) setLoadingDivisions(false); });
    return () => { active = false; };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (password !== passwordConfirmation) {
      setError("The passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          password,
          password_confirmation: passwordConfirmation,
          division_code: divisionCode,
          invitation_code: invitationCode.trim(),
        }),
      });
      const payload = await response.json().catch(() => ({})) as SignupPayload;
      if (!response.ok) {
        const detail = payload.detail || "Unable to create the account.";
        const extra = [...(payload.password_errors || []), ...(payload.errors || [])];
        throw new Error(extra.length ? `${detail} ${extra.join(" ")}` : detail);
      }
      setSuccess(payload.detail || "Account created. You can now sign in.");
      window.setTimeout(() => router.push(`/login?registered=${encodeURIComponent(email.trim().toLowerCase())}`), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create the account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-layout signup-layout">
      <section className="login-art-panel">
        <div className="login-art-inner">
          <div className="brand-lockup login-brand">
            <div className="brand-mark"><Package2 size={22} strokeWidth={2.3} /></div>
            <div><div className="brand-name">RentLedger</div><div className="brand-caption">Business workspace</div></div>
          </div>
          <div className="login-hero-copy">
            <div className="eyebrow eyebrow-light"><span className="eyebrow-line" /> A workspace for your division</div>
            <h1>Manage your rentals with <em>confidence.</em></h1>
            <p>Create a division manager account to organize customer bookings, stock, payments and business records in one place.</p>
          </div>
          <div className="login-feature-card">
            <div className="feature-card-icon"><ShieldCheck size={21} /></div>
            <div><strong>Division-specific access</strong><span>Your account is tied to one division, keeping the two businesses' records separate.</span></div>
            <div className="feature-card-check">✓</div>
          </div>
          <div className="login-decoration"><div className="deco-ring deco-ring-one" /><div className="deco-ring deco-ring-two" /><div className="deco-dot" /></div>
          <div className="login-bottom-note"><span>BOOKINGS</span><i /> <span>INVENTORY</span><i /> <span>FINANCIALS</span></div>
        </div>
      </section>

      <section className="login-form-panel signup-form-panel">
        <div className="login-form-wrap signup-form-wrap">
          <div className="login-mobile-brand brand-lockup">
            <div className="brand-mark"><Package2 size={22} /></div>
            <div><div className="brand-name">RentLedger</div><div className="brand-caption">Business workspace</div></div>
          </div>
          <div className="login-welcome signup-welcome">
            <div className="welcome-icon"><UserRound size={21} /></div>
            <p className="section-kicker">NEW DIVISION MANAGER</p>
            <h2>Create your account</h2>
            <p>Use the invitation code provided by the application administrator.</p>
          </div>
          {success ? <div className="signup-success" role="status"><ShieldCheck size={22} /><div><strong>Account created successfully</strong><span>{success} Redirecting you to sign in…</span><Link href="/login" className="text-link">Go to sign in now</Link></div></div> : (
            <form className="login-form signup-form" onSubmit={handleSubmit}>
              <div className="signup-name-grid">
                <div><label className="field-label" htmlFor="first-name">First name</label><div className="input-with-icon"><input id="first-name" autoComplete="given-name" placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={150} required /></div></div>
                <div><label className="field-label" htmlFor="last-name">Last name</label><div className="input-with-icon"><input id="last-name" autoComplete="family-name" placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={150} required /></div></div>
              </div>
              <label className="field-label" htmlFor="email">Email address</label>
              <div className="input-with-icon"><span className="input-leading">@</span><input id="email" type="email" autoComplete="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} required /></div>
              <label className="field-label" htmlFor="division">Business division</label>
              <div className="input-with-icon signup-select-wrap"><select id="division" value={divisionCode} onChange={(e) => setDivisionCode(e.target.value)} disabled={loadingDivisions || divisions.length === 0} required><option value="" disabled>Select your division</option>{divisions.map((division) => <option key={division.code} value={division.code}>{division.name}</option>)}</select></div>
              <label className="field-label" htmlFor="invitation-code">Division invitation code</label>
              <div className="input-with-icon"><KeyRound className="input-leading-icon" size={17} /><input id="invitation-code" autoComplete="off" placeholder="Enter the code provided by admin" value={invitationCode} onChange={(e) => setInvitationCode(e.target.value)} required /></div>
              <label className="field-label" htmlFor="password">Password</label>
              <div className="input-with-icon"><LockKeyhole className="input-leading-icon" size={17} /><input id="password" autoComplete="new-password" type={showPassword ? "text" : "password"} placeholder="Create a strong password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required /><button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
              <label className="field-label" htmlFor="password-confirmation">Confirm password</label>
              <div className="input-with-icon"><LockKeyhole className="input-leading-icon" size={17} /><input id="password-confirmation" autoComplete="new-password" type={showConfirmation ? "text" : "password"} placeholder="Enter the same password again" value={passwordConfirmation} onChange={(e) => setPasswordConfirmation(e.target.value)} required /><button type="button" className="password-toggle" onClick={() => setShowConfirmation((value) => !value)} aria-label={showConfirmation ? "Hide confirmation" : "Show confirmation"}>{showConfirmation ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
              {loadingDivisions && <p className="signup-help">Loading available divisions…</p>}
              {!loadingDivisions && divisions.length === 0 && <div className="form-alert" role="status">Manager sign-up is not enabled yet. Ask the application administrator to configure a division invitation code.</div>}
              {error && <div className="form-alert" role="alert">{error}</div>}
              <button className="button button-primary login-submit" type="submit" disabled={submitting || loadingDivisions || divisions.length === 0}>{submitting ? "Creating account…" : "Create division manager account"}<ArrowRight size={18} /></button>
            </form>
          )}
          <div className="login-security-note"><ShieldCheck size={16} /><span>Invitation codes are checked on the server. Newly registered accounts cannot access Django Admin.</span></div>
          <p className="login-footer signup-footer">Already have an account? <Link href="/login" className="text-link">Sign in</Link></p>
        </div>
      </section>
    </main>
  );
}
