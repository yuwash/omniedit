export class MovingWindowEditor {
  private text: string;
  private cursor: number;
  private windowSize: number;
  private maxWindowSize: number;
  private start: number;

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
    // Ideal start is windowSize characters behind the cursor
    let idealStart = Math.max(0, this.cursor - this.windowSize);
    let actualStart = idealStart;

    // Word boundary logic: 
    // If we aren't at the start of the text, and the character before our
    // potential start is a "word" character, we move back to find the start of that word.
    if (actualStart > 0 && this.isWordChar(this.text[actualStart - 1])) {
      let lookback = actualStart - 1;
      while (lookback >= 0 && this.isWordChar(this.text[lookback])) {
        lookback--;
      }
      
      // Check if including this word exceeds maxWindowSize
      const potentialStart = lookback + 1;
      if (this.cursor - potentialStart <= this.maxWindowSize) {
        actualStart = potentialStart;
      } else {
        // Hard cut at maxWindowSize
        actualStart = Math.max(0, this.cursor - this.maxWindowSize);
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

  public update(newWindowText: string): void {
    const before = this.text.substring(0, this.start);
    const after = this.text.substring(this.cursor);
    
    // Update the full text by replacing the window slice
    this.text = before + newWindowText + after;
    
    // The cursor moves to the end of the newly inserted text
    this.setCursor(this.start + newWindowText.length);
  }
}
