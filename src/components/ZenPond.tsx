import React, { useEffect, useRef, useState } from 'react';
import { PromptId } from '../constants/prompts';
import './ZenPond.css';

interface ZenPondProps {
  onComplete: (pathway: PromptId) => void;
}

export const ZenPond: React.FC<ZenPondProps> = ({ onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [selectedPathway, setSelectedPathway] = useState<PromptId | null>(null);
  
  const [breathingPhase, setBreathingPhase] = useState('phase-exhale');
  const [breathingCount, setBreathingCount] = useState<number | string>('');
  const [isCountChanging, setIsCountChanging] = useState(false);
  const [activeLabel, setActiveLabel] = useState('Get ready...');
  
  const [isCardVisible, setIsCardVisible] = useState(false);
  const [isUiVisible, setIsUiVisible] = useState(false);
  const [isExitingFinal, setIsExitingFinal] = useState(false);
  const [isItemsVisible, setIsItemsVisible] = useState(false);
  const [isItemsExiting, setIsItemsExiting] = useState(false);

  const motionConfig = {
    ui: {
      firstPaintDelayMs: 300,
      contentFadeDurationMs: 1200,
      itemRevealDurationMs: 1000,
      itemStaggerMs: 0,
      breatheIntroDelayMs: 1000,
      cardExitDurationMs: 1000,
      overlayFadeDurationMs: 1200
    },
    breathing: {
      inhaleSeconds: 4,
      holdSeconds: 7,
      exhaleSeconds: 8,
      tickMs: 1000 
    }
  };

  const flowSteps = [
    { type: 'text', title: "Bassin Bleu", text: "A space for reflection and calm.", btn: "Start" },
    { type: 'text', title: "Welcome to our Reflective Space.", text: "Take one calm breath before continuing.", btn: "Next" },
    { type: 'text', title: "Take a moment to enjoy the waters.", text: "Notice the gentle ripples and calm fish underneath.", btn: "Next" },
    { type: 'text', title: "The upcoming reflection will take about 20 minutes.", text: "Ensure you are in a quiet and comfortable environment.", btn: "Next" },
    { type: 'text', title: "Before we begin...", text: "Let's take a moment to centre ourselves in the present moment.", btn: "Next" },
    { type: 'text', title: "How to follow the exercise", text: "Inhale slowly as the circle expands. Hold while it stays large. Exhale completely as it shrinks.", btn: "I understand" },
    { type: 'text', title: "Let's breathe together.", text: "Follow the rhythm of the circle.", btn: "Begin" },
    { type: "breathe" },
    { type: 'text', title: "You are centered.", text: "Whenever you are ready, let's begin our journey together.", btn: "Start Journey" }
  ];

  const step = flowSteps[currentStep];

  useEffect(() => {
    setTimeout(() => {
      setIsCardVisible(true);
      setIsUiVisible(true);
      setIsItemsVisible(true);
    }, motionConfig.ui.firstPaintDelayMs);
  }, []);

  useEffect(() => {
    if (step.type === 'breathe') {
      setTimeout(startBreathingCycle, motionConfig.ui.breatheIntroDelayMs);
    }
  }, [currentStep]);

  const nextStep = (pathwayId?: string, force = false) => {
    if (isTransitioning && !force) return;
    
    if (currentStep === flowSteps.length - 1) {
      handleSkip();
      return;
    }

    if (pathwayId) {
      setSelectedPathway(pathwayId as PromptId);
    }

    setIsTransitioning(true);
    setIsItemsVisible(false);

    // Wait for fade out (matching --dur-fast in CSS)
    setTimeout(() => {
      setCurrentStep(prev => prev + 1);
      
      // Double RAF to ensure the new step content is in the DOM before triggering fade-in
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsItemsVisible(true);
          // Wait for fade in
          setTimeout(() => {
            setIsTransitioning(false);
          }, 1000);
        });
      });
    }, 1000); 
  };

  const handleSkip = () => {
    setIsItemsVisible(false);
    setIsItemsExiting(true);
    setIsCardVisible(false);
    setIsExitingFinal(true);
    setTimeout(() => {
      setIsUiVisible(false);
      setTimeout(() => {
        onComplete(selectedPathway || 'facilitator');
      }, 500);
    }, 500);
  };

  const setCountdownValue = (value: number | string) => {
    setBreathingCount(value);
  };

  const countdown = (seconds: number, callback: () => void) => {
    let left = seconds - 1;

    const interval = setInterval(() => {
      if (left <= 0) {
        clearInterval(interval);
        callback();
      } else {
        setCountdownValue(left);
        left--;
      }
    }, 1000);
  };

  const startBreathingCycle = () => {
    setIsTransitioning(true);
    
    // Inhale
    setActiveLabel("Inhale");
    setBreathingPhase("phase-inhale");
    setBreathingCount(motionConfig.breathing.inhaleSeconds);
    
    countdown(motionConfig.breathing.inhaleSeconds, () => {
      // Hold
      setActiveLabel("Hold");
      setBreathingPhase("phase-hold");
      setBreathingCount(motionConfig.breathing.holdSeconds);
      
      countdown(motionConfig.breathing.holdSeconds, () => {
        // Exhale
        setActiveLabel("Exhale");
        setBreathingPhase("phase-exhale");
        setBreathingCount(motionConfig.breathing.exhaleSeconds);
        
        countdown(motionConfig.breathing.exhaleSeconds, () => {
          nextStep(undefined, true);
        });
      });
    });
  };

  // Canvas Animation Logic
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    window.addEventListener('resize', handleResize);

    class Ripple {
      x: number; y: number; radius: number; maxRadius: number; speed: number; alpha: number;
      constructor(x: number, y: number) {
        this.x = x; this.y = y; this.radius = 0;
        this.maxRadius = 180 + Math.random() * 100;
        this.speed = 0.15; this.alpha = 0.8;
      }
      update() {
        const progress = this.radius / this.maxRadius;
        this.radius += this.speed * (1 - progress + 0.05);
        this.alpha = 0.8 * (1 - progress);
        return this.radius < this.maxRadius;
      }
      draw(ctx: CanvasRenderingContext2D) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${this.alpha})`;
        ctx.lineWidth = 1.5 * this.alpha;
        ctx.stroke();
        if (this.radius > 20) {
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.radius - 20, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 255, 255, ${this.alpha * 0.3})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    class Lily {
      x: number; y: number; size: number; angle: number; drift: number; padColor: string; hasFlower: boolean;
      constructor(x: number, y: number) {
        this.x = x; this.y = y;
        this.size = 35 + Math.random() * 20;
        this.angle = Math.random() * Math.PI * 2;
        this.drift = (Math.random() - 0.5) * 0.0001;
        this.padColor = 'rgba(135, 155, 145, 0.8)';
        this.hasFlower = Math.random() > 0.4;
      }
      update() { this.angle += this.drift; }
      draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.shadowColor = 'rgba(80, 95, 90, 0.15)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 10;
        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0.15, Math.PI * 2 - 0.15);
        ctx.quadraticCurveTo(-this.size * 0.2, 0, 0, 0);
        ctx.closePath();
        ctx.fillStyle = this.padColor;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 0.5;
        for(let i=0; i<7; i++) {
          ctx.rotate((Math.PI * 2) / 7);
          ctx.beginPath();
          ctx.moveTo(0,0);
          ctx.lineTo(this.size * 0.8, 0);
          ctx.stroke();
        }
        if (this.hasFlower) {
          ctx.shadowColor = 'transparent';
          const petals = 8;
          ctx.fillStyle = 'rgba(255, 240, 245, 0.6)';
          for (let i = 0; i < petals; i++) {
            ctx.rotate((Math.PI * 2) / petals);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(this.size * 0.2, this.size * 0.4, 0, this.size * 0.6);
            ctx.quadraticCurveTo(-this.size * 0.2, this.size * 0.4, 0, 0);
            ctx.fill();
          }
          ctx.fillStyle = 'rgba(255, 250, 252, 0.9)';
          ctx.rotate(Math.PI / petals);
          for (let i = 0; i < petals; i++) {
            ctx.rotate((Math.PI * 2) / petals);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(this.size * 0.1, this.size * 0.2, 0, this.size * 0.4);
            ctx.quadraticCurveTo(-this.size * 0.1, this.size * 0.2, 0, 0);
            ctx.fill();
          }
          ctx.beginPath();
          ctx.arc(0, 0, this.size * 0.08, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(245, 215, 140, 0.9)';
          ctx.fill();
        }
        ctx.restore();
      }
    }

    class Fish {
      palette: any; x: number; y: number; vx: number; vy: number; angle: number; baseSpeed: number; speed: number; turnOffset: number; scale: number; numNodes: number; nodes: any[]; widths: number[];
      constructor() {
        const palettes =[
          { body: 'rgba(235, 120, 95, 0.85)', fins: 'rgba(235, 120, 95, 0.4)' },
          { body: 'rgba(255, 252, 248, 0.9)', fins: 'rgba(255, 252, 248, 0.5)' },
          { body: 'rgba(60, 70, 75, 0.8)', fins: 'rgba(60, 70, 75, 0.4)' },
          { body: 'rgba(220, 180, 110, 0.85)', fins: 'rgba(220, 180, 110, 0.4)' }
        ];
        this.palette = palettes[Math.floor(Math.random() * palettes.length)];
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = 0; this.vy = 0;
        this.angle = Math.random() * Math.PI * 2;
        this.baseSpeed = 0.3 + Math.random() * 0.2;
        this.speed = this.baseSpeed;
        this.turnOffset = Math.random() * 1000;
        this.scale = 0.8 + Math.random() * 0.6;
        this.numNodes = 14;
        this.nodes = [];
        const targetDist = 5 * this.scale;
        for(let i=0; i<this.numNodes; i++) {
          this.nodes.push({
            x: this.x - Math.cos(this.angle) * (i * targetDist),
            y: this.y - Math.sin(this.angle) * (i * targetDist)
          });
        }
        this.widths =[3, 6, 8, 8.5, 8, 7, 5.5, 4, 3, 2, 1.5, 4, 5, 1].map(w => w * this.scale);
      }
      update(timeSeconds: number, ripples: Ripple[]) {
        this.speed += (this.baseSpeed - this.speed) * 0.015;
        this.angle += Math.sin(timeSeconds + this.turnOffset) * 0.003;
        const targetVx = Math.cos(this.angle) * this.speed;
        const targetVy = Math.sin(this.angle) * this.speed;
        let nudgeX = 0; let nudgeY = 0;
        for (let i = 0; i < ripples.length; i++) {
          const r = ripples[i];
          const dx = this.nodes[0].x - r.x;
          const dy = this.nodes[0].y - r.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (Math.abs(dist - r.radius) < 40) {
            const force = (40 - Math.abs(dist - r.radius)) / 40;
            const pushAngle = Math.atan2(dy, dx);
            nudgeX += Math.cos(pushAngle) * force * 0.3;
            nudgeY += Math.sin(pushAngle) * force * 0.3;
          }
        }
        this.vx += (targetVx + nudgeX - this.vx) * 0.05;
        this.vy += (targetVy + nudgeY - this.vy) * 0.05;
        this.nodes[0].x += this.vx;
        this.nodes[0].y += this.vy;
        const margin = 150;
        if (this.nodes[0].x < -margin) this.nodes[0].x = width + margin;
        if (this.nodes[0].x > width + margin) this.nodes[0].x = -margin;
        if (this.nodes[0].y < -margin) this.nodes[0].y = height + margin;
        if (this.nodes[0].y > height + margin) this.nodes[0].y = -margin;
        for (let i = 1; i < this.numNodes; i++) {
          const dx = this.nodes[i-1].x - this.nodes[i].x;
          const dy = this.nodes[i-1].y - this.nodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const segmentTargetDist = 5 * this.scale;
          if (dist > segmentTargetDist) {
            this.nodes[i].x = this.nodes[i-1].x - (dx / dist) * segmentTargetDist;
            this.nodes[i].y = this.nodes[i-1].y - (dy / dist) * segmentTargetDist;
          }
        }
      }
      draw(ctx: CanvasRenderingContext2D) {
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.shadowColor = 'rgba(70, 85, 90, 0.15)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 15;
        if (this.nodes[2] && this.nodes[3]) {
          const dx = this.nodes[2].x - this.nodes[3].x;
          const dy = this.nodes[2].y - this.nodes[3].y;
          const angle = Math.atan2(dy, dx);
          ctx.fillStyle = this.palette.fins;
          ctx.beginPath();
          ctx.save();
          ctx.translate(this.nodes[2].x, this.nodes[2].y);
          ctx.rotate(angle + Math.PI/3);
          ctx.ellipse(this.scale * 8, 0, this.scale * 10, this.scale * 4, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          ctx.save();
          ctx.translate(this.nodes[2].x, this.nodes[2].y);
          ctx.rotate(angle - Math.PI/3);
          ctx.ellipse(this.scale * 8, 0, this.scale * 10, this.scale * 4, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        ctx.fillStyle = this.palette.body;
        ctx.beginPath();
        const leftPoints = [];
        const rightPoints = [];
        for (let i = 0; i < this.numNodes; i++) {
          let angle;
          if (i === 0) angle = Math.atan2(this.nodes[0].y - this.nodes[1].y, this.nodes[0].x - this.nodes[1].x);
          else if (i === this.numNodes - 1) angle = Math.atan2(this.nodes[i-1].y - this.nodes[i].y, this.nodes[i-1].x - this.nodes[i].x);
          else {
            const dx = this.nodes[i-1].x - this.nodes[i+1].x;
            const dy = this.nodes[i-1].y - this.nodes[i+1].y;
            angle = Math.atan2(dy, dx);
          }
          const normal = angle + Math.PI / 2;
          const w = this.widths[i];
          leftPoints.push({ x: this.nodes[i].x + Math.cos(normal) * w, y: this.nodes[i].y + Math.sin(normal) * w });
          rightPoints.push({ x: this.nodes[i].x - Math.cos(normal) * w, y: this.nodes[i].y - Math.sin(normal) * w });
        }
        ctx.moveTo(leftPoints[0].x, leftPoints[0].y);
        for (let i = 1; i < leftPoints.length; i++) ctx.lineTo(leftPoints[i].x, leftPoints[i].y);
        for (let i = rightPoints.length - 1; i >= 0; i--) ctx.lineTo(rightPoints[i].x, rightPoints[i].y);
        ctx.closePath();
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1 * this.scale;
        ctx.beginPath();
        ctx.moveTo(this.nodes[0].x, this.nodes[0].y);
        for(let i=1; i<7; i++) ctx.lineTo(this.nodes[i].x, this.nodes[i].y);
        ctx.stroke();
      }
    }

    const fishes: Fish[] = [];
    const ripples: Ripple[] = [];
    const lilies: Lily[] = [];

    for (let i = 0; i < 7; i++) {
      let placed = false, attempts = 0;
      while (!placed && attempts < 50) {
        const testX = Math.random() * width, testY = Math.random() * height;
        let collision = false;
        for (let j = 0; j < lilies.length; j++) {
          const dx = testX - lilies[j].x, dy = testY - lilies[j].y;
          if (Math.sqrt(dx*dx + dy*dy) < 180) { collision = true; break; }
        }
        if (!collision) { lilies.push(new Lily(testX, testY)); placed = true; }
        attempts++;
      }
    }
    for (let i = 0; i < 9; i++) fishes.push(new Fish());

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || event.button === 0) {
        const isInteractive = Boolean((event.target as Element).closest('button, a'));
        if (isInteractive) return;
        
        ripples.push(new Ripple(event.clientX, event.clientY));
        
        fishes.forEach(fish => {
          const dx = fish.nodes[0].x - event.clientX;
          const dy = fish.nodes[0].y - event.clientY;
          if (Math.sqrt(dx * dx + dy * dy) < 220) {
            fish.speed = 2.5;
            fish.angle = Math.atan2(dy, dx); 
          }
        });
        
        if (event.pointerType === 'touch' || event.pointerType === 'pen') {
          canvas.releasePointerCapture?.(event.pointerId);
        }
      }
    };

    canvas.addEventListener('pointerdown', handlePointerDown);

    let animationFrameId: number;
    const animatePond = (nowMs = 0) => {
      ctx.clearRect(0, 0, width, height);
      
      lilies.forEach(lily => { lily.update(); lily.draw(ctx); });
      fishes.forEach(fish => { fish.update(nowMs * 0.0001, ripples); fish.draw(ctx); });
      
      for (let i = ripples.length - 1; i >= 0; i--) {
        if (!ripples[i].update()) ripples.splice(i, 1);
        else ripples[i].draw(ctx);
      }

      animationFrameId = requestAnimationFrame(animatePond);
    };

    animationFrameId = requestAnimationFrame(animatePond);

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const getRevealClass = (index: number) => {
    let classes = "reveal-item";
    if (isItemsVisible) classes += " is-visible";
    if (isItemsExiting) classes += " is-exiting-item";
    return classes;
  };

  const getRevealStyle = (index: number) => ({
    transitionDuration: `1000ms`,
    transitionDelay: `0ms`
  });

  return (
    <div className="zen-pond-root">
      <svg id="texture">
        <filter id="noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch"/>
          <feColorMatrix type="matrix" values="1 0 0 0 0, 0 1 0 0 0, 0 0 1 0 0, 0 0 0 0.1 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noise)"/>
      </svg>

      <canvas id="pond" ref={canvasRef}></canvas>

      <button 
        onClick={handleSkip}
        className="fixed top-6 right-6 z-[110] px-4 py-2 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-slate-700 text-xs font-bold tracking-widest uppercase hover:bg-white/40 transition-all pointer-events-auto"
      >
        Skip Intro
      </button>

      <div id="ui-container" className={isUiVisible ? 'is-visible' : ''} style={{ display: isUiVisible || isExitingFinal ? 'flex' : 'none' }}>
        <div 
          className={`card ${isCardVisible ? 'is-visible' : ''} ${isExitingFinal ? 'is-exiting-final' : ''}`} 
          id="card-container"
        >
          <div id="card-content">
            {step.type === 'breathe' && (
              <div className="breathing-container">
                <div 
                  className={`breathing-circle ${breathingPhase} ${getRevealClass(0)}`} 
                  style={{...getRevealStyle(0), transitionDuration: `${breathingPhase === 'phase-inhale' ? motionConfig.breathing.inhaleSeconds * 1000 : breathingPhase === 'phase-hold' ? 1500 : motionConfig.breathing.exhaleSeconds * 1000}ms`}}
                >
                  <span className={`breathing-count ${isCountChanging ? 'is-changing' : ''}`}>
                    {breathingCount || motionConfig.breathing.inhaleSeconds}
                  </span>
                </div>
                <div className={`breathing-label ${getRevealClass(1)}`} style={getRevealStyle(1)}>
                  <span className={`breathing-label-text ${activeLabel === 'Get ready...' ? 'is-active' : ''}`}>Get ready...</span>
                  <span className={`breathing-label-text ${activeLabel === 'Inhale' ? 'is-active' : ''}`}>Inhale</span>
                  <span className={`breathing-label-text ${activeLabel === 'Hold' ? 'is-active' : ''}`}>Hold</span>
                  <span className={`breathing-label-text ${activeLabel === 'Exhale' ? 'is-active' : ''}`}>Exhale</span>
                </div>
              </div>
            )}

            {step.type === 'text' && (
              <>
                <h2 className={getRevealClass(0)} style={getRevealStyle(0)}>{step.title}</h2>
                {step.text && <p className={getRevealClass(1)} style={getRevealStyle(1)}>{step.text}</p>}
                <button 
                  className={`btn ${getRevealClass(2)}`} 
                  style={getRevealStyle(2)}
                  onClick={() => nextStep()}
                >
                  {step.btn}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
