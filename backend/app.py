import os
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

from preprocess import preprocess_gtfs
from gtfs_repo import GTFSRepository
from planner import MultiModalPlanner

BASE_DIR = Path(__file__).resolve().parent
IN_DIR = BASE_DIR / "resources"        
OUT_DIR = BASE_DIR / "gtfs-out"      
FRONTEND_DIR = BASE_DIR.parent / "frontend"

REQUIRED_GTFS_FILES = {
    "routes.txt",
    "trips.txt",
    "stops.txt",
    "shapes.txt",
    "stop_times.txt",
    "calendar_dates.txt"
}

app = Flask(__name__, static_folder=None)
CORS(app)

repo = GTFSRepository(str(OUT_DIR))
planner = None

def gtfs_present(in_dir: Path) -> bool:
    if not in_dir.exists():
        return False
    files = {p.name for p in in_dir.iterdir() if p.is_file()}
    return REQUIRED_GTFS_FILES.issubset(files)

def auto_bootstrap():
    """
    Default:
      - se NON esiste gtfs-out/timetable.json (test a caso - tanto devono esserci tutti per farlo funzionare)
      - e in resources/ ci sono i GTFS
      => preprocess automatico su gtfs-out/
    """
    os.makedirs(OUT_DIR, exist_ok=True)
    timetable_json = OUT_DIR / "timetable.json"

    if not timetable_json.exists():
        if gtfs_present(IN_DIR):
            print(f"Preprocess automatico: {IN_DIR} -> {OUT_DIR}")
            preprocess_gtfs(str(IN_DIR), str(OUT_DIR), include_route_types=(2, 3))
        else:
            print(f"Nessun JSON e GTFS non trovati in {IN_DIR}. Metti i file GTFS in resources/ o chiama /preprocess.")

    if timetable_json.exists():
        repo.load()
        global planner
        planner = MultiModalPlanner(repo)
        print("Repository caricato.")
    else:
        print("Nessun dataset caricato. Chiama /preprocess appena hai i GTFS.")

auto_bootstrap()

def ensure_loaded():
    global planner
    if not repo.routes:
        repo.load()
    if planner is None:
        planner = MultiModalPlanner(repo)

@app.route("/health")
def health():
    return jsonify({"ok": True})

@app.route("/preprocess", methods=["POST"])
def do_preprocess():
    """
    Se non viene passato 'in_dir', userà automaticamente backend/resources
    e salverà in backend/gtfs-out.
    """
    body = request.get_json(force=True, silent=True) or {}
    in_dir = body.get("in_dir") or str(IN_DIR)
    include_types = body.get("include_route_types", [2, 3])

    if not gtfs_present(Path(in_dir)):
        return jsonify({"error": f"I file GTFS richiesti non sono presenti in {in_dir}"}), 400

    stats = preprocess_gtfs(in_dir, str(OUT_DIR), include_route_types=tuple(include_types))
    repo.load()
    global planner
    planner = MultiModalPlanner(repo)
    return jsonify({"ok": True, "stats": stats, "out_dir": str(OUT_DIR)})

@app.route("/data/<string:fname>.json", methods=["GET"])
def get_json(fname):
    return send_from_directory(str(OUT_DIR), f"{fname}.json")

@app.route("/plan", methods=["POST"])
def plan_endpoint():
    ensure_loaded()
    data = request.get_json(force=True)
    origin = data.get("origin")
    destination = data.get("destination")
    date = data.get("date")
    optimize = data.get("optimize", "time")
    depart_after = data.get("depart_after", "00:00:00")

    if not origin or not destination or not date:
        return jsonify({"found": False, "message": "origin, destination, date sono obbligatori"}), 400

    res = planner.plan(origin, destination, date, depart_after, optimize)
    return jsonify(res)

# fa partire il fe
@app.route("/")
def index():
    return send_from_directory(str(FRONTEND_DIR), "index.html")

@app.route("/modules/<path:path>")
def modules(path):
    return send_from_directory(str(FRONTEND_DIR / "modules"), path)

@app.route("/<path:path>")
def static_proxy(path):
    return send_from_directory(str(FRONTEND_DIR), path)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
