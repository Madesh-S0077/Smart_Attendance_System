# Norm AI — Smart Attendance System

Norm AI is a local-first, AI-powered attendance system built with Tauri, React, FastAPI, and InsightFace. It uses face recognition and anti-spoofing to securely mark student attendance, ensuring that students can only mark their attendance when connected to a designated college Wi-Fi network.

## 🏗 Tech Stack
- **Frontend**: Tauri (Desktop App), React, TypeScript, TailwindCSS
- **Backend API**: FastAPI, SQLAlchemy, PostgreSQL, pgvector
- **AI Sidecar**: Python, InsightFace (buffalo_l), ONNXRuntime (MiniFASNet for anti-spoofing)
- **Database**: Docker + PostgreSQL 15

---

## 🛠 Prerequisites
Before starting, ensure you have the following installed:
1. **Node.js** (v18+) & **npm**
2. **Python** (v3.10 to v3.12 recommended)
3. **Rust** (Required for Tauri desktop builds: [Install via rustup.rs](https://rustup.rs/))
4. **Docker Desktop** (For PostgreSQL with the `pgvector` extension)
5. **Git**

---

## 1️⃣ Database Setup
The backend uses a Docker container for PostgreSQL.

1. Open a terminal in the **`norm-ai-backend`** folder.
2. Start the database container:
   ```bash
   docker-compose up -d
   ```
*(This starts a Postgres 15 database on port 5432 with the pgvector extension installed).*

---

## 2️⃣ Backend Setup (FastAPI)
The backend handles the API, authentication, and database interactions.

1. In the **`norm-ai-backend`** folder, create a Python virtual environment:
   ```bash
   python -m venv .venv
   ```
2. Activate the environment:
   - Windows: `.\.venv\Scripts\activate`
   - Mac/Linux: `source .venv/bin/activate`
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Copy the example env file and set a real secret (credentials already match `docker-compose.yml`):
   ```bash
   copy .env.example .env      # Mac/Linux: cp .env.example .env
   ```
   Then replace `SECRET_KEY` with a random string of at least 64 characters, e.g.
   `python -c "import secrets; print(secrets.token_hex(32))"`.
   Tokens: access = 15 min, refresh = 7 days.
5. Run database migrations to create the tables:
   ```bash
   alembic upgrade head
   ```
6. Seed the default admin account:
   ```bash
   python -m app.seed_admin
   ```

---

## 3️⃣ AI Sidecar Setup (Face Recognition)
The Tauri frontend communicates with a local Python sidecar for face detection and liveness checking (anti-spoofing).

1. The sidecar's pinned dependencies (onnxruntime 1.19, insightface 0.7) need **Python 3.11** (they have no Python 3.13 wheels). Use a separate venv, e.g. with [uv](https://docs.astral.sh/uv/):
   ```bash
   pip install uv
   uv venv --python 3.11 norm-ai-backend/.venv-sidecar
   uv pip install --python norm-ai-backend/.venv-sidecar/Scripts/python.exe -r norm-ai-frontend/src-tauri/sidecar/requirements-sidecar.txt
   ```
2. **Download the AI models** (InsightFace `buffalo_l` + MiniFASNetV2 ONNX) from the repo root:
   ```bash
   norm-ai-backend/.venv-sidecar/Scripts/python scripts/download_models.py
   ```
   This places `buffalo_l/` and `minifas_1m.onnx` in `norm-ai-frontend/src-tauri/sidecar/models/`.

---

## 4️⃣ Frontend Setup (React + Tauri)
1. Open a new terminal in the **`norm-ai-frontend`** folder.
2. Install Node dependencies:
   ```bash
   npm install
   ```

---

## 🚀 How to Run the Project
To run the full application locally, you need to start **three servers** (plus ensure Docker is running). Open three separate terminal tabs:

**Terminal 1 — Backend API:**
```bash
cd norm-ai-backend
.\.venv\Scripts\activate
uvicorn app.main:app --reload
```
*(Check `http://localhost:8000/docs` to verify it's running).*

**Terminal 2 — AI Sidecar:**
```bash
cd norm-ai-frontend\src-tauri\sidecar
# Use the Python 3.11 sidecar venv created in step 3
..\..\..\norm-ai-backend\.venv\Scripts\python ai_pipeline.py
```
*(Check `http://127.0.0.1:8765/health` to verify it's running).*

**Terminal 3 — Frontend UI:**
```bash
cd norm-ai-frontend
npm run tauri dev
```
*(This will launch the desktop window).*

> **Tauri notes:** `tauri.conf.json` declares the sidecar as `externalBin`, so Tauri needs a file named
> `norm-ai-frontend/src-tauri/sidecar/ai_pipeline-x86_64-pc-windows-msvc.exe` to exist at build time.
> For development create an empty placeholder (`type nul > ...`); the app logs that the sidecar was not
> spawned and uses the one you started in Terminal 2. A real PyInstaller-built binary is needed for an installer
> (not included yet). Building also needs Rust + MSVC Build Tools + WebView2.
> The liveness model's thresholds can be tuned with the `LIVENESS_THRESHOLD` / `LIVE_CLASS_INDEX` env vars.

## 🧪 Tests
```bash
cd norm-ai-backend && .\.venv\Scripts\pytest     # unit + DB integration tests (integration skipped if Postgres is down)
cd norm-ai-frontend && npx tsc --noEmit && npm run build
```
