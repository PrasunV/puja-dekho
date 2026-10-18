import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../app-context.js';
import { api } from '../lib/util.js';

let gsiInit = false;
const loadGsi = () => new Promise((res) => {
  if (window.google?.accounts?.id) return res(true);
  const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = () => res(true); s.onerror = () => res(false); document.head.append(s);
});

export default function SignIn() {
  const { health, toast, loadState, loadMe } = useApp();
  const [adult, setAdult] = useState(false), [nick, setNick] = useState('');
  const adultRef = useRef(false), nickRef = useRef(''); adultRef.current = adult; nickRef.current = nick;
  const gbox = useRef(null);
  const complete = async (path, body) => {
    if (!adultRef.current) { toast('Confirm that you are 18 or older first.', 'err'); return; }
    try { await api(path, { method: 'POST', body: { ...body, adult: true, nickname: nickRef.current || undefined } }); await loadState(); await loadMe(); toast('Signed in', 'ok'); }
    catch (e) { toast(e.message, 'err'); }
  };
  useEffect(() => {
    if (!health?.googleClientId) return;
    let dead = false;
    loadGsi().then((ok) => {
      if (dead || !gbox.current) return;
      if (!ok) { gbox.current.textContent = 'Could not load Google sign-in.'; return; }
      if (!gsiInit) { window.google.accounts.id.initialize({ client_id: health.googleClientId, callback: (r) => window.__pjGoogleCb?.(r.credential) }); gsiInit = true; }
      window.__pjGoogleCb = (cred) => complete('/auth/google', { credential: cred });
      window.google.accounts.id.renderButton(gbox.current, { theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill' });
    });
    return () => { dead = true; };
  }, [health]); // eslint-disable-line
  return (
    <div className="stack tight">
      <label className="check"><input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />I am 18 or older.</label>
      <input type="text" maxLength={20} value={nick} onChange={(e) => setNick(e.target.value)} placeholder="Nickname for the leaderboard (optional)" aria-label="Nickname" />
      {health?.googleClientId ? <div ref={gbox} /> : <div className="note">Google sign-in is not set up on this server yet.</div>}
      {health?.testAuth && <button className="btn small" data-testid="test-signin" onClick={() => complete('/auth/test', { sub: 'tester' })}>Test sign-in (development only)</button>}
      <div className="sub">We keep your Google account ID, nickname, private check-in photos and points. You can delete all of it from the Me tab.</div>
    </div>
  );
}
