import { useState } from 'react'

const POS_CLASS = {
  GKP: 'pos-gkp',
  DEF: 'pos-def',
  MID: 'pos-mid',
  FWD: 'pos-fwd',
}

function TeamCard({ team }) {
  const [expanded, setExpanded] = useState(false)

  if (team.error) {
    return (
      <div className="team-card">
        <div className="team-header" onClick={() => setExpanded(!expanded)}>
          <div className="team-header-left">
            <h3>{team.team_name}</h3>
            <span className="manager">{team.manager}</span>
          </div>
          <div className="team-header-right">
            <div className="team-stat">
              <div className="label">Rank</div>
              <div className="value">{team.rank}</div>
            </div>
            <div className="team-stat">
              <div className="label">Points</div>
              <div className="value">{team.total_points}</div>
            </div>
            <span className="error" style={{ fontSize: '0.8rem', padding: '4px 8px' }}>
              Error loading
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="team-card">
      <div className="team-header" onClick={() => setExpanded(!expanded)}>
        <div className="team-header-left">
          <h3>{team.team_name}</h3>
          <span className="manager">{team.manager}</span>
        </div>
        <div className="team-header-right">
          <div className="team-stat">
            <div className="label">Rank</div>
            <div className="value">{team.rank}</div>
          </div>
          <div className="team-stat">
            <div className="label">Points</div>
            <div className="value">{team.total_points}</div>
          </div>
          <div className="team-stat">
            <div className="label">Bank</div>
            <div className="value">£{team.bank?.toFixed(1)}</div>
          </div>
          <div className="team-stat">
            <div className="label">Captain</div>
            <div className="value" style={{ color: '#4fc3f7' }}>{team.current_captain}</div>
          </div>
          <span className={`expand-icon ${expanded ? 'open' : ''}`}>▼</span>
        </div>
      </div>

      {expanded && (
        <div className="team-details">
          <div className="suggestions">
            {/* Transfer Suggestions */}
            <div className="suggestion-card">
              <h4 className="transfer-title">🔄 Transfer Suggestions</h4>
              {team.transfers && team.transfers.length > 0 ? (
                team.transfers.map((t, i) => (
                  <div key={i} className="transfer">
                    <div className="transfer-row">
                      <div className="player-info">
                        <span className="transfer-out">{t.out.name}</span>
                        <span className="pos-badge">{t.out.position}</span>
                        <span className="team-badge">{t.out.team}</span>
                      </div>
                      <span className="arrow">→</span>
                      <div className="player-info">
                        <span className="transfer-in">{t.in.name}</span>
                        <span className="pos-badge">{t.in.position}</span>
                        <span className="team-badge">{t.in.team}</span>
                      </div>
                    </div>
                    <div className="transfer-detail">
                      £{t.out.price}m (form {t.out.form}) → £{t.in.price}m (form {t.in.form})
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ color: '#555' }}>No transfer suggestions available</div>
              )}
            </div>

            {/* Captain Suggestion */}
            <div className="suggestion-card">
              <h4 className="captain-title">©️ Captain Suggestion</h4>
              {team.captain_suggestion ? (
                <div className="captain-pick">
                  <div className="captain-icon">C</div>
                  <div className="captain-details">
                    <div className="captain-name">
                      {team.captain_suggestion.name}
                      <span className="pos-badge" style={{ marginLeft: 8 }}>
                        {team.captain_suggestion.position}
                      </span>
                      <span className="team-badge" style={{ marginLeft: 6 }}>
                        {team.captain_suggestion.team}
                      </span>
                    </div>
                    <div className="captain-reason">{team.captain_suggestion.reason}</div>
                    <div style={{ marginTop: 6, fontSize: '0.8rem', color: '#666' }}>
                      £{team.captain_suggestion.price}m &middot; Score: {team.captain_suggestion.score}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ color: '#555' }}>No captain suggestion available</div>
              )}
            </div>
          </div>

          {/* Bench Order */}
          {team.bench_order && team.bench_order.length > 0 && (
            <div className="suggestion-card" style={{ marginBottom: 20 }}>
              <h4 className="bench-title">🪑 Recommended Bench Order</h4>
              <div className="bench-order-list">
                {team.bench_order.map((p, i) => (
                  <div key={i} className="bench-order-item">
                    <span className="bench-order-num">{p.order}</span>
                    <span className={POS_CLASS[p.position] || ''}>{p.position}</span>
                    <span className="bench-player-name">{p.name}</span>
                    <span className="team-badge">{p.team}</span>
                    <span className="bench-meta">Form {p.form} &middot; Score {p.score}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Squad */}
          <div className="squad-section">
            <h4>Squad</h4>
            <table className="squad-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Pos</th>
                  <th>Team</th>
                  <th>Price</th>
                  <th>Form</th>
                  <th>Pts</th>
                </tr>
              </thead>
              <tbody>
                {team.squad?.map((p, i) => (
                  <tr key={i} className={!p.is_starter ? 'bench' : ''}>
                    <td>
                      {p.name}
                      {p.is_captain && <span className="captain-badge">C</span>}
                      {p.is_vice && <span className="vice-badge">V</span>}
                    </td>
                    <td className={POS_CLASS[p.position] || ''}>{p.position}</td>
                    <td>{p.team}</td>
                    <td>£{p.price}m</td>
                    <td>{p.form}</td>
                    <td>{p.total_points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default TeamCard
