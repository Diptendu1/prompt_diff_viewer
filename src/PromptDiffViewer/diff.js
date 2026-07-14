/**
 * Zero-dependency diff engine for the PromptDiffViewer component.
 *
 * Produces a line-level diff (LCS based). Removed/added line runs that sit
 * next to each other are paired up as "modified" lines, and each pair gets a
 * word-level diff so the exact edits inside a line can be highlighted.
 */

/** Longest-common-subsequence table over two arrays of strings. */
function lcsMatrix(a, b) {
  const n = a.length;
  const m = b.length;
  // (n+1) x (m+1) table, flat Int32Array for speed/memory.
  const table = new Int32Array((n + 1) * (m + 1));
  const w = m + 1;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      table[i * w + j] =
        a[i - 1] === b[j - 1]
          ? table[(i - 1) * w + (j - 1)] + 1
          : Math.max(table[(i - 1) * w + j], table[i * w + (j - 1)]);
    }
  }
  return table;
}

/**
 * Generic diff over two token arrays.
 * Returns ops: { type: 'equal' | 'remove' | 'add', value: string }[]
 */
export function diffTokens(a, b) {
  const table = lcsMatrix(a, b);
  const w = b.length + 1;
  const ops = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      ops.push({ type: 'equal', value: a[i - 1] });
      i--;
      j--;
    } else if (table[(i - 1) * w + j] >= table[i * w + (j - 1)]) {
      ops.push({ type: 'remove', value: a[i - 1] });
      i--;
    } else {
      ops.push({ type: 'add', value: b[j - 1] });
      j--;
    }
  }
  while (i > 0) ops.push({ type: 'remove', value: a[--i] });
  while (j > 0) ops.push({ type: 'add', value: b[--j] });
  return ops.reverse();
}

/** Split a line into words + whitespace + punctuation tokens for inline diffs. */
function tokenizeWords(text) {
  return text.match(/\s+|\w+|[^\s\w]/g) || [];
}

/**
 * Word-level diff between two lines, with adjacent same-type tokens merged.
 * Returns segments: { type: 'equal' | 'remove' | 'add', value: string }[]
 */
export function diffWords(oldLine, newLine) {
  const ops = diffTokens(tokenizeWords(oldLine), tokenizeWords(newLine));
  const merged = [];
  for (const op of ops) {
    const last = merged[merged.length - 1];
    if (last && last.type === op.type) last.value += op.value;
    else merged.push({ type: op.type, value: op.value });
  }
  return merged;
}

/**
 * Line-level diff between two multi-line strings.
 *
 * Returns rows: {
 *   type: 'equal' | 'add' | 'remove' | 'modify',
 *   oldLine: string | null, newLine: string | null,
 *   oldNumber: number | null, newNumber: number | null,
 *   // present on 'modify' rows only — word-level segments for each side:
 *   oldSegments?: Segment[], newSegments?: Segment[],
 * }[]
 */
export function diffLines(oldText, newText) {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const ops = diffTokens(oldLines, newLines);

  // Group consecutive ops so a remove-run followed by an add-run can be
  // paired into 'modify' rows.
  const rows = [];
  let oldNum = 1;
  let newNum = 1;
  let k = 0;

  while (k < ops.length) {
    const op = ops[k];
    if (op.type === 'equal') {
      rows.push({
        type: 'equal',
        oldLine: op.value,
        newLine: op.value,
        oldNumber: oldNum++,
        newNumber: newNum++,
      });
      k++;
      continue;
    }

    // Collect the full contiguous run of non-equal ops (removes and adds can
    // interleave depending on LCS backtracking order).
    const removed = [];
    const added = [];
    while (k < ops.length && ops[k].type !== 'equal') {
      if (ops[k].type === 'remove') removed.push(ops[k].value);
      else added.push(ops[k].value);
      k++;
    }

    const paired = Math.min(removed.length, added.length);
    for (let p = 0; p < paired; p++) {
      const oldLine = removed[p];
      const newLine = added[p];
      const segments = diffWords(oldLine, newLine);
      rows.push({
        type: 'modify',
        oldLine,
        newLine,
        oldNumber: oldNum++,
        newNumber: newNum++,
        oldSegments: segments.filter((s) => s.type !== 'add'),
        newSegments: segments.filter((s) => s.type !== 'remove'),
      });
    }
    for (let p = paired; p < removed.length; p++) {
      rows.push({
        type: 'remove',
        oldLine: removed[p],
        newLine: null,
        oldNumber: oldNum++,
        newNumber: null,
      });
    }
    for (let p = paired; p < added.length; p++) {
      rows.push({
        type: 'add',
        oldLine: null,
        newLine: added[p],
        oldNumber: null,
        newNumber: newNum++,
      });
    }
  }

  return rows;
}

/** Summary counts used for the header badge. */
export function diffStats(rows) {
  let additions = 0;
  let deletions = 0;
  for (const row of rows) {
    if (row.type === 'add' || row.type === 'modify') additions++;
    if (row.type === 'remove' || row.type === 'modify') deletions++;
  }
  return { additions, deletions };
}
