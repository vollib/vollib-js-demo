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

self.onmessage = (event: MessageEvent<BenchmarkRequest>) => {
  const durationMs = event.data.durationMs
  const cases = createCases()
  const startedAt = performance.now()
  let count = 0
  let checksum = 0
  let index = 0

  while (performance.now() - startedAt < durationMs) {
    for (let batch = 0; batch < 128; batch += 1) {
      const optionCase = cases[index % cases.length]
      const iv = blackScholesImpliedVolatility(
        optionCase.price,
        optionCase.S,
        optionCase.K,
        optionCase.t,
        optionCase.r,
        optionCase.flag,
      )

      checksum += iv
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
    cases: cases.length,
    engine: 'Peter Jaeckel LetsBeRational via @vollib/vollib',
  })
}
