import { useCallback, useEffect, useRef, useState } from 'react';
import { rooms, dimensions, roomFacts, sunMarks } from './house/layout';
import { useHouse } from './ui/useHouse';

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

export default function App() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const labelRefs = useRef<Array<HTMLElement | null>>([]);
  const sliderRef = useRef<HTMLInputElement>(null);
  const { roomIndex, finale, ready, error, jumpTo, roomProgress, setHour, sunHours } = useHouse(canvasRef, rootRef, labelRefs, clockRef, sliderRef);
  const room = roomIndex >= 0 ? rooms[roomIndex] : null;
  const [fileOpen, setFileOpen] = useState(false);
  const [hours, setHours] = useState<number[] | null>(null);
  const [manual, setManual] = useState(false);

  const toggleFile = () => {
    setFileOpen((open) => !open);
    // Usually already measured in idle time after load; otherwise this waits for it.
    if (!hours) void sunHours().then(setHours);
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
    <div className="app" ref={rootRef}>
      <canvas ref={canvasRef} className="stage" aria-hidden="true" />
      <div className="progress" aria-hidden="true" />

      <header className="bar">
        <a className="brand" href="#top" onClick={(e) => { e.preventDefault(); jumpTo(0); }}>
          <SunMark />
          <span>Solstice House</span>
        </a>
        <div className={`clock${room ? ' is-on' : ''}`} aria-label="Time of day in the house">
          <span ref={clockRef}>07:00</span>
          <small>Local sun</small>
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
            <i>{size(r)}</i>
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

      <aside className="titleblock" aria-hidden="true">
        <svg viewBox="0 0 40 40"><circle cx="20" cy="22" r="13" fill="none" stroke="currentColor" strokeWidth="1.2" /><path d="M20 6 L25 24 L20 21 L15 24 Z" fill="currentColor" /><text x="20" y="38" textAnchor="middle" fontSize="7" fill="currentColor">N</text></svg>
        <dl>
          <div><dt>Sheet</dt><dd>Solstice House</dd></div>
          <div><dt>Drawing</dt><dd>Ground floor plan</dd></div>
          <div><dt>Scale</dt><dd>1 : 100</dd></div>
          <div><dt>Area</dt><dd>438 m²</dd></div>
        </dl>
      </aside>

      <aside className={`caption${room ? ' is-on' : ''}`} aria-live="polite">
        {room && (
          <div key={room.id} className="caption__in">
            <p className="caption__no"><span className="caption__num">{room.no}</span>/ 06 · {size(room)} · {room.outdoor ? 'Outdoors' : 'Indoors'}</p>
            <h2>{room.name}</h2>
            <p>{room.line}</p>
            <div className="caption__foot">
              <button type="button" className="caption__more" aria-expanded={fileOpen} onClick={toggleFile}>
                {fileOpen ? 'Close room file −' : 'Open room file +'}
              </button>
              <span className="caption__step">
                <button type="button" aria-label="Previous room" onClick={() => go(-1)}>←</button>
                <button type="button" aria-label="Next room" disabled={roomIndex >= rooms.length - 1} onClick={() => go(1)}>→</button>
              </span>
            </div>
          </div>
        )}
      </aside>

      <aside className={`file${room && fileOpen ? ' is-on' : ''}`} aria-hidden={!(room && fileOpen)}>
        {room && facts && (
          <>
            <p className="eyebrow">Room file · {room.no}</p>
            <h3>{room.name}</h3>
            <dl>
              <div><dt>Size</dt><dd>{size(room)}</dd></div>
              <div><dt>Area</dt><dd>{(room.x1 - room.x0) * (room.z1 - room.z0)} m²</dd></div>
              <div><dt>Opens to</dt><dd>{facts.faces}</dd></div>
              <div><dt>Direct sun</dt><dd>{hours ? `${hours[roomIndex].toFixed(1)} hours a day` : 'Measuring…'}</dd></div>
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

      <section className={`finale${finale ? ' is-on' : ''}`} aria-hidden={!finale}>
        <p className="eyebrow">Solstice House</p>
        <h2>A study in <em>daylight</em>.</h2>
        <p>Six rooms, one route, and twelve and a half hours of sun. The walls and plan are drawn in code; skies, materials and furniture are photographic scans.</p>
        <div className="finale__cta">
          <button type="button" className="btn btn--solid" onClick={() => jumpTo(0)}>Walk again</button>
          <button type="button" className="btn" onClick={() => jumpTo(roomProgress(0))}>Return to the gate</button>
        </div>
        <p className="credit">Skies, materials and furniture models: <a href="https://polyhaven.com" target="_blank" rel="noreferrer">Poly Haven</a> (CC0).</p>
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
