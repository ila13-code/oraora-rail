import json
from pathlib import Path

class GTFSRepository:
    def __init__(self, out_dir: str):
        self.out_dir = Path(out_dir)
        self.routes = {}
        self.shapes = {}
        self.stops = {}
        self.timetable = {}
        self.calendar = {}

    def load(self):
        with open(self.out_dir / 'routes.json', 'r', encoding='utf-8') as f:
            self.routes = json.load(f)
        with open(self.out_dir / 'shapes.json', 'r', encoding='utf-8') as f:
            self.shapes = json.load(f)
        with open(self.out_dir / 'stops.json', 'r', encoding='utf-8') as f:
            self.stops = json.load(f)
        with open(self.out_dir / 'timetable.json', 'r', encoding='utf-8') as f:
            self.timetable = json.load(f)
        with open(self.out_dir / 'calendar.json', 'r', encoding='utf-8') as f:
            self.calendar = json.load(f)

    def service_active(self, trip_obj, date: str) -> bool:
        sd = trip_obj.get('service_dates', {})
        if date in sd and sd[date] == 1:
            return True
        if trip_obj.get('service_id') in self.calendar:
            if date in self.calendar[trip_obj['service_id']] and self.calendar[trip_obj['service_id']][date] == 1:
                return True
        return False
