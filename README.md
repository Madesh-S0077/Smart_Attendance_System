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

1. The sidecar relies on the **backend's virtual environment**, so ensure it is activated in your terminal.
2. **Download the AI models** (InsightFace `buffalo_l` + MiniFASNet ONNX) with one command from the repo root:
   ```bash
   pip install -r norm-ai-frontend/src-tauri/sidecar/requirements-sidecar.txt
   python scripts/download_models.py
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
# Use the python from the backend virtual environment
..\..\..\norm-ai-backend\.venv\Scripts\python ai_pipeline.py
```
*(Check `http://127.0.0.1:8765/health` to verify it's running).*

**Terminal 3 — Frontend UI:**
```bash
cd norm-ai-frontend
npm run tauri dev
```
*(This will launch the desktop window).*
