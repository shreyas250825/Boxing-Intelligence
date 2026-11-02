import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Zap, ChevronRight, CheckCircle, XCircle, Loader2, RotateCcw, Info } from 'lucide-react'
import Layout from '../../../components/Layout'
import {
  fetchSimulatorScenarios,
  fetchSimulatorScenario,
  submitSimulatorAnswer,
  type SimulatorScenario,
  type SimulatorStep,
  type SimulatorAnswerResult,
} from '../../../api/aiCorner'

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: 'text-green-400 bg-green-500/10 border-green-500/20',
  intermediate: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  advanced: 'text-red-400 bg-red-500/10 border-red-500/20',
}

interface StepState {
  step: SimulatorStep
  chosenIndex: number | null
  result: SimulatorAnswerResult | null
}

export default function BoxingSimulator() {
  const [searchParams] = useSearchParams()
  const boxerId = searchParams.get('boxer') || ''
  const [scenarios, setScenarios] = useState<SimulatorScenario[]>([])
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null)
  const [steps, setSteps] = useState<SimulatorStep[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [stepStates, setStepStates] = useState<StepState[]>([])
  const [loading, setLoading] = useState(true)
  const [stepLoading, setStepLoading] = useState(false)
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    fetchSimulatorScenarios()
      .then(setScenarios)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const startScenario = async (slug: string) => {
    setLoading(true)
    try {
      const scenario = await fetchSimulatorScenario(slug)
      setSelectedScenario(slug)
      setSteps(scenario.steps)
      setCurrentStep(0)
      setStepStates([])
      setFinished(false)
    } catch {
      // error shown inline
    } finally {
      setLoading(false)
    }
  }

  const handleAnswer = async (scenarioSlug: string, stepIndex: number, chosenIndex: number) => {
    if (!boxerId) return
    setStepLoading(true)
    try {
      const result = await submitSimulatorAnswer({
        boxer_id: boxerId,
        scenario_slug: scenarioSlug,
        step_index: stepIndex,
        chosen_option_index: chosenIndex,
      })
      setStepStates((prev) => [
        ...prev,
        { step: steps[stepIndex], chosenIndex, result },
      ])
      if (result.is_last_step) {
        setFinished(true)
      } else {
        setCurrentStep((prev) => prev + 1)
      }
    } catch {
      // silent
    } finally {
      setStepLoading(false)
    }
  }

  const correctCount = stepStates.filter((s) => s.result?.correct).length

  if (!selectedScenario) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
          <div className="flex items-center gap-2">
            <Zap size={20} className="text-orange-400" />
            <h1 className="text-lg font-bold text-white">Boxing Simulator</h1>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-xl border border-blue-500/20 bg-blue-500/5">
            <Info size={14} className="text-blue-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-400">
              This is an educational simulation. Tactical decisions in real boxing depend on your physical conditioning, your coach's guidance, and the specific situation. These scenarios are not a prediction of real competitive outcomes.
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-orange-400" /></div>
          ) : (
            <div className="space-y-3">
              {scenarios.map((scenario) => (
                <button
                  key={scenario.slug}
                  onClick={() => startScenario(scenario.slug)}
                  className="w-full text-left rounded-xl border border-slate-700/50 bg-slate-900/60 p-4 hover:border-orange-500/30 hover:bg-slate-800/50 transition group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <p className="text-sm font-semibold text-white">{scenario.title}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${DIFFICULTY_COLORS[scenario.difficulty] || ''}`}>
                          {scenario.difficulty}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400">{scenario.description}</p>
                      <p className="text-xs text-slate-500 mt-1">{scenario.total_steps} decision{scenario.total_steps > 1 ? 's' : ''}</p>
                    </div>
                    <ChevronRight size={14} className="text-slate-500 group-hover:text-orange-400 transition mt-1 shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </Layout>
    )
  }

  const currentScenario = scenarios.find((s) => s.slug === selectedScenario)

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => setSelectedScenario(null)}
              className="text-xs text-slate-400 hover:text-white transition mb-1"
            >← All scenarios</button>
            <h1 className="text-base font-bold text-white">{currentScenario?.title}</h1>
          </div>
          <button
            onClick={() => startScenario(selectedScenario)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
          >
            <RotateCcw size={12} /> Restart
          </button>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition ${
                i < currentStep
                  ? stepStates[i]?.result?.correct ? 'bg-green-500' : 'bg-red-500'
                  : i === currentStep && !finished ? 'bg-orange-500 animate-pulse' : 'bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Previous step results */}
        {stepStates.map((state, i) => (
          <div
            key={i}
            className={`rounded-xl border p-4 ${
              state.result?.correct ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {state.result?.correct
                ? <CheckCircle size={14} className="text-green-400" />
                : <XCircle size={14} className="text-red-400" />}
              <span className="text-xs font-semibold text-slate-300">Step {i + 1} — Your choice: "{state.step.options[state.chosenIndex!]}"</span>
            </div>
            <p className="text-sm text-slate-300">{state.result?.feedback}</p>
            {!state.result?.correct && (
              <p className="text-xs text-slate-500 mt-1">
                Best answer: "{state.step.options[state.result?.correct_index ?? 0]}"
              </p>
            )}
          </div>
        ))}

        {/* Current step */}
        {!finished && steps[currentStep] && (
          <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-5 space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Decision {currentStep + 1} of {steps.length}</span>
            </div>
            <p className="text-sm text-white font-medium leading-relaxed">{steps[currentStep].scenario_text}</p>
            <div className="space-y-2">
              {steps[currentStep].options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(selectedScenario, currentStep, i)}
                  disabled={stepLoading}
                  className="w-full text-left px-4 py-3 rounded-xl border border-slate-700/50 bg-slate-800/60 text-sm text-slate-300 hover:border-orange-500/40 hover:bg-slate-800 hover:text-white transition disabled:opacity-50"
                >
                  {opt}
                </button>
              ))}
            </div>
            {stepLoading && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Loader2 size={12} className="animate-spin" /> Evaluating your choice…
              </div>
            )}
          </div>
        )}

        {/* Finished */}
        {finished && (
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-6 text-center space-y-3">
            <Zap size={28} className="mx-auto text-orange-400" />
            <p className="text-lg font-bold text-white">Scenario Complete!</p>
            <p className="text-sm text-slate-300">
              You answered {correctCount} of {steps.length} decision{steps.length > 1 ? 's' : ''} correctly.
            </p>
            <p className="text-xs text-slate-500 italic mt-2">
              {stepStates[0]?.result?.educational_note}
            </p>
            <div className="flex gap-3 justify-center mt-2">
              <button onClick={() => startScenario(selectedScenario)} className="btn-secondary text-xs py-2">
                <RotateCcw size={12} /> Try Again
              </button>
              <button onClick={() => setSelectedScenario(null)} className="btn-primary text-xs py-2">
                More Scenarios
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
