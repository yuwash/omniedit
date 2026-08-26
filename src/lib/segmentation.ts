export type HighlightSegment = { text: string; isMatch: boolean; start?: number };

export type FormattedSegment =
  | { type: 'normal'; text: string }
  | { type: 'strong'; text: string }
  | { type: 'match'; text: string; start: number };

export function getRenderedSearchParagraphs(text: string, searchMatches: { start: number; end: number }[]): FormattedSegment[][] {
  const rawSegments = getSearchSegments(text, searchMatches);
  const paragraphs: FormattedSegment[][] = [[]];
  for (const seg of rawSegments) {
    const parts = seg.text.split('\n');
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) {
        paragraphs.push([]);
      }
      if (parts[i]) {
        if (seg.isMatch && seg.start !== undefined) {
          paragraphs[paragraphs.length - 1].push({
            type: 'match',
            text: parts[i],
            start: seg.start,
          });
        } else {
          paragraphs[paragraphs.length - 1].push({
            type: 'normal',
            text: parts[i],
          });
        }
      }
    }
  }
  return paragraphs;
}

export function getRenderedDocumentsParagraphs(documents: Document[]): FormattedSegment[][] {
  // Show document list in preview area
  const paragraphs: FormattedSegment[][] = [[]];
  
  // Add header
  paragraphs[0].push({
    type: 'strong',
    text: 'Documents:'
  });
  
  // Add each document as a button
  for (const doc of documents) {
    paragraphs.push([]);
    paragraphs[paragraphs.length - 1].push({
      type: 'normal',
      text: '- '
    });
    paragraphs[paragraphs.length - 1].push({
      type: 'match',
      text: doc.name,
      start: 0
    });
  }
  
  return paragraphs;
}

export function getRenderedInputParagraphs(text: string, windowRange: [number, number]): FormattedSegment[][] {
  if (!text) return [];

  const [start, end] = windowRange;
  const before = text.substring(0, start);
  const windowed = text.substring(start, end);
  const after = text.substring(end);

  const segments: Array<{ type: 'normal' | 'strong'; text: string }> = [];
  if (before) segments.push({ type: 'normal', text: before });
  if (windowed) segments.push({ type: 'strong', text: windowed });
  if (after) segments.push({ type: 'normal', text: after });

  const paragraphs: FormattedSegment[][] = [[]];
  for (const seg of segments) {
    const parts = seg.text.split('\n');
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) {
        paragraphs.push([]);
      }
      if (parts[i]) {
        paragraphs[paragraphs.length - 1].push(
          seg.type === 'strong'
            ? { type: 'strong', text: parts[i] }
            : { type: 'normal', text: parts[i] }
        );
      }
    }
  }

  return paragraphs;
}

export function getSearchSegments(text: string, searchMatches: { start: number; end: number }[]): HighlightSegment[] {
  if (!text) return [];
  if (!searchMatches || searchMatches.length === 0) {
    return [{ text, isMatch: false }];
  }

  const segments: HighlightSegment[] = [];
  let lastIndex = 0;

  for (const match of searchMatches) {
    if (match.start > lastIndex) {
      segments.push({
        text: text.substring(lastIndex, match.start),
        isMatch: false,
      });
    }
    segments.push({
      text: text.substring(match.start, match.end),
      isMatch: true,
      start: match.start,
    });
    lastIndex = match.end;
  }

  if (lastIndex < text.length) {
    segments.push({
      text: text.substring(lastIndex),
      isMatch: false,
    });
  }

  return segments;
}
