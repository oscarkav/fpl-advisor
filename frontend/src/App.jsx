import { useState } from 'react'
import TeamCard from './components/TeamCard'
import ComparisonPage from './components/ComparisonPage'

function App() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)
  const [page, setPage] = useState('main')

  function extractLeagueId(value) {
    const trimmed = value.trim()
    // Pure number
    if (/^\d+$/.test(trimmed)) return trimmed
    // URL like https://fantasy.premierleague.com/leagues/12345/standings/...
    const match = trimmed.match(/leagues\/(\d+)/)
    if (match) return match[1]
    return null
  }

  async function handleSearch(directId) {
    const leagueId = directId || extractLeagueId(input)
    if (!leagueId) {
      setError('Please enter a valid league ID or FPL league URL.')
      return
    }
    if (directId) setInput(String(directId))

    setLoading(true)
    setError(null)
    setData(null)

    try {
      const resp = await fetch(`/api/league/${leagueId}`)
      const json = await resp.json()
      if (!resp.ok) {
        setError(json.error || 'Failed to fetch league data.')
        return
      }
      setData(json)
    } catch (err) {
      setError('Could not connect to the server. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSearch()
  }

  if (page === 'comparison') {
    return (
      <div className="app">
        <ComparisonPage onBack={() => setPage('main')} />
      </div>
    )
  }

  return (
    <div className="app">
      <div className="header">
        <h1>⚽ FPL Advisor</h1>
        <p>Get transfer suggestions and captain picks for every team in your league</p>
      </div>

      <div className="search-section">
        <input
          type="text"
          placeholder="Enter league URL or ID (e.g. 12345)"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button onClick={handleSearch} disabled={loading || !input.trim()}>
          {loading ? 'Analysing...' : 'Analyse League'}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {loading && (
        <div className="loading">
          <div className="spinner" />
          <p>Fetching league data and generating suggestions...</p>
          <p style={{ marginTop: 8, fontSize: '0.82rem', color: '#555' }}>
            This may take a moment for large leagues
          </p>
        </div>
      )}

      {data && (
        <>
          <div className="league-info">
            <h2>{data.league_name}</h2>
            <span>Gameweek {data.gameweek} &middot; {data.teams.length} teams</span>
            <button className="comparison-btn" onClick={() => setPage('comparison')}>
              📊 Verify Suggestions
            </button>
          </div>

          <div className="teams-grid">
            {data.teams.map(team => (
              <TeamCard key={team.team_id} team={team} />
            ))}
          </div>
        </>
      )}

      {!data && !loading && !error && (
        <div className="help-text">
          <div className="about-section">
            <h2>Vad gör FPL Advisor?</h2>
            <p>FPL Advisor analyserar alla lag i din Fantasy Premier League-liga och ger smarta förslag baserat på spelarstatistik, form och kommande matcher.</p>
            <div className="feature-grid">
              <div className="feature-item">
                <span className="feature-icon">🔄</span>
                <h3>Transferförslag</h3>
                <p>Hittar de svagaste spelarna i ditt lag och föreslår bättre ersättare med starkare form och lättare matcher.</p>
              </div>
              <div className="feature-item">
                <span className="feature-icon">©️</span>
                <h3>Kaptenval</h3>
                <p>Rekommenderar den bästa kaptenen baserat på form, poäng per match och matchsvårighet.</p>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🪑</span>
                <h3>Bänkordning</h3>
                <p>Rangordnar dina bänkspelare så att den mest poänggivande spelar substitueras in först.</p>
              </div>
              <div className="feature-item">
                <span className="feature-icon">📊</span>
                <h3>Verifiera förslag</h3>
                <p>Jämför din faktiska gameweek-poäng med vad du hade fått om du följt våra förslag.</p>
              </div>
            </div>
          </div>

          <div className="how-to">
            <h3>Kom igång</h3>
            <p>Klistra in din FPL-liga-URL eller ange liga-ID:t ovan.</p>
            <p style={{ marginTop: 8 }}>
              Exempel: <code>https://fantasy.premierleague.com/leagues/12345/standings/page</code>
            </p>
            <p style={{ marginTop: 4 }}>
              eller bara: <code>12345</code>
            </p>
            <div className="example-ids">
              <span>Prova en liga:</span>
              <button onClick={() => handleSearch('547702')}>547702</button>
              <button onClick={() => handleSearch('1385234')}>1385234</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
