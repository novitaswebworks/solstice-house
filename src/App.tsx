import { useCallback, useEffect, useRef, useState } from 'react';
import { rooms, dimensions, roomFacts, sunMarks } from './house/layout';
import { useHouse } from './ui/useHouse';
import { SUN_SLOT_START } from './house/runtime';
import { planSheetSvg } from './house/planSheet';

const SunMark = () => (
  <svg className="sun-mark" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="4.5" fill="currentColor" />
    {Array.from({ length: 8 }, (_, i) => {
      const a = (i * Math.PI) / 4;
      return <line key={i} x1={12 + Math.cos(a) * 7.5} y1={12 + Math.sin(a) * 7.5} x2={12 + Math.cos(a) * 10.5} y2={12 + Math.sin(a) * 10.5} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />;
    })}
  </svg>
);

const size = (r: (typeof rooms)[number]) => `${r.x1 - r.x0} × ${r.z1 - r.z0} m`;
const area = (r: (typeof rooms)[number]) => (r.x1 - r.x0) * (r.z1 - r.z0);
const TOTAL_AREA = rooms.reduce((sum, r) => sum + area(r), 0);

/** A day on a 24-hour strip: each quarter-hour slot is filled by how much of the room it lights. */
const SunStrip = ({ slots }: { slots: number[] }) => (
  <span className="strip">
    <svg viewBox="0 0 96 6" preserveAspectRatio="none" aria-hidden="true">
      <rect className="strip__day" x="0" y="2.5" width="96" height="1" />
      {slots.map((f, i) => f > 0 && <rect key={i} x={SUN_SLOT_START * 4 + i} y="0" width="1.05" height="6" opacity={0.2 + 0.8 * f} />)}
    </svg>
    <span className="strip__ticks" aria-hidden="true"><i>00</i><i>06</i><i>12</i><i>18</i><i>24</i></span>
  </span>
);

// The whole plan, faint, with one room filled: a pictogram for the room index.
const PLAN = rooms.reduce((b, r) => ({ x0: Math.min(b.x0, r.x0), z0: Math.min(b.z0, r.z0), x1: Math.max(b.x1, r.x1), z1: Math.max(b.z1, r.z1) }),
  { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity });
const PlanMark = ({ active }: { active: number }) => (
  <svg className="planmark" viewBox={`${PLAN.x0 - 0.6} ${PLAN.z0 - 0.6} ${PLAN.x1 - PLAN.x0 + 1.2} ${PLAN.z1 - PLAN.z0 + 1.2}`} aria-hidden="true">
    {rooms.map((r, i) => (
      <rect key={r.id} x={r.x0} y={r.z0} width={r.x1 - r.x0} height={r.z1 - r.z0} className={i === active ? 'is-on' : ''} vectorEffect="non-scaling-stroke" />
    ))}
  </svg>
);

export default function App() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const labelRefs = useRef<Array<HTMLElement | null>>([]);
  const sliderRef = useRef<HTMLInputElement>(null);
  const { roomIndex, finale, ready, error, jumpTo, roomProgress, setHour, sun, skies } = useHouse(canvasRef, rootRef, labelRefs, clockRef, sliderRef);
  const room = roomIndex >= 0 ? rooms[roomIndex] : null;
  const [fileOpen, setFileOpen] = useState(false);
  const [manual, setManual] = useState(false);
  const [shared, setShared] = useState(false);
  // The address already follows the walk (#kitchen), so sharing the page shares the room.
  const share = async () => {
    const url = location.href;
    try {
      if (navigator.share) await navigator.share({ title: `${room?.name ?? 'Solstice House'} · Solstice House`, url });
      else { await navigator.clipboard.writeText(url); setShared(true); setTimeout(() => setShared(false), 1800); }
    } catch { /* the visitor closed the share sheet */ }
  };

  const toggleFile = () => setFileOpen((open) => !open);
  // Built in the browser from the same layout data as the 3D house; nothing is fetched.
  const downloadPlan = () => {
    const url = URL.createObjectURL(new Blob([planSheetSvg(sun)], { type: 'image/svg+xml' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'solstice-house-plan-1-100-A3.svg' });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const facts = room ? roomFacts[room.id] : null;

  // Step one chapter along the walk; -1 is the plan.
  const go = useCallback((delta: number) => {
    const next = Math.max(-1, Math.min(rooms.length - 1, roomIndex + delta));
    jumpTo(roomProgress(next));
  }, [roomIndex, jumpTo, roomProgress]);

  // J/K or ←/→ move between rooms, Esc closes the room file. Left alone while typing or on the slider.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!ready || e.metaKey || e.ctrlKey || e.altKey || e.target instanceof HTMLInputElement) return;
      if (e.key === 'Escape') setFileOpen(false);
      else if (e.key === 'ArrowRight' || e.key === 'j') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft' || e.key === 'k') { e.preventDefault(); go(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ready, go]);

  // Deep links: /#kitchen opens the walk at that room, and the address follows you through the house.
  const linked = useRef(false);
  useEffect(() => {
    if (!ready || linked.current) return;
    linked.current = true;
    const target = rooms.findIndex((r) => r.id === location.hash.slice(1));
    if (target >= 0) setTimeout(() => jumpTo(roomProgress(target)), 400);
  }, [ready, jumpTo, roomProgress]);
  useEffect(() => {
    if (!linked.current) return;
    const next = room ? `#${room.id}` : '';
    if (location.hash !== next) history.replaceState(null, '', `${location.pathname}${location.search}${next}`);
  }, [room]);

  return (
    <div className={`app${finale ? ' is-finale' : ''}${room && fileOpen ? ' is-file' : ''}`} ref={rootRef}>
      <canvas ref={canvasRef} className="stage" aria-hidden="true" />
      <div className="progress" aria-hidden="true" />

      <header className="bar">
        <a className="brand" href="#top" onClick={(e) => { e.preventDefault(); jumpTo(0); }}>
          <SunMark />
          <span>Solstice House</span>
        </a>
        <div className={`clock${room ? ' is-on' : ''}`} aria-label="Time of day in the house">
          <span ref={clockRef}>07:00</span>
          <small>{skies ? 'Local sun' : 'Sky loading…'}</small>
        </div>
      </header>

      <section className="intro" aria-label="Introduction">
        <p className="eyebrow">Ground plan · Six rooms · One day</p>
        <h1>Follow the <em>sun</em> through a house.</h1>
        <p className="lede">Scroll. The plan stands up, the walls close around you, and one day passes from dawn to dusk.</p>
      </section>

      <div className="labels" aria-hidden="true">
        {rooms.map((r, i) => (
          <div key={r.id} className="label" ref={(el) => { labelRefs.current[i] = el; }}>
            <b>{r.no}</b>
            <span>{r.name}</span>
            <i>{size(r)} · {area(r)} m²</i>
          </div>
        ))}
        {dimensions.map((d, i) => (
          <div key={d.text} className="label label--dim" ref={(el) => { labelRefs.current[rooms.length + i] = el; }}>
            <i>{d.text}</i>
          </div>
        ))}
        {sunMarks.map((m, i) => (
          <div key={m.hour} className="label label--sun" ref={(el) => { labelRefs.current[rooms.length + dimensions.length + i] = el; }}>
            <i>{m.text}</i>
          </div>
        ))}
      </div>

      <aside className="titleblock" aria-label="Plan sheet">
        <svg viewBox="0 0 40 40"><circle cx="20" cy="22" r="13" fill="none" stroke="currentColor" strokeWidth="1.2" /><path d="M20 6 L25 24 L20 21 L15 24 Z" fill="currentColor" /><text x="20" y="38" textAnchor="middle" fontSize="7" fill="currentColor">N</text></svg>
        <dl>
          <div><dt>Sheet</dt><dd>Solstice House</dd></div>
          <div><dt>Drawing</dt><dd>Ground floor plan</dd></div>
          <div><dt>Scale</dt><dd>1 : 100</dd></div>
          <div><dt>Area</dt><dd>{TOTAL_AREA} m²</dd></div>
        </dl>
        <div className="scalebar">
          <span><i /><i /><i /></span>
          <span className="scalebar__nums" aria-hidden="true"><b>0</b><b>1</b><b>2</b><b>5 m</b></span>
        </div>
        <button type="button" className="titleblock__download" onClick={downloadPlan}>Download plan · 1:100 SVG</button>
      </aside>

      <aside className={`caption${room ? ' is-on' : ''}`} aria-live="polite">
        {room && (
          <div key={room.id} className="caption__in">
            <p className="caption__no"><span className="caption__num">{room.no}</span>/ 06 · {size(room)} · {room.outdoor ? 'Outdoors' : 'Indoors'}</p>
            <h2>{room.name}</h2>
            <p>{room.line}</p>
            <div className="caption__foot">
              <span className="caption__links">
                <button type="button" className="caption__more" aria-expanded={fileOpen} onClick={toggleFile}>
                  {fileOpen ? 'Close room file −' : 'Open room file +'}
                </button>
                <button type="button" className="caption__more" onClick={share} aria-live="polite">{shared ? 'Link copied' : 'Share'}</button>
              </span>
              <span className="caption__step">
                <button type="button" aria-label="Previous room" onClick={() => go(-1)}>←</button>
                <button type="button" aria-label="Next room" disabled={roomIndex >= rooms.length - 1} onClick={() => go(1)}>→</button>
              </span>
            </div>
          </div>
        )}
      </aside>

      <aside className={`file${room && fileOpen && !finale ? ' is-on' : ''}`} aria-hidden={!(room && fileOpen && !finale)}>
        {room && facts && (
          <>
            <p className="eyebrow">Room file · {room.no}</p>
            <h3>{room.name}</h3>
            <dl>
              <div><dt>Size</dt><dd>{size(room)}</dd></div>
              <div><dt>Area</dt><dd>{area(room)} m²</dd></div>
              <div><dt>Opens to</dt><dd>{facts.faces}</dd></div>
              <div><dt>Direct sun</dt><dd>{sun ? <>{sun[roomIndex].hours.toFixed(1)} hours a day<SunStrip slots={sun[roomIndex].slots} /></> : 'Measuring…'}</dd></div>
              <div><dt>Materials</dt><dd>{facts.materials.join(' · ')}</dd></div>
            </dl>
          </>
        )}
      </aside>

      <div className={`sunbar${room ? ' is-on' : ''}`}>
        <label htmlFor="sun-hour">Sun</label>
        <input
          id="sun-hour" ref={sliderRef} type="range" min={7} max={19.5} step={0.05} defaultValue={7}
          onInput={(e) => { setManual(true); setHour(Number(e.currentTarget.value)); }}
        />
        <button type="button" className={manual ? 'is-on' : ''} onClick={() => { setManual(false); setHour(null); }}>Follow the walk</button>
      </div>

      <nav className="rail" aria-label="Rooms">
        {[null, ...rooms].map((r, i) => (
          <button key={r?.id ?? 'plan'} type="button" className={roomIndex + 1 === i ? 'is-active' : ''} onClick={() => jumpTo(roomProgress(i - 1))}>
            <span>{r ? r.name : 'Plan'}</span>
            <i />
          </button>
        ))}
      </nav>

      <div className={`hint${roomIndex === -1 && ready ? ' is-on' : ''}`}>
        <span>Scroll to enter</span>
        <i />
      </div>

      <section className={`finale${finale ? ' is-on' : ''}`} aria-hidden={!finale} inert={!finale}>
        <p className="eyebrow">Solstice House</p>
        <h2>A study in <em>daylight</em>.</h2>
        <p>Six rooms, one route, and twelve and a half hours of sun. Step back into any room.</p>
        <ol className="index" aria-label="Rooms">
          {rooms.map((r, i) => (
            <li key={r.id}>
              <button type="button" onClick={() => jumpTo(roomProgress(i))}>
                <PlanMark active={i} />
                <span className="index__name"><b>{r.no}</b>{r.name}</span>
                <span className="index__meta">{size(r)}{sun ? ` · ${sun[i].hours.toFixed(1)} h sun` : ''}</span>
                {sun && <SunStrip slots={sun[i].slots} />}
              </button>
            </li>
          ))}
        </ol>
        <div className="finale__cta">
          <button type="button" className="btn btn--solid" onClick={() => jumpTo(0)}>Walk again</button>
          <button type="button" className="btn" onClick={() => jumpTo(roomProgress(0))}>Return to the gate</button>
          <button type="button" className="btn" onClick={downloadPlan}>Download plan</button>
        </div>
        <p className="credit">The walls and plan are drawn in code. Skies, materials and furniture models: <a href="https://polyhaven.com" target="_blank" rel="noreferrer">Poly Haven</a> (CC0).</p>
      </section>

      {error && (
        <div className="fallback" role="alert">
          <p className="eyebrow">Solstice House</p>
          <h2>Follow the sun through a house.</h2>
          <p>{error}</p>
          <video controls playsInline preload="metadata" poster={`${import.meta.env.BASE_URL}media/still.jpg`}>
            <source src={`${import.meta.env.BASE_URL}media/walkthrough.mp4`} type="video/mp4" />
          </video>
          <button type="button" className="btn" onClick={() => location.reload()}>Try again</button>
        </div>
      )}

      <div className={`loader${ready || error ? ' is-done' : ''}`} aria-live="polite">
        <SunMark />
        <p>Raising the walls…</p>
        <i><b /></i>
      </div>

      <div className="track" id="top" />
    </div>
  );
}
