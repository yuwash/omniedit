export class MovingWindowEditor {
  private text: string;
  private cursor: number;
  private windowSize: number;
  private maxWindowSize: number;
  private start!: number;

  constructor(
    text: string = "",
    cursor: number = text.length,
    windowSize: number = 50,
    maxWindowSize: number = 100
  ) {
    this.text = text;
    this.cursor = cursor;
    this.windowSize = windowSize;
    this.maxWindowSize = maxWindowSize;
    this.calculateStart();
  }

  private calculateStart(): void {
    // Find the start of the line containing the cursor
    const lineStart = this.text.lastIndexOf('\n', this.cursor - 1) + 1;

    // Ideal start is windowSize characters behind the cursor (within the current line)
    let idealStart = Math.max(lineStart, this.cursor - this.windowSize);
    let actualStart = idealStart;

    // If we're not at lineStart and the character before our potential start is a "word" character,
    // we move back to find the start of that word within lineStart.
    if (actualStart > lineStart && this.isWordChar(this.text[actualStart - 1])) {
      let lookback = actualStart - 1;
      // Move back until we hit a non-word character or lineStart
      while (lookback >= lineStart && this.isWordChar(this.text[lookback])) {
        lookback--;
      }
      
      // Check if including this word exceeds maxWindowSize
      const potentialStart = lookback + 1;
      if (this.cursor - potentialStart <= this.maxWindowSize) {
        actualStart = potentialStart;
      } else {
        // Hard cut at maxWindowSize
        actualStart = Math.max(lineStart, this.cursor - this.maxWindowSize);
      }
    }

    this.start = actualStart;
  }

  private isWordChar(char: string): boolean {
    // Standard regex for word characters: [a-zA-Z0-9_]
    return /\w/.test(char);
  }

  public getText(): string {
    return this.text;
  }

  public getWindow(): string {
    return this.text.substring(this.start, this.cursor);
  }

  public getWindowStartEnd(): [number, number] {
    return [this.start, this.cursor];    
  } 

  public setCursor(position: number): void {
    this.cursor = Math.max(0, Math.min(position, this.text.length));
    this.calculateStart();
  }

  public moveCursorByWindowSize(delta: number): void {
    if (delta == 0) {
      return;
    }
    if (0 < delta) {
      const nextLineBreak = this.text.indexOf('\n', this.cursor);
      if (nextLineBreak !== -1) {
        this.setCursor(nextLineBreak + 1);
        return;
      }
      const targetCursor = this.cursor + delta * this.windowSize;
      const ceilDeltaTillNextLineBreakOrEnd = Math.ceil(
        (this.text.length - this.cursor) / this.windowSize
      );
      if (this.text.length <= targetCursor) {
        this.setCursor(this.text.length);
        const remainingDelta = delta - ceilDeltaTillNextLineBreakOrEnd;
        return this.moveCursorByWindowSize(remainingDelta);
      }
    } else {
      const currentLineStart = this.text.lastIndexOf('\n', this.cursor - 1) + 1;
      if (this.cursor > currentLineStart) {
        this.setCursor(currentLineStart);
        return;
      }
      if (currentLineStart > 0) {
        const prevLineStart = this.text.lastIndexOf('\n', currentLineStart - 2) + 1;
        this.setCursor(prevLineStart);
        return;
      }
      this.setCursor(0);
      return;
    }
    const targetCursor = this.cursor + delta * this.windowSize;
    const tempCursor = targetCursor + this.windowSize;
    this.setCursor(tempCursor);
    if (0 < this.start) {
      this.setCursor(this.start);
    }
  }

  public update(newWindowText: string): void {
    const before = this.text.substring(0, this.start);
    const after = this.text.substring(this.cursor);
    
    // Update the full text by replacing the window slice
    this.text = before + newWindowText + after;
    
    // The cursor moves to the end of the newly inserted text
    this.setCursor(this.start + newWindowText.length);
  }
}
