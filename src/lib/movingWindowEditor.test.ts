import { describe, it, expect } from 'vitest';
import { MovingWindowEditor } from './movingWindowEditor';

describe('MovingWindowEditor', () => {
  it('should handle moveCursorByWindowSize correctly for the specified scenario', () => {
    // Create a single-line text of 168 characters made of 18 times a 7-letter word delimited with a space
    const word = 'abcdefg';
    const text = Array(18).fill(word).join(' '); // 18*7 + 17 = 143
    
    // Create editor with default parameters
    const editor = new MovingWindowEditor(text);
    
    // Check initial state - cursor should be at the end of text
    const [start, end] = editor.getWindowStartEnd();
    expect(end).toBe(143); // cursor should be at end
    
    // Call moveCursorByWindowSize with -2
    editor.moveCursorByWindowSize(-2);
    const [start1, end1] = editor.getWindowStartEnd();
    
    // Should select the first part of the text (window size is 50 by default)
    expect(start1).toBe(0);
    expect(end1).toBe(32);
    
    // Call moveCursorByWindowSize with -1
    editor.moveCursorByWindowSize(-1);
    const [start2, end2] = editor.getWindowStartEnd();
    
    // Should not change since we're already at the beginning
    expect(start2).toBe(0);
    expect(end2).toBe(32);
    
    // Call moveCursorByWindowSize with 2
    editor.moveCursorByWindowSize(2);
    const [start3, end3] = editor.getWindowStartEnd();
    
    // Should be at the end of the text
    expect(start3).toBe(88);
    expect(end3).toBe(143);
  });

  it('should handle multiline navigation when moving backward and forward', () => {
    const text = "abcde fg\nhij\nikl";
    const editor = new MovingWindowEditor(text, text.length, 5, 10);

    // Initial state at end of document
    let [start, end] = editor.getWindowStartEnd();
    expect(end).toBe(text.length);

    // Move backward across line breaks
    editor.moveCursorByWindowSize(-3);
    let [start1, end1] = editor.getWindowStartEnd();
    expect(start1).toBe(0);
    expect(end1).toBe(8);

    // Moving backward when already at start (0) should remain 0
    editor.moveCursorByWindowSize(-1);
    let [start2, end2] = editor.getWindowStartEnd();
    expect(start2).toBe(0);
    expect(end2).toBe(8);

    // Move forward to the second line
    editor.moveCursorByWindowSize(1);
    let [start3, end3] = editor.getWindowStartEnd();
    expect(start3).toBe(9);
    expect(end3).toBe(12);

    // Move forward to the end of the text
    editor.moveCursorByWindowSize(1);
    let [start4, end4] = editor.getWindowStartEnd();
    expect(start4).toBe(13);
    expect(end4).toBe(text.length);

    // Moving forward when already at the end should remain at the end
    editor.moveCursorByWindowSize(1);
    let [start5, end5] = editor.getWindowStartEnd();
    expect(start5).toBe(13);
    expect(end5).toBe(text.length);
  });
});
