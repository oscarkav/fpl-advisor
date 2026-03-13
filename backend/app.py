"""FPL Advisor Backend - Fetches league data and generates transfer/captain suggestions."""

import os
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import requests
import ssl

# Serve React build from frontend/dist
STATIC_DIR = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist')
app = Flask(__name__, static_folder=STATIC_DIR, static_url_path='')
CORS(app)

BASE_URL = "https://fantasy.premierleague.com/api"

# Shared session with browser-like headers (FPL blocks plain requests)
session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
})
session.verify = False  # This machine has SSL cert issues
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


def fpl_get(path):
    """Make a GET request to the FPL API."""
    resp = session.get(f"{BASE_URL}/{path}")
    resp.raise_for_status()
    return resp.json()


def get_bootstrap():
    """Get all static FPL data (players, teams, gameweeks)."""
    return fpl_get("bootstrap-static/")


def get_league_standings(league_id, page=1):
    """Get classic league standings."""
    return fpl_get(f"leagues-classic/{league_id}/standings/?page_standings={page}")


def get_team_picks(team_id, gw):
    """Get a team's picks for a specific gameweek."""
    return fpl_get(f"entry/{team_id}/event/{gw}/picks/")


def get_team_info(team_id):
    """Get team entry info."""
    return fpl_get(f"entry/{team_id}/")


def get_fixtures():
    """Get all fixtures."""
    return fpl_get("fixtures/")


def get_current_gw(bootstrap):
    """Find the current/next gameweek."""
    for event in bootstrap["events"]:
        if event["is_current"]:
            return event["id"]
        if event["is_next"]:
            return event["id"]
    # fallback: last finished
    for event in reversed(bootstrap["events"]):
        if event["finished"]:
            return event["id"]
    return 1


def get_gw_live(gw):
    """Get final/live points for all players in a specific gameweek."""
    data = fpl_get(f"event/{gw}/live/")
    return {el["id"]: el["stats"]["total_points"] for el in data["elements"]}


def build_player_map(bootstrap):
    """Build a dict of player_id -> player info with computed scores."""
    teams = {t["id"]: t for t in bootstrap["teams"]}
    element_types = {et["id"]: et["singular_name_short"] for et in bootstrap["element_types"]}

    players = {}
    for p in bootstrap["elements"]:
        players[p["id"]] = {
            "id": p["id"],
            "name": p["web_name"],
            "full_name": f'{p["first_name"]} {p["second_name"]}',
            "team_id": p["team"],
            "team_name": teams[p["team"]]["short_name"],
            "position": element_types[p["element_type"]],
            "element_type": p["element_type"],
            "price": p["now_cost"] / 10,
            "form": float(p["form"]),
            "points_per_game": float(p["points_per_game"]),
            "total_points": p["total_points"],
            "minutes": p["minutes"],
            "goals": p["goals_scored"],
            "assists": p["assists"],
            "clean_sheets": p["clean_sheets"],
            "ict_index": float(p["ict_index"]),
            "selected_by": float(p["selected_by_percent"]),
            "event_points": p["event_points"],
            "status": p["status"],  # 'a' = available
            "chance_playing": p["chance_of_playing_next_round"],
            "news": p["news"],
        }
    return players, teams


def get_upcoming_fixture_difficulty(fixtures, teams, next_n=5):
    """Compute average fixture difficulty for each team over the next N unfinished fixtures."""
    team_fixtures = {t_id: [] for t_id in teams}

    upcoming = [f for f in fixtures if not f["finished"] and f["event"] is not None]
    upcoming.sort(key=lambda f: f["event"])

    for f in upcoming:
        home = f["team_h"]
        away = f["team_a"]
        if len(team_fixtures[home]) < next_n:
            team_fixtures[home].append(f["team_h_difficulty"])
        if len(team_fixtures[away]) < next_n:
            team_fixtures[away].append(f["team_a_difficulty"])

    avg_diff = {}
    for t_id, diffs in team_fixtures.items():
        avg_diff[t_id] = sum(diffs) / len(diffs) if diffs else 3.0
    return avg_diff


def compute_player_score(player, fixture_difficulty):
    """Compute a composite recommendation score for a player."""
    form = player["form"]
    ppg = player["points_per_game"]
    ict = player["ict_index"]
    fdr = fixture_difficulty.get(player["team_id"], 3.0)

    # Lower fixture difficulty = easier fixtures = higher score
    fixture_bonus = (5 - fdr) * 2

    # Availability penalty
    availability = 1.0
    if player["status"] != "a":
        availability = 0.0
    elif player["chance_playing"] is not None and player["chance_playing"] < 75:
        availability = 0.3

    score = (form * 3 + ppg * 2 + ict / 50 + fixture_bonus) * availability
    return round(score, 2)


def suggest_transfers(squad_ids, players, fixture_difficulty, bank=0):
    """Suggest 2 transfers: find weakest squad players and best replacements."""
    squad = [players[pid] for pid in squad_ids if pid in players]
    if not squad:
        return []

    # Score all squad players
    for p in squad:
        p["score"] = compute_player_score(p, fixture_difficulty)

    # Find the 2 weakest starters (lowest score, skip unavailable — they're obvious)
    squad_sorted = sorted(squad, key=lambda p: p["score"])

    transfers = []
    used_positions = set()
    excluded_ids = set(squad_ids)

    for weak in squad_sorted:
        if len(transfers) >= 2:
            break
        pos = weak["element_type"]
        if pos in used_positions:
            continue

        # Find best replacement in same position not already in squad
        candidates = [
            p for p in players.values()
            if p["element_type"] == pos
            and p["id"] not in excluded_ids
            and p["status"] == "a"
            and p["minutes"] > 90
        ]
        for c in candidates:
            c["score"] = compute_player_score(c, fixture_difficulty)

        candidates.sort(key=lambda p: p["score"], reverse=True)

        if candidates:
            replacement = candidates[0]
            transfers.append({
                "out": {
                    "id": weak["id"],
                    "name": weak["name"],
                    "team": weak["team_name"],
                    "position": weak["position"],
                    "price": weak["price"],
                    "form": weak["form"],
                    "score": weak["score"],
                },
                "in": {
                    "id": replacement["id"],
                    "name": replacement["name"],
                    "team": replacement["team_name"],
                    "position": replacement["position"],
                    "price": replacement["price"],
                    "form": replacement["form"],
                    "score": replacement["score"],
                },
                "reason": f"Upgrade {weak['position']}: {weak['name']} (form {weak['form']}) → {replacement['name']} (form {replacement['form']}, easier fixtures)"
            })
            excluded_ids.add(replacement["id"])
            used_positions.add(pos)

    return transfers


def suggest_bench_order(bench_ids, players, fixture_difficulty):
    """Suggest optimal bench order (1st sub, 2nd sub, 3rd sub) based on score."""
    bench = []
    for pid in bench_ids:
        if pid in players:
            p = players[pid].copy()
            p["score"] = compute_player_score(p, fixture_difficulty)
            bench.append(p)

    # Sort by score descending — best bench player first
    bench.sort(key=lambda p: p["score"], reverse=True)

    return [
        {
            "order": i + 1,
            "name": p["name"],
            "team": p["team_name"],
            "position": p["position"],
            "form": p["form"],
            "price": p["price"],
            "score": p["score"],
        }
        for i, p in enumerate(bench)
    ]


def suggest_captain(squad_ids, players, fixture_difficulty):
    """Suggest the best captain from the squad."""
    squad = []
    for pid in squad_ids:
        if pid in players:
            p = players[pid].copy()
            p["score"] = compute_player_score(p, fixture_difficulty)
            squad.append(p)

    squad.sort(key=lambda p: p["score"], reverse=True)

    if not squad:
        return None

    best = squad[0]
    return {
        "id": best["id"],
        "name": best["name"],
        "team": best["team_name"],
        "position": best["position"],
        "form": best["form"],
        "price": best["price"],
        "score": best["score"],
        "reason": f"Best form ({best['form']}) with favorable fixtures (FDR avg {fixture_difficulty.get(best['team_id'], 3.0):.1f})"
    }


def compute_comparison(picks_data, players, transfers, captain_suggestion, gw_live):
    """Compare actual GW points vs hypothetical points with suggested changes."""
    picks = picks_data["picks"]

    # --- Actual points ---
    actual_details = []
    actual_total = 0
    for pick in picks:
        pid = pick["element"]
        multiplier = pick["multiplier"]
        if pid in players and multiplier > 0:
            p = players[pid]
            ep = gw_live.get(pid, 0)
            pts = ep * multiplier
            actual_total += pts
            actual_details.append({
                "id": pid,
                "name": p["name"],
                "position": p["position"],
                "team": p["team_name"],
                "event_points": ep,
                "multiplier": multiplier,
                "total": pts,
                "is_captain": pick["is_captain"],
            })

    # --- Suggested points ---
    suggested = {}
    for pick in picks:
        if pick["multiplier"] > 0:
            suggested[pick["element"]] = 1

    # Apply suggested transfers
    transfer_comparison = []
    for t in transfers:
        out_id = t["out"]["id"]
        in_id = t["in"]["id"]
        out_ep = gw_live.get(out_id, 0)
        in_ep = gw_live.get(in_id, 0)
        was_starter = out_id in suggested
        transfer_comparison.append({
            "out_name": t["out"]["name"],
            "out_team": t["out"]["team"],
            "out_points": out_ep,
            "in_name": t["in"]["name"],
            "in_team": t["in"]["team"],
            "in_points": in_ep,
            "diff": in_ep - out_ep,
            "was_starter": was_starter,
        })
        if was_starter:
            del suggested[out_id]
            suggested[in_id] = 1

    # Apply suggested captain
    captain_comparison = None
    if captain_suggestion:
        sug_cap_id = captain_suggestion["id"]
        for pid in suggested:
            suggested[pid] = 1
        if sug_cap_id in suggested:
            suggested[sug_cap_id] = 2

        actual_cap = next((d for d in actual_details if d["is_captain"]), None)
        sug_cap_ep = gw_live.get(sug_cap_id, 0)
        captain_comparison = {
            "actual_name": actual_cap["name"] if actual_cap else "?",
            "actual_points": actual_cap["event_points"] if actual_cap else 0,
            "actual_total": actual_cap["total"] if actual_cap else 0,
            "suggested_name": captain_suggestion["name"],
            "suggested_points": sug_cap_ep,
            "suggested_total": sug_cap_ep * 2,
        }

    suggested_total = 0
    suggested_details = []
    for pid, mult in suggested.items():
        if pid in players:
            p = players[pid]
            ep = gw_live.get(pid, 0)
            pts = ep * mult
            suggested_total += pts
            suggested_details.append({
                "id": pid,
                "name": p["name"],
                "position": p["position"],
                "team": p["team_name"],
                "event_points": ep,
                "multiplier": mult,
                "total": pts,
                "is_captain": mult == 2,
            })

    return {
        "actual_total": actual_total,
        "suggested_total": suggested_total,
        "difference": suggested_total - actual_total,
        "actual_details": sorted(actual_details, key=lambda x: (-x["is_captain"], -x["total"])),
        "suggested_details": sorted(suggested_details, key=lambda x: (-x["is_captain"], -x["total"])),
        "transfer_comparison": transfer_comparison,
        "captain_comparison": captain_comparison,
    }


@app.route("/api/league/<int:league_id>")
def api_league(league_id):
    """Main endpoint: get league teams with transfer and captain suggestions."""
    try:
        bootstrap = get_bootstrap()
        current_gw = get_current_gw(bootstrap)
        players, teams_map = build_player_map(bootstrap)
        fixtures = get_fixtures()
        fixture_difficulty = get_upcoming_fixture_difficulty(fixtures, teams_map)

        # Get live GW points for accurate comparison
        try:
            gw_live = get_gw_live(current_gw)
        except Exception:
            gw_live = {}

        # Get league info
        league_data = get_league_standings(league_id)
        league_name = league_data["league"]["name"]
        standings = league_data["standings"]["results"]

        results = []
        for entry in standings[:20]:  # Limit to 20 teams
            team_id = entry["entry"]
            manager = entry["player_name"]
            team_name = entry["entry_name"]
            rank = entry["rank"]
            total = entry["total"]

            try:
                picks_data = get_team_picks(team_id, current_gw)
                squad_ids = [pick["element"] for pick in picks_data["picks"]]
                starting_11 = [pick["element"] for pick in picks_data["picks"] if pick["position"] <= 11]
                bench_ids = [pick["element"] for pick in picks_data["picks"] if pick["position"] > 11]
                current_captain = next((pick["element"] for pick in picks_data["picks"] if pick["is_captain"]), None)
                bank = picks_data.get("entry_history", {}).get("bank", 0) / 10

                transfers = suggest_transfers(squad_ids, players, fixture_difficulty, bank)
                captain = suggest_captain(starting_11, players, fixture_difficulty)
                bench_order = suggest_bench_order(bench_ids, players, fixture_difficulty)
                comparison = compute_comparison(picks_data, players, transfers, captain, gw_live)

                current_captain_name = players[current_captain]["name"] if current_captain and current_captain in players else "Unknown"

                squad_details = []
                for pick in picks_data["picks"]:
                    pid = pick["element"]
                    if pid in players:
                        p = players[pid]
                        squad_details.append({
                            "name": p["name"],
                            "team": p["team_name"],
                            "position": p["position"],
                            "price": p["price"],
                            "form": p["form"],
                            "total_points": p["total_points"],
                            "is_captain": pick["is_captain"],
                            "is_vice": pick["is_vice_captain"],
                            "is_starter": pick["position"] <= 11,
                        })

                results.append({
                    "team_id": team_id,
                    "manager": manager,
                    "team_name": team_name,
                    "rank": rank,
                    "total_points": total,
                    "bank": bank,
                    "current_captain": current_captain_name,
                    "squad": squad_details,
                    "transfers": transfers,
                    "captain_suggestion": captain,
                    "bench_order": bench_order,
                    "comparison": comparison,
                })
            except Exception as e:
                results.append({
                    "team_id": team_id,
                    "manager": manager,
                    "team_name": team_name,
                    "rank": rank,
                    "total_points": total,
                    "error": str(e),
                })

        return jsonify({
            "league_name": league_name,
            "gameweek": current_gw,
            "teams": results,
        })

    except requests.exceptions.HTTPError as e:
        return jsonify({"error": f"FPL API error: {e.response.status_code} - Could not find league. Check the ID."}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/comparison/<int:league_id>")
def api_comparison(league_id):
    """Get historical comparison data for a league from a specific GW onwards."""
    from_gw = request.args.get("from_gw", 30, type=int)
    try:
        bootstrap = get_bootstrap()
        current_gw = get_current_gw(bootstrap)
        players, teams_map = build_player_map(bootstrap)
        fixtures = get_fixtures()
        fixture_difficulty = get_upcoming_fixture_difficulty(fixtures, teams_map)

        # Find finished GWs in range
        finished_gws = [
            ev["id"] for ev in bootstrap["events"]
            if ev["id"] >= from_gw and ev["finished"]
        ]
        # Also include current GW if it's started (has live data)
        if current_gw >= from_gw and current_gw not in finished_gws:
            finished_gws.append(current_gw)
        finished_gws.sort()

        if not finished_gws:
            return jsonify({"error": f"No available gameweek data from GW{from_gw}."}), 404

        league_data = get_league_standings(league_id)
        league_name = league_data["league"]["name"]
        standings = league_data["standings"]["results"]

        # Fetch live points per GW (one call per GW, shared across teams)
        gw_live_cache = {}
        for gw in finished_gws:
            try:
                gw_live_cache[gw] = get_gw_live(gw)
            except Exception:
                pass

        available_gws = sorted(gw_live_cache.keys())
        if not available_gws:
            return jsonify({"error": "Could not fetch live points data."}), 500

        results = []
        for entry in standings[:20]:
            team_id = entry["entry"]
            team_result = {
                "team_id": team_id,
                "team_name": entry["entry_name"],
                "manager": entry["player_name"],
                "gw_data": {},
                "total_actual": 0,
                "total_suggested": 0,
                "total_diff": 0,
            }

            for gw in available_gws:
                gw_live = gw_live_cache[gw]
                try:
                    picks_data = get_team_picks(team_id, gw)
                    squad_ids = [p["element"] for p in picks_data["picks"]]
                    starting_11 = [p["element"] for p in picks_data["picks"] if p["position"] <= 11]

                    transfers = suggest_transfers(squad_ids, players, fixture_difficulty)
                    captain = suggest_captain(starting_11, players, fixture_difficulty)

                    # Actual points
                    actual = 0
                    for pick in picks_data["picks"]:
                        if pick["multiplier"] > 0:
                            actual += gw_live.get(pick["element"], 0) * pick["multiplier"]

                    # Suggested points
                    suggested_lineup = {}
                    for pick in picks_data["picks"]:
                        if pick["multiplier"] > 0:
                            suggested_lineup[pick["element"]] = 1

                    for t in transfers:
                        out_id = t["out"]["id"]
                        in_id = t["in"]["id"]
                        if out_id in suggested_lineup:
                            del suggested_lineup[out_id]
                            suggested_lineup[in_id] = 1

                    if captain:
                        for pid in suggested_lineup:
                            suggested_lineup[pid] = 1
                        if captain["id"] in suggested_lineup:
                            suggested_lineup[captain["id"]] = 2

                    suggested = sum(gw_live.get(pid, 0) * mult for pid, mult in suggested_lineup.items())

                    team_result["gw_data"][str(gw)] = {
                        "actual": actual,
                        "suggested": suggested,
                        "diff": suggested - actual,
                    }
                    team_result["total_actual"] += actual
                    team_result["total_suggested"] += suggested
                except Exception:
                    pass

            team_result["total_diff"] = team_result["total_suggested"] - team_result["total_actual"]
            results.append(team_result)

        return jsonify({
            "league_name": league_name,
            "gameweeks": available_gws,
            "teams": results,
        })

    except requests.exceptions.HTTPError as e:
        return jsonify({"error": f"FPL API error: {e.response.status_code} - Could not find league."}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    """Serve React SPA - any non-API route returns index.html."""
    file_path = os.path.join(app.static_folder, path)
    if path and os.path.exists(file_path):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
