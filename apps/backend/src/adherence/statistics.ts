export type AdherenceCell = {
  age: number;
  sex: string;
  exposure: number;
  observed: number;
  qx: number;
  expected: number;
};

const EPS = 1e-14;

function logGamma(z: number): number {
  const coefficients = [
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7
  ];
  if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let x = 0.99999999999980993;
  for (let i = 0; i < coefficients.length; i += 1) x += coefficients[i] / (z + i + 1);
  const t = z + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function regularizedGammaP(a: number, x: number): number {
  if (x <= 0) return 0;
  let sum = 1 / a;
  let term = sum;
  let ap = a;
  for (let n = 1; n <= 1000; n += 1) {
    ap += 1;
    term *= x / ap;
    sum += term;
    if (Math.abs(term) < Math.abs(sum) * 1e-14) break;
  }
  return Math.min(1, Math.max(0, sum * Math.exp(-x + a * Math.log(x) - logGamma(a))));
}

function regularizedGammaQ(a: number, x: number): number {
  if (x <= 0) return 1;
  if (x < a + 1) return 1 - regularizedGammaP(a, x);
  let b = x + 1 - a;
  let c = 1 / Number.MIN_VALUE;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= 1000; i += 1) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < Number.MIN_VALUE) d = Number.MIN_VALUE;
    c = b + an / c;
    if (Math.abs(c) < Number.MIN_VALUE) c = Number.MIN_VALUE;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-14) break;
  }
  return Math.min(1, Math.max(0, Math.exp(-x + a * Math.log(x) - logGamma(a)) * h));
}

export function chiSquareTest(cells: AdherenceCell[]) {
  const usable = cells.filter((cell) => cell.expected > 0);
  const statistic = usable.reduce((total, cell) => {
    const difference = cell.observed - cell.expected;
    return total + difference * difference / cell.expected;
  }, 0);
  const df = Math.max(1, usable.length - 1);
  const pValue = regularizedGammaQ(df / 2, statistic / 2);
  return { statistic, df, pValue };
}

function normalCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const value = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * value);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-value * value);
  return 0.5 * (1 + sign * erf);
}

export function zTest(cells: AdherenceCell[]) {
  const observed = cells.reduce((total, cell) => total + cell.observed, 0);
  const expected = cells.reduce((total, cell) => total + cell.expected, 0);
  const variance = cells.reduce((total, cell) => total + cell.exposure * cell.qx * (1 - cell.qx), 0);
  const statistic = variance > EPS ? (observed - expected) / Math.sqrt(variance) : observed === expected ? 0 : Math.sign(observed - expected) * Number.POSITIVE_INFINITY;
  const pValue = Number.isFinite(statistic) ? Math.max(0, Math.min(1, 2 * (1 - normalCdf(Math.abs(statistic))))) : 0;
  return { statistic, pValue, observed, expected, variance };
}

export function kolmogorovSmirnovTest(cells: AdherenceCell[]) {
  const ordered = [...cells].sort((a, b) => a.age - b.age || a.sex.localeCompare(b.sex));
  const totalObserved = ordered.reduce((total, cell) => total + cell.observed, 0);
  const totalExpected = ordered.reduce((total, cell) => total + cell.expected, 0);
  if (totalObserved <= 0 || totalExpected <= 0) return { d: 1, pValue: 0 };
  let cumulativeObserved = 0;
  let cumulativeExpected = 0;
  let d = 0;
  for (const cell of ordered) {
    cumulativeObserved += cell.observed / totalObserved;
    cumulativeExpected += cell.expected / totalExpected;
    d = Math.max(d, Math.abs(cumulativeObserved - cumulativeExpected));
  }
  const effectiveN = totalObserved * totalExpected / (totalObserved + totalExpected);
  const root = Math.sqrt(Math.max(effectiveN, EPS));
  const lambda = (root + 0.12 + 0.11 / root) * d;
  let series = 0;
  for (let k = 1; k <= 100; k += 1) {
    const term = 2 * (k % 2 === 1 ? 1 : -1) * Math.exp(-2 * k * k * lambda * lambda);
    series += term;
    if (Math.abs(term) < 1e-12) break;
  }
  return { d, pValue: Math.max(0, Math.min(1, series)) };
}

function logCombination(n: number, k: number): number {
  if (k < 0 || k > n) return Number.NEGATIVE_INFINITY;
  return logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1);
}

function hypergeometricProbability(a: number, row1: number, col1: number, total: number): number {
  return Math.exp(logCombination(col1, a) + logCombination(total - col1, row1 - a) - logCombination(total, row1));
}

export function fisherExactTwoSided(a: number, b: number, c: number, d: number): number {
  const values = [a, b, c, d].map((value) => Math.max(0, Math.round(value)));
  [a, b, c, d] = values;
  const row1 = a + b;
  const row2 = c + d;
  const col1 = a + c;
  const total = row1 + row2;
  if (total === 0) return 1;
  const observedProbability = hypergeometricProbability(a, row1, col1, total);
  const minA = Math.max(0, col1 - row2);
  const maxA = Math.min(row1, col1);
  let p = 0;
  for (let candidate = minA; candidate <= maxA; candidate += 1) {
    const probability = hypergeometricProbability(candidate, row1, col1, total);
    if (probability <= observedProbability + 1e-12) p += probability;
  }
  return Math.max(0, Math.min(1, p));
}

export function fisherByAgeSplit(cells: AdherenceCell[], splitAge: number) {
  const low = cells.filter((cell) => cell.age <= splitAge);
  const high = cells.filter((cell) => cell.age > splitAge);
  const observedLow = low.reduce((total, cell) => total + cell.observed, 0);
  const observedHigh = high.reduce((total, cell) => total + cell.observed, 0);
  const expectedLow = low.reduce((total, cell) => total + cell.expected, 0);
  const expectedHigh = high.reduce((total, cell) => total + cell.expected, 0);
  return {
    pValue: fisherExactTwoSided(observedLow, observedHigh, expectedLow, expectedHigh),
    observedLow,
    observedHigh,
    expectedLow,
    expectedHigh
  };
}

export function meanSquaredDeviation(cells: AdherenceCell[]) {
  const exposure = cells.reduce((total, cell) => total + cell.exposure, 0);
  if (exposure <= 0) return 0;
  return cells.reduce((total, cell) => {
    const observedRate = cell.exposure > 0 ? cell.observed / cell.exposure : 0;
    const difference = observedRate - cell.qx;
    return total + cell.exposure * difference * difference;
  }, 0) / exposure;
}

export function evaluateCandidate(cells: AdherenceCell[], alpha: number, fisherSplitAge: number) {
  const chiSquare = chiSquareTest(cells);
  const ks = kolmogorovSmirnovTest(cells);
  const z = zTest(cells);
  const fisher = fisherByAgeSplit(cells, fisherSplitAge);
  const dqm = meanSquaredDeviation(cells);
  const tests = [chiSquare.pValue, ks.pValue, z.pValue, fisher.pValue];
  return {
    observedEvents: z.observed,
    expectedEvents: z.expected,
    chiSquare: chiSquare.statistic,
    chiSquareDf: chiSquare.df,
    chiSquareP: chiSquare.pValue,
    chiSquarePass: chiSquare.pValue >= alpha,
    ksD: ks.d,
    ksP: ks.pValue,
    ksPass: ks.pValue >= alpha,
    zStatistic: z.statistic,
    zP: z.pValue,
    zPass: z.pValue >= alpha,
    fisherP: fisher.pValue,
    fisherPass: fisher.pValue >= alpha,
    dqm,
    rejectedTests: tests.filter((p) => p < alpha).length
  };
}
