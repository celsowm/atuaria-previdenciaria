export type AdherenceCell = {
  age: number;
  sex: string;
  exposure: number;
  observed: number;
  qx: number;
  expected: number;
};

const EPS = 1e-14;
const LARGE_CHI_SQUARE = 1_000_000_000;
const LARGE_Z = 999_999;

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

function chiSquareCritical(df: number, alpha: number) {
  let low = 0;
  let high = Math.max(1, df);
  while (regularizedGammaQ(df / 2, high / 2) > alpha && high < LARGE_CHI_SQUARE) high *= 2;
  for (let i = 0; i < 80; i += 1) {
    const middle = (low + high) / 2;
    if (regularizedGammaQ(df / 2, middle / 2) > alpha) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

export function chiSquareTest(cells: AdherenceCell[], alpha: number) {
  const usable = cells.filter((cell) => cell.expected > EPS);
  const impossible = cells.some((cell) => cell.expected <= EPS && cell.observed > 0);
  const statistic = impossible ? LARGE_CHI_SQUARE : usable.reduce((total, cell) => {
    const difference = cell.observed - cell.expected;
    return total + difference * difference / cell.expected;
  }, 0);
  const df = Math.max(1, usable.length - 1);
  const pValue = impossible ? 0 : regularizedGammaQ(df / 2, statistic / 2);
  return { statistic, df, pValue, critical: chiSquareCritical(df, alpha) };
}

function normalCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const value = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * value);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-value * value);
  return 0.5 * (1 + sign * erf);
}

function inverseNormal(p: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const low = 0.02425;
  const high = 1 - low;
  if (p <= 0) return -LARGE_Z;
  if (p >= 1) return LARGE_Z;
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= high) {
    const q = p - 0.5;
    const r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

export function zTest(cells: AdherenceCell[], alpha: number) {
  const observed = cells.reduce((total, cell) => total + cell.observed, 0);
  const expected = cells.reduce((total, cell) => total + cell.expected, 0);
  const variance = cells.reduce((total, cell) => total + cell.exposure * cell.qx * (1 - cell.qx), 0);
  const statistic = variance > EPS
    ? (observed - expected) / Math.sqrt(variance)
    : observed === expected ? 0 : Math.sign(observed - expected) * LARGE_Z;
  const pValue = Math.abs(statistic) >= LARGE_Z ? 0 : Math.max(0, Math.min(1, 2 * (1 - normalCdf(Math.abs(statistic)))));
  return { statistic, pValue, critical: inverseNormal(1 - alpha / 2), observed, expected, variance };
}

function ksPValue(d: number, effectiveN: number) {
  if (d <= 0) return 1;
  if (effectiveN <= EPS) return 0;
  const root = Math.sqrt(effectiveN);
  const lambda = (root + 0.12 + 0.11 / root) * d;
  let series = 0;
  for (let k = 1; k <= 100; k += 1) {
    const term = 2 * (k % 2 === 1 ? 1 : -1) * Math.exp(-2 * k * k * lambda * lambda);
    series += term;
    if (Math.abs(term) < 1e-12) break;
  }
  return Math.max(0, Math.min(1, series));
}

function ksCritical(effectiveN: number, alpha: number) {
  if (effectiveN <= EPS) return 1;
  let low = 0;
  let high = 1;
  for (let i = 0; i < 70; i += 1) {
    const middle = (low + high) / 2;
    if (ksPValue(middle, effectiveN) > alpha) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

export function kolmogorovSmirnovTest(cells: AdherenceCell[], alpha: number) {
  const ordered = [...cells].sort((a, b) => a.age - b.age || a.sex.localeCompare(b.sex));
  const totalObserved = ordered.reduce((total, cell) => total + cell.observed, 0);
  const totalExpected = ordered.reduce((total, cell) => total + cell.expected, 0);
  if (totalObserved <= 0 && totalExpected <= 0) return { d: 0, pValue: 1, critical: 1 };
  if (totalObserved <= 0 || totalExpected <= 0) return { d: 1, pValue: 0, critical: 1 };
  let cumulativeObserved = 0;
  let cumulativeExpected = 0;
  let d = 0;
  for (const cell of ordered) {
    cumulativeObserved += cell.observed / totalObserved;
    cumulativeExpected += cell.expected / totalExpected;
    d = Math.max(d, Math.abs(cumulativeObserved - cumulativeExpected));
  }
  const effectiveN = totalObserved * totalExpected / (totalObserved + totalExpected);
  return { d, pValue: ksPValue(d, effectiveN), critical: ksCritical(effectiveN, alpha) };
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
  const chiSquare = chiSquareTest(cells, alpha);
  const ks = kolmogorovSmirnovTest(cells, alpha);
  const z = zTest(cells, alpha);
  const fisher = fisherByAgeSplit(cells, fisherSplitAge);
  const dqm = meanSquaredDeviation(cells);
  const tests = [chiSquare.pValue, ks.pValue, z.pValue, fisher.pValue];
  return {
    observedEvents: z.observed,
    expectedEvents: z.expected,
    chiSquare: chiSquare.statistic,
    chiSquareDf: chiSquare.df,
    chiSquareCritical: chiSquare.critical,
    chiSquareP: chiSquare.pValue,
    chiSquarePass: chiSquare.pValue >= alpha,
    ksD: ks.d,
    ksCritical: ks.critical,
    ksP: ks.pValue,
    ksPass: ks.pValue >= alpha,
    zStatistic: z.statistic,
    zCritical: z.critical,
    zP: z.pValue,
    zPass: z.pValue >= alpha,
    fisherP: fisher.pValue,
    fisherPass: fisher.pValue >= alpha,
    dqm,
    rejectedTests: tests.filter((p) => p < alpha).length
  };
}
