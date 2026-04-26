import { useState, useEffect, useRef } from "react";

/* ── DATA ── */
const SESSION_MODES = [
  { key: "full", label: "Full", total: 80, desc: "Deep exploration", icon: "spa", times: [5, 15, 20, 10, 20, 10] },
  { key: "standard", label: "Standard", total: 60, desc: "Complete session", icon: "balance", times: [3, 12, 15, 8, 15, 7] },
  { key: "focused", label: "Focused", total: 45, desc: "Leaner pacing", icon: "center_focus_strong", times: [3, 10, 12, 7, 8, 5] },
  { key: "express", label: "Express", total: 30, desc: "Refresh your skills", icon: "bolt", times: [2, 7, 8, 5, 5, 3] },
];

const STAGES = [
  { id: 1, name: "Arrive", tagline: "Settle in and get comfortable", icon: "self_improvement",
    what: ["Share an image or describe a place that makes you feel good", "Take a moment to breathe and arrive", "Choose which parts of the session matter most to you"] },
  { id: 2, name: "Tell your story", tagline: "Describe a teaching moment that stayed with you", icon: "history_edu",
    what: ["What happened? — describe the moment itself", "What do you notice now? — look at it from other angles", "What sense do you make of it? — find the meaning", "What would you do differently? — plan a next step"] },
  { id: 3, name: "Learn the cycle", tagline: "Understand Kolb's four phases using your own story", icon: "autorenew",
    what: ["Match descriptions of each phase to your earlier answers", "Try out questions that deepen different parts of a reflection", "Learn two ways we engage with experience: taking it in and working on it", "Connect those ideas back to your own critical incident"] },
  { id: 4, name: "Notice how you think", tagline: "Discover your learning style preferences", icon: "psychology",
    what: ["Notice how the kind of thinking you did changed across the lesson", "Learn four learning styles that sit between the phases", "Match short examples to the right style — and explain why"] },
  { id: 5, name: "Go deeper", tagline: "Revisit and strengthen your earlier responses", icon: "layers",
    what: ["Look at what you originally wrote for each phase", "Notice what feels thin or underdeveloped now that you know more", "Add, sharpen, or rethink — you're in charge of the writing", "Optionally check how well your four responses connect as a whole"] },
  { id: 6, name: "Wrap up", tagline: "Reflect on the session and connect with colleagues", icon: "handshake",
    what: ["Answer four quick questions about the lesson experience itself", "Leave feedback on the session", "Optionally share your work with colleagues on Slack"],
    endpoints: [{ label: "Session feedback", icon: "assignment", desc: "Google Forms" }, { label: "Share with colleagues", icon: "forum", desc: "Slack channel" }] },
];

const DEEP = [
  { key: "describe", label: "Describe", sub: "What happened?", icon: "visibility", kolb: "Concrete Experience",
    desc: "Stay close to the event. Walk through what happened, what you noticed, what you felt, what stood out.", color: "#6557B2" },
  { key: "explore", label: "Explore", sub: "What do you notice now?", icon: "explore", kolb: "Reflective Observation",
    desc: "Step back and look from different angles. Notice tensions, assumptions, patterns, and alternative viewpoints.", color: "#5B8DB8" },
  { key: "evaluate", label: "Evaluate", sub: "What does it mean?", icon: "lightbulb", kolb: "Abstract Conceptualisation",
    desc: "Make sense of the experience. Identify what matters, what it reveals about your practice, and why.", color: "#8FA68E" },
  { key: "plan", label: "Plan", sub: "What will you do next?", icon: "rocket_launch", kolb: "Active Experimentation",
    desc: "Turn your insight into a realistic next step — a small, testable change you can try.", color: "#D4806A" },
];

/* ── NATURE SVGS ── */
const Lotus = ({ x, y, size, rot }: { x: string, y: string, size: number, rot: number }) => (
  <svg style={{ position: "absolute", left: x, top: y, width: size, height: size, transform: `rotate(${rot}deg)`, opacity: 0.45 }} viewBox="0 0 80 80" fill="none">
    <circle cx="40" cy="40" r="36" fill="#8FA68E" opacity="0.3" />
    <circle cx="40" cy="40" r="28" fill="#8FA68E" opacity="0.2" />
    {[0,45,90,135,180,225,270,315].map((a,i) => <ellipse key={i} cx="40" cy="24" rx="5" ry="12" fill="#F0EDE5" opacity="0.8" transform={`rotate(${a} 40 40)`}/>)}
    <circle cx="40" cy="40" r="5" fill="#D4C98A" opacity="0.6" />
  </svg>
);
const LilyPad = ({ x, y, size, rot }: { x: string, y: string, size: number, rot: number }) => (
  <svg style={{ position: "absolute", left: x, top: y, width: size, height: size, transform: `rotate(${rot}deg)`, opacity: 0.3 }} viewBox="0 0 80 80" fill="none">
    <path d="M40 4 A36 36 0 1 1 36 4 L40 40 Z" fill="#8FA68E" opacity="0.45" />
    <path d="M40 40 L40 8" stroke="#7A937A" strokeWidth="0.8" opacity="0.3" />
  </svg>
);

/* ── CYCLE DIAGRAM ── */
const CycleDiagram = ({ activePhase, setActivePhase, compact }: { activePhase: number | null, setActivePhase: (phase: number | null) => void, compact: boolean }) => {
  const w = compact ? 300 : 420, h = compact ? 300 : 420;
  const cx = w / 2, cy = h / 2, R = compact ? 90 : 130;
  const angles = [-Math.PI/2, 0, Math.PI/2, Math.PI];
  const pos = angles.map(a => ({ x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) }));
  const nodeR = compact ? 22 : 28;

  const arc = (i: number) => {
    const j = (i + 1) % 4;
    const a1 = angles[i], a2 = angles[j];
    const inset = compact ? 0.35 : 0.28;
    const startA = a1 + inset;
    const endA = a2 - inset;
    const steps = 20;
    let d = "";
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const a = startA + t * (endA - startA + (endA < startA ? Math.PI * 2 : 0));
      const px = cx + R * Math.cos(a);
      const py = cy + R * Math.sin(a);
      d += s === 0 ? `M ${px},${py}` : ` L ${px},${py}`;
    }
    return d;
  };

  const labelFontSize = compact ? 12 : 14;
  const subFontSize = compact ? 8 : 10;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", maxWidth: w, height: "auto", display: "block" }}>
      <defs>
        {DEEP.map((p,i) => (
          <marker key={i} id={`ah${i}`} markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <path d="M0,0 L8,3 L0,6 L1.5,3Z" fill={p.color} opacity="0.7" />
          </marker>
        ))}
        {DEEP.map((p,i) => (
          <radialGradient key={`glow${i}`} id={`glow${i}`}>
            <stop offset="0%" stopColor={p.color} stopOpacity="0.2"/>
            <stop offset="100%" stopColor={p.color} stopOpacity="0"/>
          </radialGradient>
        ))}
      </defs>

      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#D4CEBC" strokeWidth="1" strokeDasharray="3 6" opacity="0.3" />

      {[0,1,2,3].map(i => (
        <path key={i} d={arc(i)} fill="none" stroke={DEEP[i].color}
          strokeWidth={activePhase === i ? 2.5 : 1.5}
          strokeLinecap="round" markerEnd={`url(#ah${i})`}
          opacity={activePhase === null ? 0.4 : activePhase === i ? 0.8 : 0.1}
          style={{ transition: "all 0.4s ease" }} />
      ))}

      <text x={cx} y={cy - 4} textAnchor="middle" fontSize={compact ? 10 : 12} fontFamily="'Cormorant Garamond',serif" fontStyle="italic" fill="#A8A29A" opacity="0.7">reflective</text>
      <text x={cx} y={cy + (compact ? 8 : 10)} textAnchor="middle" fontSize={compact ? 10 : 12} fontFamily="'Cormorant Garamond',serif" fontStyle="italic" fill="#A8A29A" opacity="0.7">cycle</text>

      {DEEP.map((p, i) => {
        const { x, y } = pos[i];
        const isActive = activePhase === i;
        const off = compact ? nodeR + 10 : nodeR + 14;
        const labelPos = [
          { tx: x, ty: y - off - 6, anchor: "middle" as const, subTy: y - off + 6 },
          { tx: x + off, ty: y - 3, anchor: "start" as const, subTy: y + 11 },
          { tx: x, ty: y + off + 2, anchor: "middle" as const, subTy: y + off + 14 },
          { tx: x - off, ty: y - 3, anchor: "end" as const, subTy: y + 11 },
        ][i];
        return (
          <g key={p.key} style={{ cursor: "pointer" }}
            onClick={() => setActivePhase(activePhase === i ? null : i)}>
            {isActive && <circle cx={x} cy={y} r={nodeR + 14} fill={`url(#glow${i})`} style={{ transition: "all 0.4s" }} />}
            <circle cx={x} cy={y} r={nodeR} fill="white" stroke={p.color}
              strokeWidth={isActive ? 2.5 : 1.5} style={{ transition: "all 0.35s" }} />
            <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle"
              fill={p.color} fontSize={compact ? 12 : 15} fontWeight="700"
              fontFamily="'Cormorant Garamond',serif">{p.label[0]}</text>
            <text x={labelPos.tx} y={labelPos.ty} textAnchor={labelPos.anchor}
              fill={isActive ? p.color : "#2D2B26"} fontSize={labelFontSize} fontWeight="700"
              fontFamily="'Cormorant Garamond',serif"
              style={{ transition: "fill 0.3s" }}>{p.label}</text>
            {!compact && <text x={labelPos.tx} y={labelPos.subTy} textAnchor={labelPos.anchor}
              fill="#A8A29A" fontSize={subFontSize} fontFamily="'Nunito Sans',sans-serif">{p.sub}</text>}
          </g>
        );
      })}
    </svg>
  );
};

/* ── MAIN ── */
interface LearningJourneyProps {
  onComplete: () => void;
}

export default function LearningJourney({ onComplete }: LearningJourneyProps) {
  const [view, setView] = useState("journey");
  const [selected, setSelected] = useState<number | null>(null);
  const [modeIdx, setModeIdx] = useState(0);
  const [activePhase, setActivePhase] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => setReady(true), 100);
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (selected !== null && isMobile && detailRef.current) {
      setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    }
  }, [selected, isMobile]);

  const mode = SESSION_MODES[modeIdx];
  const active = selected !== null ? STAGES[selected] : null;
  const activeTime = selected !== null ? mode.times[selected] : null;

  return (
    <div className={`root ${ready ? "ready" : ""}`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Nunito+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,300,0,0&display=swap');

        .root {
          --bg: #EDEBE4;
          --bg-warm: #F5F3ED;
          --card-bg: rgba(255,255,255,0.82);
          --card-bg-solid: #FFFFFF;
          --glass: rgba(255,255,255,0.55);
          --glass-border: rgba(255,255,255,0.45);
          --card-shadow: 0 2px 24px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.025);
          --card-shadow-hover: 0 8px 40px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.03);
          --card-shadow-active: 0 4px 28px rgba(101,87,178,0.14), 0 0 0 1.5px rgba(101,87,178,0.22);
          --sage: #8FA68E; --sage-soft: rgba(143,166,142,0.10); --sage-mid: rgba(143,166,142,0.22);
          --indigo: #6557B2; --indigo-soft: rgba(101,87,178,0.07); --indigo-mid: rgba(101,87,178,0.14);
          --terracotta: #D4806A;
          --text-dark: #2D2B26; --text: #4A4740; --text-mid: #7A756A; --text-soft: #A8A29A;
          --border: rgba(0,0,0,0.05);
          font-family: 'Nunito Sans', sans-serif; font-weight: 400; color: var(--text);
          background: var(--bg);
          background-image: radial-gradient(ellipse at 20% 0%, rgba(143,166,142,0.08) 0%, transparent 60%),
                            radial-gradient(ellipse at 80% 100%, rgba(101,87,178,0.06) 0%, transparent 50%);
          width: 100%; height: 100vh; overflow: hidden;
          display: flex; flex-direction: column;
          -webkit-font-smoothing: antialiased; position: relative;
        }
        .root * { box-sizing: border-box; margin: 0; padding: 0; }
        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined'; font-weight: 300; font-style: normal;
          font-size: 24px; line-height: 1; letter-spacing: normal; text-transform: none;
          display: inline-block; white-space: nowrap; direction: ltr;
          -webkit-font-smoothing: antialiased; font-feature-settings: 'liga';
        }

        /* ── ANIMATIONS ── */
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.93) } to { opacity: 1; transform: scale(1) } }
        @keyframes slideReveal { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes itemIn { from { opacity: 0; transform: translateX(-8px) } to { opacity: 1; transform: translateX(0) } }
        @keyframes floatSlow { 0%,100% { transform: translateY(0) rotate(var(--fr,0deg)) } 50% { transform: translateY(-10px) rotate(var(--fr,0deg)) } }
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }
        @keyframes pulseGlow { 0%,100% { opacity: 0.4 } 50% { opacity: 0.7 } }

        /* ── GRAIN OVERLAY ── */
        .root::before {
          content: ''; position: fixed; inset: 0; z-index: 1; pointer-events: none;
          opacity: 0.025;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 180px;
        }

        .nature-layer { position: absolute; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
        .float-el { animation: floatSlow 10s ease-in-out infinite; }

        /* ── HEADER ── */
        .header {
          position: relative; z-index: 3;
          display: flex; align-items: flex-end; justify-content: space-between;
          padding: 28px 40px 18px; opacity: 0;
        }
        .ready .header { animation: fadeUp 0.6s ease-out 0.1s forwards; }
        .brand-name {
          font-family: 'Cormorant Garamond', serif; font-weight: 700; font-size: 32px;
          color: var(--text-dark); letter-spacing: -0.02em;
        }
        .brand-accent { color: var(--indigo); }
        .header-meta { text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
        .header-title {
          font-family: 'Cormorant Garamond', serif; font-weight: 500; font-style: italic;
          font-size: 15px; color: var(--text-mid);
        }
        .header-pill {
          display: inline-flex; align-items: center; gap: 7px;
          font-size: 11px; font-weight: 600; color: var(--text-mid);
          background: var(--glass); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
          border: 1px solid var(--glass-border);
          padding: 6px 16px; border-radius: 100px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04); transition: all 0.3s;
        }
        .header-pill .material-symbols-outlined { font-size: 14px; color: var(--sage); }
        .divider {
          position: relative; z-index: 3; height: 1px; margin: 0 40px;
          background: linear-gradient(to right, transparent, var(--border), transparent);
        }

        /* ── VIEW TOGGLE ── */
        .view-toggle-row {
          position: relative; z-index: 3;
          display: flex; align-items: center; gap: 4px; padding: 16px 40px 0; opacity: 0;
        }
        .ready .view-toggle-row { animation: fadeUp 0.5s ease-out 0.12s forwards; }
        .view-tab {
          display: flex; align-items: center; gap: 6px;
          padding: 9px 22px; background: transparent;
          border: 1.5px solid transparent; border-radius: 100px;
          cursor: pointer; font-family: 'Nunito Sans', sans-serif;
          font-size: 13px; font-weight: 600; color: var(--text-soft);
          transition: all 0.3s ease;
        }
        .view-tab:hover { color: var(--text-mid); background: rgba(0,0,0,0.02); }
        .view-tab.active {
          color: var(--indigo); background: var(--card-bg);
          backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
          border-color: rgba(101,87,178,0.25);
          box-shadow: 0 2px 16px rgba(101,87,178,0.1);
        }
        .view-tab .material-symbols-outlined { font-size: 16px; }
        .view-tab.active .material-symbols-outlined { color: var(--indigo); }

        /* ── SESSION SELECTOR ── */
        .session-selector {
          position: relative; z-index: 3;
          display: flex; align-items: center; gap: 6px;
          padding: 14px 40px 0; opacity: 0;
          flex-wrap: wrap;
        }
        .ready .session-selector { animation: fadeUp 0.5s ease-out 0.15s forwards; }
        .session-label {
          font-size: 10px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 2px; color: var(--text-soft); margin-right: 6px; flex-shrink: 0;
        }
        .mode-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 7px 14px;
          background: var(--glass); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          border: 1.5px solid var(--glass-border); border-radius: 100px;
          cursor: pointer; transition: all 0.3s ease;
          font-family: 'Nunito Sans', sans-serif; font-size: 12px; font-weight: 600;
          color: var(--text-mid);
        }
        .mode-btn:hover { box-shadow: 0 3px 16px rgba(0,0,0,0.07); color: var(--text-dark); }
        .mode-btn.active {
          border-color: rgba(101,87,178,0.3); color: var(--indigo);
          background: rgba(101,87,178,0.06);
          box-shadow: 0 2px 16px rgba(101,87,178,0.12);
        }
        .mode-btn .material-symbols-outlined { font-size: 16px; transition: color 0.25s; }
        .mode-btn.active .material-symbols-outlined { color: var(--indigo); }
        .mode-total { font-size: 11px; font-weight: 400; color: var(--text-soft); margin-left: -2px; }
        .mode-btn.active .mode-total { color: var(--indigo); opacity: 0.7; }
        .mode-desc {
          font-family: 'Cormorant Garamond', serif; font-style: italic;
          font-size: 13px; color: var(--text-soft); margin-left: auto; flex-shrink: 0;
        }

        /* ── MAIN ── */
        .main { position: relative; z-index: 2; flex: 1; display: flex; flex-direction: column; min-height: 0; }

        /* ── STAGE CARDS ── */
        .cards-row {
          display: flex; align-items: stretch; gap: 10px;
          padding: 14px 40px 0; flex-shrink: 0;
        }
        .stage-card {
          flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px;
          padding: 18px 10px 14px;
          background: var(--card-bg); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
          border: 1.5px solid var(--glass-border); border-radius: 18px;
          cursor: pointer; transition: all 0.35s ease; position: relative;
          opacity: 0; box-shadow: var(--card-shadow);
        }
        .ready .stage-card { animation: scaleIn 0.45s ease-out calc(0.3s + var(--ci) * 0.07s) forwards; }
        .stage-card:hover { transform: translateY(-4px); box-shadow: var(--card-shadow-hover); }
        .stage-card.active {
          border-color: rgba(101,87,178,0.3); box-shadow: var(--card-shadow-active);
          background: rgba(255,255,255,0.92);
        }
        .card-icon-wrap {
          width: 46px; height: 46px; border-radius: 50%;
          background: var(--sage-soft);
          display: flex; align-items: center; justify-content: center;
          transition: all 0.35s ease;
        }
        .card-icon-wrap .material-symbols-outlined { font-size: 20px; color: var(--sage); transition: all 0.35s; }
        .stage-card:hover .card-icon-wrap { background: var(--sage-mid); }
        .stage-card.active .card-icon-wrap { background: var(--indigo-mid); }
        .stage-card.active .card-icon-wrap .material-symbols-outlined { color: var(--indigo); }
        .card-text { text-align: center; }
        .card-stage-num {
          font-size: 9px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 2px; color: var(--text-soft); display: block; margin-bottom: 3px;
        }
        .card-name {
          font-family: 'Cormorant Garamond', serif; font-weight: 700; font-size: 15px;
          color: var(--text-dark); line-height: 1.25; transition: color 0.3s;
        }
        .stage-card.active .card-name { color: var(--indigo); }
        .card-time-bar { width: 100%; padding: 0 6px; display: flex; align-items: center; gap: 6px; }
        .time-bar-track { flex: 1; height: 4px; background: rgba(0,0,0,0.04); border-radius: 2px; overflow: hidden; }
        .time-bar-fill {
          height: 100%; border-radius: 2px; background: var(--sage);
          transform-origin: left; transition: width 0.6s cubic-bezier(0.4,0,0.2,1);
        }
        .stage-card.active .time-bar-fill { background: var(--indigo); }
        .card-time-label {
          font-size: 10px; font-weight: 600; color: var(--text-soft);
          min-width: 28px; text-align: right; transition: color 0.3s;
        }
        .stage-card.active .card-time-label { color: var(--indigo); }

        /* connector line */
        .connector-line { position: relative; z-index: 2; height: 20px; margin: 0 40px; display: flex; align-items: center; }
        .connector-svg { width: 100%; height: 100%; opacity: 0; }
        .ready .connector-svg { animation: fadeUp 0.5s ease-out 0.8s forwards; }

        /* ── DETAIL PANEL ── */
        .detail-area { flex: 1; min-height: 0; padding: 0 40px; overflow: hidden; }
        .detail-placeholder { height: 100%; display: flex; align-items: center; justify-content: center; opacity: 0; }
        .ready .detail-placeholder { animation: fadeUp 0.5s ease-out 1s forwards; }
        .placeholder-text {
          font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: 16px;
          color: var(--text-soft); display: flex; align-items: center; gap: 8px;
        }
        .placeholder-text .material-symbols-outlined { font-size: 18px; color: var(--text-soft); }
        .detail-panel { height: 100%; display: flex; gap: 0; padding: 12px 0; animation: slideReveal 0.35s ease-out forwards; }
        .detail-card {
          background: var(--card-bg); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
          border: 1px solid var(--glass-border);
          border-radius: 22px; box-shadow: var(--card-shadow); display: flex; width: 100%; overflow: hidden;
        }
        .detail-left {
          width: 280px; min-width: 280px; display: flex; flex-direction: column; justify-content: center;
          padding: 36px;
          background: linear-gradient(145deg, rgba(143,166,142,0.06) 0%, rgba(101,87,178,0.04) 100%);
        }
        .d-stage-label {
          font-size: 10px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 2.5px; color: var(--indigo); margin-bottom: 10px;
        }
        .d-title {
          font-family: 'Cormorant Garamond', serif; font-weight: 700; font-size: 34px;
          color: var(--text-dark); line-height: 1.1; margin-bottom: 12px; letter-spacing: -0.01em;
        }
        .d-tagline { font-size: 14px; color: var(--text-mid); line-height: 1.65; margin-bottom: 20px; }
        .d-time {
          display: inline-flex; align-items: center; gap: 7px;
          font-size: 12px; font-weight: 600; color: var(--text-mid);
          background: var(--glass); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          border: 1px solid var(--glass-border);
          padding: 7px 16px; border-radius: 100px; box-shadow: 0 1px 4px rgba(0,0,0,0.04);
        }
        .d-time .material-symbols-outlined { font-size: 16px; color: var(--sage); }
        .detail-right {
          flex: 1; min-width: 0; border-left: 1px solid var(--border);
          padding: 36px; display: flex; flex-direction: column; justify-content: center;
        }
        .dr-heading {
          font-size: 10px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 2px; color: var(--text-soft); margin-bottom: 18px;
        }
        .what-list { list-style: none; counter-reset: step; }
        .what-item {
          counter-increment: step; position: relative;
          padding: 9px 0 9px 42px; font-size: 14px; color: var(--text); line-height: 1.6;
          opacity: 0; animation: itemIn 0.3s ease-out calc(0.1s + var(--wi) * 0.07s) forwards;
        }
        .what-item::before {
          content: counter(step); position: absolute; left: 0; top: 10px;
          width: 28px; height: 28px; border-radius: 50%;
          background: var(--indigo-soft); color: var(--indigo);
          font-size: 11px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
        }
        .endpoints-row { display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap; }
        .endpoint-chip {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 18px; background: var(--sage-soft);
          border: 1px solid var(--sage-mid); border-radius: 14px;
          transition: all 0.25s ease;
        }
        .endpoint-chip:hover { background: var(--sage-mid); transform: translateY(-1px); }
        .endpoint-chip .material-symbols-outlined { font-size: 20px; color: var(--sage); }
        .ep-label { font-size: 13px; font-weight: 600; color: var(--text-dark); display: block; line-height: 1.2; }
        .ep-desc { font-size: 11px; color: var(--text-mid); display: block; }

        /* ═══ CYCLE VIEW ═══ */
        .cycle-view {
          flex: 1; min-height: 0; display: flex; flex-direction: column;
          align-items: center; padding: 16px 40px 24px;
          animation: fadeIn 0.4s ease-out forwards; overflow: auto;
        }
        .pacing-strip {
          display: flex; align-items: center; gap: 20px;
          padding: 12px 28px; background: var(--glass);
          backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
          border: 1px solid var(--glass-border);
          border-radius: 100px; box-shadow: var(--card-shadow);
          margin-bottom: 20px; flex-shrink: 0;
        }
        .pacing-item { display: flex; align-items: center; gap: 7px; font-size: 12px; color: var(--text-mid); }
        .pacing-item .material-symbols-outlined { font-size: 16px; color: var(--sage); }
        .pacing-item strong { font-weight: 700; color: var(--text-dark); }
        .pacing-sep { width: 1px; height: 20px; background: var(--border); }
        .cycle-content {
          display: flex; align-items: center; gap: 0;
          width: 100%; max-width: 960px; flex: 1; min-height: 0;
        }
        .cycle-diagram-wrap { flex: 0 0 420px; display: flex; align-items: center; justify-content: center; }
        .cycle-detail-wrap { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; padding-left: 12px; }
        .phase-cards-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .phase-card {
          background: var(--card-bg); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
          border: 1px solid var(--glass-border);
          border-radius: 16px; padding: 18px 20px;
          box-shadow: var(--card-shadow); cursor: pointer;
          transition: all 0.3s ease; border: 1.5px solid transparent;
        }
        .phase-card:hover { box-shadow: var(--card-shadow-hover); transform: translateY(-2px); }
        .phase-card.sel { border-color: var(--sel-color); box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
        .phase-card-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .phase-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .phase-card-label {
          font-family: 'Cormorant Garamond', serif; font-weight: 700; font-size: 16px;
          color: var(--text-dark); transition: color 0.3s;
        }
        .phase-card.sel .phase-card-label { color: var(--sel-color); }
        .phase-card-kolb { font-size: 10px; color: var(--text-soft); font-style: italic; margin-left: auto; }
        .phase-card-sub { font-size: 11px; font-weight: 600; color: var(--text-mid); margin-bottom: 4px; }
        .phase-card-desc { font-size: 12px; color: var(--text-mid); line-height: 1.55; }

        /* ── FOOTER ── */
        .footer {
          position: relative; z-index: 3;
          padding: 14px 40px 22px; display: flex; align-items: center;
          justify-content: space-between; opacity: 0; flex-shrink: 0;
        }
        .ready .footer { animation: fadeUp 0.5s ease-out 1.1s forwards; }
        .footer-outcome {
          font-family: 'Cormorant Garamond', serif; font-style: italic;
          font-size: 14px; color: var(--text-soft); max-width: 600px;
        }
        .footer-outcome strong { font-style: normal; font-weight: 600; color: var(--text-mid); }
        .footer-right { display: flex; align-items: center; gap: 16px; font-size: 11px; color: var(--text-soft); letter-spacing: 0.5px; }

        .start-session-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 24px;
          background: var(--sage);
          color: #fff;
          font-family: 'Nunito Sans', sans-serif;
          font-size: 15px;
          font-weight: 700;
          border-radius: 100px;
          border: none;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 12px rgba(143,166,142,0.3);
        }
        .start-session-btn:hover {
          background: #7A937A;
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(143,166,142,0.4);
        }
        .start-session-btn .material-symbols-outlined {
          font-size: 20px;
        }

        /* ═══════════════════════════════════════════
           MOBILE — the full responsive layer
           ═══════════════════════════════════════════ */
        @media (max-width: 767px) {
          .root { overflow-y: auto; height: auto; min-height: 100vh; }

          .nature-layer { position: absolute; }

          /* header */
          .header {
            flex-direction: column; align-items: flex-start; gap: 10px;
            padding: 20px 20px 14px;
          }
          .brand-name { font-size: 26px; }
          .header-meta { text-align: left; align-items: flex-start; }
          .header-title { font-size: 13px; }
          .header-pill { font-size: 10px; padding: 5px 12px; }
          .divider { margin: 0 20px; }

          /* view toggle */
          .view-toggle-row { padding: 12px 20px 0; gap: 4px; }
          .view-tab { padding: 8px 14px; font-size: 12px; }

          /* session selector */
          .session-selector {
            padding: 10px 20px 0; gap: 6px;
            overflow-x: auto; flex-wrap: nowrap;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
          }
          .session-selector::-webkit-scrollbar { display: none; }
          .mode-btn { flex-shrink: 0; padding: 6px 12px; font-size: 11px; }
          .mode-desc { display: none; }

          /* cards — horizontal scroll */
          .cards-row {
            padding: 12px 20px 0; gap: 8px;
            overflow-x: auto; flex-wrap: nowrap;
            -webkit-overflow-scrolling: touch;
            scroll-snap-type: x mandatory;
            scrollbar-width: none;
          }
          .cards-row::-webkit-scrollbar { display: none; }
          .stage-card {
            flex: 0 0 130px; min-width: 130px;
            padding: 14px 10px 12px; border-radius: 16px;
            scroll-snap-align: start;
          }
          .card-icon-wrap { width: 40px; height: 40px; }
          .card-icon-wrap .material-symbols-outlined { font-size: 18px; }
          .card-name { font-size: 13px; }
          .card-stage-num { font-size: 8px; letter-spacing: 1.5px; }

          /* connector hidden on mobile */
          .connector-line { display: none; }

          /* detail panel — stacks vertically */
          .detail-area { padding: 0 20px; overflow: visible; flex: none; min-height: auto; }
          .detail-panel { height: auto; padding: 10px 0 16px; }
          .detail-card { flex-direction: column; border-radius: 20px; }
          .detail-left {
            width: 100%; min-width: auto; padding: 24px 24px 20px;
            border-radius: 20px 20px 0 0;
          }
          .d-title { font-size: 28px; }
          .d-tagline { font-size: 13px; margin-bottom: 14px; }
          .detail-right {
            border-left: none; border-top: 1px solid var(--border);
            padding: 24px;
          }
          .what-item { font-size: 13px; padding-left: 38px; }
          .what-item::before { width: 26px; height: 26px; font-size: 10px; }
          .endpoints-row { flex-direction: column; }
          .endpoint-chip { padding: 10px 14px; }

          .detail-placeholder { padding: 24px 0; height: auto; min-height: 60px; }
          .placeholder-text { font-size: 14px; }

          /* cycle view */
          .cycle-view { padding: 14px 20px 24px; }
          .pacing-strip {
            flex-direction: column; border-radius: 18px;
            padding: 16px 20px; gap: 10px; width: 100%;
          }
          .pacing-sep { width: 100%; height: 1px; }
          .pacing-item { font-size: 11px; }

          .cycle-content { flex-direction: column; gap: 16px; }
          .cycle-diagram-wrap { flex: none; width: 100%; max-width: 300px; }
          .cycle-detail-wrap { padding-left: 0; width: 100%; }
          .phase-cards-grid { grid-template-columns: 1fr; gap: 8px; }
          .phase-card { padding: 16px; }
          .phase-card-kolb { display: none; }

          /* footer */
          .footer {
            flex-direction: column; align-items: flex-start; gap: 16px;
            padding: 14px 20px 24px;
          }
          .footer-outcome { font-size: 13px; }
          
          .footer-right {
            width: 100%; justify-content: space-between; flex-direction: row-reverse;
          }
          .start-session-btn {
            font-size: 13px; padding: 8px 20px;
          }
        }

        /* ── Tablet tweaks ── */
        @media (min-width: 768px) and (max-width: 1024px) {
          .header { padding: 24px 28px 16px; }
          .divider { margin: 0 28px; }
          .view-toggle-row { padding: 14px 28px 0; }
          .session-selector { padding: 12px 28px 0; }
          .cards-row { padding: 14px 28px 0; gap: 8px; }
          .connector-line { margin: 0 28px; }
          .detail-area { padding: 0 28px; }
          .detail-left { width: 240px; min-width: 240px; padding: 28px; }
          .detail-right { padding: 28px; }
          .cycle-view { padding: 14px 28px 24px; }
          .cycle-diagram-wrap { flex: 0 0 340px; }
          .footer { padding: 12px 28px 20px; }
          .stage-card { padding: 14px 8px 12px; }
          .card-name { font-size: 13px; }
        }
      `}</style>

      {/* Nature */}
      <div className="nature-layer">
        <div className="float-el" style={{ "--fr": "0deg", animationDelay: "0s" } as any}><Lotus x="-20px" y="-10px" size={isMobile ? 60 : 90} rot={15} /></div>
        <div className="float-el" style={{ "--fr": "5deg", animationDelay: "1.5s" } as any}><Lotus x="42%" y="2%" size={isMobile ? 55 : 80} rot={-10} /></div>
        <div className="float-el" style={{ "--fr": "-3deg", animationDelay: "3s" } as any}><Lotus x="85%" y="65%" size={isMobile ? 50 : 75} rot={20} /></div>
        {!isMobile && <>
          <div className="float-el" style={{ "--fr": "0deg", animationDelay: "2s" } as any}><Lotus x="12%" y="72%" size={70} rot={-25} /></div>
          <div className="float-el" style={{ "--fr": "8deg", animationDelay: "4s" } as any}><LilyPad x="22%" y="30%" size={60} rot={40} /></div>
        </>}
        <div className="float-el" style={{ "--fr": "-5deg", animationDelay: "0.5s" } as any}><LilyPad x="75%" y="12%" size={isMobile ? 35 : 50} rot={-20} /></div>
        <div className="float-el" style={{ "--fr": "3deg", animationDelay: "2.5s" } as any}><LilyPad x="60%" y="80%" size={isMobile ? 40 : 55} rot={60} /></div>
      </div>

      {/* Header */}
      <div className="header">
        <div className="brand-mark">
          <span className="brand-name">Refleksyo<span className="brand-accent">n</span></span>
        </div>
        <div className="header-meta">
          <span className="header-title">Your learning journey — reflective practice with Kolb's cycle</span>
          <span className="header-pill">
            <span className="material-symbols-outlined">schedule</span>
            {view === "journey"
              ? `About ${mode.total} min · one-to-one with your AI facilitator`
              : "Self-paced · one-to-one with your AI facilitator"}
          </span>
        </div>
      </div>
      <div className="divider" />

      {/* View toggle */}
      <div className="view-toggle-row">
        <button className={`view-tab ${view === "journey" ? "active" : ""}`} onClick={() => setView("journey")}>
          <span className="material-symbols-outlined">route</span>
          {isMobile ? "Overview" : "Session overview"}
        </button>
        <button className={`view-tab ${view === "cycle" ? "active" : ""}`} onClick={() => setView("cycle")}>
          <span className="material-symbols-outlined">autorenew</span>
          {isMobile ? "The cycle" : "The reflective cycle"}
        </button>
      </div>

      {/* ═══ JOURNEY VIEW ═══ */}
      {view === "journey" && <>
        <div className="session-selector">
          <span className="session-label">Session</span>
          {SESSION_MODES.map((m, i) => (
            <button key={m.key} className={`mode-btn ${modeIdx === i ? "active" : ""}`} onClick={() => setModeIdx(i)}>
              <span className="material-symbols-outlined">{m.icon}</span>
              {m.label}
              <span className="mode-total">{m.total}m</span>
            </button>
          ))}
          <span className="mode-desc">{mode.desc}</span>
        </div>
        <div className="main">
          <div className="cards-row">
            {STAGES.map((s, i) => {
              const mins = mode.times[i], maxMins = SESSION_MODES[0].times[i], pct = (mins / maxMins) * 100;
              return (
                <div key={s.id} className={`stage-card ${selected === i ? "active" : ""}`}
                  style={{ "--ci": i } as any} onClick={() => setSelected(selected === i ? null : i)}>
                  <div className="card-icon-wrap">
                    <span className="material-symbols-outlined">{s.icon}</span>
                  </div>
                  <div className="card-text">
                    <span className="card-stage-num">Stage {s.id}</span>
                    <div className="card-name">{s.name}</div>
                  </div>
                  <div className="card-time-bar">
                    <div className="time-bar-track">
                      <div className="time-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="card-time-label">{mins}m</span>
                  </div>
                </div>
              );
            })}
          </div>
          {!isMobile && (
            <div className="connector-line">
              <svg className="connector-svg" viewBox="0 0 1000 24" preserveAspectRatio="none">
                <path className="conn-path" d="M 60,12 L 940,12" fill="none" stroke="#A8A29A" strokeWidth="1" strokeDasharray="4 6" opacity="0.4" />
                {[0, 1, 2, 3, 4, 5].map(i => <circle key={i} cx={60 + i * 176} cy={12} r={3} fill="#8FA68E" opacity="0.4" />)}
              </svg>
            </div>
          )}
          <div className="detail-area" ref={detailRef}>
            {active === null ? (
              <div className="detail-placeholder">
                <span className="placeholder-text">
                  <span className="material-symbols-outlined">touch_app</span>
                  {isMobile ? "Tap a stage above" : "Select a stage to see what you'll do"}
                </span>
              </div>
            ) : (
              <div className="detail-panel" key={`${active.id}-${mode.key}`}>
                <div className="detail-card">
                  <div className="detail-left">
                    <div className="d-stage-label">Stage {active.id}</div>
                    <h2 className="d-title">{active.name}</h2>
                    <p className="d-tagline">{active.tagline}</p>
                    <span className="d-time">
                      <span className="material-symbols-outlined">schedule</span>~{activeTime} min
                    </span>
                  </div>
                  <div className="detail-right">
                    <div className="dr-heading">What you'll do</div>
                    <ol className="what-list">
                      {active.what.map((item, j) =>
                        <li key={j} className="what-item" style={{ "--wi": j } as any}>{item}</li>
                      )}
                    </ol>
                    {active.endpoints && (
                      <div className="endpoints-row">
                        {active.endpoints.map((ep, j) => (
                          <div key={j} className="endpoint-chip">
                            <span className="material-symbols-outlined">{ep.icon}</span>
                            <div>
                              <span className="ep-label">{ep.label}</span>
                              <span className="ep-desc">{ep.desc}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </>}

      {/* ═══ CYCLE VIEW ═══ */}
      {view === "cycle" && (
        <div className="cycle-view">
          <div className="pacing-strip">
            <div className="pacing-item">
              <span className="material-symbols-outlined">timer</span>
              <span><strong>~20 min</strong> minimum</span>
            </div>
            <div className="pacing-sep" />
            <div className="pacing-item">
              <span className="material-symbols-outlined">all_inclusive</span>
              <span>No maximum — take the time you need</span>
            </div>
            <div className="pacing-sep" />
            <div className="pacing-item">
              <span className="material-symbols-outlined">swap_horiz</span>
              <span>Say <strong>"next"</strong> when you're ready to move on</span>
            </div>
          </div>

          <div className="cycle-content">
            <div className="cycle-diagram-wrap">
              <CycleDiagram activePhase={activePhase} setActivePhase={setActivePhase} compact={isMobile} />
            </div>
            <div className="cycle-detail-wrap">
              <div className="phase-cards-grid">
                {DEEP.map((p, i) => (
                  <div key={p.key}
                    className={`phase-card ${activePhase === i ? "sel" : ""}`}
                    style={{ "--sel-color": p.color } as any}
                    onClick={() => setActivePhase(activePhase === i ? null : i)}>
                    <div className="phase-card-head">
                      <div className="phase-dot" style={{ background: p.color }} />
                      <span className="phase-card-label">{p.label}</span>
                      <span className="phase-card-kolb">{p.kolb}</span>
                    </div>
                    <div className="phase-card-sub">{p.sub}</div>
                    <div className="phase-card-desc">{p.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="footer">
        <p className="footer-outcome">
          <strong>By the end</strong> you'll be better able to evaluate reflective writing using Kolb's experiential learning cycle
        </p>
        <div className="footer-right">
          Refleksyon
          <button className="start-session-btn" onClick={onComplete}>
            Start Session
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  );
}
