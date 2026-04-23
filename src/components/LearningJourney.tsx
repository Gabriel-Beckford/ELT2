import { useState, useEffect } from "react";

const SESSION_MODES = [
  {
    key: "full",
    label: "Full",
    total: 80,
    desc: "Deep exploration",
    icon: "spa",
    times: [5, 15, 20, 10, 20, 10],
  },
  {
    key: "standard",
    label: "Standard",
    total: 60,
    desc: "Complete session",
    icon: "balance",
    times: [3, 12, 15, 8, 15, 7],
  },
  {
    key: "focused",
    label: "Focused",
    total: 45,
    desc: "Leaner pacing",
    icon: "center_focus_strong",
    times: [3, 10, 12, 7, 8, 5],
  },
  {
    key: "express",
    label: "Express",
    total: 30,
    desc: "Refresh your skills",
    icon: "bolt",
    times: [2, 7, 8, 5, 5, 3],
  },
];

const STAGES = [
  {
    id: 1,
    name: "Arrive",
    tagline: "Settle in and get comfortable",
    icon: "self_improvement",
    what: [
      "Share an image or describe a place that makes you feel good",
      "Take a moment to breathe and arrive",
      "Choose which parts of the session matter most to you",
    ],
  },
  {
    id: 2,
    name: "Tell your story",
    tagline: "Describe a teaching moment that stayed with you",
    icon: "history_edu",
    what: [
      "What happened? — describe the moment itself",
      "What do you notice now? — look at it from other angles",
      "What sense do you make of it? — find the meaning",
      "What would you do differently? — plan a next step",
    ],
  },
  {
    id: 3,
    name: "Learn the cycle",
    tagline: "Understand Kolb's four phases using your own story",
    icon: "autorenew",
    what: [
      "Match descriptions of each phase to your earlier answers",
      "Try out questions that deepen different parts of a reflection",
      "Learn two ways we engage with experience: taking it in and working on it",
      "Connect those ideas back to your own critical incident",
    ],
  },
  {
    id: 4,
    name: "Notice how you think",
    tagline: "Discover your learning style preferences",
    icon: "psychology",
    what: [
      "Notice how the kind of thinking you did changed across the lesson",
      "Learn four learning styles that sit between the phases",
      "Match short examples to the right style — and explain why",
    ],
  },
  {
    id: 5,
    name: "Go deeper",
    tagline: "Revisit and strengthen your earlier responses",
    icon: "layers",
    what: [
      "Look at what you originally wrote for each phase",
      "Notice what feels thin or underdeveloped now that you know more",
      "Add, sharpen, or rethink — you're in charge of the writing",
      "Optionally check how well your four responses connect as a whole",
    ],
  },
  {
    id: 6,
    name: "Wrap up",
    tagline: "Reflect on the session and connect with colleagues",
    icon: "handshake",
    what: [
      "Answer four quick questions about the lesson experience itself",
      "Leave feedback on the session",
      "Optionally share your work with colleagues on Slack",
    ],
    endpoints: [
      { label: "Session feedback", icon: "assignment", desc: "Google Forms" },
      { label: "Share with colleagues", icon: "forum", desc: "Slack channel" },
    ],
  },
];

const Lotus = ({ x, y, size, rot }: { x: string, y: string, size: number, rot: number }) => (
  <svg
    style={{
      position: "absolute", left: x, top: y, width: size, height: size,
      transform: `rotate(${rot}deg)`, opacity: 0.55,
    }}
    viewBox="0 0 80 80" fill="none"
  >
    <circle cx="40" cy="40" r="36" fill="#8FA68E" opacity="0.35" />
    <circle cx="40" cy="40" r="28" fill="#8FA68E" opacity="0.25" />
    {[0, 45, 90, 135, 180, 225, 270, 315].map((a, i) => (
      <ellipse key={i} cx="40" cy="24" rx="5" ry="12" fill="#F0EDE5" opacity="0.85" transform={`rotate(${a} 40 40)`} />
    ))}
    <circle cx="40" cy="40" r="5" fill="#D4C98A" opacity="0.7" />
  </svg>
);

const LilyPad = ({ x, y, size, rot }: { x: string, y: string, size: number, rot: number }) => (
  <svg
    style={{
      position: "absolute", left: x, top: y, width: size, height: size,
      transform: `rotate(${rot}deg)`, opacity: 0.4,
    }}
    viewBox="0 0 80 80" fill="none"
  >
    <path d="M40 4 A36 36 0 1 1 36 4 L40 40 Z" fill="#8FA68E" opacity="0.5" />
    <path d="M40 40 L40 8" stroke="#7A937A" strokeWidth="0.8" opacity="0.4" />
  </svg>
);

interface LearningJourneyProps {
  onComplete: () => void;
}

export default function LearningJourney({ onComplete }: LearningJourneyProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [modeIdx, setModeIdx] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setTimeout(() => setReady(true), 100);
  }, []);

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
          --card-bg: #FFFFFF;
          --card-shadow: 0 2px 20px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03);
          --card-shadow-hover: 0 6px 32px rgba(0,0,0,0.09), 0 0 0 1px rgba(0,0,0,0.04);
          --card-shadow-active: 0 4px 24px rgba(101,87,178,0.14), 0 0 0 1.5px rgba(101,87,178,0.25);
          --sage: #8FA68E;
          --sage-soft: rgba(143,166,142,0.12);
          --sage-mid: rgba(143,166,142,0.25);
          --indigo: #6557B2;
          --indigo-soft: rgba(101,87,178,0.08);
          --indigo-mid: rgba(101,87,178,0.15);
          --text-dark: #2D2B26;
          --text: #4A4740;
          --text-mid: #7A756A;
          --text-soft: #A8A29A;
          --border: rgba(0,0,0,0.06);

          font-family: 'Nunito Sans', sans-serif;
          font-weight: 400;
          color: var(--text);
          background: var(--bg);
          width: 100%;
          height: 100vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          -webkit-font-smoothing: antialiased;
          position: relative;
        }
        .root * { box-sizing: border-box; margin: 0; padding: 0; }

        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-weight: 300; font-style: normal; font-size: 24px; line-height: 1;
          letter-spacing: normal; text-transform: none; display: inline-block;
          white-space: nowrap; word-wrap: normal; direction: ltr;
          -webkit-font-smoothing: antialiased; font-feature-settings: 'liga';
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.92); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes slideReveal {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes itemIn {
          from { opacity: 0; transform: translateX(-6px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes floatSlow {
          0%, 100% { transform: translateY(0) rotate(var(--fr, 0deg)); }
          50% { transform: translateY(-8px) rotate(var(--fr, 0deg)); }
        }
        @keyframes drawLine {
          from { stroke-dashoffset: 2000; }
          to   { stroke-dashoffset: 0; }
        }

        .nature-layer {
          position: absolute; inset: 0; pointer-events: none; z-index: 0; overflow: hidden;
        }
        .float-el { animation: floatSlow 8s ease-in-out infinite; }

        /* HEADER */
        .header {
          position: relative; z-index: 2;
          display: flex; align-items: flex-end; justify-content: space-between;
          padding: 24px 40px 16px; opacity: 0;
        }
        .ready .header { animation: fadeUp 0.6s ease-out 0.1s forwards; }

        .brand-name {
          font-family: 'Cormorant Garamond', serif;
          font-weight: 700; font-size: 30px; letter-spacing: 0.5px; color: var(--text-dark);
        }
        .brand-accent { color: var(--indigo); }

        .header-meta {
          text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 5px;
        }
        .header-title {
          font-family: 'Cormorant Garamond', serif;
          font-weight: 500; font-style: italic; font-size: 15px; color: var(--text-mid);
        }
        .header-pill {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 11px; font-weight: 600; color: var(--text-mid);
          background: var(--card-bg); border: 1px solid var(--border);
          padding: 5px 14px; border-radius: 100px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.04);
          transition: all 0.3s ease;
        }
        .header-pill .material-symbols-outlined { font-size: 14px; color: var(--sage); }

        .divider {
          position: relative; z-index: 2; height: 1px; margin: 0 40px;
          background: linear-gradient(to right, transparent, var(--border), transparent);
        }

        /* SESSION SELECTOR */
        .session-selector {
          position: relative; z-index: 2;
          display: flex; align-items: center; gap: 6px;
          padding: 16px 40px 0; opacity: 0;
        }
        .ready .session-selector { animation: fadeUp 0.5s ease-out 0.15s forwards; }

        .session-label {
          font-size: 10px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 2px; color: var(--text-soft); margin-right: 8px; flex-shrink: 0;
        }

        .mode-btn {
          display: flex; align-items: center; gap: 7px;
          padding: 7px 16px;
          background: var(--card-bg);
          border: 1.5px solid transparent; border-radius: 100px;
          cursor: pointer; transition: all 0.25s ease;
          box-shadow: 0 1px 6px rgba(0,0,0,0.04);
          font-family: 'Nunito Sans', sans-serif;
          font-size: 12px; font-weight: 600; color: var(--text-mid);
        }
        .mode-btn:hover {
          box-shadow: 0 2px 12px rgba(0,0,0,0.08); color: var(--text-dark);
        }
        .mode-btn.active {
          border-color: var(--indigo); color: var(--indigo);
          box-shadow: 0 2px 16px rgba(101,87,178,0.12);
        }
        .mode-btn .material-symbols-outlined { font-size: 16px; transition: color 0.25s; }
        .mode-btn.active .material-symbols-outlined { color: var(--indigo); }

        .mode-total {
          font-size: 11px; font-weight: 400; color: var(--text-soft); margin-left: -2px;
        }
        .mode-btn.active .mode-total { color: var(--indigo); opacity: 0.7; }

        .mode-desc {
          font-family: 'Cormorant Garamond', serif;
          font-style: italic; font-size: 13px; color: var(--text-soft);
          margin-left: auto; flex-shrink: 0;
        }

        /* MAIN */
        .main {
          position: relative; z-index: 2; flex: 1;
          display: flex; flex-direction: column; min-height: 0;
        }

        /* STAGE CARDS */
        .cards-row {
          display: flex; align-items: stretch; gap: 12px;
          padding: 16px 40px 0; flex-shrink: 0;
        }

        .stage-card {
          flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px;
          padding: 16px 10px 14px;
          background: var(--card-bg); border: 1.5px solid transparent; border-radius: 16px;
          cursor: pointer; transition: all 0.3s ease;
          position: relative; opacity: 0; box-shadow: var(--card-shadow);
        }
        .ready .stage-card {
          animation: scaleIn 0.45s ease-out calc(0.3s + var(--ci) * 0.08s) forwards;
        }
        .stage-card:hover { transform: translateY(-3px); box-shadow: var(--card-shadow-hover); }
        .stage-card.active { border-color: var(--indigo); box-shadow: var(--card-shadow-active); }

        .card-icon-wrap {
          width: 44px; height: 44px; border-radius: 50%;
          background: var(--sage-soft);
          display: flex; align-items: center; justify-content: center;
          transition: all 0.3s ease;
        }
        .card-icon-wrap .material-symbols-outlined {
          font-size: 20px; color: var(--sage); transition: all 0.3s;
        }
        .stage-card:hover .card-icon-wrap { background: var(--sage-mid); }
        .stage-card.active .card-icon-wrap { background: var(--indigo-mid); }
        .stage-card.active .card-icon-wrap .material-symbols-outlined { color: var(--indigo); }

        .card-text { text-align: center; }
        .card-stage-num {
          font-size: 9px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 2px; color: var(--text-soft); display: block; margin-bottom: 2px;
        }
        .card-name {
          font-family: 'Cormorant Garamond', serif;
          font-weight: 700; font-size: 15px; color: var(--text-dark);
          line-height: 1.25; transition: color 0.3s;
        }
        .stage-card.active .card-name { color: var(--indigo); }

        /* Time bar */
        .card-time-bar {
          width: 100%; padding: 0 6px; display: flex; align-items: center; gap: 6px;
        }
        .time-bar-track {
          flex: 1; height: 4px; background: rgba(0,0,0,0.04);
          border-radius: 2px; overflow: hidden;
        }
        .time-bar-fill {
          height: 100%; border-radius: 2px; background: var(--sage);
          transform-origin: left;
          transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .stage-card.active .time-bar-fill { background: var(--indigo); }
        .card-time-label {
          font-size: 10px; font-weight: 600; color: var(--text-soft);
          min-width: 28px; text-align: right; transition: color 0.3s;
        }
        .stage-card.active .card-time-label { color: var(--indigo); }

        /* Connector */
        .connector-line {
          position: relative; z-index: 2; height: 20px; margin: 0 40px;
          display: flex; align-items: center;
        }
        .connector-svg { width: 100%; height: 100%; opacity: 0; }
        .ready .connector-svg { animation: fadeUp 0.5s ease-out 0.8s forwards; }
        .conn-path { stroke-dasharray: 2000; stroke-dashoffset: 2000; }
        .ready .conn-path { animation: drawLine 1.5s ease-out 0.9s forwards; }

        /* DETAIL */
        .detail-area { flex: 1; min-height: 0; padding: 0 40px; overflow: hidden; }

        .detail-placeholder {
          height: 100%; display: flex; align-items: center; justify-content: center; opacity: 0;
        }
        .ready .detail-placeholder { animation: fadeUp 0.5s ease-out 1.2s forwards; }

        .placeholder-text {
          font-family: 'Cormorant Garamond', serif;
          font-style: italic; font-size: 16px; color: var(--text-soft);
          display: flex; align-items: center; gap: 8px;
        }
        .placeholder-text .material-symbols-outlined { font-size: 18px; color: var(--text-soft); }

        .detail-panel {
          height: 100%; display: flex; gap: 0; padding: 12px 0;
          animation: slideReveal 0.35s ease-out forwards;
        }
        .detail-card {
          background: var(--card-bg); border-radius: 20px;
          box-shadow: var(--card-shadow); display: flex; width: 100%; overflow: hidden;
        }

        .detail-left {
          width: 280px; min-width: 280px;
          display: flex; flex-direction: column; justify-content: center; padding: 32px;
          background: linear-gradient(135deg, rgba(143,166,142,0.06) 0%, rgba(101,87,178,0.04) 100%);
        }
        .d-stage-label {
          font-size: 10px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 2.5px; color: var(--indigo); margin-bottom: 8px;
        }
        .d-title {
          font-family: 'Cormorant Garamond', serif;
          font-weight: 700; font-size: 32px; color: var(--text-dark);
          line-height: 1.12; margin-bottom: 10px;
        }
        .d-tagline {
          font-size: 14px; color: var(--text-mid); line-height: 1.6; margin-bottom: 18px;
        }
        .d-time {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 12px; font-weight: 600; color: var(--text-mid);
          background: var(--card-bg); border: 1px solid var(--border);
          padding: 6px 14px; border-radius: 100px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .d-time .material-symbols-outlined { font-size: 16px; color: var(--sage); }

        .detail-right {
          flex: 1; min-width: 0; border-left: 1px solid var(--border);
          padding: 32px; display: flex; flex-direction: column; justify-content: center;
        }
        .dr-heading {
          font-size: 10px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 2px; color: var(--text-soft); margin-bottom: 16px;
        }

        .what-list { list-style: none; counter-reset: step; }
        .what-item {
          counter-increment: step; position: relative;
          padding: 8px 0 8px 40px; font-size: 14px; color: var(--text);
          line-height: 1.6; opacity: 0;
          animation: itemIn 0.3s ease-out calc(0.1s + var(--wi) * 0.07s) forwards;
        }
        .what-item::before {
          content: counter(step); position: absolute; left: 0; top: 9px;
          width: 26px; height: 26px; border-radius: 50%;
          background: var(--indigo-soft); color: var(--indigo);
          font-size: 11px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
        }

        .endpoints-row { display: flex; gap: 10px; margin-top: 18px; }
        .endpoint-chip {
          display: flex; align-items: center; gap: 10px; padding: 10px 16px;
          background: var(--sage-soft); border: 1px solid var(--sage-mid);
          border-radius: 12px; transition: background 0.2s;
        }
        .endpoint-chip:hover { background: var(--sage-mid); }
        .endpoint-chip .material-symbols-outlined { font-size: 20px; color: var(--sage); }
        .ep-label {
          font-size: 13px; font-weight: 600; color: var(--text-dark);
          display: block; line-height: 1.2;
        }
        .ep-desc { font-size: 11px; color: var(--text-mid); display: block; }

        /* FOOTER */
        .footer {
          position: relative; z-index: 2; padding: 10px 40px 18px;
          display: flex; align-items: center; justify-content: space-between; opacity: 0;
        }
        .ready .footer { animation: fadeUp 0.5s ease-out 1.3s forwards; }
        .footer-outcome {
          font-family: 'Cormorant Garamond', serif;
          font-style: italic; font-size: 14px; color: var(--text-soft); max-width: 600px;
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
      `}</style>

      {/* Floating nature elements */}
      <div className="nature-layer">
        <div className="float-el" style={{ "--fr": "0deg", animationDelay: "0s" } as any}>
          <Lotus x="-20px" y="-10px" size={90} rot={15} />
        </div>
        <div className="float-el" style={{ "--fr": "5deg", animationDelay: "1.5s" } as any}>
          <Lotus x="42%" y="2%" size={80} rot={-10} />
        </div>
        <div className="float-el" style={{ "--fr": "-3deg", animationDelay: "3s" } as any}>
          <Lotus x="85%" y="65%" size={75} rot={20} />
        </div>
        <div className="float-el" style={{ "--fr": "0deg", animationDelay: "2s" } as any}>
          <Lotus x="12%" y="72%" size={70} rot={-25} />
        </div>
        <div className="float-el" style={{ "--fr": "8deg", animationDelay: "4s" } as any}>
          <LilyPad x="22%" y="30%" size={60} rot={40} />
        </div>
        <div className="float-el" style={{ "--fr": "-5deg", animationDelay: "0.5s" } as any}>
          <LilyPad x="75%" y="12%" size={50} rot={-20} />
        </div>
        <div className="float-el" style={{ "--fr": "3deg", animationDelay: "2.5s" } as any}>
          <LilyPad x="60%" y="80%" size={55} rot={60} />
        </div>
      </div>

      {/* Header */}
      <div className="header">
        <div className="brand-mark">
          <span className="brand-name">
            Refleksyo<span className="brand-accent">n</span>
          </span>
        </div>
        <div className="header-meta">
          <span className="header-title">Your learning journey — reflective practice with Kolb's cycle</span>
          <span className="header-pill">
            <span className="material-symbols-outlined">schedule</span>
            About {mode.total} minutes · one-to-one with your AI facilitator
          </span>
        </div>
      </div>

      <div className="divider" />

      {/* Session length selector */}
      <div className="session-selector">
        <span className="session-label">Session</span>
        {SESSION_MODES.map((m, i) => (
          <button
            key={m.key}
            className={`mode-btn ${modeIdx === i ? "active" : ""}`}
            onClick={() => setModeIdx(i)}
          >
            <span className="material-symbols-outlined">{m.icon}</span>
            {m.label}
            <span className="mode-total">{m.total}m</span>
          </button>
        ))}
        <span className="mode-desc">{mode.desc}</span>
      </div>

      <div className="main">
        {/* Stage cards */}
        <div className="cards-row">
          {STAGES.map((s, i) => {
            const mins = mode.times[i];
            const maxMins = SESSION_MODES[0].times[i];
            const pct = (mins / maxMins) * 100;
            return (
              <div
                key={s.id}
                className={`stage-card ${selected === i ? "active" : ""}`}
                style={{ "--ci": i } as any}
                onClick={() => setSelected(selected === i ? null : i)}
              >
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

        {/* Connector */}
        <div className="connector-line">
          <svg className="connector-svg" viewBox="0 0 1000 24" preserveAspectRatio="none">
            <path className="conn-path" d="M 60,12 L 940,12" fill="none" stroke="#A8A29A" strokeWidth="1" strokeDasharray="4 6" opacity="0.5" />
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <circle key={i} cx={60 + i * 176} cy={12} r={3} fill="#8FA68E" opacity="0.5" />
            ))}
          </svg>
        </div>

        {/* Detail area */}
        <div className="detail-area">
          {active === null ? (
            <div className="detail-placeholder">
              <span className="placeholder-text">
                <span className="material-symbols-outlined">touch_app</span>
                Select a stage to see what you'll do
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
                    <span className="material-symbols-outlined">schedule</span>
                    ~{activeTime} min
                  </span>
                </div>
                <div className="detail-right">
                  <div className="dr-heading">What you'll do</div>
                  <ol className="what-list">
                    {active.what.map((item, j) => (
                      <li key={j} className="what-item" style={{ "--wi": j } as any}>{item}</li>
                    ))}
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
