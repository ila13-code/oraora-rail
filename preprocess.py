#!/usr/bin/env python3
"""
Usage:
    python preprocess.py <in_dir> <out_dir>
"""
import json
import sys
import pandas as pd
from pathlib import Path
from collections import defaultdict
from datetime import datetime, timedelta
import re

def safe_read_csv(file_path):
    """Legge un CSV gestendo errori di encoding"""
    try:
        return pd.read_csv(file_path, encoding='utf-8')
    except UnicodeDecodeError:
        try:
            return pd.read_csv(file_path, encoding='latin-1')
        except:
            return pd.read_csv(file_path, encoding='cp1252')

def parse_time(time_str):
    """Converte time in formato HH:MM:SS in secondi dal mezzanotte"""
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
    """Crea una shape interpolando tra le fermate quando la shape non esiste"""
    coordinates = []
    
    # Ordina per stop_sequence
    stop_times_sorted = stop_times_group.sort_values('stop_sequence')
    
    for _, stop_time in stop_times_sorted.iterrows():
        stop_id = stop_time['stop_id']
        stop_info = stops_df[stops_df['stop_id'] == stop_id]
        
        if not stop_info.empty:
            stop_data = stop_info.iloc[0]
            coordinates.append([float(stop_data['stop_lat']), float(stop_data['stop_lon'])])
    
    return coordinates

def main():
    try:
        in_dir, out_dir = map(Path, sys.argv[1:3])
    except ValueError:
        sys.exit("❌ Usage: python preprocess_gtfs.py <in_dir> <out_dir>")

    print(f"🚀 Avvio preprocessing GTFS da {in_dir} verso {out_dir}")
    out_dir.mkdir(parents=True, exist_ok=True)

    # Carica file GTFS
    print("📂 Caricamento file GTFS...")
    
    try:
        routes_df = safe_read_csv(in_dir / 'routes.txt')
        trips_df = safe_read_csv(in_dir / 'trips.txt')
        stops_df = safe_read_csv(in_dir / 'stops.txt')
        shapes_df = safe_read_csv(in_dir / 'shapes.txt')
        stop_times_df = safe_read_csv(in_dir / 'stop_times.txt')
        calendar_dates_df = safe_read_csv(in_dir / 'calendar_dates.txt')
        
    except FileNotFoundError as e:
        print(f"❌ File mancante: {e}")
        return
    except Exception as e:
        print(f"❌ Errore caricamento: {e}")
        return

    print(f"📊 File caricati:")
    print(f"   - routes: {len(routes_df)} righe")
    print(f"   - trips: {len(trips_df)} righe") 
    print(f"   - stops: {len(stops_df)} righe")
    print(f"   - shapes: {len(shapes_df)} righe")
    print(f"   - stop_times: {len(stop_times_df)} righe")
    print(f"   - calendar_dates: {len(calendar_dates_df)} righe")

    # Filtra solo treni (route_type == 2)
    print("🚆 Filtraggio solo linee ferroviarie...")
    train_routes = routes_df[routes_df['route_type'] == 2].copy()
    
    if train_routes.empty:
        print("❌ Nessuna linea ferroviaria trovata!")
        return
    
    print(f"🚂 Trovate {len(train_routes)} linee ferroviarie:")
    for _, route in train_routes.iterrows():
        print(f"   - {route['route_short_name']}: {route['route_long_name']}")
    
    train_route_ids = set(train_routes['route_id'])
    train_trips = trips_df[trips_df['route_id'].isin(train_route_ids)].copy()
    
    # Filtra shapes e stop_times correlati
    train_trip_ids = set(train_trips['trip_id'])
    train_shapes = shapes_df[shapes_df['shape_id'].isin(train_trips['shape_id'])].copy()
    train_stop_times = stop_times_df[stop_times_df['trip_id'].isin(train_trip_ids)].copy()
    
    print(f"📊 Dati filtrati:")
    print(f"   - {len(train_trips)} viaggi ferroviari")
    print(f"   - {len(train_shapes)} punti shape")
    print(f"   - {len(train_stop_times)} fermate programmate")

    # 1. PROCESSA ROUTES
    print("🎨 Processando routes...")
    routes_json = {}
    for _, route in train_routes.iterrows():
        # Gestisce colore
        color = "#3388ff"
        if pd.notna(route.get('route_color')) and route['route_color'] != '':
            color_val = str(route['route_color']).strip()
            if not color_val.startswith('#'):
                color = f"#{color_val}"
            else:
                color = color_val
        
        routes_json[str(route['route_id'])] = {
            "short": str(route.get('route_short_name', 'REG')),
            "long": str(route.get('route_long_name', 'Linea Regionale')),
            "color": color,
            "type": str(route.get('route_type', 2))
        }

    # 2. PROCESSA SHAPES
    print("🗺️  Processando shapes...")
    shapes_json = {}
    
    # Processa shapes esistenti
    for shape_id, shape_group in train_shapes.groupby('shape_id'):
        shape_points = shape_group.sort_values('shape_pt_sequence')
        coordinates = []
        
        for _, point in shape_points.iterrows():
            coordinates.append([float(point['shape_pt_lat']), float(point['shape_pt_lon'])])
        
        shapes_json[str(shape_id)] = coordinates

    # 3. PROCESSA STOPS
    print("🚉 Processando stops...")
    stops_json = {}
    for _, stop in stops_df.iterrows():
        stops_json[str(stop['stop_id'])] = {
            "name": str(stop['stop_name']).replace('Stazione di ', ''),
            "lat": float(stop['stop_lat']),
            "lon": float(stop['stop_lon']),
            "full_name": str(stop['stop_name'])
        }

    # 4. PROCESSA TIMETABLE CON CALENDARIO
    print("⏰ Processando timetable...")
    timetable_json = {}
    
    # Crea dizionario calendar per lookup veloce
    calendar_lookup = {}
    for _, cal_date in calendar_dates_df.iterrows():
        service_id = str(cal_date['service_id'])
        date = str(cal_date['date'])
        exception_type = int(cal_date['exception_type'])
        
        if service_id not in calendar_lookup:
            calendar_lookup[service_id] = {}
        calendar_lookup[service_id][date] = exception_type

    # Raggruppa stop_times per trip_id
    trip_groups = train_stop_times.groupby('trip_id')
    
    trip_count = 0
    for trip_id, stop_times_group in trip_groups:
        # Ottieni info del trip
        trip_info = train_trips[train_trips['trip_id'] == trip_id]
        if trip_info.empty:
            continue
        
        trip_info = trip_info.iloc[0]
        
        # Ordina per stop_sequence
        stop_times_sorted = stop_times_group.sort_values('stop_sequence')
        
        if stop_times_sorted.empty:
            continue
        
        first_stop = stop_times_sorted.iloc[0]
        last_stop = stop_times_sorted.iloc[-1]
        
        # Crea lista fermate con informazioni complete
        stops_list = []
        for _, stop_time in stop_times_sorted.iterrows():
            stop_data = [
                str(stop_time['stop_id']),
                str(stop_time['departure_time']),
                str(stop_time['arrival_time']),
                int(stop_time['stop_sequence'])
            ]
            stops_list.append(stop_data)
        
        # Ottieni shape_id, se non esiste crea una shape dalle fermate
        shape_id = trip_info.get('shape_id')
        if pd.isna(shape_id) or shape_id == '' or str(shape_id) not in shapes_json:
            # Crea shape dalle coordinate delle fermate
            generated_shape_id = f"generated_{trip_id}"
            shape_coords = create_shape_from_stops(stop_times_sorted, stops_df)
            if shape_coords:
                shapes_json[generated_shape_id] = shape_coords
                shape_id = generated_shape_id
            else:
                shape_id = "default"
        
        # Calcola durata del viaggio
        dep_time = parse_time(first_stop['departure_time'])
        arr_time = parse_time(last_stop['arrival_time'])
        duration_minutes = 0
        if dep_time and arr_time:
            duration_minutes = (arr_time - dep_time) // 60
        
        # Ottieni date di servizio
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
        
        trip_count += 1

    print(f"✅ Processati {trip_count} viaggi")

    # 5. PROCESSA CALENDAR DATES
    print("📅 Processando calendar dates...")
    calendar_json = {}
    for _, cal_date in calendar_dates_df.iterrows():
        service_id = str(cal_date['service_id'])
        date = str(cal_date['date'])
        exception_type = int(cal_date['exception_type'])
        
        if service_id not in calendar_json:
            calendar_json[service_id] = {}
        
        calendar_json[service_id][date] = exception_type

    # 6. CREA STATISTICHE DETTAGLIATE
    print("📈 Generando statistiche...")
    
    # Analisi per destinazioni
    destinations = {}
    for trip in timetable_json.values():
        headsign = trip['headsign']
        if headsign not in destinations:
            destinations[headsign] = 0
        destinations[headsign] += 1
    
    stats_json = {
        "total_routes": len(routes_json),
        "total_trips": len(timetable_json),
        "total_stops": len(stops_json),
        "total_shapes": len(shapes_json),
        "generated_at": datetime.now().isoformat(),
        "destinations": destinations,
        "routes_summary": {
            route_id: {
                "trip_count": len([t for t in timetable_json.values() if t['route_id'] == route_id]),
                "stops_served": len(set([stop[0] for t in timetable_json.values() if t['route_id'] == route_id for stop in t['stops']])),
                "destinations": list(set([t['headsign'] for t in timetable_json.values() if t['route_id'] == route_id and t['headsign']]))
            }
            for route_id in routes_json.keys()
        }
    }

    # 7. SALVA TUTTI I FILE JSON
    print("💾 Salvando file JSON...")
    
    def save_json(data, filename):
        with open(out_dir / filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, separators=(',', ':'), ensure_ascii=False, indent=2)
    
    save_json(routes_json, 'routes.json')
    save_json(shapes_json, 'shapes.json')
    save_json(stops_json, 'stops.json')
    save_json(timetable_json, 'timetable.json')
    save_json(calendar_json, 'calendar.json')
    save_json(stats_json, 'stats.json')

    print("✅ Preprocessing completato con successo!")
    print(f"📁 File generati in: {out_dir}")
    print(f"   - routes.json ({len(routes_json)} linee)")
    print(f"   - shapes.json ({len(shapes_json)} percorsi)")
    print(f"   - stops.json ({len(stops_json)} stazioni)")
    print(f"   - timetable.json ({len(timetable_json)} viaggi)")
    print(f"   - calendar.json ({len(calendar_json)} servizi)")
    print(f"   - stats.json (statistiche complete)")
    
    # Mostra statistiche interessanti per debug
    print("\n📊 Statistiche dettagliate:")
    for route_id, route_data in routes_json.items():
        route_stats = stats_json['routes_summary'][route_id]
        print(f"\n🚂 {route_data['short']} - {route_data['long']}:")
        print(f"   - {route_stats['trip_count']} viaggi totali")
        print(f"   - {route_stats['stops_served']} stazioni servite")
        print(f"   - Destinazioni: {', '.join(route_stats['destinations'])}")
    
    print(f"\n🎯 Destinazioni principali:")
    for dest, count in sorted(destinations.items(), key=lambda x: x[1], reverse=True)[:10]:
        print(f"   - {dest}: {count} viaggi")

if __name__ == "__main__":
    main()
