# Valen Boxing Intelligence — Quick Start

## Requirements
- Python 3.11+
- Node.js 18+
- Ollama (local AI): https://ollama.com/download

## Setup

```bash
# 1. Start Ollama (first time: ollama pull llama3:latest)
ollama serve

# 2. Backend
cd "valen-boxing-intelligence\backend"
venv\Scripts\activate
uvicorn app.main:app --reload --port 8000

# 3. Frontend
cd "valen-boxing-intelligence\frontend"
npm run dev -- --force
```

Open http://localhost:5173

AI health check: http://localhost:8000/health

See valen-boxing-intelligence/README.md for full documentation.
