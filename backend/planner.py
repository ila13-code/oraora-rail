from dataclasses import dataclass
from typing import Dict, List, Optional
from collections import defaultdict
import math

def parse_hhmmss_to_minutes(t: str) -> Optional[int]:
    if not t:
        return None
    parts = t.split(':')
    if len(parts) < 2:
        return None
    h, m = int(parts[0]), int(parts[1])
    s = int(parts[2]) if len(parts) == 3 else 0
    return h * 60 + m + s // 60

@dataclass
class Connection:
    dep_stop: str
    arr_stop: str
    dep_time: int   
    arr_time: int
    trip_id: str
    route_id: str
    mode: str       # treno - bus

@dataclass
class Label:
    arr_time: int
    transfers: int
    last_trip: Optional[str]
    prev: Optional['Label']
    reached_by: Optional[Connection]
    stop: str

class MultiModalPlanner:
    """
    - optimize='time'        → arrivo più presto
    - optimize='transfers'   → meno cambi 
    """
    def __init__(self, repo):
        self.repo = repo

    def build_connections(self, date: str) -> List[Connection]:
        conns: List[Connection] = []
        for trip_id, trip in self.repo.timetable.items():
            if not self.repo.service_active(trip, date):
                continue
            route = self.repo.routes.get(trip['route_id'], {})
            mode = route.get('mode', 'train')
            stops = trip['stops']
            for i in range(len(stops) - 1):
                s_from = stops[i]
                s_to = stops[i+1]
                dep_m = parse_hhmmss_to_minutes(s_from[1])
                arr_m = parse_hhmmss_to_minutes(s_to[2])
                if dep_m is None or arr_m is None:
                    continue
                conns.append(Connection(
                    dep_stop=s_from[0],
                    arr_stop=s_to[0],
                    dep_time=dep_m,
                    arr_time=arr_m,
                    trip_id=trip_id,
                    route_id=trip['route_id'],
                    mode=mode
                ))
        conns.sort(key=lambda c: c.dep_time)
        return conns

    def _segment_json(self, conn: Connection) -> Dict:
        stop_from = self.repo.stops.get(conn.dep_stop, {})
        stop_to = self.repo.stops.get(conn.arr_stop, {})
        route = self.repo.routes.get(conn.route_id, {})

        def fmt(m):
            h = m // 60
            r = m % 60
            return f"{h:02d}:{r:02d}"

        return {
            "mode": conn.mode,
            "route_id": conn.route_id,
            "route_short": route.get('short', ''),
            "trip_id": conn.trip_id,
            "from_stop": {"id": conn.dep_stop, "name": stop_from.get('name', conn.dep_stop)},
            "to_stop": {"id": conn.arr_stop, "name": stop_to.get('name', conn.arr_stop)},
            "departure": fmt(conn.dep_time),
            "arrival": fmt(conn.arr_time),
            "duration": conn.arr_time - conn.dep_time
        }

    def _reconstruct(self, label: Label) -> List[Connection]:
        seq: List[Connection] = []
        cur = label
        while cur and cur.reached_by:
            seq.append(cur.reached_by)
            cur = cur.prev
        return list(reversed(seq))

    def build_legs(self, conns: List[Connection]):
        """Raggruppa i segmenti consecutivi con lo stesso trip_id."""
        legs = []
        cur = None

        def fmt(m):
            h = m // 60
            r = m % 60
            return f"{h:02d}:{r:02d}"

        for c in conns:
            if cur is None or cur['trip_id'] != c.trip_id:
                if cur is not None:
                    legs.append(cur)
                cur = {
                    "trip_id": c.trip_id,
                    "route_id": c.route_id,
                    "route_short": self.repo.routes.get(c.route_id, {}).get('short', ''),
                    "mode": c.mode,
                    "from_stop": self.repo.stops.get(c.dep_stop, {"name": c.dep_stop}),
                    "to_stop": self.repo.stops.get(c.arr_stop, {"name": c.arr_stop}),
                    "departure": fmt(c.dep_time),
                    "arrival": fmt(c.arr_time),
                    "duration": c.arr_time - c.dep_time,
                    "segments": [self._segment_json(c)]
                }
            else:
                cur["to_stop"] = self.repo.stops.get(c.arr_stop, {"name": c.arr_stop})
                cur["arrival"] = fmt(c.arr_time)
                cur["duration"] += (c.arr_time - c.dep_time)
                cur["segments"].append(self._segment_json(c))
        if cur is not None:
            legs.append(cur)
        return legs

    def plan(self, origin: str, destination: str, date: str, departure_after: str, optimize: str):
        dep_after = parse_hhmmss_to_minutes(departure_after) if departure_after else 0
        conns = self.build_connections(date)

        if optimize == 'transfers':
            label = self._plan_min_transfers(conns, origin, destination, dep_after)
            solver = "csa-transfers"
        else:
            label = self._plan_earliest_arrival(conns, origin, destination, dep_after)
            solver = "csa-time"

        if label is None:
            return {"found": False, "message": "Nessun itinerario trovato"}

        segments = self._reconstruct(label)
        segments_json = [self._segment_json(seg) for seg in segments]
        legs = self.build_legs(segments)

        unique_trips = [leg["trip_id"] for leg in legs]
        trip_changes = max(0, len(unique_trips) - 1)
        total_minutes = (label.arr_time - dep_after) if label.arr_time >= dep_after else label.arr_time

        return {
            "found": True,
            "origin": origin,
            "destination": destination,
            "date": date,
            "optimize": optimize,
            "solver": solver,
            "total_minutes": total_minutes,
            "transfers": trip_changes,          
            "segments_count": len(segments_json), 
            "unique_trips": unique_trips,
            "segments": segments_json,
            "legs": legs
        }

    def _plan_earliest_arrival(self, conns: List[Connection], origin: str, destination: str, dep_after: int) -> Optional[Label]:
        best_arrival: Dict[str, Label] = {}
        best_arrival[origin] = Label(arr_time=dep_after, transfers=0, last_trip=None, prev=None, reached_by=None, stop=origin)

        for c in conns:
            if c.dep_time < dep_after:
                continue
            if c.dep_stop not in best_arrival:
                continue
            cur_label = best_arrival[c.dep_stop]
            if cur_label.arr_time <= c.dep_time:
                if (c.arr_time < best_arrival.get(c.arr_stop, Label(math.inf, 0, None, None, None, c.arr_stop)).arr_time):
                    new_label = Label(
                        arr_time=c.arr_time,
                        transfers=cur_label.transfers + (0 if cur_label.last_trip == c.trip_id else 1 if cur_label.last_trip is not None else 0),
                        last_trip=c.trip_id,
                        prev=cur_label,
                        reached_by=c,
                        stop=c.arr_stop
                    )
                    best_arrival[c.arr_stop] = new_label

        return best_arrival.get(destination)

    def _plan_min_transfers(self, conns: List[Connection], origin: str, destination: str, dep_after: int) -> Optional[Label]:
        labels: Dict[str, List[Label]] = defaultdict(list)
        labels[origin].append(Label(dep_after, 0, None, None, None, origin))

        def dominated(new_l: Label, existing: List[Label]) -> bool:
            for l in existing:
                if l.transfers <= new_l.transfers and l.arr_time <= new_l.arr_time:
                    return True
            return False

        for c in conns:
            if c.dep_time < dep_after:
                continue

            for lab in list(labels[c.dep_stop]):
                if lab.arr_time <= c.dep_time:
                    transfers = lab.transfers + (0 if lab.last_trip == c.trip_id else 1 if lab.last_trip is not None else 0)
                    new_label = Label(
                        arr_time=c.arr_time,
                        transfers=transfers,
                        last_trip=c.trip_id,
                        prev=lab,
                        reached_by=c,
                        stop=c.arr_stop
                    )
                    if not dominated(new_label, labels[c.arr_stop]):
                        labels[c.arr_stop] = [l for l in labels[c.arr_stop] if not (new_label.transfers <= l.transfers and new_label.arr_time <= l.arr_time)]
                        labels[c.arr_stop].append(new_label)

        if not labels[destination]:
            return None

        return min(labels[destination], key=lambda l: (l.transfers, l.arr_time))
