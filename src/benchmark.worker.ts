import { blackScholes, blackScholesImpliedVolatility } from '@vollib/vollib'

type BenchmarkRequest = {
  durationMs: number
}

type BenchmarkCase = {
  flag: 'c' | 'p'
  S: number
  K: number
  t: number
  r: number
  price: number
}

const flags = ['c', 'p'] as const
const spots = [72, 91, 100, 118]
const strikes = [70, 85, 100, 115]
const maturities = [14 / 365, 0.25, 0.75, 1.5, 3]
const rates = [-0.005, 0.0, 0.025, 0.06]
const sigmas = [0.08, 0.16, 0.24, 0.42, 0.78]
const batchSize = 512

function createCases(): BenchmarkCase[] {
  const cases: BenchmarkCase[] = []

  for (let i = 0; i < 160; i += 1) {
    const flag = flags[i % flags.length]
    const S = spots[i % spots.length]
    const K = strikes[Math.floor(i / spots.length) % strikes.length]
    const t = maturities[Math.floor(i / 7) % maturities.length]
    const r = rates[Math.floor(i / 11) % rates.length]
    const sigma = sigmas[Math.floor(i / 13) % sigmas.length]
    const price = blackScholes(flag, S, K, t, r, sigma)

    cases.push({ flag, S, K, t, r, price })
  }

  return cases
}

const benchmarkCases = createCases()

function solveImpliedVolatility(optionCase: BenchmarkCase): number {
  return blackScholesImpliedVolatility(
    optionCase.price,
    optionCase.S,
    optionCase.K,
    optionCase.t,
    optionCase.r,
    optionCase.flag,
  )
}

function warmUpEngine(): void {
  let checksum = 0

  for (let i = 0; i < benchmarkCases.length * 8; i += 1) {
    checksum += solveImpliedVolatility(benchmarkCases[i % benchmarkCases.length])
  }

  if (!Number.isFinite(checksum)) {
    throw new Error('Benchmark warmup produced a non-finite result.')
  }
}

self.onmessage = (event: MessageEvent<BenchmarkRequest>) => {
  const durationMs = event.data.durationMs
  warmUpEngine()

  const startedAt = performance.now()
  let count = 0
  let checksum = 0
  let index = 0

  while (performance.now() - startedAt < durationMs) {
    for (let batch = 0; batch < batchSize; batch += 1) {
      checksum += solveImpliedVolatility(benchmarkCases[index % benchmarkCases.length])
      count += 1
      index += 1
    }
  }

  const elapsedMs = performance.now() - startedAt

  self.postMessage({
    count,
    elapsedMs,
    perSecond: count / (elapsedMs / 1000),
    checksum,
    cases: benchmarkCases.length,
    engine: 'Peter Jaeckel LetsBeRational via @vollib/vollib',
  })
}
