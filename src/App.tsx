import { Activity, Gauge, RotateCcw, Zap } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import vollibLogo from './assets/vollib-logo.svg'
import './App.css'

type BenchmarkResult = {
  count: number
  elapsedMs: number
  perSecond: number
  checksum: number
  cases: number
  engine: string
}

type RunState = 'idle' | 'running' | 'done'

const DURATION_MS = 1000

const numberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
})

const decimalFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 3,
})

function App() {
  const [runState, setRunState] = useState<RunState>('idle')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<BenchmarkResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const frameRef = useRef<number | null>(null)

  const resultHeadline = useMemo(() => {
    if (!result) return '1 second'
    return numberFormatter.format(Math.round(result.perSecond))
  }, [result])

  useEffect(() => {
    return () => {
      workerRef.current?.terminate()
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
  }, [])

  function startBenchmark() {
    workerRef.current?.terminate()
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)

    setRunState('running')
    setResult(null)
    setError(null)
    setProgress(0)

    const startedAt = performance.now()
    const worker = new Worker(new URL('./benchmark.worker.ts', import.meta.url), {
      type: 'module',
    })

    workerRef.current = worker

    const tick = () => {
      const elapsed = performance.now() - startedAt
      setProgress(Math.min(elapsed / DURATION_MS, 1))
      if (elapsed < DURATION_MS) {
        frameRef.current = requestAnimationFrame(tick)
      }
    }

    frameRef.current = requestAnimationFrame(tick)

    worker.onmessage = (event: MessageEvent<BenchmarkResult>) => {
      setProgress(1)
      setResult(event.data)
      setRunState('done')
      worker.terminate()
      workerRef.current = null
    }

    worker.onerror = (event) => {
      setError(event.message || 'The benchmark worker stopped unexpectedly.')
      setRunState('idle')
      worker.terminate()
      workerRef.current = null
    }

    worker.postMessage({ durationMs: DURATION_MS })
  }

  const meterRows = result
    ? [
        { label: 'Implied volatilities', value: numberFormatter.format(result.count) },
        { label: 'Measured elapsed', value: `${decimalFormatter.format(result.elapsedMs)} ms` },
        { label: 'Option cases cycled', value: numberFormatter.format(result.cases) },
        { label: 'Numerical checksum', value: decimalFormatter.format(result.checksum) },
      ]
    : [
        { label: 'Implied volatilities', value: 'Waiting' },
        { label: 'Measured elapsed', value: '1000 ms' },
        { label: 'Option cases cycled', value: '160' },
        { label: 'Numerical checksum', value: 'Ready' },
      ]

  return (
    <main className="shell">
      <section className="hero" aria-label="VolLib benchmark">
        <div className="hero-copy">
          <img className="brand-logo" src={vollibLogo} alt="VolLib" />
          <div className="eyebrow">
            <Zap size={16} aria-hidden="true" />
            No server. No local install.
          </div>
          <h1>
            <span>VolLib runs</span>
            <strong>on your browser.</strong>
          </h1>
          <p className="lede">
            Press start. For one second, this page solves Black-Scholes implied volatility as fast as this browser can go.
          </p>
          <button className="start-button" type="button" onClick={startBenchmark} disabled={runState === 'running'}>
            {runState === 'running' ? <Activity size={20} aria-hidden="true" /> : <Gauge size={20} aria-hidden="true" />}
            {runState === 'running' ? 'Running' : result ? 'Run again' : 'Start'}
          </button>
          {error ? <p className="error">{error}</p> : null}
        </div>

        <div className="visual-panel" aria-label="Benchmark visualization">
          <div className="speed-readout">
            <span>{resultHeadline}</span>
            <small>{result ? 'implied volatility calculations, just now, on this browser' : 'one-second browser benchmark'}</small>
          </div>

          <div className="progress-track" aria-label="Benchmark progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} role="progressbar">
            <div className="progress-fill" style={{ transform: `scaleX(${progress})` }} />
          </div>

          <div className={`surface ${runState}`} aria-hidden="true">
            {Array.from({ length: 96 }, (_, index) => (
              <span key={index} style={{ '--cell': index } as CSSProperties & Record<'--cell', number>} />
            ))}
          </div>
        </div>
      </section>

      <section className="metrics" aria-label="Benchmark results">
        {meterRows.map((row) => (
          <div className="metric" key={row.label}>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </div>
        ))}
      </section>

      <section className="details" aria-label="Benchmark details">
        <div>
          <h2>What runs</h2>
          <p>
            A Web Worker cycles through calls and puts, then repeatedly solves implied volatility from price for exactly one measured second.
          </p>
        </div>
        <div>
          <h2>What it proves</h2>
          <p>
            The page imports <code>@vollib/vollib</code> from NPM and runs the calculation inside the browser you are using now.
          </p>
        </div>
        <div>
          <h2>Engine</h2>
          <p>
            {result?.engine ?? 'Peter Jaeckel LetsBeRational via VolLib TypeScript'}
            {result ? (
              <button className="icon-button" type="button" onClick={startBenchmark} aria-label="Run benchmark again">
                <RotateCcw size={18} aria-hidden="true" />
              </button>
            ) : null}
          </p>
        </div>
      </section>
    </main>
  )
}

export default App
