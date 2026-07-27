import { useState, useEffect } from 'react'
import TeamCard from './components/TeamCard'
import ComparisonPage from './components/ComparisonPage'

function CountdownTimer({ deadline, gameweek }) {
  function calculateTimeLeft() {
    const diff = +new Date(deadline) - +new Date()
    if (diff <= 0) return null
    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / 1000 / 60) % 60),
      seconds: Math.floor((diff / 1000) % 60),
    }
  }

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft())

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 1000)
    return () => clearInterval(timer)
  }, [deadline])

  if (!deadline) return null

  return (
    <div className="countdown-container">
      <div className="countdown-label">⏳ GW{gameweek} Deadline</div>
      {timeLeft ? (
        <div className="countdown-grid">
          <div className="countdown-unit"><span>{timeLeft.days}</span>d</div>
          <div className="countdown-unit"><span>{timeLeft.hours}</span>h</div>
          <div className="countdown-unit"><span>{timeLeft.minutes}</span>m</div>
          <div className="countdown-unit"><span>{timeLeft.seconds}</span>s</div>
        </div>
      ) : (
        <div className="countdown-expired">Deadline has passed!</div>
      )}
    </div>
  )
}

function FdrBadge({ value }) {
  const v = parseFloat(value)
  const colors = { 1: '#00c853', 2: '#64dd17', 3: '#ffd600', 4: '#ff6d00', 5: '#d50000' }
  const bg = v <= 1.5 ? colors[1] : v <= 2.5 ? colors[2] : v <= 3.5 ? colors[3] : v <= 4.2 ? colors[4] : colors[5]
  return (
    <span className="fdr-badge" style={{ background: bg, color: v <= 2.5 ? '#0e1117' : '#fff' }}>
      {value}
    </span>
  )
}

function PreseasonDashboard({ data }) {
  const { preseason_data, gameweek, deadline } = data
  const [activeTab, setActiveTab] = useState('popular')

  const picksToShow = activeTab === 'popular' ? preseason_data.popular_picks : preseason_data.scout_picks

  return (
    <div className="preseason-dashboard">
      <CountdownTimer deadline={deadline} gameweek={gameweek} />

      <div className="preseason-alert">
        <strong>⚽ Pre-Season Mode</strong> — League standings unlock once GW{gameweek} kicks off.
        Use these insights to build your squad before the deadline!
      </div>

      {/* Scout Picks */}
      <div className="preseason-section">
        <div className="preseason-tabs">
          <button
            className={`preseason-tab ${activeTab === 'popular' ? 'active' : ''}`}
            onClick={() => setActiveTab('popular')}
          >
            🔥 Most Owned Globally
          </button>
          <button
            className={`preseason-tab ${activeTab === 'value' ? 'active' : ''}`}
            onClick={() => setActiveTab('value')}
          >
            💡 FDR Value Picks (≤£8.5m)
          </button>
        </div>

        <div className="scout-grid">
          {picksToShow.map(p => (
            <div key={p.id} className="scout-card">
              <div className="scout-card-top">
                <span className={`scout-pos pos-${p.position.toLowerCase()}`}>{p.position}</span>
                <span className="scout-name">{p.name}</span>
                <span className="scout-team">{p.team}</span>
              </div>
              <div className="scout-card-stats">
                <div className="scout-stat">
                  <span className="scout-stat-label">Price</span>
                  <span className="scout-stat-value">£{p.price}m</span>
                </div>
                <div className="scout-stat">
                  <span className="scout-stat-label">Owned</span>
                  <span className="scout-stat-value">{p.selected_by}%</span>
                </div>
                <div className="scout-stat">
                  <span className="scout-stat-label">Score</span>
                  <span className="scout-stat-value" style={{ color: '#00ff87' }}>{p.score}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FDR Heatmap */}
      <div className="preseason-section">
        <h3 className="preseason-section-title">📅 Opening Fixture Difficulty (Next 5 GWs)</h3>
        <p className="preseason-section-sub">Lower average = easier run of fixtures — great for buying their assets early</p>
        <div className="fdr-table-wrapper">
          <table className="fdr-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Club</th>
                <th>Avg FDR</th>
                <th>Difficulty</th>
              </tr>
            </thead>
            <tbody>
              {preseason_data.fdr_leaderboard.map((team, i) => (
                <tr key={team.team_id} className={i < 6 ? 'fdr-easy' : i >= preseason_data.fdr_leaderboard.length - 6 ? 'fdr-hard' : ''}>
                  <td className="fdr-rank">{i + 1}</td>
                  <td className="fdr-club">
                    <span className="fdr-short">{team.short_name}</span>
                    <span className="fdr-full">{team.name}</span>
                  </td>
                  <td><FdrBadge value={team.avg_difficulty} /></td>
                  <td>
                    <div className="fdr-bar-track">
                      <div
                        className="fdr-bar-fill"
                        style={{
                          width: `${((team.avg_difficulty - 1) / 4) * 100}%`,
                          background: team.avg_difficulty <= 2.5 ? '#00c853' : team.avg_difficulty <= 3.5 ? '#ffd600' : '#ff6d00'
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

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
      <div className="fpl-page">
        <SiteHeader />
        <div className="fpl-content">
          <ComparisonPage onBack={() => setPage('main')} />
        </div>
      </div>
    )
  }

  return (
    <div className="fpl-page">
      <SiteHeader />

      {/* Hero / search */}
      <div className="fpl-hero">
        <div className="fpl-hero-inner">
          <h1 className="fpl-hero-title">FPL Advisor</h1>
          <p className="fpl-hero-sub">Transfer suggestions &amp; captain picks for every team in your league</p>
          <div className="search-section">
            <input
              type="text"
              placeholder="Enter league URL or ID (e.g. 12345)"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button onClick={() => handleSearch()} disabled={loading || !input.trim()}>
              {loading ? 'Analysing…' : 'Analyse League'}
            </button>
          </div>
        </div>
        <div className="fpl-hero-players" aria-hidden="true" />
      </div>

      <div className="fpl-content">
        {error && <div className="error">{error}</div>}

        {loading && (
          <div className="loading">
            <div className="spinner" />
            <p>Fetching league data and generating suggestions…</p>
            <p className="loading-sub">This may take a moment for large leagues</p>
          </div>
        )}

        {data && (
          <>
            <div className="league-info">
              <h2>{data.league_name}</h2>
              <span>Gameweek {data.gameweek} &middot; {data.teams.length} teams</span>
              {data.teams.length > 0 && (
                <button className="comparison-btn" onClick={() => setPage('comparison')}>
                  📊 Verify Suggestions
                </button>
              )}
            </div>

            {data.teams.length === 0 ? (
              <PreseasonDashboard data={data} />
            ) : (
              <div className="teams-grid">
                {data.teams.map(team => (
                  <TeamCard key={team.team_id} team={team} />
                ))}
              </div>
            )}
          </>
        )}

        {!data && !loading && !error && (
          <div className="help-text">
            <div className="about-section">
              <h2>What does FPL Advisor do?</h2>
              <p>FPL Advisor analyses every team in your Fantasy Premier League mini-league and delivers smart recommendations based on player stats, form and upcoming fixtures.</p>
              <div className="feature-grid">
                <div className="feature-item">
                  <span className="feature-icon">🔄</span>
                  <h3>Transfer Suggestions</h3>
                  <p>Finds the weakest players in a squad and recommends stronger replacements with better form and easier fixtures.</p>
                </div>
                <div className="feature-item">
                  <span className="feature-icon">©️</span>
                  <h3>Captain Pick</h3>
                  <p>Recommends the best captain based on form, points per game and fixture difficulty.</p>
                </div>
                <div className="feature-item">
                  <span className="feature-icon">🪑</span>
                  <h3>Bench Order</h3>
                  <p>Ranks bench players so the highest-scoring sub comes on first.</p>
                </div>
                <div className="feature-item">
                  <span className="feature-icon">📊</span>
                  <h3>Verify Suggestions</h3>
                  <p>Compare your actual gameweek score against what you would have scored following our advice.</p>
                </div>
              </div>
            </div>

            <div className="how-to">
              <h3>Get started</h3>
              <p>Paste your FPL league URL or enter the league ID above.</p>
              <p style={{ marginTop: 8 }}>
                Example: <code>https://fantasy.premierleague.com/leagues/12345/standings/page</code>
              </p>
              <p style={{ marginTop: 4 }}>or just: <code>12345</code></p>
              <div className="example-ids">
                <span>Try a league:</span>
                <button onClick={() => handleSearch('314')}>Overall (314)</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="fpl-footer">
        <p>FPL Advisor — unofficial tool, not affiliated with the Premier League.</p>
      </footer>
    </div>
  )
}

function SiteHeader() {
  return (
    <nav className="fpl-nav">
      <div className="fpl-nav-inner">
        <div className="fpl-nav-logo">
          <span className="fpl-nav-ball">⚽</span>
          <span className="fpl-nav-brand">Fantasy<strong>Advisor</strong></span>
        </div>
        <div className="fpl-nav-links">
          <a href="https://fantasy.premierleague.com" target="_blank" rel="noreferrer">Official FPL</a>
          <a href="https://fantasy.premierleague.com/statistics" target="_blank" rel="noreferrer">Statistics</a>
          <a href="https://fantasy.premierleague.com/fixtures" target="_blank" rel="noreferrer">Fixtures</a>
        </div>
      </div>
    </nav>
  )
}

export default App
