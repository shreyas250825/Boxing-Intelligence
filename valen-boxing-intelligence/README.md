# Valen Boxing Intelligence

Boxing performance analysis platform with local AI companions.

---

## Architecture

All components run locally on your machine:

```
Browser (React) ←→ FastAPI Backend ←→ SQLite / PostgreSQL
                         ↕
                   Ollama (local AI)
                   llama3:latest
```

**The AI Corner uses Ollama exclusively.** No OpenAI key or cloud API is needed.
Never expose Ollama's port (11434) to the internet.

---

## Setup

### 1. Install Ollama

Download from [https://ollama.com/download](https://ollama.com/download)

Pull a model:
```bash
ollama pull llama3:latest
```

Start Ollama:
```bash
ollama serve
```

Verify: `GET http://localhost:11434/api/tags` should return available models.

### 2. Backend

```bash
cd valen-boxing-intelligence/backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Mac/Linux

pip install -r requirements.txt

# Copy environment config
copy .env.example .env

# Start backend
uvicorn app.main:app --reload --port 8000
```

Verify AI health: `GET http://localhost:8000/health`

Expected response:
```json
{
  "status": "ok",
  "ai": {
    "available": true,
    "model": "llama3:latest",
    "model_installed": true,
    "error": null
  }
}
```

### 3. Frontend

```bash
cd valen-boxing-intelligence/frontend

npm install
npm run dev -- --force
```

Open [http://localhost:5173](http://localhost:5173)

---

## AI Configuration

Edit `backend/.env`:

```env
# Ollama server URL (default: local)
OLLAMA_BASE_URL=http://localhost:11434

# Model to use — must be pulled first
OLLAMA_MODEL=llama3:latest

# Generation timeout in seconds (increase for large models or slow hardware)
OLLAMA_TIMEOUT_SECONDS=120
```

Available models on this machine:
- `llama3:latest` — recommended, balanced speed and quality
- `qwen2.5-coder:7b` — works but optimised for code tasks

To use a different model:
```bash
ollama pull mistral:latest
# Then set OLLAMA_MODEL=mistral:latest in backend/.env
```

---

## Deployment note

This application is designed for local use. If you deploy the backend to a
hosted service (Render, Railway, etc.), that server cannot reach Ollama
running on your local machine via `localhost`. In that scenario:
- Run the complete stack locally (recommended)
- Or configure a self-hosted Ollama accessible from the backend server

---

## AI Corner

The AI Corner provides 8 specialised AI companions:

| Companion | Purpose |
|---|---|
| Coach Valen | Boxing technique, drills, learning paths |
| NutriCoach | Food diary, meal planning, macros |
| RecoverAI | Sleep, fatigue, training load |
| CornerIQ | Fight preparation, tactics |
| VisionBox AI | Video analysis results |
| MindCorner | Mindset, confidence, focus |
| PerformanceLab AI | Fitness assessments, conditioning |
| Boxing Academy AI | Rules, history, lessons, quizzes |

All responses are grounded in the athlete's actual saved data.
No fake analytics or invented statistics.

---

## Troubleshooting

**AI offline banner shows on dashboard:**
1. Run `ollama serve`
2. Run `ollama pull llama3:latest` if model is not installed
3. Check `OLLAMA_BASE_URL` in `backend/.env`
4. Restart the backend server

**Responses are very slow:**
- First request loads the model into memory (~20-30s)
- Subsequent requests are much faster
- Increase `OLLAMA_TIMEOUT_SECONDS` if needed
- Use a smaller model for faster responses

**Backend won't start:**
- Ensure virtual environment is activated
- Run `pip install -r requirements.txt`
- Check that port 8000 is not in use
