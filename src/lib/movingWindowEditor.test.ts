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

  it('should correctly merge with previous line', () => {
    const text = "abcde\n\nfghij";
    // Place cursor in the middle empty line (index 6)
    const editor = new MovingWindowEditor(text, 6);

    // Merge with previous line: should remove the empty line
    editor.mergeWithPreviousLine();
    expect(editor.getText()).toBe("abcde\nfghij");
    const [start1, end1] = editor.getWindowStartEnd();
    expect(start1).toBe(0);
    expect(end1).toBe(5);
    expect(editor.getWindow()).toBe("abcde");

    // Merge again on the first line: should do nothing
    editor.mergeWithPreviousLine();
    expect(editor.getText()).toBe("abcde\nfghij");
    const [start2, end2] = editor.getWindowStartEnd();
    expect(start2).toBe(0);
    expect(end2).toBe(5);
    expect(editor.getWindow()).toBe("abcde");

    // Move cursor to the end of the text (last line)
    editor.setCursor(editor.getText().length);
    // Merge with previous line: should join with a space
    editor.mergeWithPreviousLine();
    expect(editor.getText()).toBe("abcde fghij");
    const [start3, end3] = editor.getWindowStartEnd();
    expect(start3).toBe(0);
    expect(end3).toBe(5);
    expect(editor.getWindow()).toBe("abcde");
  });

  it('should track window start shift when editing in the middle of text', () => {
    // Exact user scenario from problem description with windowSize = 50
    const initialText = "text 1 text 2 text 3 text 4 text 5 text 6 text 7 text 8";
    // Set cursor near end
    const editor = new MovingWindowEditor(initialText, initialText.length, 50, 100);
    expect(editor.getWindow()).toBe("1 text 2 text 3 text 4 text 5 text 6 text 7 text 8");
    const [oldStart, oldCursor] = editor.getWindowStartEnd();

    // User types " t" right after "7" in the window "1 text 2 text 3 text 4 text 5 text 6 text 7"
    // In window "1 text 2 text 3 text 4 text 5 text 6 text 7 text 8", position after "7" is index 49 (selection cursor = 49)
    const windowTextBeforeEdit = editor.getWindow();
    const posAfter7InWindow = windowTextBeforeEdit.indexOf('7') + 1; // 49
    const newWindowText = windowTextBeforeEdit.substring(0, posAfter7InWindow) + " t" + windowTextBeforeEdit.substring(posAfter7InWindow);

    editor.update(newWindowText);

    const [newStart, newCursor] = editor.getWindowStartEnd();
    expect(editor.getWindow()).toBe("text 2 text 3 text 4 text 5 text 6 text 7 t text 8");

    const deltaStart = newStart - oldStart; // 7
    const originalSelection = posAfter7InWindow + 2; // 51 (after typing " t")
    const adjustedSelection = originalSelection - deltaStart; // 51 - 7 = 44

    // Ensure adjustedSelection points to index right after 't' in the new window
    expect(editor.getWindow().substring(0, adjustedSelection)).toBe("text 2 text 3 text 4 text 5 text 6 text 7 t");
  });

  it('should replace a range of text correctly with replaceRange', () => {
    const text = "First paragraph.\nSecond paragraph.\nThird paragraph.";
    const editor = new MovingWindowEditor(text, text.length);

    // Replace "Second paragraph." (start index 17, end index 34)
    const secondStart = 17;
    const secondEnd = 34;
    editor.replaceRange(secondStart, secondEnd, "Modified second paragraph.");

    expect(editor.getText()).toBe("First paragraph.\nModified second paragraph.\nThird paragraph.");
    expect(editor.getWindowStartEnd()[1]).toBe(secondStart + "Modified second paragraph.".length);
  });
});
