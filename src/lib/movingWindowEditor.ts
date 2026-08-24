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

    // Ideal start is windowSize characters behind the cursor, but not before lineStart
    let idealStart = Math.max(lineStart, this.cursor - this.windowSize);
    let actualStart = idealStart;

    // If we're not at lineStart and the character before our potential start is a "word" character,
    // we move back to find the start of that word within the current line.
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
    } else {
      // Ensure we don't cross line boundaries
      actualStart = Math.max(lineStart, actualStart);
    }

    // Ensure we don't go past the start of the line
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
    const targetCursor = this.cursor + delta * this.windowSize;
    if (0 < delta) {
      let currentCursor = this.cursor;
      if (currentCursor < this.text.length && this.text[currentCursor] === '\n') {
        currentCursor += 1;
      }
      const nextLineBreak = this.text.indexOf('\n', currentCursor);
      const nextLineBreakOrEnd = 0 <= nextLineBreak ? nextLineBreak : this.text.length;
      const ceilDeltaTillNextLineBreakOrEnd = Math.max(
        1,
        Math.ceil((nextLineBreakOrEnd - currentCursor) / this.windowSize)
      );
      if (nextLineBreakOrEnd <= targetCursor) {
        this.setCursor(nextLineBreakOrEnd);
        const remainingDelta = delta - ceilDeltaTillNextLineBreakOrEnd;
        return this.moveCursorByWindowSize(remainingDelta);
      }
    } else {
      let currentCursor = this.cursor;
      if (currentCursor > 0 && this.text[currentCursor - 1] === '\n') {
        currentCursor -= 1;
      }
      const prevLineBreak = this.text.lastIndexOf('\n', currentCursor - 1);
      const prevLineBreakOrStart = 0 <= prevLineBreak ? prevLineBreak : 0;
      const ceilDeltaTillPrevLineBreakOrStart = Math.max(
        1,
        Math.ceil((currentCursor - prevLineBreakOrStart) / this.windowSize)
      );
      if (delta < 0 && prevLineBreakOrStart >= targetCursor) {
        this.setCursor(prevLineBreakOrStart);
        const remainingDelta = delta + ceilDeltaTillPrevLineBreakOrStart;
        return this.moveCursorByWindowSize(remainingDelta);
      }
    }
    // Not yet returning, so there’s no line break between the cursor
    // and the target.
    const tempCursor = (
      targetCursor + this.windowSize
      // Temporarily go forward another window to find the word boundary.
    );
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
