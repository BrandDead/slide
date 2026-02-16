import React, { useState } from 'react';

// DEALT/SLIDE GANG CREATOR v3.1 - FIXED LAYOUT
const CITY_STYLES = { miami: { id: 'miami', name: 'Miami', vibe: 'Tropical' }, la: { id: 'la', name: 'LA', vibe: 'West coast' }, chicago: { id: 'chicago', name: 'Chicago', vibe: 'Drill' }, atlanta: { id: 'atlanta', name: 'Atlanta', vibe: 'Designer' }, nyc: { id: 'nyc', name: 'NYC', vibe: 'NY Drill' }, detroit: { id: 'detroit', name: 'Detroit', vibe: 'Cartier' } };
const MEMBER_ROLES = { shooter: { id: 'shooter', name: 'Shooter', emoji: '🔫' }, dealer: { id: 'dealer', name: 'Dealer', emoji: '💊' }, enforcer: { id: 'enforcer', name: 'Enforcer', emoji: '💪' }, lookout: { id: 'lookout', name: 'Lookout', emoji: '👀' }, driver: { id: 'driver', name: 'Driver', emoji: '🚗' } };
const MEMBER_STATUS = { active: { id: 'active', name: 'Active', emoji: '✅' }, mission: { id: 'mission', name: 'Mission', emoji: '🥷' }, hospital: { id: 'hospital', name: 'Hospital', emoji: '🏥' }, jail: { id: 'jail', name: 'Jail', emoji: '🚔' } };
const SKIN_TONES = [{ id: 'ivory', hex: '#F8E4D4' }, { id: 'sand', hex: '#E8C4A2' }, { id: 'honey', hex: '#D4A574' }, { id: 'caramel', hex: '#B5835A' }, { id: 'toffee', hex: '#8B6544' }, { id: 'chocolate', hex: '#5D4037' }, { id: 'espresso', hex: '#3E2723' }];
const HAIRSTYLES = { male: ['Bald', 'Buzz', 'Fade', 'Waves', 'Dreads', 'Braids', 'Afro'], female: ['Bald', 'Pixie', 'Bob', 'Braids', 'Ponytail', 'Locs'] };
const HAIR_COLORS = [{ id: 'black', hex: '#0a0a0a' }, { id: 'brown', hex: '#3d2314' }, { id: 'blonde', hex: '#d4a83c' }, { id: 'platinum', hex: '#e8e8e8' }];
const HEADWEAR = [{ id: 'none', name: 'None', icon: '✕' }, { id: 'fitted', name: 'Fitted', icon: '🧢' }, { id: 'beanie', name: 'Beanie', icon: '🎿' }, { id: 'durag', name: 'Durag', icon: '👳' }, { id: 'bandana', name: 'Bandana', icon: '🎀' }, { id: 'ski_mask', name: 'Ski Mask', icon: '🎭' }];
const EYEWEAR = [{ id: 'none', name: 'None', icon: '✕' }, { id: 'shades', name: 'Shades', icon: '🕶️' }, { id: 'cartier', name: 'Cartier', icon: '👓' }];
const JEWELRY = ['None', 'Chain', 'Cuban', 'Grillz', 'Watch'];
const TOPS = [{ id: 'tank', name: 'Tank', icon: '👕' }, { id: 'tee', name: 'Tee', icon: '👕' }, { id: 'hoodie', name: 'Hoodie', icon: '🧥' }, { id: 'polo', name: 'Polo', icon: '👔' }];
const OUTERWEAR = [{ id: 'none', name: 'None', icon: '✕' }, { id: 'leather', name: 'Leather', icon: '🧥' }, { id: 'bomber', name: 'Bomber', icon: '🧥' }, { id: 'puffer', name: 'Puffer', icon: '🧥' }];
const BOTTOMS = [{ id: 'slim', name: 'Slim', icon: '👖' }, { id: 'baggy', name: 'Baggy', icon: '👖' }, { id: 'cargos', name: 'Cargos', icon: '👖' }, { id: 'joggers', name: 'Joggers', icon: '👖' }];
const SHOES = [{ id: 'jordans', name: 'Jordans', icon: '👟' }, { id: 'forces', name: 'Forces', icon: '👟' }, { id: 'chucks', name: 'Chucks', icon: '👟' }, { id: 'timbs', name: 'Timbs', icon: '🥾' }];
const TACTICAL = [{ id: 'none', name: 'None', icon: '✕', def: 0 }, { id: 'vest', name: 'Vest', icon: '🦺', def: 25 }];
const WEAPONS = [{ id: 'none', name: 'Unarmed', icon: '✊', dmg: 5 }, { id: 'knife', name: 'Knife', icon: '🔪', dmg: 15 }, { id: 'glock', name: 'Glock', icon: '🔫', dmg: 30 }, { id: 'mac10', name: 'MAC-10', icon: '🔫', dmg: 38 }, { id: 'ak47', name: 'AK-47', icon: '🔫', dmg: 55 }, { id: 'shotgun', name: 'Shotgun', icon: '🔫', dmg: 65 }];
const MODS = [{ id: 'none', name: 'None', bonus: 0 }, { id: 'ext', name: 'Ext Mag', bonus: 5 }, { id: 'drum', name: 'Drum', bonus: 10 }, { id: 'double', name: 'Double Drum', bonus: 18 }];
const GANG_COLORS = [{ id: 'red', hex: '#8B0000' }, { id: 'blue', hex: '#0047AB' }, { id: 'purple', hex: '#6B3FA0' }, { id: 'green', hex: '#228B22' }, { id: 'gold', hex: '#FFD700' }, { id: 'black', hex: '#1a1a1a' }];
const STATS = { shooter: { shoot: 85, drive: 55, deal: 25, loyal: 70 }, dealer: { shoot: 35, drive: 50, deal: 90, loyal: 55 }, driver: { shoot: 45, drive: 95, deal: 30, loyal: 70 }, balanced: { shoot: 55, drive: 55, deal: 55, loyal: 55 } };
const rand = a => a[Math.floor(Math.random() * a.length)];
const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

export default function App() {
  const [tab, setTab] = useState('identity');
  const [members, setMembers] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);

  const [m, setM] = useState({
    id: Date.now(), name: 'Shadow', gender: 'male', city: 'chicago', skinTone: 'chocolate',
    hair: 'Bald', hairColor: 'black', headwear: 'ski_mask', eyewear: 'none', jewelry: 'None',
    top: 'hoodie', outer: 'none', bottom: 'cargos', shoes: 'chucks', tactical: 'none',
    weapon: 'glock', mod: 'none', gangColor: 'black', role: 'shooter', status: 'active',
    tattoos: [], stats: { ...STATS.shooter }
  });

  const set = (k, v) => setM(p => ({ ...p, [k]: v }));
  
  const randomize = () => {
    const g = rand(['male', 'female']);
    const role = rand(Object.keys(MEMBER_ROLES));
    setM({
      id: Date.now(), name: `Member_${randInt(1000, 9999)}`, gender: g, city: rand(Object.keys(CITY_STYLES)),
      skinTone: rand(SKIN_TONES).id, hair: rand(HAIRSTYLES[g]), hairColor: rand(HAIR_COLORS).id,
      headwear: rand(HEADWEAR).id, eyewear: rand(EYEWEAR).id, jewelry: rand(JEWELRY),
      top: rand(TOPS).id, outer: rand(OUTERWEAR).id, bottom: rand(BOTTOMS).id, shoes: rand(SHOES).id,
      tactical: rand(TACTICAL).id, weapon: rand(WEAPONS).id, mod: rand(MODS).id,
      gangColor: rand(GANG_COLORS).id, role, status: 'active', tattoos: [], stats: { ...STATS[role] || STATS.balanced }
    });
  };

  const save = () => { setMembers(p => [...p, { ...m }]); setM({ ...m, id: Date.now(), name: 'New Member' }); };

  const genPrompt = (type) => {
    const skin = SKIN_TONES.find(s => s.id === m.skinTone);
    const head = HEADWEAR.find(h => h.id === m.headwear);
    const top = TOPS.find(t => t.id === m.top);
    const bot = BOTTOMS.find(b => b.id === m.bottom);
    const shoe = SHOES.find(s => s.id === m.shoes);
    const wpn = WEAPONS.find(w => w.id === m.weapon);
    const clr = GANG_COLORS.find(c => c.id === m.gangColor);
    const pose = type === 'armed' ? 'Combat stance, holding weapon ready' : type === 'headshot' ? 'Portrait headshot, shoulders up' : 'Standing idle, relaxed stance';
    setPrompt(`Semi-realistic GTA-style character art. Full body on TRANSPARENT PNG background. Gritty urban street realism. Detailed clothing textures.\n\n${pose}\n\nCHARACTER: ${m.gender}, ${skin?.id || 'medium'} skin tone\nHEAD: ${m.hair}${head && m.headwear !== 'none' ? `, wearing ${head.name}` : ''}\nCLOTHING: ${top?.name || 'Hoodie'}, ${bot?.name || 'Cargos'}, ${shoe?.name || 'Chucks'}\n${type === 'armed' && wpn ? `WEAPON: ${wpn.name}\n` : ''}STYLE: ${CITY_STYLES[m.city]?.name} aesthetic, ${clr?.id} gang color\n\nOUTPUT: 512x512 PNG, transparent background`);
    setShowPrompt(true);
  };

  const wpn = WEAPONS.find(w => w.id === m.weapon);
  const mod = MODS.find(x => x.id === m.mod);
  const dmg = (wpn?.dmg || 0) + (mod?.bonus || 0);
  const def = TACTICAL.find(t => t.id === m.tactical)?.def || 0;
  const clr = GANG_COLORS.find(c => c.id === m.gangColor);
  const role = MEMBER_ROLES[m.role];
  const status = MEMBER_STATUS[m.status];

  const S = {
    app: { fontFamily: 'Inter, system-ui, sans-serif', background: '#0d0d0d', minHeight: '100vh', color: '#fff' },
    header: { background: '#151515', borderBottom: '1px solid #2a2a2a', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    h1: { fontSize: 18, fontWeight: 700, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8 },
    btns: { display: 'flex', gap: 8 },
    btn: { padding: '8px 16px', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' },
    main: { display: 'grid', gridTemplateColumns: '300px 1fr 200px', minHeight: 'calc(100vh - 52px)' },
    preview: { background: '#111', borderRight: '1px solid #2a2a2a', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' },
    card: { background: '#1a1a1a', borderRadius: 12, padding: 16, border: `2px solid ${clr?.hex || '#333'}`, position: 'relative' },
    badge: { position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: 4, fontSize: 10, color: '#888' },
    avatar: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0' },
    head: { width: 55, height: 60, borderRadius: '50% 50% 45% 45%', background: SKIN_TONES.find(s => s.id === m.skinTone)?.hex || '#B5835A', position: 'relative' },
    hw: { position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', fontSize: 32 },
    body: { width: 65, height: 55, marginTop: -6, borderRadius: '6px 6px 0 0', background: (clr?.hex || '#333') + '44', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 },
    legs: { fontSize: 22, marginTop: -2 },
    feet: { fontSize: 16, marginTop: 2 },
    wpn: { position: 'absolute', right: 16, top: '50%', fontSize: 28, transform: 'rotate(-20deg)' },
    info: { textAlign: 'center', marginTop: 10 },
    name: { fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 },
    role: { fontSize: 10, color: '#888', marginTop: 2 },
    stats: { display: 'flex', justifyContent: 'center', gap: 12, marginTop: 10 },
    stat: { textAlign: 'center' },
    statLabel: { fontSize: 8, color: '#666', textTransform: 'uppercase' },
    statBar: { width: 40, height: 3, background: '#333', borderRadius: 2, marginTop: 2, overflow: 'hidden' },
    input: { background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, padding: 10, color: '#fff', fontSize: 13, width: '100%', textAlign: 'center', fontWeight: 600 },
    promptSec: { marginTop: 4 },
    promptH: { fontSize: 10, color: '#666', textTransform: 'uppercase', marginBottom: 6 },
    promptBtns: { display: 'flex', flexDirection: 'column', gap: 5 },
    promptBtn: { padding: 9, border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 },
    colorSec: { marginTop: 8 },
    colorH: { fontSize: 10, color: '#666', textTransform: 'uppercase', marginBottom: 6 },
    colors: { display: 'flex', gap: 5, flexWrap: 'wrap' },
    colorBtn: { width: 28, height: 28, borderRadius: '50%', border: '2px solid transparent', cursor: 'pointer' },
    statusGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginTop: 8 },
    statusBtn: { padding: 7, background: '#1a1a1a', border: '1px solid #333', borderRadius: 5, color: '#888', fontSize: 10, cursor: 'pointer', textAlign: 'center' },
    editor: { display: 'flex', flexDirection: 'column', background: '#0d0d0d' },
    tabs: { display: 'flex', background: '#151515', borderBottom: '1px solid #2a2a2a', padding: '0 12px' },
    tab: { padding: '12px 16px', background: 'transparent', border: 'none', borderBottom: '2px solid transparent', color: '#666', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 },
    tabActive: { color: '#fff', borderBottomColor: '#ef4444' },
    content: { flex: 1, overflowY: 'auto', padding: 16 },
    section: { marginBottom: 20 },
    secH: { fontSize: 10, color: '#666', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 6 },
    opt: { padding: '8px 6px', background: '#1a1a1a', border: '2px solid #2a2a2a', borderRadius: 6, color: '#888', fontSize: 10, cursor: 'pointer', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 },
    optSel: { borderColor: '#ef4444', color: '#fff' },
    optIcon: { fontSize: 16 },
    swatches: { display: 'flex', gap: 6, flexWrap: 'wrap' },
    swatch: { width: 28, height: 28, borderRadius: '50%', border: '2px solid transparent', cursor: 'pointer' },
    swatchSel: { borderColor: '#fff', boxShadow: '0 0 0 2px #ef4444' },
    cityGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 },
    cityBtn: { padding: 10, background: '#1a1a1a', border: '2px solid #2a2a2a', borderRadius: 6, color: '#888', textAlign: 'left', cursor: 'pointer' },
    citySel: { borderColor: '#ef4444', color: '#fff' },
    roleGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 },
    roleBtn: { padding: '10px 6px', background: '#1a1a1a', border: '2px solid #2a2a2a', borderRadius: 6, color: '#888', cursor: 'pointer', textAlign: 'center' },
    roleSel: { borderColor: '#ef4444', color: '#fff' },
    saved: { background: '#111', borderLeft: '1px solid #2a2a2a', padding: 14, overflowY: 'auto' },
    savedH: { fontSize: 10, color: '#666', textTransform: 'uppercase', marginBottom: 10 },
    savedEmpty: { textAlign: 'center', color: '#444', fontSize: 11, padding: '20px 10px' },
    savedItem: { background: '#1a1a1a', borderRadius: 6, padding: 8, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', border: '2px solid transparent' },
    savedAvatar: { width: 32, height: 32, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 },
    savedInfo: { flex: 1 },
    savedName: { fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 },
    savedRole: { fontSize: 9, color: '#666' },
    savedDel: { background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: 11 },
    modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 },
    modalBox: { background: '#1a1a1a', borderRadius: 10, maxWidth: 550, width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', border: '1px solid #333' },
    modalH: { padding: 14, borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    modalBody: { padding: 14, overflowY: 'auto', flex: 1 },
    prompt: { background: '#0d0d0d', border: '1px solid #333', borderRadius: 6, padding: 14, fontFamily: 'monospace', fontSize: 10, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: '#10b981' },
    modalF: { padding: 14, borderTop: '1px solid #333', display: 'flex', gap: 8, justifyContent: 'flex-end' },
  };

  const tabs = [{ id: 'identity', icon: '👤', label: 'Identity' }, { id: 'look', icon: '💇', label: 'Look' }, { id: 'outfit', icon: '👕', label: 'Outfit' }, { id: 'tactical', icon: '🔫', label: 'Arsenal' }, { id: 'stats', icon: '📊', label: 'Stats' }];

  return (
    <div style={S.app}>
      {showPrompt && (
        <div style={S.modal} onClick={() => setShowPrompt(false)}>
          <div style={S.modalBox} onClick={e => e.stopPropagation()}>
            <div style={S.modalH}><h3 style={{ fontSize: 13 }}>🍌 Banana Nano Prompt</h3><button style={{ background: 'none', border: 'none', color: '#888', fontSize: 16, cursor: 'pointer' }} onClick={() => setShowPrompt(false)}>✕</button></div>
            <div style={S.modalBody}><pre style={S.prompt}>{prompt}</pre></div>
            <div style={S.modalF}>
              <button style={{ ...S.btn, background: '#16a34a', color: '#fff' }} onClick={() => { navigator.clipboard.writeText(prompt); alert('Copied!'); }}>📋 Copy</button>
              <button style={{ ...S.btn, background: '#333', color: '#fff' }} onClick={() => setShowPrompt(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <div style={S.header}>
        <h1 style={S.h1}>🔫 DEALT/SLIDE Creator</h1>
        <div style={S.btns}>
          <button style={{ ...S.btn, background: '#333', color: '#fff' }} onClick={randomize}>🎲 Random</button>
          <button style={{ ...S.btn, background: '#16a34a', color: '#fff' }} onClick={save}>💾 Save</button>
          <button style={{ ...S.btn, background: '#2563eb', color: '#fff' }} onClick={() => { const b = new Blob([JSON.stringify({ members }, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'gang.json'; a.click(); }}>📤 ({members.length})</button>
        </div>
      </div>

      <div style={S.main}>
        {/* PREVIEW */}
        <div style={S.preview}>
          <div style={S.card}>
            <div style={S.badge}>{CITY_STYLES[m.city]?.name}</div>
            <div style={S.avatar}>
              <div style={S.head}>{m.headwear !== 'none' && <div style={S.hw}>{HEADWEAR.find(h => h.id === m.headwear)?.icon}</div>}</div>
              <div style={S.body}>{TOPS.find(t => t.id === m.top)?.icon}</div>
              <div style={S.legs}>{BOTTOMS.find(b => b.id === m.bottom)?.icon}</div>
              <div style={S.feet}>{SHOES.find(s => s.id === m.shoes)?.icon}</div>
              {m.weapon !== 'none' && <div style={S.wpn}>{wpn?.icon}</div>}
            </div>
            <div style={S.info}>
              <div style={S.name}>{m.name} {role?.emoji} {status?.emoji}</div>
              <div style={S.role}>{role?.name} • {CITY_STYLES[m.city]?.name}</div>
              <div style={S.stats}>
                <div style={S.stat}><div style={S.statLabel}>DMG</div><div style={S.statBar}><div style={{ height: '100%', width: `${dmg}%`, background: '#ef4444', borderRadius: 2 }} /></div></div>
                <div style={S.stat}><div style={S.statLabel}>DEF</div><div style={S.statBar}><div style={{ height: '100%', width: `${def}%`, background: '#3b82f6', borderRadius: 2 }} /></div></div>
                <div style={S.stat}><div style={S.statLabel}>LYL</div><div style={S.statBar}><div style={{ height: '100%', width: `${m.stats?.loyal || 50}%`, background: '#a855f7', borderRadius: 2 }} /></div></div>
              </div>
            </div>
          </div>

          <input style={S.input} value={m.name} onChange={e => set('name', e.target.value)} placeholder="Name..." />

          <div style={S.promptSec}>
            <div style={S.promptH}>🍌 Banana Nano</div>
            <div style={S.promptBtns}>
              <button style={{ ...S.promptBtn, background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#000' }} onClick={() => genPrompt('idle')}>🧍 Idle Sprite</button>
              <button style={{ ...S.promptBtn, background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: '#fff' }} onClick={() => genPrompt('armed')}>🔫 Armed Sprite</button>
              <button style={{ ...S.promptBtn, background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff' }} onClick={() => genPrompt('headshot')}>📸 Headshot</button>
            </div>
          </div>

          <div style={S.colorSec}>
            <div style={S.colorH}>Gang Color</div>
            <div style={S.colors}>
              {GANG_COLORS.map(c => <button key={c.id} style={{ ...S.colorBtn, background: c.hex, ...(m.gangColor === c.id ? { borderColor: '#fff', boxShadow: '0 0 0 2px #ef4444' } : {}) }} onClick={() => set('gangColor', c.id)} />)}
            </div>
          </div>

          <div style={S.statusGrid}>
            {Object.values(MEMBER_STATUS).map(s => <button key={s.id} style={{ ...S.statusBtn, ...(m.status === s.id ? { borderColor: '#ef4444', color: '#fff' } : {}) }} onClick={() => set('status', s.id)}>{s.emoji} {s.name}</button>)}
          </div>
        </div>

        {/* EDITOR */}
        <div style={S.editor}>
          <div style={S.tabs}>
            {tabs.map(t => <button key={t.id} style={{ ...S.tab, ...(tab === t.id ? S.tabActive : {}) }} onClick={() => setTab(t.id)}><span>{t.icon}</span> {t.label}</button>)}
          </div>

          <div style={S.content}>
            {tab === 'identity' && (<>
              <div style={S.section}><div style={S.secH}>Gender</div><div style={{ ...S.grid, gridTemplateColumns: '1fr 1fr' }}>
                {['male', 'female'].map(g => <button key={g} style={{ ...S.opt, ...(m.gender === g ? S.optSel : {}) }} onClick={() => set('gender', g)}><span style={S.optIcon}>{g === 'male' ? '👨' : '👩'}</span>{g}</button>)}
              </div></div>
              <div style={S.section}><div style={S.secH}>City</div><div style={S.cityGrid}>
                {Object.values(CITY_STYLES).map(c => <button key={c.id} style={{ ...S.cityBtn, ...(m.city === c.id ? S.citySel : {}) }} onClick={() => set('city', c.id)}><strong style={{ fontSize: 12 }}>{c.name}</strong><div style={{ fontSize: 9, color: '#666' }}>{c.vibe}</div></button>)}
              </div></div>
              <div style={S.section}><div style={S.secH}>Role</div><div style={S.roleGrid}>
                {Object.values(MEMBER_ROLES).map(r => <button key={r.id} style={{ ...S.roleBtn, ...(m.role === r.id ? S.roleSel : {}) }} onClick={() => { set('role', r.id); set('stats', STATS[r.id] || STATS.balanced); }}><div style={{ fontSize: 18 }}>{r.emoji}</div><div style={{ fontSize: 10 }}>{r.name}</div></button>)}
              </div></div>
              <div style={S.section}><div style={S.secH}>Skin Tone</div><div style={S.swatches}>
                {SKIN_TONES.map(s => <button key={s.id} style={{ ...S.swatch, background: s.hex, ...(m.skinTone === s.id ? S.swatchSel : {}) }} onClick={() => set('skinTone', s.id)} />)}
              </div></div>
            </>)}

            {tab === 'look' && (<>
              <div style={S.section}><div style={S.secH}>Hairstyle</div><div style={S.grid}>
                {HAIRSTYLES[m.gender].map(h => <button key={h} style={{ ...S.opt, ...(m.hair === h ? S.optSel : {}) }} onClick={() => set('hair', h)}>{h}</button>)}
              </div></div>
              <div style={S.section}><div style={S.secH}>Hair Color</div><div style={S.swatches}>
                {HAIR_COLORS.map(c => <button key={c.id} style={{ ...S.swatch, background: c.hex, ...(m.hairColor === c.id ? S.swatchSel : {}) }} onClick={() => set('hairColor', c.id)} />)}
              </div></div>
              <div style={S.section}><div style={S.secH}>Headwear</div><div style={S.grid}>
                {HEADWEAR.map(h => <button key={h.id} style={{ ...S.opt, ...(m.headwear === h.id ? S.optSel : {}) }} onClick={() => set('headwear', h.id)}><span style={S.optIcon}>{h.icon}</span>{h.name}</button>)}
              </div></div>
              <div style={S.section}><div style={S.secH}>Eyewear</div><div style={S.grid}>
                {EYEWEAR.map(e => <button key={e.id} style={{ ...S.opt, ...(m.eyewear === e.id ? S.optSel : {}) }} onClick={() => set('eyewear', e.id)}><span style={S.optIcon}>{e.icon}</span>{e.name}</button>)}
              </div></div>
              <div style={S.section}><div style={S.secH}>Jewelry</div><div style={S.grid}>
                {JEWELRY.map(j => <button key={j} style={{ ...S.opt, ...(m.jewelry === j ? S.optSel : {}) }} onClick={() => set('jewelry', j)}>{j}</button>)}
              </div></div>
            </>)}

            {tab === 'outfit' && (<>
              <div style={S.section}><div style={S.secH}>Top</div><div style={S.grid}>
                {TOPS.map(t => <button key={t.id} style={{ ...S.opt, ...(m.top === t.id ? S.optSel : {}) }} onClick={() => set('top', t.id)}><span style={S.optIcon}>{t.icon}</span>{t.name}</button>)}
              </div></div>
              <div style={S.section}><div style={S.secH}>Outerwear</div><div style={S.grid}>
                {OUTERWEAR.map(o => <button key={o.id} style={{ ...S.opt, ...(m.outer === o.id ? S.optSel : {}) }} onClick={() => set('outer', o.id)}><span style={S.optIcon}>{o.icon}</span>{o.name}</button>)}
              </div></div>
              <div style={S.section}><div style={S.secH}>Bottoms</div><div style={S.grid}>
                {BOTTOMS.map(b => <button key={b.id} style={{ ...S.opt, ...(m.bottom === b.id ? S.optSel : {}) }} onClick={() => set('bottom', b.id)}><span style={S.optIcon}>{b.icon}</span>{b.name}</button>)}
              </div></div>
              <div style={S.section}><div style={S.secH}>Shoes</div><div style={S.grid}>
                {SHOES.map(s => <button key={s.id} style={{ ...S.opt, ...(m.shoes === s.id ? S.optSel : {}) }} onClick={() => set('shoes', s.id)}><span style={S.optIcon}>{s.icon}</span>{s.name}</button>)}
              </div></div>
            </>)}

            {tab === 'tactical' && (<>
              <div style={S.section}><div style={S.secH}>Tactical Gear</div><div style={S.grid}>
                {TACTICAL.map(t => <button key={t.id} style={{ ...S.opt, ...(m.tactical === t.id ? S.optSel : {}) }} onClick={() => set('tactical', t.id)}><span style={S.optIcon}>{t.icon}</span>{t.name}{t.def > 0 && <span style={{ fontSize: 8, color: '#3b82f6' }}>+{t.def}</span>}</button>)}
              </div></div>
              <div style={S.section}><div style={S.secH}>Weapon</div><div style={S.grid}>
                {WEAPONS.map(w => <button key={w.id} style={{ ...S.opt, ...(m.weapon === w.id ? S.optSel : {}) }} onClick={() => set('weapon', w.id)}><span style={S.optIcon}>{w.icon}</span>{w.name}<span style={{ fontSize: 8, color: '#ef4444' }}>{w.dmg}</span></button>)}
              </div></div>
              <div style={S.section}><div style={S.secH}>Weapon Mod</div><div style={S.grid}>
                {MODS.map(x => <button key={x.id} style={{ ...S.opt, ...(m.mod === x.id ? S.optSel : {}) }} onClick={() => set('mod', x.id)}>{x.name}{x.bonus > 0 && <span style={{ fontSize: 8, color: '#f59e0b' }}>+{x.bonus}</span>}</button>)}
              </div></div>
            </>)}

            {tab === 'stats' && (
              <div style={{ background: '#151515', borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 14 }}>📊 Combat Stats</div>
                {Object.entries(m.stats).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <label style={{ width: 60, fontSize: 10, color: '#888', textTransform: 'uppercase' }}>{k}</label>
                    <input type="range" min="0" max="100" value={v} onChange={e => set('stats', { ...m.stats, [k]: parseInt(e.target.value) })} style={{ flex: 1, height: 5, background: '#333', borderRadius: 3, appearance: 'none', cursor: 'pointer' }} />
                    <span style={{ width: 24, textAlign: 'right', fontWeight: 700, fontSize: 12, color: '#ef4444' }}>{v}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: '1px solid #333' }}>
                  {Object.keys(STATS).map(t => <button key={t} style={{ padding: '5px 10px', background: '#222', border: '1px solid #444', borderRadius: 4, color: '#888', fontSize: 9, cursor: 'pointer', textTransform: 'uppercase' }} onClick={() => set('stats', { ...STATS[t] })}>{t}</button>)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SAVED */}
        <div style={S.saved}>
          <div style={S.savedH}>Saved ({members.length})</div>
          {members.length === 0 ? <div style={S.savedEmpty}>No members yet</div> : members.map((x, i) => (
            <div key={x.id} style={S.savedItem} onClick={() => setM({ ...x })}>
              <div style={{ ...S.savedAvatar, background: GANG_COLORS.find(c => c.id === x.gangColor)?.hex }}>{x.gender === 'male' ? '👨' : '👩'}</div>
              <div style={S.savedInfo}><div style={S.savedName}>{x.name} {MEMBER_ROLES[x.role]?.emoji}</div><div style={S.savedRole}>{MEMBER_ROLES[x.role]?.name}</div></div>
              <button style={S.savedDel} onClick={e => { e.stopPropagation(); setMembers(p => p.filter((_, j) => j !== i)); }}>✕</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
