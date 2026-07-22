// Shared lender-name matching logic, loaded before both content-dealertrack.js
// and content-happyfox.js (see manifest.json) so the same rules apply whether
// we're matching live against Dealertrack's dropdown or against a cached copy
// of its lender list on the HappyFox side.
//
// Compares the *meaningful* words in each name rather than raw substrings, so
// e.g. "BMO Harris Bank" can still match Dealertrack's "BMO Bank N.A.", and
// tolerates common typos ("Uinon" for "Union"). If more than one option looks
// equally plausible, this deliberately returns no match rather than guessing
// — picking the wrong lender is worse than stopping.

const GENERIC_LENDER_WORDS = new Set([
  'bank', 'banks', 'credit', 'union', 'na', 'inc', 'llc', 'corp',
  'corporation', 'company', 'co', 'the', 'of', 'and', 'association', 'assoc'
]);

const FUZZY_WORD_THRESHOLD = 0.75;

function lenderTokens(s) {
  const filtered = s
    .toLowerCase()
    .replace(/\s*&\s*/g, '') // "M&T" and "M & T" should tokenize identically either way
    .replace(/[.,']/g, '')
    .split(/\s+/)
    .filter((w) => w && !GENERIC_LENDER_WORDS.has(w));

  // "and" is already stripped as a generic word above, but that alone still
  // leaves "M and T" as two separate letters ("m", "t") while "M&T" glues
  // into one ("mt") — same brand, different token shape. Gluing adjacent
  // single-letter tokens back together fixes that regardless of which
  // connector (or spacing) the name used.
  return glueAdjacentSingleLetters(filtered);
}

function glueAdjacentSingleLetters(tokens) {
  const result = [];
  let buffer = '';
  for (const tok of tokens) {
    if (tok.length === 1 && /[a-z]/.test(tok)) {
      buffer += tok;
    } else {
      if (buffer) { result.push(buffer); buffer = ''; }
      result.push(tok);
    }
  }
  if (buffer) result.push(buffer);
  return result;
}

// Damerau-Levenshtein (restricted/OSA variant) — treats an adjacent-letter
// swap as a single edit, since that's the most common real typo.
function editDistance(a, b) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

function wordSimilarity(a, b) {
  if (a === b) return 1;
  return 1 - editDistance(a, b) / Math.max(a.length, b.length);
}

function setHasFuzzyMatch(tokenSet, token) {
  for (const t of tokenSet) {
    if (wordSimilarity(t, token) >= FUZZY_WORD_THRESHOLD) return true;
  }
  return false;
}

function buildTokenFrequency(texts) {
  const freq = new Map();
  for (const text of texts) {
    const uniqueTokens = new Set(lenderTokens(text));
    for (const tok of uniqueTokens) {
      freq.set(tok, (freq.get(tok) || 0) + 1);
    }
  }
  return freq;
}

// optionTexts: array of plain strings (Dealertrack's lender names, live or
// cached). Returns { match, confidence }:
//   confidence: 'high' — safe to auto-select, no human check needed.
//   confidence: 'low'  — structurally related but relies on a word that's
//                        too common to trust blindly (e.g. "Community").
//                        Worth showing to a human to confirm, not worth
//                        auto-selecting.
//   confidence: 'none' — nothing structurally close; match is null.
function findLenderMatch(optionTexts, lenderName) {
  const tokenFrequency = buildTokenFrequency(optionTexts);
  const targetTokens = lenderTokens(lenderName);
  if (targetTokens.length === 0) return { match: null, confidence: 'none' };
  const targetSet = new Set(targetTokens);
  const targetJoined = targetTokens.join(' ');

  // 1) Exact match once generic suffixes are stripped.
  const exact = optionTexts.filter((t) => lenderTokens(t).join(' ') === targetJoined);
  if (exact.length === 1) return { match: exact[0], confidence: 'high' };
  if (exact.length > 1) return { match: null, confidence: 'none' }; // ambiguous, don't guess

  // 2) One name's distinctive words are contained in the other's, with
  // per-word typo tolerance once there are 2+ words to confirm against.
  const structural = optionTexts.filter((t) => {
    const optSet = new Set(lenderTokens(t));
    if (optSet.size === 0) return false;
    const [smaller, larger] = optSet.size <= targetSet.size ? [optSet, targetSet] : [targetSet, optSet];
    const allowFuzzy = smaller.size >= 2;
    return [...smaller].every(
      (tok) => larger.has(tok) || (allowFuzzy && setHasFuzzyMatch(larger, tok))
    );
  });

  if (structural.length !== 1) return { match: null, confidence: 'none' }; // 0 or ambiguous — don't guess

  // Exactly one structural candidate. Whether it's safe to auto-select
  // depends on whether the words it's matching on are actually distinctive
  // across the whole lender list — "Community" alone isn't, "BMO" is.
  const candidate = structural[0];
  const optSet = new Set(lenderTokens(candidate));
  const smaller = optSet.size <= targetSet.size ? optSet : targetSet;
  const distinctive = [...smaller].every((tok) => (tokenFrequency.get(tok) || 0) <= 1);

  return { match: candidate, confidence: distinctive ? 'high' : 'low' };
}
