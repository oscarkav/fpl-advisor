import { useState, useEffect, Fragment } from 'react'

const LEAGUES = [547702, 1385234]
const FROM_GW = 25

function ComparisonPage({ onBack }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [leagues, setLeagues] = useState([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const results = []
      for (const id of LEAGUES) {
        try {
          const resp = await fetch(`/api/comparison/${id}?from_gw=${FROM_GW}`)
          if (resp.ok) {
            const json = await resp.json()
            results.push(json)
          }
        } catch {}
      }
      if (!cancelled) {
        if (results.length === 0) setError('Kunde inte hämta jämförelsedata.')
        setLeagues(results)
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="comparison-page">
      <div className="comparison-header">
        <button className="back-btn" onClick={onBack}>← Tillbaka</button>
        <h2>📊 Verifiering av förslag</h2>
        <p>Ligor {LEAGUES.join(' & ')} — från GW{FROM_GW}</p>
      </div>

      {loading && (
        <div className="loading">
          <div className="spinner" />
          <p>Hämtar historisk data för GW{FROM_GW}+...</p>
          <p style={{ marginTop: 8, fontSize: '0.82rem', color: '#555' }}>
            Analyserar flera gameweeks — detta kan ta en stund
          </p>
        </div>
      )}

      {error && <div className="error">{error}</div>}

      {!loading && leagues.map((league, idx) => (
        <div key={idx} className="comparison-league-block">
          <div className="league-title-row">
            <h3>{league.league_name}</h3>
            <span className="gw-range-badge">
              GW{league.gameweeks[0]} – GW{league.gameweeks[league.gameweeks.length - 1]}
            </span>
          </div>

          <div className="compact-table-wrap">
            <table className="compact-compare-table">
              <thead>
                <tr>
                  <th className="sticky-col">Lag</th>
                  {league.gameweeks.map(gw => (
                    <th key={gw} colSpan={2} className="gw-col-header">GW{gw}</th>
                  ))}
                  <th colSpan={2} className="total-col-header">Totalt</th>
                  <th className="diff-col-header">Diff</th>
                </tr>
                <tr className="sub-header-row">
                  <th className="sticky-col"></th>
                  {league.gameweeks.map(gw => (
                    <Fragment key={gw}>
                      <th className="sub-h">Fkt</th>
                      <th className="sub-h">Fsl</th>
                    </Fragment>
                  ))}
                  <th className="sub-h">Fkt</th>
                  <th className="sub-h">Fsl</th>
                  <th className="sub-h"></th>
                </tr>
              </thead>
              <tbody>
                {league.teams.map(team => (
                  <tr key={team.team_id}>
                    <td className="sticky-col team-name-cell">
                      <div className="team-cell-content">
                        <span className="team-name-text">{team.team_name}</span>
                        <span className="manager-text">{team.manager}</span>
                      </div>
                    </td>
                    {league.gameweeks.map(gw => {
                      const gd = team.gw_data[String(gw)]
                      if (!gd) return (
                        <Fragment key={gw}>
                          <td className="pts-cell">-</td>
                          <td className="pts-cell">-</td>
                        </Fragment>
                      )
                      const cls = gd.diff > 0 ? 'positive' : gd.diff < 0 ? 'negative' : ''
                      return (
                        <Fragment key={gw}>
                          <td className="pts-cell">{gd.actual}</td>
                          <td className={`pts-cell ${cls}`}>{gd.suggested}</td>
                        </Fragment>
                      )
                    })}
                    <td className="pts-cell total-val">{team.total_actual}</td>
                    <td className="pts-cell total-val">{team.total_suggested}</td>
                    <td className={`pts-cell diff-val ${team.total_diff > 0 ? 'positive' : team.total_diff < 0 ? 'negative' : ''}`}>
                      {team.total_diff > 0 ? '+' : ''}{team.total_diff}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

export default ComparisonPage
