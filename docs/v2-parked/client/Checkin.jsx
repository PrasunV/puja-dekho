import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../app-context.js';
import { api, getPos } from '../lib/util.js';
import { Icon } from './ui.jsx';
import SignIn from './SignIn.jsx';

async function resizePhoto(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file));
  let scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height)), q = 0.78, out = '';
  for (let i = 0; i < 6; i++) {
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    out = c.toDataURL('image/jpeg', q);
    if ((out.length - 23) * 0.75 < 650000) return out;
    q = Math.max(0.5, q - 0.1); scale *= 0.85;
  }
  return out;
}

const Card = ({ children }) => <div className="card stack"><h3>Check in</h3>{children}</div>;

export default function Checkin({ p }) {
  const { mine, mode, toast, loadState, loadMe } = useApp();
  const [photo, setPhoto] = useState(null), [busy, setBusy] = useState(false), [done, setDone] = useState(null);
  const checked = mine.checkins?.includes(p.id);
  if (!p.ck) return <Card><div className="sub">Check-in is off for this puja because its map pin is approximate.</div></Card>;
  if (checked) return (
    <Card>
      <div className="row">
        <img className="thumb" src={`/api/photo/${p.id}`} alt="Your check-in photo" onError={(e) => e.currentTarget.remove()} />
        <div><b>You checked in here</b><div className="sub">Your photo stays private to you.</div></div>
        <AnimatePresence>{done && <motion.span className="burst" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 14 }}>+{done}</motion.span>}</AnimatePresence>
      </div>
    </Card>
  );
  if (mode !== 'server') return <Card><div className="sub">Check-ins need the server and a Google sign-in.</div></Card>;
  if (!mine.user) return <Card><div className="sub">Be at the pandal, take a photo of Maa Durga, earn points and badges. Sign in once to start.</div><SignIn /></Card>;
  const pick = async (e) => { const f = e.target.files[0]; if (!f) return; try { setPhoto(await resizePhoto(f)); } catch { toast('Could not read that photo. Try another.', 'err'); } };
  const submit = async () => {
    setBusy(true);
    try {
      const pos = await getPos({ timeout: 10000, high: true });
      const r = await api('/checkin', { method: 'POST', body: { pujaId: p.id, lat: pos.lat, lng: pos.lng, photo } });
      setDone(r.pointsAwarded); toast(r.capped ? 'Checked in. Daily check-in points limit reached.' : `Checked in +${r.pointsAwarded} points. Level: ${r.level}`, 'ok');
      setPhoto(null); await loadState(); await loadMe();
    } catch (e) { toast(e.status ? e.message : 'We could not get your location. Allow location access and try again.', 'err'); setBusy(false); }
  };
  return (
    <Card>
      <div className="sub">You need to be within 200 m of the pandal. Photos stay private to you.</div>
      <input id="ckfile" data-testid="photo-input" type="file" accept="image/*" capture="environment" hidden onChange={pick} />
      <label htmlFor="ckfile" className="btn block"><Icon name="camera" />Take or choose a photo of Maa Durga</label>
      {photo && <img className="photo-prev" src={photo} alt="Photo preview" />}
      <button className="btn primary block" disabled={!photo || busy} onClick={submit}>Check in here</button>
    </Card>
  );
}
