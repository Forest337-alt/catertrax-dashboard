import { useState } from 'react'

interface Props {
  onConfirm: (name: string) => Promise<void>
}

export default function NamePrompt({ onConfirm }: Props) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    setLoading(true)
    setError(null)
    try {
      await onConfirm(trimmed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="mb-6">
          <img
            src="/catertrax-logo.png"
            alt="CaterTrax"
            className="h-8 w-auto mb-5"
          />
          <h1 className="text-2xl font-bold text-gray-900">Operator Dashboard</h1>
          <p className="mt-1 text-gray-500">Enter your name to get started with the demo.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="display-name" className="block text-sm font-medium text-gray-700 mb-1">
              Your name
            </label>
            <input
              id="display-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mike Thompson"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-800 focus:border-transparent text-gray-900 placeholder-gray-400"
              autoFocus
              disabled={loading}
            />
          </div>

          {error && <p className="text-sm text-danger-600">{error}</p>}

          <button
            type="submit"
            disabled={!name.trim() || loading}
            className="w-full bg-primary-800 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Setting up...' : 'Get started'}
          </button>
        </form>

        <p className="mt-4 text-xs text-gray-400 text-center">
          This is a demo environment. No real data is stored.
        </p>
      </div>
    </div>
  )
}
