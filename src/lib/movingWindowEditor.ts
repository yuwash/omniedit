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
    } else {
      // Ensure we don't cross line boundaries
      actualStart = Math.max(lineStart, actualStart);
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
    if (delta === 0) {
      return;
    }

    if (delta < 0) {
      const lineStart = this.text.lastIndexOf('\n', Math.max(0, this.cursor - 1)) + 1;
      if (this.start > lineStart) {
        this.setCursor(this.start);
        return this.moveCursorByWindowSize(delta + 1);
      } else if (lineStart > 0) {
        this.setCursor(lineStart - 1);
        return this.moveCursorByWindowSize(delta + 1);
      } else {
        return;
      }
    } else {
      const nextLineBreak = this.text.indexOf('\n', this.cursor);
      const lineEnd = nextLineBreak !== -1 ? nextLineBreak : this.text.length;

      if (this.cursor < lineEnd) {
        const targetCursor = this.cursor + this.windowSize;
        if (targetCursor >= lineEnd) {
          this.setCursor(lineEnd);
        } else {
          const tempCursor = Math.min(lineEnd, targetCursor + this.windowSize);
          this.setCursor(tempCursor);
          if (0 < this.start && tempCursor < lineEnd) {
            this.setCursor(this.start);
          }
        }
        return this.moveCursorByWindowSize(delta - 1);
      } else if (lineEnd < this.text.length) {
        this.setCursor(lineEnd + 1);
        return this.moveCursorByWindowSize(delta);
      } else {
        return;
      }
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

  public get windowIsAtLineStart(): boolean {
    return (
      this.start === 0
      || this.text[this.start - 1] === '\n'
    );
  }

  public mergeWithPreviousLine(): void {
    const previousLineEnd = this.text.lastIndexOf('\n', Math.max(0, this.cursor - 1));
    const currentWindow = this.getWindow();
    const before = this.text.substring(0, previousLineEnd);  // Without the newline
    const after = this.text.substring(previousLineEnd + 1);
    this.text = before + (
      (before[before.length - 1] === '\n' || after[0] === '\n') ? '' : ' '
    ) + after;
    this.setCursor(previousLineEnd);
  }

  public splitLine(position: number): void {
    const originalBefore = this.text.substring(0, position);
    const deletableTrailingSpace = (
      // Delete the trailing space if there’s exactly one.
      /[^ ] $/.test(originalBefore)
    );
    const before = (
      deletableTrailingSpace
      ? originalBefore.substring(0, originalBefore.length - 1)
      : originalBefore
    );
    const after = this.text.substring(position);
    this.text = before + '\n' + after;
    this.setCursor(deletableTrailingSpace ? position -1 : position);
    this.moveCursorByWindowSize(1);
  }
}
