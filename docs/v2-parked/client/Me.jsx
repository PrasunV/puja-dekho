import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useApp } from '../app-context.js';
import SignIn from './SignIn.jsx';
import { api } from '../lib/util.js';

function PointsGuide() {
  const rows = [['Check in with a photo', '+15 (10 + 5 for the photo)'], ['Rate a puja (signed in)', '+2'], ['Report the queue while at the puja', '+3'], ['Report a road closure', '+3'], ['Confirm or clear someone’s road report', '+1'], ['Finish a 4+ puja tour', '+20']];
  return <table className="t"><tbody>{rows.map(([a, b]) => <tr key={a}><td>{a}</td><td className="num">{b}</td></tr>)}</tbody></table>;
}

export default function Me() {
  const { me, mode, data, openPuja, loadMe, loadState, toast, setMe } = useApp();
  const u = me?.user;
  const [rows, setRows] = useState(null), [nick, setNick] = useState(''), [confirm, setConfirm] = useState(false);
  useEffect(() => { if (u) setNick(u.nickname); }, [u?.nickname]); // eslint-disable-line
  useEffect(() => { if (mode === 'server') api('/leaderboard').then((r) => setRows(r.rows)).catch(() => setRows([])); }, [mode, u?.points]);
  if (mode !== 'server') return <div className="stack"><div className="head"><h2>Me</h2></div><div className="note">Points, check-ins and the leaderboard need the server. This is the offline preview.</div></div>;
  const pct = u?.nextLevel ? Math.min(100, Math.round((u.points / u.nextLevel.at) * 100)) : 100;
  return (
    <div className="stack">
      <div className="head"><h2>{u ? u.nickname : 'Me'}</h2></div>
      {!u ? (
        <div className="card stack"><h3>Earn points as you hop</h3><PointsGuide /><div className="divider" /><SignIn /></div>
      ) : (
        <>
          <div className="card stack">
            <div className="row"><div className="grow"><div className="bignum">{u.points} pts</div><div className="sub">{u.level}{u.nextLevel ? ` · ${u.nextLevel.at - u.points} to ${u.nextLevel.name}` : ''} · {u.todayPoints} today</div></div><span className="tag accent">{u.level}</span></div>
            <div className="bar"><motion.i initial={{ width: 0 }} animate={{ width: pct + '%' }} transition={{ duration: 0.6, ease: 'easeOut' }} /></div>
          </div>
          <div><h3 className="mb8">Badges</h3>
            <div className="badges">{me.badges.map((b) => <div key={b.id} className={'badge' + (b.earned ? '' : ' locked')}><b>{(b.earned ? '★ ' : '') + b.name}</b><small>{b.how}</small></div>)}</div></div>
          {me.checkins.length > 0 && <div><h3 className="mb8">{`Your check-ins (${me.checkins.length})`}</h3>
            {me.checkins.map((c) => { const p = data.byId.get(c.puja_id); return p ? <button key={c.puja_id} className="lb rowbtn" onClick={() => openPuja(p.id)}><img className="thumb" src={`/api/photo/${p.id}`} alt="" loading="lazy" /><span className="grow">{p.n}</span></button> : null; })}</div>}
          <div className="card stack"><h3>Nickname</h3>
            <div className="row"><input type="text" value={nick} maxLength={20} aria-label="Nickname" onChange={(e) => setNick(e.target.value)} /><button className="btn small" onClick={async () => { try { await api('/me/nickname', { method: 'POST', body: { nickname: nick } }); await loadMe(); toast('Nickname saved', 'ok'); } catch (e) { toast(e.message, 'err'); } }}>Save</button></div>
            <div className="sub">Your nickname, points and check-in count appear on the leaderboard. Nothing else does.</div></div>
          <div className="card stack"><h3>How points work</h3><PointsGuide /></div>
        </>
      )}
      <div><h3 className="mb8">Leaderboard</h3>
        {rows == null ? <div className="sub">Loading…</div> : rows.length ? rows.map((x, i) => <div key={i} className="lb"><span className="r num">{i + 1}</span><span className="grow">{x.nickname}</span><span className="sub num">{x.checkins} check-ins</span><b className="num">{x.points}</b></div>) : <div className="sub">Nobody yet. Check in at a puja to take the first spot.</div>}</div>
      {u && (
        <div className="stack tight">
          <button className="btn block" onClick={async () => { await api('/auth/logout', { method: 'POST' }); await loadState(); setMe({ user: null }); }}>Sign out</button>
          {!confirm ? <button className="btn danger block" onClick={() => setConfirm(true)}>Delete my account and data</button> : (
            <>
              <div className="note">This deletes your points, check-ins and photos for good.</div>
              <div className="row"><button className="btn danger grow" onClick={async () => { try { await api('/me', { method: 'DELETE' }); setMe({ user: null }); await loadState(); toast('Your data was deleted', 'ok'); setConfirm(false); } catch (e) { toast(e.message, 'err'); } }}>Delete everything</button><button className="btn grow" onClick={() => setConfirm(false)}>Keep it</button></div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
