import json
import pandas as pd
from pathlib import Path
from datetime import datetime

def safe_read_csv(file_path):
    try:
        return pd.read_csv(file_path, encoding='utf-8')
    except UnicodeDecodeError:
        try:
            return pd.read_csv(file_path, encoding='latin-1')
        except:
            return pd.read_csv(file_path, encoding='cp1252')

def parse_time_to_seconds(time_str):
    if pd.isna(time_str) or time_str == '':
        return None
    parts = str(time_str).split(':')
    if len(parts) != 3:
        return None
    try:
        hours = int(parts[0])
        minutes = int(parts[1])
        seconds = int(parts[2])
        return hours * 3600 + minutes * 60 + seconds
    except ValueError:
        return None

def create_shape_from_stops(stop_times_group, stops_df):
    coordinates = []
    stop_times_sorted = stop_times_group.sort_values('stop_sequence')
    for _, stop_time in stop_times_sorted.iterrows():
        stop_id = stop_time['stop_id']
        stop_info = stops_df[stops_df['stop_id'] == stop_id]
        if not stop_info.empty:
            stop_data = stop_info.iloc[0]
            coordinates.append([float(stop_data['stop_lat']), float(stop_data['stop_lon'])])
    return coordinates

def preprocess_gtfs(in_dir: str, out_dir: str, include_route_types=(2, 3)):
    """
    Converte i GTFS in JSON: routes, shapes, stops, timetable, calendar, stats.
    include_route_types: 2=train, 3=bus 
    """
    in_dir = Path(in_dir)
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    routes_df = safe_read_csv(in_dir / 'routes.txt')
    trips_df = safe_read_csv(in_dir / 'trips.txt')
    stops_df = safe_read_csv(in_dir / 'stops.txt')
    shapes_df = safe_read_csv(in_dir / 'shapes.txt')
    stop_times_df = safe_read_csv(in_dir / 'stop_times.txt')
    calendar_dates_df = safe_read_csv(in_dir / 'calendar_dates.txt')

    sel_routes = routes_df[routes_df['route_type'].isin(include_route_types)].copy()
    route_ids = set(sel_routes['route_id'])
    sel_trips = trips_df[trips_df['route_id'].isin(route_ids)].copy()

    trip_ids = set(sel_trips['trip_id'])
    sel_shapes = shapes_df[shapes_df['shape_id'].isin(sel_trips['shape_id'])].copy()
    sel_stop_times = stop_times_df[stop_times_df['trip_id'].isin(trip_ids)].copy()

    routes_json = {}
    for _, route in sel_routes.iterrows():
        color = "#3388ff"
        if pd.notna(route.get('route_color')) and route['route_color'] != '':
            color_val = str(route['route_color']).strip()
            color = f"#{color_val}" if not color_val.startswith('#') else color_val

        mode = 'train' if int(route.get('route_type', 2)) == 2 else 'bus'
        routes_json[str(route['route_id'])] = {
            "short": str(route.get('route_short_name', 'REG')),
            "long": str(route.get('route_long_name', 'Linea')),
            "color": color,
            "type": str(route.get('route_type', 2)),
            "mode": mode
        }

    shapes_json = {}
    for shape_id, shape_group in sel_shapes.groupby('shape_id'):
        points = shape_group.sort_values('shape_pt_sequence')
        coords = []
        for _, p in points.iterrows():
            coords.append([float(p['shape_pt_lat']), float(p['shape_pt_lon'])])
        shapes_json[str(shape_id)] = coords

    stops_json = {}
    for _, stop in stops_df.iterrows():
        stops_json[str(stop['stop_id'])] = {
            "name": str(stop['stop_name']).replace('Stazione di ', ''),
            "lat": float(stop['stop_lat']),
            "lon": float(stop['stop_lon']),
            "full_name": str(stop['stop_name'])
        }

    calendar_lookup = {}
    for _, cal_date in calendar_dates_df.iterrows():
        service_id = str(cal_date['service_id'])
        date = str(cal_date['date'])
        exception_type = int(cal_date['exception_type'])
        calendar_lookup.setdefault(service_id, {})[date] = exception_type

    timetable_json = {}
    for trip_id, stop_times_group in sel_stop_times.groupby('trip_id'):
        trip_info = sel_trips[sel_trips['trip_id'] == trip_id]
        if trip_info.empty:
            continue
        trip_info = trip_info.iloc[0]

        stop_times_sorted = stop_times_group.sort_values('stop_sequence')
        if stop_times_sorted.empty:
            continue

        first_stop = stop_times_sorted.iloc[0]
        last_stop = stop_times_sorted.iloc[-1]

        stops_list = []
        for _, st in stop_times_sorted.iterrows():
            stops_list.append([
                str(st['stop_id']),
                str(st['departure_time']),
                str(st['arrival_time']),
                int(st['stop_sequence'])
            ])

        shape_id = trip_info.get('shape_id')
        if pd.isna(shape_id) or shape_id == '' or str(shape_id) not in shapes_json:
            generated_shape_id = f"generated_{trip_id}"
            coords = create_shape_from_stops(stop_times_sorted, stops_df)
            if coords:
                shapes_json[generated_shape_id] = coords
                shape_id = generated_shape_id
            else:
                shape_id = "default"

        dep_time = parse_time_to_seconds(first_stop['departure_time'])
        arr_time = parse_time_to_seconds(last_stop['arrival_time'])
        duration_minutes = 0
        if dep_time is not None and arr_time is not None:
            duration_minutes = (arr_time - dep_time) // 60

        service_id = str(trip_info.get('service_id', ''))
        service_dates = calendar_lookup.get(service_id, {})

        timetable_json[str(trip_id)] = {
            "route_id": str(trip_info['route_id']),
            "shape_id": str(shape_id),
            "service_id": service_id,
            "departure": str(first_stop['departure_time']),
            "arrival": str(last_stop['arrival_time']),
            "headsign": str(trip_info.get('trip_headsign', '')),
            "duration_minutes": duration_minutes,
            "stops": stops_list,
            "stop_count": len(stops_list),
            "service_dates": service_dates
        }

    calendar_json = {}
    for _, cal_date in calendar_dates_df.iterrows():
        calendar_json.setdefault(str(cal_date['service_id']), {})[str(cal_date['date'])] = int(cal_date['exception_type'])

    stats_json = {
        "total_routes": len(routes_json),
        "total_trips": len(timetable_json),
        "total_stops": len(stops_json),
        "total_shapes": len(shapes_json),
        "generated_at": datetime.now().isoformat(),
    }

    def save_json(data, filename):
        with open(out_dir / filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, separators=(',', ':'), ensure_ascii=False, indent=2)

    save_json(routes_json, 'routes.json')
    save_json(shapes_json, 'shapes.json')
    save_json(stops_json, 'stops.json')
    save_json(timetable_json, 'timetable.json')
    save_json(calendar_json, 'calendar.json')
    save_json(stats_json, 'stats.json')

    return {
        "routes": len(routes_json),
        "shapes": len(shapes_json),
        "stops": len(stops_json),
        "trips": len(timetable_json),
        "calendar": len(calendar_json)
    }
