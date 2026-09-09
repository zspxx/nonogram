'use strict';

/* ==========================================================================
   NONOGRAM 7x7
   --------------------------------------------------------------------------
   Part 1 - pure logic : seeded RNG, clue maths, line solver, puzzle
                         generation, clue-completion and win detection.
   Part 2 - game layer : state, storage, rendering, input, game flow.
   ========================================================================== */

const SIZE = 7;
const MAX_MISTAKES = 3;
/* The grid is divided into blocks of 5, as printed nonograms are. */
const BLOCK = 5;

/* Logical state of a single board cell. */
const UNKNOWN = 0;
const FILLED = 1;
const MARKED = 2;

/* ----------------------------- seeded random ----------------------------- */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* A puzzle number plus the player's salt always yields the same puzzle. */
function seedFor(salt, puzzleNumber) {
  let h = ((salt >>> 0) ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (puzzleNumber >>> 0), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

function randomSalt() {
  return Math.floor(Math.random() * 4294967295) >>> 0;
}

function randInt(rng, max) {
  return Math.floor(rng() * max);
}

/* ------------------------------ grid helpers ----------------------------- */

function makeGrid(value) {
  return Array.from({ length: SIZE }, () => new Array(SIZE).fill(value));
}

function gridRow(grid, r) {
  return grid[r].slice();
}

function gridCol(grid, c) {
  const line = [];
  for (let r = 0; r < SIZE; r++) line.push(grid[r][c]);
  return line;
}

function countFilled(grid) {
  let n = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) if (grid[r][c] === 1) n++;
  }
  return n;
}

function serializeGrid(grid) {
  return grid.map(function (row) { return row.join(''); }).join('');
}

function deserializeGrid(text) {
  if (typeof text !== 'string' || text.length !== SIZE * SIZE) return null;
  const grid = makeGrid(0);
  for (let i = 0; i < text.length; i++) {
    const value = Number(text[i]);
    if (!Number.isInteger(value) || value < 0 || value > 2) return null;
    grid[Math.floor(i / SIZE)][i % SIZE] = value;
  }
  return grid;
}

/* --------------------------------- clues --------------------------------- */

/* Lengths of every group of consecutive filled cells in a line. */
function runsOf(line) {
  const runs = [];
  let run = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === 1) {
      run++;
    } else if (run > 0) {
      runs.push(run);
      run = 0;
    }
  }
  if (run > 0) runs.push(run);
  return runs;
}

/* Clue for a line - an empty line is described by a single 0. */
function cluesOf(line) {
  const runs = runsOf(line);
  return runs.length ? runs : [0];
}

function computeRowClues(grid) {
  return Array.from({ length: SIZE }, function (_, r) { return cluesOf(gridRow(grid, r)); });
}

function computeColClues(grid) {
  return Array.from({ length: SIZE }, function (_, c) { return cluesOf(gridCol(grid, c)); });
}

/* --------------------------- line solver (quality) ------------------------ */

const arrangementCache = new Map();

/* Every way the clue can be laid out across a line of `len` cells. */
function arrangements(clues, len) {
  const key = len + ':' + clues.join(',');
  const cached = arrangementCache.get(key);
  if (cached) return cached;

  const groups = (clues.length === 1 && clues[0] === 0) ? [] : clues;
  const out = [];

  function place(index, from, line) {
    if (index === groups.length) {
      out.push(line.slice());
      return;
    }
    /* Space the remaining groups need, including the gaps between them. */
    let needed = -1;
    for (let i = index; i < groups.length; i++) needed += groups[i] + 1;
    for (let start = from; start + needed <= len; start++) {
      const next = line.slice();
      for (let i = 0; i < groups[index]; i++) next[start + i] = 1;
      place(index + 1, start + groups[index] + 1, next);
    }
  }

  place(0, 0, new Array(len).fill(0));
  arrangementCache.set(key, out);
  return out;
}

/*
 * Solve a puzzle using only per-line logic (the reasoning a human uses).
 * Returns a grid of 0/1/-1 where -1 means "not deducible", or null if the
 * clues contradict each other.
 */
function solveByLines(rowClues, colClues) {
  const grid = makeGrid(-1);
  let changed = true;

  while (changed) {
    changed = false;

    for (let r = 0; r < SIZE; r++) {
      const options = arrangements(rowClues[r], SIZE).filter(function (option) {
        for (let c = 0; c < SIZE; c++) {
          if (grid[r][c] !== -1 && grid[r][c] !== option[c]) return false;
        }
        return true;
      });
      if (!options.length) return null;
      for (let c = 0; c < SIZE; c++) {
        if (grid[r][c] !== -1) continue;
        const value = options[0][c];
        if (options.every(function (option) { return option[c] === value; })) {
          grid[r][c] = value;
          changed = true;
        }
      }
    }

    for (let c = 0; c < SIZE; c++) {
      const options = arrangements(colClues[c], SIZE).filter(function (option) {
        for (let r = 0; r < SIZE; r++) {
          if (grid[r][c] !== -1 && grid[r][c] !== option[r]) return false;
        }
        return true;
      });
      if (!options.length) return null;
      for (let r = 0; r < SIZE; r++) {
        if (grid[r][c] !== -1) continue;
        const value = options[0][r];
        if (options.every(function (option) { return option[r] === value; })) {
          grid[r][c] = value;
          changed = true;
        }
      }
    }
  }

  return grid;
}

/* True when the clues alone lead to exactly this solution, no guessing. */
function isLineSolvable(grid) {
  const solved = solveByLines(computeRowClues(grid), computeColClues(grid));
  if (!solved) return false;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (solved[r][c] !== grid[r][c]) return false;
    }
  }
  return true;
}

/* ---------------------------- pattern generators -------------------------- */

function randomPattern(rng, density) {
  const grid = makeGrid(0);
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) grid[r][c] = rng() < density ? 1 : 0;
  }
  return grid;
}

/* Mirrored down the middle - reads as a small picture more often. */
function mirroredPattern(rng, density, horizontal) {
  const grid = makeGrid(0);
  const half = Math.ceil(SIZE / 2);
  for (let a = 0; a < SIZE; a++) {
    for (let b = 0; b < half; b++) {
      const value = rng() < density ? 1 : 0;
      if (horizontal) {
        grid[a][b] = value;
        grid[a][SIZE - 1 - b] = value;
      } else {
        grid[b][a] = value;
        grid[SIZE - 1 - b][a] = value;
      }
    }
  }
  return grid;
}

/* Organic blob grown outwards from a few seeds. */
function blobPattern(rng, target) {
  const grid = makeGrid(0);
  let count = 0;
  const seeds = 1 + randInt(rng, 3);
  for (let i = 0; i < seeds; i++) {
    const r = randInt(rng, SIZE);
    const c = randInt(rng, SIZE);
    if (!grid[r][c]) { grid[r][c] = 1; count++; }
  }
  let guard = 0;
  while (count < target && guard++ < 900) {
    const r = randInt(rng, SIZE);
    const c = randInt(rng, SIZE);
    if (grid[r][c]) continue;
    const touching =
      (r > 0 && grid[r - 1][c]) || (r < SIZE - 1 && grid[r + 1][c]) ||
      (c > 0 && grid[r][c - 1]) || (c < SIZE - 1 && grid[r][c + 1]);
    if (touching || rng() < 0.04) { grid[r][c] = 1; count++; }
  }
  return grid;
}

/* Rows built from a couple of clean runs. */
function runsPattern(rng) {
  const grid = makeGrid(0);
  for (let r = 0; r < SIZE; r++) {
    let c = 0;
    while (c < SIZE) {
      if (rng() < 0.42) { c++; continue; }
      const len = 1 + randInt(rng, 3);
      for (let i = 0; i < len && c < SIZE; i++, c++) grid[r][c] = 1;
      c++;
    }
  }
  return grid;
}

function candidatePattern(rng, attempt) {
  const density = 0.34 + rng() * 0.26;
  switch (attempt % 5) {
    case 0: return runsPattern(rng);
    case 1: return mirroredPattern(rng, density, true);
    case 2: return blobPattern(rng, 15 + randInt(rng, 12));
    case 3: return mirroredPattern(rng, density, false);
    default: return randomPattern(rng, density);
  }
}

/* ---------------------------- puzzle generation --------------------------- */

/* Rejects boards that would be dull: near empty, near full, too repetitive. */
function hasReasonableShape(grid) {
  const total = countFilled(grid);
  if (total < 16 || total > 31) return false;

  let emptyRows = 0, emptyCols = 0, fullRows = 0, fullCols = 0;
  for (let i = 0; i < SIZE; i++) {
    let rowCount = 0, colCount = 0;
    for (let j = 0; j < SIZE; j++) {
      rowCount += grid[i][j];
      colCount += grid[j][i];
    }
    if (rowCount === 0) emptyRows++;
    if (rowCount === SIZE) fullRows++;
    if (colCount === 0) emptyCols++;
    if (colCount === SIZE) fullCols++;
  }
  if (emptyRows > 1 || emptyCols > 1) return false;
  if (fullRows > 1 || fullCols > 1) return false;

  const distinctRows = new Set(grid.map(function (row) { return row.join(''); }));
  return distinctRows.size >= 5;
}

/*
 * A plain cross. Its clues force every cell, so it is always solvable by line
 * logic - the guaranteed floor if random generation ever came up empty.
 */
function crossPattern() {
  const grid = makeGrid(0);
  const middle = Math.floor(SIZE / 2);
  for (let i = 0; i < SIZE; i++) {
    grid[middle][i] = 1;
    grid[i][middle] = 1;
  }
  return grid;
}

/*
 * Generate a solution.
 *
 * Solvability by pure line logic is non-negotiable on every path: it is what
 * guarantees a player can reason the board out from the clues alone, with no
 * guessing. Only the cosmetic requirements are relaxed if a pass finds
 * nothing - first the no-repeats rule, then the shape rules - so a board is
 * never published unless the solver has confirmed it.
 *
 * In practice the first pass succeeds within a handful of attempts.
 */
function generateSolution(seed, avoid) {
  const rng = mulberry32(seed);
  const skip = new Set(avoid || []);
  const passes = [
    { attempts: 600, shaped: true, fresh: true },
    { attempts: 300, shaped: true, fresh: false },
    { attempts: 400, shaped: false, fresh: false }
  ];

  for (let p = 0; p < passes.length; p++) {
    const pass = passes[p];
    for (let attempt = 0; attempt < pass.attempts; attempt++) {
      const grid = candidatePattern(rng, attempt);
      const total = countFilled(grid);
      if (total < 5 || total === SIZE * SIZE) continue;
      if (pass.shaped && !hasReasonableShape(grid)) continue;
      if (pass.fresh && skip.has(serializeGrid(grid))) continue;
      if (isLineSolvable(grid)) return grid;
    }
  }

  return crossPattern();
}

function makePuzzle(number, salt, avoid) {
  let solution = generateSolution(seedFor(salt, number), avoid);
  /* Invariant: nothing reaches the player that the solver cannot deduce. */
  if (!isLineSolvable(solution)) solution = crossPattern();
  return {
    number: number,
    solution: solution,
    rowClues: computeRowClues(solution),
    colClues: computeColClues(solution)
  };
}

/* ------------------------- clue completion detection ---------------------- */

/* Start index and length of every filled group in a line. */
function runSpans(line) {
  const spans = [];
  let start = -1;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === 1) {
      if (start === -1) start = i;
    } else if (start !== -1) {
      spans.push({ start: start, len: i - start });
      start = -1;
    }
  }
  if (start !== -1) spans.push({ start: start, len: line.length - start });
  return spans;
}

/*
 * Which individual clues the board already satisfies.
 *
 * A clue counts as complete when every layout of that line still consistent
 * with what the player has drawn puts the clue in the same place, and the
 * player has actually filled all of it. This only uses the clues plus the
 * player's own marks - never the hidden solution - so it confirms what the
 * player could already work out, and it never points at a hidden cell.
 */
function clueCompletion(clues, filledLine, markedLine) {
  const done = clues.map(function () { return false; });
  const marks = markedLine || filledLine.map(function () { return 0; });

  if (clues.length === 1 && clues[0] === 0) {
    done[0] = filledLine.indexOf(1) === -1;
    return done;
  }

  function consistentOptions(useMarks) {
    return arrangements(clues, filledLine.length).filter(function (option) {
      for (let i = 0; i < option.length; i++) {
        if (filledLine[i] === 1 && option[i] !== 1) return false;
        if (useMarks && marks[i] === 1 && option[i] !== 0) return false;
      }
      return true;
    });
  }

  /* In Easy Mode an X can sit on a cell that is really filled, which can
     contradict the clue and leave nothing consistent. Fall back to the fills
     alone so clue feedback keeps working. In Normal Mode every mark is correct,
     so the first pass always finds options and this changes nothing. */
  let options = consistentOptions(true);
  if (!options.length) options = consistentOptions(false);
  if (!options.length) return done;

  const spansPerOption = options.map(runSpans);
  const first = spansPerOption[0];

  for (let i = 0; i < clues.length; i++) {
    const span = first[i];
    if (!span) continue;

    let allFilled = true;
    for (let k = span.start; k < span.start + span.len; k++) {
      if (filledLine[k] !== 1) { allFilled = false; break; }
    }
    if (!allFilled) continue;

    done[i] = spansPerOption.every(function (spans) {
      return spans[i] && spans[i].start === span.start;
    });
  }

  return done;
}

/* ------------------------------ win detection ----------------------------- */

/* The player's filled cells must match the solution exactly. X marks are notes
   and are not required anywhere. */
function isSolved(cells, solution) {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const filled = cells[r][c] === FILLED;
      if (filled !== (solution[r][c] === 1)) return false;
    }
  }
  return true;
}

/* The two 0/1 grids the clues are judged against: what the player filled,
   and where the player placed X marks. */
function boardView(cells) {
  return {
    filled: cells.map(function (row) {
      return row.map(function (value) { return value === FILLED ? 1 : 0; });
    }),
    marked: cells.map(function (row) {
      return row.map(function (value) { return value === MARKED ? 1 : 0; });
    })
  };
}

// ---- END PURE LOGIC ----

/* ==========================================================================
   Part 2 - game layer
   ========================================================================== */

const STORAGE_KEY = 'nonogram-7x7-v1';
const RECENT_LIMIT = 12;

/* Timings for the end-of-puzzle reveal. */
const WIN_PULSE_MS = 260;      /* board acknowledges the win before revealing */
const LOSS_SHAKE_MS = 320;     /* board acknowledges the third mistake */
const REVEAL_STEP_MS = 34;     /* gap between cells in the reveal wave */
const REVEAL_CELL_MS = 220;    /* one cell's reveal animation */
const GAME_OVER_HOLD_MS = 1600;/* finished loss board stays up this long */
const RESUMED_HOLD_MS = 1200;  /* same, when a refresh lands on a lost puzzle */

const DIFFICULTY_NOTE = {
  normal: 'Wrong fills and wrong X marks count as mistakes',
  easy: 'Only wrong fills count as mistakes'
};

const state = {
  puzzleNumber: 1,
  salt: 0,
  solution: null,
  rowClues: null,
  colClues: null,
  cells: null,
  mistakes: 0,
  status: 'playing', // 'playing' | 'solved' | 'over'
  revealing: false,  // the closing animation is running
  mode: 'fill',      // 'fill' | 'mark' - which action a press performs
  difficulty: 'normal', // 'normal' | 'easy' - whether a wrong X costs a mistake
  recent: []
};

const dom = {};
const cellEls = [];
const rowClueEls = [];
const colClueEls = [];

let drag = null;
let revealTimer = null;
let focusRow = 0;
let focusCol = 0;

/* Every timer the closing animation schedules, so it can be cancelled. */
const pendingTimers = [];

function later(fn, delay) {
  const id = window.setTimeout(fn, delay);
  pendingTimers.push(id);
  return id;
}

function clearPendingTimers() {
  while (pendingTimers.length) window.clearTimeout(pendingTimers.pop());
}

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* -------------------------------- storage -------------------------------- */

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      puzzleNumber: state.puzzleNumber,
      salt: state.salt,
      solution: serializeGrid(state.solution),
      rowClues: state.rowClues,
      colClues: state.colClues,
      cells: serializeGrid(state.cells),
      mistakes: state.mistakes,
      status: state.status,
      mode: state.mode,
      difficulty: state.difficulty,
      recent: state.recent
    }));
  } catch (err) {
    /* Storage can be unavailable (private mode); the game still works. */
  }
}

function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    return false;
  }
  if (!raw) return false;

  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    return false;
  }
  if (!data || typeof data !== 'object') return false;

  const solution = deserializeGrid(data.solution);
  const cells = deserializeGrid(data.cells);
  if (!solution || !cells) return false;
  if (countFilled(solution) === 0) return false;

  state.puzzleNumber = Number.isInteger(data.puzzleNumber) && data.puzzleNumber > 0 ? data.puzzleNumber : 1;
  state.salt = Number.isInteger(data.salt) ? data.salt : randomSalt();
  state.solution = solution;
  state.cells = cells;
  /* Clues are always recomputed so they can never drift from the solution. */
  state.rowClues = computeRowClues(solution);
  state.colClues = computeColClues(solution);
  state.mistakes = Number.isInteger(data.mistakes) ? Math.min(Math.max(data.mistakes, 0), MAX_MISTAKES) : 0;
  state.status = data.status === 'solved' || data.status === 'over' ? data.status : 'playing';
  state.mode = data.mode === 'mark' ? 'mark' : 'fill';
  state.difficulty = data.difficulty === 'easy' ? 'easy' : 'normal';
  state.recent = Array.isArray(data.recent) ? data.recent.filter(function (k) { return typeof k === 'string'; }) : [];

  /* Repair impossible combinations. Play can never produce a fill on an empty
     cell, so drop any that were stored. An X on a filled cell is impossible in
     Normal Mode but perfectly legal in Easy Mode, so it is only dropped when
     the saved difficulty says it could not have been placed. */
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const value = state.cells[r][c];
      if (value === FILLED && solution[r][c] === 0) state.cells[r][c] = UNKNOWN;
      if (value === MARKED && solution[r][c] === 1 && state.difficulty !== 'easy') {
        state.cells[r][c] = UNKNOWN;
      }
    }
  }
  if (state.mistakes >= MAX_MISTAKES && state.status === 'playing') state.status = 'over';
  if (state.status === 'solved' && !isSolved(state.cells, state.solution)) state.status = 'playing';
  return true;
}

/* ------------------------------ puzzle setup ------------------------------ */

function rememberPuzzle(solution) {
  state.recent.push(serializeGrid(solution));
  while (state.recent.length > RECENT_LIMIT) state.recent.shift();
}

function startPuzzle(number) {
  const puzzle = makePuzzle(number, state.salt, state.recent);
  state.puzzleNumber = puzzle.number;
  state.solution = puzzle.solution;
  state.rowClues = puzzle.rowClues;
  state.colClues = puzzle.colClues;
  state.cells = makeGrid(UNKNOWN);
  state.mistakes = 0;
  state.status = 'playing';
  rememberPuzzle(puzzle.solution);
}

/* -------------------------------- building -------------------------------- */

/*
 * Grid line a row or column index sits on. The divider between the blocks
 * occupies a track of its own, so everything after it shifts along by one.
 * Clues and cells use the same mapping, which keeps them aligned.
 */
function trackFor(index) {
  return index < BLOCK ? index + 1 : index + 2;
}

function buildBoard() {
  dom.board.replaceChildren();
  cellEls.length = 0;

  for (let r = 0; r < SIZE; r++) {
    const rowEl = document.createElement('div');
    rowEl.className = 'board-row';
    rowEl.setAttribute('role', 'row');
    const row = [];

    for (let c = 0; c < SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.setAttribute('role', 'gridcell');
      cell.dataset.r = String(r);
      cell.dataset.c = String(c);
      cell.style.gridColumn = String(trackFor(c));
      cell.style.gridRow = String(trackFor(r));
      rowEl.appendChild(cell);
      row.push(cell);
    }

    cellEls.push(row);
    dom.board.appendChild(rowEl);
  }

  ['rule rule-v', 'rule rule-h'].forEach(function (className) {
    const rule = document.createElement('div');
    rule.className = className;
    rule.setAttribute('role', 'presentation');
    rule.setAttribute('aria-hidden', 'true');
    dom.board.appendChild(rule);
  });
}

function buildClues() {
  dom.colClues.replaceChildren();
  dom.rowClues.replaceChildren();
  colClueEls.length = 0;
  rowClueEls.length = 0;

  for (let c = 0; c < SIZE; c++) {
    const holder = document.createElement('div');
    holder.className = 'clue-col';
    holder.style.gridColumn = String(trackFor(c));
    colClueEls.push(state.colClues[c].map(function (value) {
      const span = document.createElement('span');
      span.className = 'clue';
      span.textContent = String(value);
      holder.appendChild(span);
      return span;
    }));
    dom.colClues.appendChild(holder);
  }

  for (let r = 0; r < SIZE; r++) {
    const holder = document.createElement('div');
    holder.className = 'clue-row';
    holder.style.gridRow = String(trackFor(r));
    rowClueEls.push(state.rowClues[r].map(function (value) {
      const span = document.createElement('span');
      span.className = 'clue';
      span.textContent = String(value);
      holder.appendChild(span);
      return span;
    }));
    dom.rowClues.appendChild(holder);
  }
}

function buildDots() {
  dom.dots.replaceChildren();
  for (let i = 0; i < MAX_MISTAKES; i++) {
    const dot = document.createElement('span');
    dot.className = 'dot';
    dom.dots.appendChild(dot);
  }
}

/* -------------------------------- rendering ------------------------------- */

/* The board always renders the player's cell states. At the end of a puzzle
   the reveal writes the answers into those same states, so there is only ever
   one thing to draw. */
function renderCell(r, c) {
  const el = cellEls[r][c];
  const value = state.cells[r][c];
  const filled = value === FILLED;
  const marked = value === MARKED;
  el.classList.toggle('filled', filled);
  el.classList.toggle('marked', marked);
  el.setAttribute('aria-label',
    'Row ' + (r + 1) + ', column ' + (c + 1) + ': ' +
    (filled ? 'filled' : marked ? 'marked empty' : 'blank'));
}

function renderCells() {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) renderCell(r, c);
  }
}

function renderClueStates() {
  const view = boardView(state.cells);

  for (let r = 0; r < SIZE; r++) {
    const done = clueCompletion(state.rowClues[r], view.filled[r], view.marked[r]);
    rowClueEls[r].forEach(function (span, i) { span.classList.toggle('done', done[i]); });
  }

  for (let c = 0; c < SIZE; c++) {
    const done = clueCompletion(state.colClues[c], gridCol(view.filled, c), gridCol(view.marked, c));
    colClueEls[c].forEach(function (span, i) { span.classList.toggle('done', done[i]); });
  }
}

function renderStatus() {
  dom.puzzleNumber.textContent = 'Puzzle #' + state.puzzleNumber;
  dom.mistakeCount.textContent = state.mistakes + ' / ' + MAX_MISTAKES;
  Array.prototype.forEach.call(dom.dots.children, function (dot, i) {
    dot.classList.toggle('used', i < state.mistakes);
  });

  dom.modeFill.classList.toggle('is-active', state.mode === 'fill');
  dom.modeMark.classList.toggle('is-active', state.mode === 'mark');
  dom.modeFill.setAttribute('aria-pressed', String(state.mode === 'fill'));
  dom.modeMark.setAttribute('aria-pressed', String(state.mode === 'mark'));

  const easy = state.difficulty === 'easy';
  dom.difficultyNormal.classList.toggle('is-active', !easy);
  dom.difficultyEasy.classList.toggle('is-active', easy);
  dom.difficultyNormal.setAttribute('aria-pressed', String(!easy));
  dom.difficultyEasy.setAttribute('aria-pressed', String(easy));
  dom.difficultyNote.textContent = DIFFICULTY_NOTE[state.difficulty];

  /* "Game Over" lands with the shake; "Solved!" waits for the reveal to
     finish, so the win reads as a completed picture rather than a label. */
  if (state.status === 'solved') {
    dom.message.textContent = state.revealing ? '' : 'Solved!';
  } else if (state.status === 'over') {
    dom.message.textContent = 'Game Over';
  } else {
    dom.message.textContent = '';
  }

  dom.next.hidden = !(state.status === 'solved' && !state.revealing);
  dom.reset.disabled = state.status === 'over' || state.revealing;
  dom.board.classList.toggle('locked', state.status !== 'playing');
}

function renderAll() {
  renderCells();
  renderClueStates();
  renderStatus();
}

function showPuzzle() {
  buildClues();
  renderAll();
  updateTabStops();
}

/* -------------------------------- feedback -------------------------------- */

function flashMistake(r, c) {
  const el = cellEls[r][c];
  el.classList.remove('mistake');
  void el.offsetWidth; /* restart the animation */
  el.classList.add('mistake');
  window.setTimeout(function () { el.classList.remove('mistake'); }, 500);
}

function pulseBoard() {
  dom.game.classList.remove('pulse');
  void dom.game.offsetWidth;
  dom.game.classList.add('pulse');
  later(function () { dom.game.classList.remove('pulse'); }, WIN_PULSE_MS + 60);
}

function shakeBoard() {
  dom.game.classList.remove('shake');
  void dom.game.offsetWidth;
  dom.game.classList.add('shake');
  window.setTimeout(function () { dom.game.classList.remove('shake'); }, 400);
}

/* ------------------------------ cell actions ------------------------------ */

/*
 * Apply one operation to one cell. Only actions that place a state
 * contradicting the hidden solution count as a mistake; clearing never does.
 */
function applyOperation(r, c, op) {
  const current = state.cells[r][c];
  const truth = state.solution[r][c];

  if (op === 'fill') {
    if (current === FILLED) return { changed: false, mistake: false };
    if (truth === 1) {
      state.cells[r][c] = FILLED;
      return { changed: true, mistake: false };
    }
    return { changed: false, mistake: true };
  }

  if (op === 'clear-fill') {
    if (current !== FILLED) return { changed: false, mistake: false };
    state.cells[r][c] = UNKNOWN;
    return { changed: true, mistake: false };
  }

  if (op === 'mark') {
    if (current === MARKED) return { changed: false, mistake: false };
    /* Easy Mode lets an X go anywhere without penalty; it is placed exactly
       like a correct one, so it gives nothing about the solution away. */
    if (truth === 0 || state.difficulty === 'easy') {
      state.cells[r][c] = MARKED;
      return { changed: true, mistake: false };
    }
    return { changed: false, mistake: true };
  }

  if (op === 'clear-mark') {
    if (current !== MARKED) return { changed: false, mistake: false };
    state.cells[r][c] = UNKNOWN;
    return { changed: true, mistake: false };
  }

  return { changed: false, mistake: false };
}

/* The operation a press on this cell starts; the whole drag reuses it. */
function operationFor(r, c, markMode) {
  if (markMode) return state.cells[r][c] === MARKED ? 'clear-mark' : 'mark';
  return state.cells[r][c] === FILLED ? 'clear-fill' : 'fill';
}

/*
 * Apply one player action and deal with everything that follows from it:
 * mistake feedback, clue states, and the win or game-over transition.
 * Both the pointer and the keyboard go through here.
 */
function commitAction(r, c, op) {
  const result = applyOperation(r, c, op);
  if (!result.changed && !result.mistake) return;

  if (result.mistake) {
    state.mistakes++;
    flashMistake(r, c);
  } else {
    renderCell(r, c);
  }

  renderClueStates();
  renderStatus();

  if (state.mistakes >= MAX_MISTAKES) {
    endDrag();
    triggerGameOver();
    return;
  }

  if (result.changed && isSolved(state.cells, state.solution)) {
    endDrag();
    triggerSolved();
    return;
  }

  save();
}

function processCell(r, c) {
  if (!drag || state.status !== 'playing') return;

  const key = r * SIZE + c;
  if (drag.seen.has(key)) return; /* one drag never hits a cell twice */
  drag.seen.add(key);

  commitAction(r, c, drag.op);
}

/* ------------------------------ final reveal ------------------------------ */

/* A cell's final answer: filled in the solution, otherwise a definite X. */
function finalStateFor(r, c) {
  return state.solution[r][c] === 1 ? FILLED : MARKED;
}

/* Cells still showing something other than their answer, ordered as a
   diagonal sweep so the reveal reads as one wave across the board. */
function unresolvedCells() {
  const list = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (state.cells[r][c] !== finalStateFor(r, c)) list.push([r, c]);
    }
  }
  return list.sort(function (a, b) { return (a[0] + a[1]) - (b[0] + b[1]); });
}

function finalizeBoard() {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) state.cells[r][c] = finalStateFor(r, c);
  }
}

/*
 * Resolve every remaining cell, then hand back to the caller. No cell is left
 * unknown: solution cells end up filled, the rest end up crossed.
 */
function revealBoard(onDone) {
  const pending = unresolvedCells();

  function finish() {
    finalizeBoard();
    renderCells();
    renderClueStates();
    state.revealing = false;
    onDone();
  }

  if (!pending.length || prefersReducedMotion()) {
    finish();
    return;
  }

  pending.forEach(function (pos, index) {
    later(function () {
      const r = pos[0];
      const c = pos[1];
      state.cells[r][c] = finalStateFor(r, c);
      renderCell(r, c);
      const el = cellEls[r][c];
      el.classList.add('revealed');
      later(function () { el.classList.remove('revealed'); }, REVEAL_CELL_MS);
      renderClueStates();
    }, index * REVEAL_STEP_MS);
  });

  later(finish, pending.length * REVEAL_STEP_MS + REVEAL_CELL_MS);
}

/* -------------------------------- game flow ------------------------------- */

/* Win: lock, a small pulse, then the remaining empty cells fill in as X. */
function triggerSolved() {
  state.status = 'solved';
  state.revealing = true;
  renderStatus();
  save();

  function reveal() {
    revealBoard(function () {
      renderAll();
      save();
    });
  }

  /* Reduced motion: no pulse, no wait - go straight to the finished board. */
  if (prefersReducedMotion()) {
    reveal();
    return;
  }
  pulseBoard();
  later(reveal, WIN_PULSE_MS);
}

/* Loss: lock, a small shake, "Game Over", then the whole answer appears. */
function triggerGameOver() {
  state.status = 'over';
  state.revealing = true;
  renderStatus();
  save();

  function reveal() {
    revealBoard(function () {
      renderAll();
      save();
      /* The finished answer stays up a moment before the next puzzle. */
      scheduleAdvance(GAME_OVER_HOLD_MS);
    });
  }

  if (prefersReducedMotion()) {
    reveal();
    return;
  }
  shakeBoard();
  later(reveal, LOSS_SHAKE_MS);
}

function scheduleAdvance(delay) {
  window.clearTimeout(revealTimer);
  revealTimer = window.setTimeout(nextPuzzle, delay);
}

function nextPuzzle() {
  window.clearTimeout(revealTimer);
  revealTimer = null;
  clearPendingTimers();
  endDrag();
  state.revealing = false;
  startPuzzle(state.puzzleNumber + 1);
  showPuzzle();
  save();
}

function resetPuzzle() {
  if (state.status === 'over' || state.revealing) return;
  window.clearTimeout(revealTimer);
  revealTimer = null;
  clearPendingTimers();
  endDrag();
  state.cells = makeGrid(UNKNOWN);
  state.mistakes = 0;
  state.status = 'playing';
  renderAll();
  save();
}

function setMode(mode) {
  state.mode = mode;
  renderStatus();
  save();
}

/* Applies from the next action onwards; mistakes already made are kept. */
function setDifficulty(difficulty) {
  state.difficulty = difficulty;
  renderStatus();
  save();
}

/* --------------------------------- input ---------------------------------- */

function cellAt(clientX, clientY) {
  const target = document.elementFromPoint(clientX, clientY);
  if (!target || !target.classList || !target.classList.contains('cell')) return null;
  if (!dom.board.contains(target)) return null;
  return { r: Number(target.dataset.r), c: Number(target.dataset.c) };
}

function onPointerDown(event) {
  if (state.status !== 'playing') return;
  if (drag) return; /* ignore a second finger while one is already drawing */

  const target = event.target;
  if (!target || !target.classList || !target.classList.contains('cell')) return;
  if (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 2) return;

  event.preventDefault();

  const r = Number(target.dataset.r);
  const c = Number(target.dataset.c);
  /* Right click is a shortcut for Mark X, never required. */
  const markMode = (event.pointerType === 'mouse' && event.button === 2) || state.mode === 'mark';

  drag = { op: operationFor(r, c, markMode), seen: new Set(), pointerId: event.pointerId };
  try { dom.board.setPointerCapture(event.pointerId); } catch (err) { /* not critical */ }

  processCell(r, c);
}

function onPointerMove(event) {
  if (!drag || event.pointerId !== drag.pointerId) return;
  event.preventDefault();
  const hit = cellAt(event.clientX, event.clientY);
  if (hit) processCell(hit.r, hit.c);
}

function endDrag() {
  if (!drag) return;
  try { dom.board.releasePointerCapture(drag.pointerId); } catch (err) { /* already released */ }
  drag = null;
}

function onPointerUp() {
  if (!drag) return;
  endDrag();
  save();
}

/* -------------------------------- keyboard --------------------------------- */

/* One tab stop for the whole grid; the arrow keys move within it. */
function updateTabStops() {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      cellEls[r][c].tabIndex = (r === focusRow && c === focusCol) ? 0 : -1;
    }
  }
}

function moveFocus(rowStep, colStep) {
  focusRow = Math.min(SIZE - 1, Math.max(0, focusRow + rowStep));
  focusCol = Math.min(SIZE - 1, Math.max(0, focusCol + colStep));
  updateTabStops();
  cellEls[focusRow][focusCol].focus();
}

const ARROW_KEYS = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1]
};

function onKeyDown(event) {
  const target = event.target;
  if (!target || !target.classList || !target.classList.contains('cell')) return;

  focusRow = Number(target.dataset.r);
  focusCol = Number(target.dataset.c);

  const step = ARROW_KEYS[event.key];
  if (step) {
    event.preventDefault();
    moveFocus(step[0], step[1]);
    return;
  }

  let markMode;
  if (event.key === 'Enter' || event.key === ' ') markMode = state.mode === 'mark';
  else if (event.key === 'x' || event.key === 'X') markMode = true;
  else return;

  event.preventDefault();
  if (state.status !== 'playing') return;
  commitAction(focusRow, focusCol, operationFor(focusRow, focusCol, markMode));
}

/* ---------------------------------- init ---------------------------------- */

function cacheDom() {
  dom.game = document.getElementById('game');
  dom.board = document.getElementById('board');
  dom.colClues = document.getElementById('col-clues');
  dom.rowClues = document.getElementById('row-clues');
  dom.puzzleNumber = document.getElementById('puzzle-number');
  dom.message = document.getElementById('message');
  dom.mistakeCount = document.getElementById('mistake-count');
  dom.dots = document.getElementById('dots');
  dom.modeFill = document.getElementById('mode-fill');
  dom.modeMark = document.getElementById('mode-mark');
  dom.difficultyNormal = document.getElementById('difficulty-normal');
  dom.difficultyEasy = document.getElementById('difficulty-easy');
  dom.difficultyNote = document.getElementById('difficulty-note');
  dom.reset = document.getElementById('reset');
  dom.next = document.getElementById('next');
}

function bindEvents() {
  dom.board.addEventListener('pointerdown', onPointerDown);
  dom.board.addEventListener('pointermove', onPointerMove);
  dom.board.addEventListener('pointerup', onPointerUp);
  dom.board.addEventListener('pointercancel', onPointerUp);
  dom.board.addEventListener('keydown', onKeyDown);
  dom.board.addEventListener('contextmenu', function (event) { event.preventDefault(); });
  dom.board.addEventListener('dragstart', function (event) { event.preventDefault(); });
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  dom.modeFill.addEventListener('click', function () { setMode('fill'); });
  dom.modeMark.addEventListener('click', function () { setMode('mark'); });
  dom.difficultyNormal.addEventListener('click', function () { setDifficulty('normal'); });
  dom.difficultyEasy.addEventListener('click', function () { setDifficulty('easy'); });
  dom.reset.addEventListener('click', resetPuzzle);
  dom.next.addEventListener('click', nextPuzzle);
}

function init() {
  cacheDom();
  buildBoard();
  buildDots();
  bindEvents();

  if (!load()) {
    state.salt = randomSalt();
    startPuzzle(1);
    save();
  }

  /* A refresh part way through a reveal lands on the finished board rather
     than replaying the animation, so no cell is ever left unknown. */
  if (state.status === 'solved' || state.status === 'over') {
    finalizeBoard();
    state.revealing = false;
    save();
  }

  showPuzzle();
  updateTabStops();

  if (state.status === 'over') scheduleAdvance(RESUMED_HOLD_MS);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
