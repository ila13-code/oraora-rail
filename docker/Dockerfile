# Dockerfile per OraOra Rail
FROM python:3.11-slim

# Imposta la directory di lavoro
WORKDIR /app

# Installa dipendenze di sistema
RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copia requirements.txt dal backend e installa dipendenze Python
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia il codice del backend
COPY backend/ ./

# Copia il frontend nella posizione corretta
COPY frontend/ ../frontend/

# Crea le directory necessarie
RUN mkdir -p resources gtfs-out

# Espone la porta 5000
EXPOSE 5000

# Comando di avvio
CMD ["python", "app.py"]