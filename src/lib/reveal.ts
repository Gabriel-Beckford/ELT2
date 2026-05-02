export interface PacingConfig {
  wpm: number;
  minCps: number;
  maxCps: number;
  pauseMultipliers: {
    comma: number;
    sentence: number;
    paragraph: number;
  };
}

const DEFAULT_PACING: PacingConfig = {
  wpm: 220,
  minCps: 15,
  maxCps: 80,
  pauseMultipliers: {
    comma: 2.5,
    sentence: 5,
    paragraph: 10,
  },
};

/**
 * SoftRevealController handles the decoupling of a text buffer and its visible representation.
 * It reveals text at a controlled rate to simulate reading speed with natural pacing.
 */
export class SoftRevealController {
  private buffer: string = '';
  private visible: string = '';
  private onUpdate: (visible: string) => void;
  private onComplete?: () => void;
  private config: PacingConfig;
  private timer: any = null;
  private isFinished: boolean = false;
  private msPerChar: number;

  constructor(options: {
    onUpdate: (visible: string) => void;
    onComplete?: () => void;
    pacing?: Partial<PacingConfig>;
  }) {
    this.onUpdate = options.onUpdate;
    this.onComplete = options.onComplete;
    this.config = { ...DEFAULT_PACING, ...options.pacing };
    
    // Calculate base CPS and cap it
    let cps = (this.config.wpm * 6) / 60;
    cps = Math.max(this.config.minCps, Math.min(this.config.maxCps, cps));
    this.msPerChar = 1000 / cps;
  }

  /**
   * Appends new text to the buffer.
   */
  append(text: string) {
    this.buffer += text;
    this.isFinished = false;
    this.scheduleTick(0);
  }

  /**
   * Signals that no more text will be appended.
   */
  finish() {
    this.isFinished = true;
    this.scheduleTick(0);
  }

  private scheduleTick(delay: number) {
    if (this.timer) return;
    this.timer = setTimeout(() => this.tick(), delay);
  }

  private tick() {
    this.timer = null;

    if (this.visible.length >= this.buffer.length) {
      if (this.isFinished) {
        if (this.onComplete) this.onComplete();
      }
      return;
    }

    // 1. Find the next safe boundary (newline or end of buffer)
    let nextIndex = this.visible.length;
    let foundBoundary = false;

    // Find the next newline character
    const nextNewline = this.buffer.indexOf('\n', nextIndex);
    
    if (nextNewline !== -1) {
      // Find the end of this newline group to include the full break
      let endOfNewlines = nextNewline;
      while (endOfNewlines < this.buffer.length && this.buffer[endOfNewlines] === '\n') {
        endOfNewlines++;
      }
      nextIndex = endOfNewlines;
      foundBoundary = true;
    } else if (this.isFinished) {
      nextIndex = this.buffer.length;
      foundBoundary = true;
    }

    if (!foundBoundary) {
      this.scheduleTick(100);
      return;
    }

    // 2. Guardrails for Markdown constructs (Syntactic Stability)
    const candidateVisible = this.buffer.slice(0, nextIndex);
    if (!this.isFinished && !this.isSyntacticallyStable(candidateVisible)) {
      // If unstable, defer until we have more buffer or hit a stable point
      // We search ahead for a closing tag if it exists in the current buffer
      const stableIndex = this.findNextStableIndex(nextIndex);
      if (stableIndex !== -1) {
        nextIndex = stableIndex;
      } else {
        // Still unstable and no closing tag in buffer yet, wait
        this.scheduleTick(100);
        return;
      }
    }

    const revealedText = this.buffer.slice(this.visible.length, nextIndex);
    this.visible = this.buffer.slice(0, nextIndex);
    this.onUpdate(this.visible);

    // Calculate base delay for this chunk
    let delay = revealedText.length * this.msPerChar;
    
    // Apply pause multipliers based on the end of the chunk
    const lastChar = revealedText[revealedText.length - 1];
    const lastTwo = revealedText.slice(-2);

    if (lastTwo === '\n\n' || lastChar === '\n') {
      delay *= this.config.pauseMultipliers.paragraph;
    } else if (['.', '!', '?'].includes(lastChar)) {
      delay *= this.config.pauseMultipliers.sentence;
    } else if ([',', ';', ':'].includes(lastChar)) {
      delay *= this.config.pauseMultipliers.comma;
    }

    // Cap delay to ensure it doesn't feel stuck
    delay = Math.min(delay, 1500);

    this.scheduleTick(delay);
  }

  /**
   * Checks if the text ends in a syntactically stable state for Markdown.
   */
  private isSyntacticallyStable(text: string): boolean {
    // Check for unbalanced code blocks
    const codeBlockCount = (text.match(/```/g) || []).length;
    if (codeBlockCount % 2 !== 0) return false;

    // Check for unbalanced links [text](url)
    const lastOpenBracket = text.lastIndexOf('[');
    const lastCloseBracket = text.lastIndexOf(']');
    if (lastOpenBracket > lastCloseBracket) return false;

    const lastOpenParen = text.lastIndexOf('(');
    const lastCloseParen = text.lastIndexOf(')');
    // If we just closed a bracket, we might be starting a paren for a link
    if (lastCloseBracket !== -1 && lastCloseBracket === text.length - 1) {
        // Wait to see if a '(' follows
        return false; 
    }
    if (lastOpenParen > lastCloseParen) {
        // Check if this paren follows a bracket (likely a link)
        const textBeforeParen = text.slice(0, lastOpenParen);
        if (textBeforeParen.endsWith(']')) return false;
    }

    // Check for unbalanced bold/italic
    const boldCount = (text.match(/\*\*/g) || []).length;
    if (boldCount % 2 !== 0) return false;
    
    const italicCount = (text.replace(/\*\*/g, '').match(/\*/g) || []).length;
    if (italicCount % 2 !== 0) return false;

    return true;
  }

  /**
   * Attempts to find the next stable index in the buffer starting from candidateIndex.
   */
  private findNextStableIndex(candidateIndex: number): number {
    // We search up to a reasonable limit to find a closing tag
    const searchLimit = Math.min(candidateIndex + 100, this.buffer.length);
    for (let i = candidateIndex + 1; i <= searchLimit; i++) {
      if (this.isSyntacticallyStable(this.buffer.slice(0, i))) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Cleanup resources.
   */
  destroy() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  getVisible() {
    return this.visible;
  }

  getBuffer() {
    return this.buffer;
  }
}
