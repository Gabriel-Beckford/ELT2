import React from 'react';

const rawHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>The Experiential Learning Cycle — After Kolb</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,300;1,9..144,400;1,9..144,500&family=Manrope:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root {
    /* Paper system */
    --paper:        #f1e9d3;
    --paper-warm:   #ebe2c8;
    --paper-deep:   #e0d5b6;
    --paper-fade:   #f6efdc;

    /* Ink */
    --ink:          #1d1812;
    --ink-soft:     #3a3127;
    --ink-mute:     #74664f;
    --ink-faint:    #a89a7e;
    --rule:         #c8b88e;

    /* Phase pigments */
    --ce:           #a83729;   /* terracotta — Concrete Experience */
    --ce-deep:      #872718;
    --ce-tint:      #e8c8b6;

    --ro:           #2c4763;   /* indigo — Reflective Observation */
    --ro-deep:      #1d3145;
    --ro-tint:      #b9c5d1;

    --ac:           #4a6438;   /* forest — Abstract Conceptualisation */
    --ac-deep:      #344825;
    --ac-tint:      #c5d0b0;

    --ae:           #a87421;   /* ochre — Active Experimentation */
    --ae-deep:      #855912;
    --ae-tint:      #e6d2a0;

    --ease:         cubic-bezier(0.16, 1, 0.3, 1);
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  html, body {
    background: var(--paper);
    color: var(--ink);
    font-family: 'Manrope', system-ui, sans-serif;
    font-weight: 400;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }

  /* Subtle paper grain */
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 1;
    opacity: 0.5;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.92' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.12 0 0 0 0 0.10 0 0 0 0 0.07 0 0 0 0.18 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  }

  body::after {
    content: '';
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 1;
    background:
      radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,235,190,0.25), transparent 60%),
      radial-gradient(ellipse 100% 80% at 50% 100%, rgba(40,30,15,0.06), transparent 70%);
  }

  .figure {
    position: relative;
    z-index: 2;
    max-width: 1080px;
    margin: 0 auto;
    padding: 2rem;
  }
  
  @media (max-width: 768px) {
    .figure { padding: 1rem 0.5rem; }
  }

  /* —————— Header —————— */
  header {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.9rem;
    margin-bottom: 3.25rem;
    max-width: 720px;
  }

  .eyebrow {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--ink-mute);
    display: flex;
    align-items: center;
    gap: 0.85rem;
  }
  .eyebrow::before {
    content: '';
    display: inline-block;
    width: 22px;
    height: 1px;
    background: var(--ink-mute);
  }

  h1 {
    font-family: 'Fraunces', Georgia, serif;
    font-weight: 400;
    font-variation-settings: "opsz" 144, "SOFT" 50;
    font-size: clamp(2.4rem, 4.6vw, 3.6rem);
    line-height: 1.02;
    letter-spacing: -0.022em;
    color: var(--ink);
    margin-top: 0.1rem;
  }
  h1 em {
    font-style: italic;
    font-weight: 300;
    color: var(--ce-deep);
  }

  .byline {
    font-family: 'Fraunces', Georgia, serif;
    font-style: italic;
    font-weight: 300;
    font-size: 1rem;
    color: var(--ink-mute);
    letter-spacing: 0.02em;
  }
  .byline span { color: var(--ink-faint); margin: 0 0.5em; }

  .lede {
    font-family: 'Fraunces', Georgia, serif;
    font-weight: 300;
    font-variation-settings: "opsz" 30;
    font-size: 1.18rem;
    line-height: 1.55;
    color: var(--ink-soft);
    max-width: 56ch;
    margin-top: 0.6rem;
  }

  /* —————— View Selector —————— */
  nav.views {
    display: none;
    gap: 0;
    margin: 2.5rem 0 3.5rem;
    border-top: 1px solid var(--rule);
    border-bottom: 1px solid var(--rule);
    background:
      repeating-linear-gradient(45deg,
        transparent 0 6px,
        rgba(120, 102, 79, 0.025) 6px 7px);
    overflow-x: auto;
  }

  .view-btn {
    flex: 1;
    background: transparent;
    border: none;
    padding: 1.15rem 1.25rem;
    cursor: pointer;
    text-align: left;
    color: var(--ink-mute);
    transition: all 0.5s var(--ease);
    border-right: 1px solid var(--rule);
    display: flex;
    align-items: baseline;
    gap: 1rem;
    position: relative;
    font-family: inherit;
    min-width: max-content;
  }
  .view-btn:last-child { border-right: none; }

  .view-btn::after {
    content: '';
    position: absolute;
    left: 0; right: 0; bottom: -1px;
    height: 2px;
    background: var(--ink);
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.6s var(--ease);
  }
  .view-btn.active::after { transform: scaleX(1); }
  .view-btn.active { color: var(--ink); background: rgba(255,250,235,0.4); }

  .view-btn:hover:not(.active) { color: var(--ink-soft); }

  .view-btn .num {
    font-family: 'Fraunces', serif;
    font-style: italic;
    font-weight: 300;
    font-variation-settings: "opsz" 144;
    font-size: 2rem;
    line-height: 1;
    color: var(--ink-faint);
    transition: color 0.5s var(--ease);
  }
  .view-btn.active .num { color: var(--ce); }

  .view-btn .label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  /* —————— Diagram —————— */
  .stage {
    display: grid;
    grid-template-columns: 1fr 280px;
    gap: 3.5rem;
    align-items: start;
  }

  @media (max-width: 880px) {
    .stage { grid-template-columns: 1fr; gap: 2rem; }
    .figure { padding: 3rem 1.5rem 4rem; }
  }

  .diagram-frame {
    position: relative;
    aspect-ratio: 1;
    width: 100%;
    max-width: 680px;
    margin: 0 auto;
    padding: 36px;   /* breathing room for axis labels in groups view */
  }

  .diagram-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
  }

  /* Faint registration marks at the corners — like a printed plate */
  .diagram-frame::before,
  .diagram-frame::after {
    content: '';
    position: absolute;
    width: 14px; height: 14px;
    border: 1px solid var(--ink-faint);
    pointer-events: none;
    opacity: 0.55;
  }
  .diagram-frame::before {
    top: 6px; left: 6px;
    border-right: none; border-bottom: none;
  }
  .diagram-frame::after {
    bottom: 6px; right: 6px;
    border-left: none; border-top: none;
  }

  /* SVG layer */
  .svg-layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: visible;
  }

  /* The cycle ring — subtle background */
  .cycle-ring {
    fill: none;
    stroke: var(--rule);
    stroke-width: 0.4;
    stroke-dasharray: 0.6 1.4;
    opacity: 0.7;
  }

  /* Center mark */
  .center-mark {
    fill: none;
    stroke: var(--ink-faint);
    stroke-width: 0.3;
    opacity: 0.6;
  }

  /* Arrows */
  .arc-arrow {
    fill: none;
    stroke: var(--ink-soft);
    stroke-width: 0.55;
    stroke-linecap: round;
    transition: stroke 0.5s var(--ease), stroke-width 0.5s var(--ease), opacity 0.5s var(--ease);
  }

  .arc-arrow.active {
    stroke: var(--ink);
    stroke-width: 0.85;
  }

  /* Axes */
  .axis {
    stroke: var(--ink-mute);
    stroke-width: 0.35;
    stroke-dasharray: 1 1.4;
    opacity: 0;
    transition: opacity 0.6s var(--ease);
  }

  .axis-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 2.2px;
    font-weight: 500;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    fill: var(--ink-mute);
    opacity: 0;
    transition: opacity 0.6s var(--ease), fill 0.4s var(--ease);
    cursor: pointer;
  }

  .axis-label:hover { fill: var(--ink); }

  /* Groups view activations */
  .diagram-wrapper[data-view="groups"] .axis,
  .diagram-wrapper[data-view="groups"] .axis-label { opacity: 1; }

  /* Phase nodes (HTML overlay) */
  .phase {
    position: absolute;
    transform: translate(-50%, -50%);
    width: 168px;
    height: 96px;
    padding: 13px 16px;
    cursor: pointer;
    z-index: 10;
    color: var(--paper);
    transition: transform 0.55s var(--ease), box-shadow 0.55s var(--ease), filter 0.55s var(--ease);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    overflow: hidden;
    border-radius: 2px;
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.16),
      inset 0 -1px 0 rgba(0,0,0,0.18),
      0 14px 28px -12px rgba(31, 24, 18, 0.32),
      0 2px 6px rgba(31, 24, 18, 0.08);
  }

  /* Scales for small devices */
  @media (max-width: 500px) {
    .phase { width: 128px; height: 76px; padding: 10px 12px; }
    .phase-num { font-size: 18px !important; }
    .phase-name { font-size: 13px !important; }
    .phase-mode { font-size: 8px !important; }
  }

  /* Faint diagonal sheen on each card */
  .phase::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      linear-gradient(135deg, rgba(255,255,255,0.10) 0%, transparent 45%),
      radial-gradient(ellipse at 0% 0%, rgba(255,255,255,0.08), transparent 70%);
  }
  /* Subtle grain on phase cards */
  .phase::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0.18;
    mix-blend-mode: overlay;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  }

  .phase-num {
    font-family: 'Fraunces', serif;
    font-style: italic;
    font-weight: 300;
    font-variation-settings: "opsz" 144;
    font-size: 22px;
    line-height: 1;
    opacity: 0.62;
    letter-spacing: 0.02em;
    align-self: flex-start;
  }

  .phase-name {
    font-family: 'Fraunces', serif;
    font-weight: 400;
    font-variation-settings: "opsz" 36;
    font-size: 17px;
    line-height: 1.08;
    letter-spacing: -0.012em;
    margin-top: -2px;
  }

  .phase-mode {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9.5px;
    font-weight: 500;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    opacity: 0.78;
    align-self: flex-start;
  }

  /* Phase positions (centers) */
  .ce { background: var(--ce); top: 16%;  left: 50%; }
  .ro { background: var(--ro); top: 50%;  left: 84%; }
  .ac { background: var(--ac); top: 84%;  left: 50%; }
  .ae { background: var(--ae); top: 50%;  left: 16%; }

  .phase:hover {
    transform: translate(-50%, -50%) scale(1.045);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.2),
      inset 0 -1px 0 rgba(0,0,0,0.2),
      0 22px 40px -14px rgba(31, 24, 18, 0.42),
      0 4px 10px rgba(31, 24, 18, 0.12);
  }

  /* Transitional style nodes — small jewel badges */
  .style-node {
    position: absolute;
    transform: translate(-50%, -50%);
    z-index: 15;
    background: var(--paper-fade);
    border: 1px solid var(--ink);
    color: var(--ink);
    padding: 7px 14px 6px;
    border-radius: 100px;
    cursor: pointer;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    box-shadow:
      0 4px 14px -4px rgba(31, 24, 18, 0.25),
      inset 0 1px 0 rgba(255,255,255,0.5);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.55s var(--ease), transform 0.55s var(--ease), background 0.4s var(--ease), color 0.4s var(--ease);
  }
  
  @media (max-width: 500px) {
    .style-node { font-size: 8px; padding: 5px 10px; }
  }

  .style-node .glyph {
    font-family: 'Fraunces', serif;
    font-style: italic;
    font-weight: 300;
    margin-right: 8px;
    text-transform: none;
    letter-spacing: 0;
    font-size: 12px;
    opacity: 0.55;
  }

  .imagining  { top: 30%; left: 70%; }
  .analyzing  { top: 70%; left: 70%; }
  .deciding   { top: 70%; left: 30%; }
  .initiating { top: 30%; left: 30%; }

  .diagram-wrapper[data-view="styles"] .style-node {
    opacity: 1;
    pointer-events: auto;
  }

  .style-node:hover {
    transform: translate(-50%, -50%) scale(1.08);
    background: var(--ink);
    color: var(--paper-fade);
  }
  .style-node:hover .glyph { opacity: 0.7; }

  /* Dim/highlight states */
  .interactable.dimmed {
    opacity: 0.32;
    filter: saturate(0.55);
  }
  .interactable.highlit {
    /* Will inherit hover-like emphasis */
  }

  /* —————— Detail panel —————— */
  .detail-panel {
    position: sticky;
    top: 2rem;
    padding-top: 0.5rem;
    min-height: 380px;
  }

  .detail-marker {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--ink-faint);
    display: flex;
    align-items: center;
    gap: 0.65rem;
    margin-bottom: 1rem;
  }
  .detail-marker::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--rule);
  }

  .detail-num {
    font-family: 'Fraunces', serif;
    font-style: italic;
    font-weight: 300;
    font-variation-settings: "opsz" 144;
    font-size: 4rem;
    line-height: 0.85;
    color: var(--ink);
    margin-bottom: 0.6rem;
    transition: color 0.4s var(--ease);
  }

  .detail-title {
    font-family: 'Fraunces', serif;
    font-weight: 400;
    font-variation-settings: "opsz" 36;
    font-size: 1.55rem;
    line-height: 1.12;
    letter-spacing: -0.012em;
    margin-bottom: 0.3rem;
    transition: color 0.4s var(--ease);
  }

  .detail-mode {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--ink-mute);
    margin-bottom: 1.1rem;
    transition: color 0.4s var(--ease);
  }

  .detail-body {
    font-family: 'Fraunces', Georgia, serif;
    font-weight: 300;
    font-variation-settings: "opsz" 28;
    font-size: 1.02rem;
    line-height: 1.55;
    color: var(--ink-soft);
  }

  .detail-body em {
    font-style: italic;
    color: var(--ink);
  }

  .detail-poles {
    margin-top: 1.4rem;
    padding-top: 1rem;
    border-top: 1px dashed var(--rule);
    font-family: 'JetBrains Mono', monospace;
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink-mute);
    line-height: 1.8;
  }
  .detail-poles strong {
    color: var(--ink);
    font-weight: 500;
  }

  /* Footer attribution */
  .colophon {
    margin-top: 4rem;
    padding-top: 1.6rem;
    border-top: 1px solid var(--rule);
    display: flex;
    justify-content: space-between;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }
  
  @media (max-width: 768px) {
    .colophon { flex-direction: column; gap: 0.5rem; text-align: center; }
  }

  /* Entrance animation */
  .phase, .style-node, .arc-arrow, .axis, .axis-label {
    animation: rise 0.9s var(--ease) backwards;
  }
  .phase.ce { animation-delay: 0.1s; }
  .arc-arrow:nth-of-type(1) { animation-delay: 0.18s; }
  .phase.ro { animation-delay: 0.26s; }
  .arc-arrow:nth-of-type(2) { animation-delay: 0.34s; }
  .phase.ac { animation-delay: 0.42s; }
  .arc-arrow:nth-of-type(3) { animation-delay: 0.50s; }
  .phase.ae { animation-delay: 0.58s; }
  .arc-arrow:nth-of-type(4) { animation-delay: 0.66s; }

  @keyframes rise {
    from { opacity: 0; transform: translate(-50%, -50%) translateY(8px); }
    to   { opacity: 1; }
  }
  .arc-arrow {
    animation-name: drawIn;
  }
  @keyframes drawIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }

</style>
</head>
<body>

<main class="figure">

  <header>
    <div class="eyebrow">Interactive Figure · § 1.1</div>
    <h1>The Experiential <em>Learning Cycle</em></h1>
    <div class="byline">After David A. Kolb <span>·</span> 1984</div>
    <p class="lede">
      Knowledge, Kolb proposes, is created through the transformation of experience — a continuous loop linking what we feel to what we watch, what we think, and what we do. Hover any element to read its detail.
    </p>
  </header>

  <nav class="views" role="tablist">
    <button class="view-btn" data-target="cycle" id="btn-cycle" role="tab">
      <span class="num">i</span>
      <span class="label">The Cycle</span>
    </button>
    <button class="view-btn" data-target="groups" id="btn-groups" role="tab">
      <span class="num">ii</span>
      <span class="label">Ways of Knowing</span>
    </button>
    <button class="view-btn" data-target="styles" id="btn-styles" role="tab">
      <span class="num">iii</span>
      <span class="label">Learning Styles</span>
    </button>
  </nav>

  <div class="stage">

    <div class="diagram-frame">
      <div class="diagram-wrapper" data-view="cycle" id="diagram-area">

        <svg class="svg-layer" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <marker id="arrowhead" viewBox="0 0 10 10" refX="8" refY="5"
                    markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse">
              <path d="M 0 0 L 9 5 L 0 10 z" fill="#3a3127" />
            </marker>
            <marker id="arrowhead-active" viewBox="0 0 10 10" refX="8" refY="5"
                    markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M 0 0 L 9 5 L 0 10 z" fill="#1d1812" />
            </marker>
          </defs>

          <!-- Cycle ring -->
          <circle class="cycle-ring" cx="50" cy="50" r="34" />

          <!-- Center mark (visible always, subtle) -->
          <circle class="center-mark" cx="50" cy="50" r="0.9" />
          <line class="center-mark" x1="48.5" y1="50" x2="51.5" y2="50" />
          <line class="center-mark" x1="50" y1="48.5" x2="50" y2="51.5" />

          <!-- Axes (visible in groups view) -->
          <line class="axis axis-v" x1="50" y1="2" x2="50" y2="98" />
          <line class="axis axis-h" x1="2" y1="50" x2="98" y2="50" />

          <!-- Axis labels (visible in groups view) -->
          <text class="axis-label interactable" id="label-grasping"
                data-connect="phase-ce,phase-ac"
                transform="translate(-3.2 50) rotate(-90)"
                text-anchor="middle">
            Grasping Knowledge
          </text>
          <text class="axis-label interactable" id="label-transforming"
                data-connect="phase-ro,phase-ae"
                x="50" y="103.2" text-anchor="middle">
            Transforming Knowledge
          </text>

          <!-- Cycle arrows -->
          <path class="arc-arrow arrow-1 interactable" data-step="1"
                d="M 60 18 C 78 18, 84 28, 84 40"
                marker-end="url(#arrowhead)" />
          <path class="arc-arrow arrow-2 interactable" data-step="2"
                d="M 82 56 C 82 72, 76 84, 66 84"
                marker-end="url(#arrowhead)" />
          <path class="arc-arrow arrow-3 interactable" data-step="3"
                d="M 40 82 C 22 82, 16 72, 16 60"
                marker-end="url(#arrowhead)" />
          <path class="arc-arrow arrow-4 interactable" data-step="4"
                d="M 18 44 C 18 28, 24 16, 34 16"
                marker-end="url(#arrowhead)" />
        </svg>

        <!-- Phase nodes -->
        <div class="phase ce interactable" id="phase-ce" data-connect="phase-ce">
          <div class="phase-num">i</div>
          <div class="phase-name">Concrete<br>Experience</div>
          <div class="phase-mode">Feeling</div>
        </div>

        <div class="phase ro interactable" id="phase-ro" data-connect="phase-ro">
          <div class="phase-num">ii</div>
          <div class="phase-name">Reflective<br>Observation</div>
          <div class="phase-mode">Watching</div>
        </div>

        <div class="phase ac interactable" id="phase-ac" data-connect="phase-ac">
          <div class="phase-num">iii</div>
          <div class="phase-name">Abstract<br>Conceptualisation</div>
          <div class="phase-mode">Thinking</div>
        </div>

        <div class="phase ae interactable" id="phase-ae" data-connect="phase-ae">
          <div class="phase-num">iv</div>
          <div class="phase-name">Active<br>Experimentation</div>
          <div class="phase-mode">Doing</div>
        </div>

        <!-- Transitional styles -->
        <div class="style-node imagining interactable" id="style-imagining" data-connect="phase-ce,phase-ro">
          <span class="glyph">a</span>Imagining
        </div>
        <div class="style-node analyzing interactable" id="style-analyzing" data-connect="phase-ro,phase-ac">
          <span class="glyph">b</span>Analyzing
        </div>
        <div class="style-node deciding interactable" id="style-deciding" data-connect="phase-ac,phase-ae">
          <span class="glyph">c</span>Deciding
        </div>
        <div class="style-node initiating interactable" id="style-initiating" data-connect="phase-ae,phase-ce">
          <span class="glyph">d</span>Initiating
        </div>

      </div>
    </div>

    <aside class="detail-panel">
      <div class="detail-marker" id="detail-marker">Reading</div>
      <div class="detail-num" id="detail-num">—</div>
      <div class="detail-title" id="detail-title">The cycle in brief</div>
      <div class="detail-mode" id="detail-mode">Overview</div>
      <div class="detail-body" id="detail-body">
        Four phases turning continuously: a learner moves from <em>direct experience</em>, to <em>reflection</em>, to <em>theory</em>, to <em>action</em>, and back again. Hover a phase to read its account.
      </div>
      <div class="detail-poles" id="detail-poles" hidden></div>
    </aside>

  </div>

  <div class="colophon">
    <span>Kolb, D. A. — Experiential Learning</span>
    <span>Plate I</span>
  </div>

</main>

<script>
  // Dynamic Initial View parameter insertion
  let currentView = '{{INITIAL_VIEW}}';

  // ————— Data —————
  const phases = {
    'phase-ce': {
      num: 'i', title: 'Concrete Experience', mode: 'Feeling',
      body: 'The grounded encounter — direct, embodied involvement with the matter at hand. Knowledge is <em>apprehended</em> through immediate sensation rather than mediated thought.',
    },
    'phase-ro': {
      num: 'ii', title: 'Reflective Observation', mode: 'Watching',
      body: 'The pause of attention — careful watching, listening, noticing. Meaning is sifted from experience by holding it still and turning it over from many sides.',
    },
    'phase-ac': {
      num: 'iii', title: 'Abstract Conceptualisation', mode: 'Thinking',
      body: 'The leap into theory — patterns are named, principles drawn, frameworks built. <em>Comprehension</em> formalises what reflection has gathered.',
    },
    'phase-ae': {
      num: 'iv', title: 'Active Experimentation', mode: 'Doing',
      body: 'The return to the world — concepts tested in action, ideas met by consequence. Learning closes the loop, and at once reopens it elsewhere.',
    },
  };

  const arrows = {
    'arrow-1': {
      num: '→', title: 'From feeling to watching', mode: 'Concrete · Reflective',
      body: 'The first turn. A lived event is set down before the mind, where the learner stops to <em>notice</em> what just happened.',
    },
    'arrow-2': {
      num: '→', title: 'From watching to thinking', mode: 'Reflective · Abstract',
      body: 'Observations gather into pattern. The reflective stance gives way to conceptual work — <em>What general rule does this case suggest?</em>',
    },
    'arrow-3': {
      num: '→', title: 'From thinking to doing', mode: 'Abstract · Active',
      body: 'Theory is taken up as plan. Concepts pass into the hands, the voice, the next attempt — they become operative.',
    },
    'arrow-4': {
      num: '→', title: 'From doing to feeling', mode: 'Active · Concrete',
      body: 'Action returns the learner to fresh experience, often inflected by what was tried. The cycle does not close; it spirals.',
    },
  };

  const axes = {
    'label-grasping': {
      num: '↕', title: 'Grasping Knowledge', mode: 'Vertical Dialectic',
      body: 'How we <em>take in</em> experience. The vertical axis runs between Concrete Experience (apprehension — knowing through feeling) and Abstract Conceptualisation (comprehension — knowing through symbolic thought).',
      poles: '<strong>Top</strong> Apprehension <span style="color:var(--ink-faint)">·</span> direct, sensed<br><strong>Foot</strong> Comprehension <span style="color:var(--ink-faint)">·</span> mediated, conceptual',
    },
    'label-transforming': {
      num: '↔', title: 'Transforming Knowledge', mode: 'Horizontal Dialectic',
      body: 'How we <em>process</em> experience. The horizontal axis runs between Reflective Observation (intension — turning inward to make meaning) and Active Experimentation (extension — turning outward to test it).',
      poles: '<strong>Right</strong> Intension <span style="color:var(--ink-faint)">·</span> inward, contemplative<br><strong>Left</strong>&nbsp;&nbsp; Extension <span style="color:var(--ink-faint)">·</span> outward, performative',
    },
  };

  const styles = {
    'style-imagining': {
      num: 'a', title: 'Imagining', mode: 'CE × RO · Diverger',
      body: 'Where feeling meets watching. Strong in seeing situations from many angles, generating possibilities, brainstorming meaning. The questioner who finds the angle no one else saw.',
    },
    'style-analyzing': {
      num: 'b', title: 'Analyzing', mode: 'RO × AC · Assimilator',
      body: 'Where watching meets thinking. Strong in inductive reasoning, building theoretical models, integrating disparate observations into coherent frameworks. The synthesiser.',
    },
    'style-deciding': {
      num: 'c', title: 'Deciding', mode: 'AC × AE · Converger',
      body: 'Where thinking meets doing. Strong in problem-solving, decision-making, the practical application of ideas. The technician who knows which tool fits the case.',
    },
    'style-initiating': {
      num: 'd', title: 'Initiating', mode: 'AE × CE · Accommodator',
      body: 'Where doing meets feeling. Strong in carrying out plans, taking risks, adapting on the fly. The opportunist (in the older, fuller sense of the word) who reads the moment and moves.',
    },
  };

  const viewDefaults = {
    cycle: {
      marker: 'Reading',
      num: '—',
      title: 'The cycle in brief',
      mode: 'Overview',
      body: 'Four phases turning continuously: a learner moves from <em>direct experience</em>, to <em>reflection</em>, to <em>theory</em>, to <em>action</em>, and back again. Hover any phase or arrow to read its account.',
      poles: '',
    },
    groups: {
      marker: 'Reading',
      num: '+',
      title: 'Two dialectics, one figure',
      mode: 'Axes',
      body: 'Kolb maps the cycle onto a pair of crossed dialectics: a vertical axis for how knowledge is <em>grasped</em>, a horizontal axis for how it is <em>transformed</em>. Hover an axis label to read its dialectic.',
      poles: '',
    },
    styles: {
      marker: 'Reading',
      num: '◇',
      title: 'Four learning styles',
      mode: 'Transitions',
      body: 'Each pair of adjacent phases names a learning style — a characteristic way of moving through the cycle. Hover any badge to read what the style does well.',
      poles: '',
    },
  };

  // ————— Detail panel updater —————
  const $marker = document.getElementById('detail-marker');
  const $num    = document.getElementById('detail-num');
  const $title  = document.getElementById('detail-title');
  const $mode   = document.getElementById('detail-mode');
  const $body   = document.getElementById('detail-body');
  const $poles  = document.getElementById('detail-poles');

  function setDetail(d, isDefault = false) {
    if(!d) return;
    $marker.textContent = d.marker || (isDefault ? 'Reading' : 'Reading · element');
    $num.innerHTML   = d.num;
    $title.textContent = d.title;
    $mode.textContent  = d.mode;
    $body.innerHTML    = d.body;
    if (d.poles) {
      $poles.innerHTML = d.poles;
      $poles.hidden = false;
    } else {
      $poles.innerHTML = '';
      $poles.hidden = true;
    }

    // Tint the numeral & title to match the phase if we have one
    const tints = {
      'Concrete Experience':       'var(--ce)',
      'Reflective Observation':    'var(--ro)',
      'Abstract Conceptualisation':'var(--ac)',
      'Active Experimentation':    'var(--ae)',
      'Grasping Knowledge':        'var(--ce)',
      'Transforming Knowledge':    'var(--ro)',
      'Imagining':                 'var(--ce)',
      'Analyzing':                 'var(--ro)',
      'Deciding':                  'var(--ac)',
      'Initiating':                'var(--ae)',
    };
    const tint = tints[d.title] || 'var(--ink)';
    $num.style.color   = tint;
    $title.style.color = 'var(--ink)';
    $mode.style.color  = isDefault ? 'var(--ink-mute)' : tint;
  }

  // ————— View switching —————
  const tabs = document.querySelectorAll('.view-btn');
  const diagramArea = document.getElementById('diagram-area');
  
  // Set initial view button
  document.getElementById('btn-' + currentView)?.classList.add('active');
  diagramArea.setAttribute('data-view', currentView);

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentView = tab.dataset.target;
      diagramArea.setAttribute('data-view', currentView);
      setDetail(viewDefaults[currentView], true);
    });
  });

  // ————— Hover behaviour —————
  const interactables = document.querySelectorAll('.interactable');
  const allArrows = document.querySelectorAll('.arc-arrow');

  function clearStates() {
    interactables.forEach(el => {
      el.classList.remove('dimmed', 'highlit');
    });
    allArrows.forEach(a => a.classList.remove('active'));
  }

  function applyHover(target) {
    // Determine which records to use
    let record;
    if (phases[target.id])      record = phases[target.id];
    else if (axes[target.id])   record = axes[target.id];
    else if (styles[target.id]) record = styles[target.id];
    else if (target.classList.contains('arc-arrow')) {
      const cls = [...target.classList].find(c => c.startsWith('arrow-'));
      record = arrows[cls];
    }
    if (record) setDetail(record);

    // Dim everything, then re-highlight target & connections
    interactables.forEach(el => el.classList.add('dimmed'));
    allArrows.forEach(a => a.classList.add('dimmed'));

    target.classList.remove('dimmed');
    target.classList.add('highlit');
    if (target.classList.contains('arc-arrow')) target.classList.add('active');

    // Emphasise connected phases
    if (target.dataset.connect) {
      target.dataset.connect.split(',').forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.classList.remove('dimmed');
          el.classList.add('highlit');
        }
      });
    }
  }

  interactables.forEach(el => {
    el.addEventListener('mouseenter', () => applyHover(el));
    el.addEventListener('focus',      () => applyHover(el));
    el.addEventListener('mouseleave', () => {
      clearStates();
      setDetail(viewDefaults[currentView], true);
    });
    el.addEventListener('blur',       () => {
      clearStates();
      setDetail(viewDefaults[currentView], true);
    });
  });

  // Initial state
  setDetail(viewDefaults[currentView] || viewDefaults.cycle, true);
  
  // Height dynamic resize reporting to parent for iframe resizing
  const body = document.body, html = document.documentElement;
  const RO = new ResizeObserver(() => {
    const height = Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight);
    window.parent.postMessage({ type: 'resize', height: height + 32 }, '*');
  });
  RO.observe(body);

</script>

</body>
</html>`;

interface KolbDiagramProps {
  initialView?: 'cycle' | 'groups' | 'styles';
}

export function KolbDiagram({ initialView = 'cycle' }: KolbDiagramProps) {
  const [height, setHeight] = React.useState('800px');
  
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  
  const content = rawHtml.replace('{{INITIAL_VIEW}}', initialView);

  React.useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.data?.type === 'resize' && e.data?.height) {
        setHeight(`${e.data.height}px`);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div className="w-full my-4 rounded-xl overflow-hidden border border-slate-200 bg-[#f1e9d3] shadow-md">
      <iframe 
        ref={iframeRef}
        srcDoc={content} 
        style={{ width: '100%', height, border: 'none' }}
        title={`Kolb Diagram: ${initialView}`}
        scrolling="no"
      />
    </div>
  );
}
