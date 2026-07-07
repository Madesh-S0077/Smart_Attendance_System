# NORM AI — Smart Attendance System
## Optimized Agent Prompt for Antigravity IDE
### Usage: Paste the MASTER CONTEXT first, then paste one Phase at a time into Antigravity chat.

---

# ═══════════════════════════════════════════
# MASTER CONTEXT — Paste this FIRST in every new Antigravity session
# ═══════════════════════════════════════════

```
You are a senior full-stack engineer building "Norm AI" — a production-ready AI-based
Smart Attendance System for RMK Engineering College. 

## Core Rules (Never Violate)
- CPU-ONLY everywhere. No CUDA. No GPU. No `cuda` in any import or config.
- All AI inference runs INSIDE the Tauri sidecar process (client-side). The FastAPI
  server NEVER runs any AI model. It only stores/compares vectors using pgvector SQL.
- Tauri v2 (not v1). API differs significantly — use Tauri v2 APIs only.
- Two separate repos: `norm-ai-frontend/` and `norm-ai-backend/`
- React + TypeScript inside Tauri (not Svelte, not Vue)
- FastAPI with async/await throughout. No sync DB calls.
- PostgreSQL 15+ with pgvector extension for vector storage.
- Three user roles: student | teacher | admin (RBAC enforced on every endpoint)
- JWT auth: access_token (15 min expiry), refresh_token (7 days expiry)
- Passwords: bcrypt hashing (never plaintext, never logged)
- All API responses follow: { "success": bool, "data": any | null, "error": string | null }
- Duplicate attendance submissions must be REJECTED (HTTP 409) at the database level.
- Face embeddings are 512-dimensional float32 arrays.
- Liveness threshold is > 0.85 (not 0.5). False acceptance is unacceptable.
- WiFi SSIDs for geofencing: ["RMKEC", "RMKEC2G"] — stored in a named constant ALLOWED_SSIDS.
- Attendance window: 08:30 to 10:00 daily (auto-slot generated, skipped on holidays/Sundays).
- Teachers can manually override any student's attendance in their dashboard.
- Show clear, actionable error messages — never generic "something went wrong".

## Tech Stack (Locked)
- Frontend: Tauri v2 + React 18 + TypeScript + Zustand + React Hook Form + Zod
- Styling: Tailwind CSS v3 (utility classes only, no custom CSS files unless unavoidable)
- HTTP Client: Axios with interceptors (auto JWT attach + 401 refresh)
- Backend: FastAPI (Python 3.11+) + SQLAlchemy (async) + Alembic
- Database: PostgreSQL 15 + pgvector
- AI: insightface (buffalo_m model) + Silent-Face-Anti-Spoofing (MiniFAS 1M variant)
- ONNX Runtime: onnxruntime (CPU-only, NOT onnxruntime-gpu)

## Design System (Apply Globally)
Colors:
  --bg:        #F7F8FC   (page background)
  --surface:   #FFFFFF   (cards, panels)
  --primary:   #5B5FEF   (main CTA, active states)
  --primary-l: #7B7DFF   (gradient endpoint, hover)
  --text-1:    #1E293B   (headings, primary text)
  --text-2:    #64748B   (secondary, captions)
  --success:   #22C55E
  --error:     #EF4444
  --holiday:   #FEE2E2   (calendar holiday highlight)
  --border:    #E2E8F0

Typography: Inter (import from Google Fonts)
  Headings: bold, 28px / 20px
  Body: regular, 14px
  Caption: regular, 12px, text-2 color

Components:
  Cards: rounded-[20px], shadow-[0_2px_12px_rgba(0,0,0,0.06)], bg-white
  Buttons: rounded-xl, px-6, py-3, transition-all duration-200
  Inputs: rounded-[10px], border border-[#E2E8F0], focus:ring-2 focus:ring-[#5B5FEF]
  Sidebar active item: bg-gradient-to-r from-[#5B5FEF] to-[#7B7DFF], text-white, rounded-xl
```

---

# ═══════════════════════════════════════════
# PHASE 1 — Repository Scaffold & Database Schema
# Paste this after MASTER CONTEXT
# ═══════════════════════════════════════════

```
## PHASE 1 GOAL
Set up both repositories with correct structure and implement the full database schema.

---

### 1A. Create norm-ai-backend/ structure

Create this exact directory tree:
norm-ai-backend/
├── app/
│   ├── __init__.py
│   ├── main.py               ← FastAPI app entry point
│   ├── core/
│   │   ├── config.py         ← Pydantic Settings (reads .env)
│   │   ├── database.py       ← Async SQLAlchemy engine + session
│   │   ├── security.py       ← JWT create/verify, bcrypt hash/verify
│   │   └── dependencies.py   ← get_current_user, role_required guards
│   ├── models/
│   │   ├── base.py           ← declarative_base()
│   │   ├── user.py
│   │   ├── student.py
│   │   ├── teacher.py
│   │   ├── admin.py
│   │   ├── attendance.py
│   │   ├── time_slot.py
│   │   └── holiday.py
│   ├── schemas/              ← Pydantic request/response models
│   ├── routers/              ← One file per domain
│   └── services/             ← Business logic, no DB code in routers
├── alembic/
├── alembic.ini
├── .env.example
├── requirements.txt
└── docker-compose.yml

---

### 1B. requirements.txt (exact versions — CPU-safe)
fastapi==0.111.0
uvicorn[standard]==0.29.0
sqlalchemy[asyncio]==2.0.30
asyncpg==0.29.0
alembic==1.13.1
pydantic==2.7.1
pydantic-settings==2.2.1
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.9
pgvector==0.3.2
slowapi==0.1.9
httpx==0.27.0

NOTE: Do NOT add insightface or onnxruntime here. Those are sidecar-only dependencies.

---

### 1C. docker-compose.yml
version: '3.9'
services:
  postgres:
    image: pgvector/pgvector:pg15
    environment:
      POSTGRES_USER: normai
      POSTGRES_PASSWORD: normai_pass
      POSTGRES_DB: normai_db
    ports:
      - "5432:5432"
    volumes:
      - pg_data:/var/lib/postgresql/data
volumes:
  pg_data:

---

### 1D. Database Models (SQLAlchemy async ORM)

Implement ALL models with these exact schemas:

#### users table
- id: UUID, primary key, default uuid4
- email: String(255), unique, not null, indexed
- password_hash: String(255), not null
- role: Enum('student', 'teacher', 'admin'), not null
- is_active: Boolean, default True
- created_at: DateTime, server_default func.now()

#### teachers table
- id: UUID, primary key, FK → users.id, ON DELETE CASCADE
- name: String(255), not null
- department: String(100), not null
- position: String(100), not null

#### admins table
- id: UUID, primary key, FK → users.id, ON DELETE CASCADE
- name: String(255), not null

#### students table
- id: UUID, primary key, FK → users.id, ON DELETE CASCADE
- name: String(255), not null
- register_number: String(50), unique, not null
- department: String(100), not null
- section: String(10), not null
- counsellor_id: UUID, FK → teachers.id, nullable, SET NULL on delete
- face_embedding: Vector(512), nullable  ← pgvector column
- created_at: DateTime, server_default func.now()

#### time_slots table
- id: UUID, primary key, default uuid4
- date: Date, not null
- slot_name: String(100), not null, default "Morning Attendance"
- start_time: Time, not null, default time(8, 30)
- end_time: Time, not null, default time(10, 0)
- UNIQUE constraint on (date)  ← one slot per day

#### attendance_logs table
- id: UUID, primary key, default uuid4
- student_id: UUID, FK → students.id, ON DELETE CASCADE
- slot_id: UUID, FK → time_slots.id, ON DELETE CASCADE
- date: Date, not null
- status: Enum('present', 'absent'), default 'absent'
- marked_at: DateTime, nullable
- marked_by: Enum('system', 'teacher'), default 'system'
- face_match_score: Float, nullable  ← cosine similarity, for audit
- UNIQUE constraint on (student_id, slot_id, date)  ← blocks duplicates at DB level

#### holidays table
- id: UUID, primary key, default uuid4
- date: Date, unique, not null
- reason: String(255), nullable
- created_by: UUID, FK → teachers.id or admins.id — use String UUID for flexibility
- created_at: DateTime, server_default func.now()

---

### 1E. Alembic Setup
- Run `alembic init alembic`
- Configure env.py to use the async engine and import all models
- Create initial migration: `alembic revision --autogenerate -m "initial_schema"`
- Verify `alembic upgrade head` runs without errors
- Confirm `CREATE EXTENSION IF NOT EXISTS vector;` is in the migration

---

### 1F. core/config.py using pydantic-settings
Required env vars in .env:
DATABASE_URL=postgresql+asyncpg://normai:normai_pass@localhost:5432/normai_db
SECRET_KEY=your-very-long-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

---

### 1G. Create norm-ai-frontend/ structure

norm-ai-frontend/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   └── commands/
│   │       ├── wifi.rs       ← get_wifi_ssid Tauri command
│   │       └── camera.rs     ← camera capture helpers
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── sidecar/
│       ├── ai_pipeline.py    ← AI inference server
│       ├── requirements-sidecar.txt
│       └── models/           ← downloaded model weights go here
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   ├── RegisterStudent.tsx
│   │   ├── RegisterTeacher.tsx
│   │   ├── StudentDashboard.tsx
│   │   ├── TeacherDashboard.tsx
│   │   └── AdminDashboard.tsx
│   ├── components/
│   │   ├── ui/               ← Button, Input, Card, Modal, Badge
│   │   ├── layout/           ← Sidebar, Header, Layout
│   │   └── attendance/       ← CameraModal, LivenessIndicator, AttendanceStatus
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useCamera.ts
│   │   ├── useGeofence.ts
│   │   └── useAttendance.ts
│   ├── store/
│   │   └── authStore.ts      ← Zustand store
│   ├── api/
│   │   ├── client.ts         ← Axios instance with interceptors
│   │   ├── auth.ts
│   │   ├── attendance.ts
│   │   ├── students.ts
│   │   └── teachers.ts
│   ├── types/
│   │   └── index.ts
│   └── constants/
│       └── geofence.ts       ← ALLOWED_SSIDS = ["RMKEC", "RMKEC2G"]

---

### PHASE 1 ACCEPTANCE CRITERIA
□ docker-compose up starts postgres with pgvector extension enabled
□ alembic upgrade head creates all 7 tables without error
□ pgvector VECTOR(512) column confirmed in students table via \d+ students
□ UNIQUE(student_id, slot_id, date) constraint exists on attendance_logs
□ npm create tauri-app scaffolds norm-ai-frontend without errors
□ All directory structures match the trees above
```

---

# ═══════════════════════════════════════════
# PHASE 2 — AI Sidecar (InsightFace + MiniFAS, CPU-only)
# Paste this after MASTER CONTEXT
# ═══════════════════════════════════════════

```
## PHASE 2 GOAL
Build the AI pipeline that runs locally inside Tauri as a sidecar process.
This is a lightweight local HTTP server on 127.0.0.1:8765.
It is ONLY accessible from the Tauri app, never from the internet.

File to create: norm-ai-frontend/src-tauri/sidecar/ai_pipeline.py

---

### 2A. Sidecar Dependencies
Create norm-ai-frontend/src-tauri/sidecar/requirements-sidecar.txt:
insightface==0.7.3
onnxruntime==1.18.0      ← CPU-only, NOT onnxruntime-gpu
numpy==1.26.4
opencv-python==4.9.0.80
Pillow==10.3.0
fastapi==0.111.0
uvicorn==0.29.0
httpx==0.27.0

CRITICAL: onnxruntime must be the CPU-only package. Add a startup check:
  if 'CUDAExecutionProvider' in onnxruntime.get_available_providers():
      raise RuntimeError("GPU provider detected — use onnxruntime CPU-only build")

---

### 2B. Model Loading Strategy

On sidecar startup:
1. Check if norm-ai-frontend/src-tauri/sidecar/models/buffalo_m/ exists
2. If not, download using insightface's model zoo: insightface.app.FaceAnalysis(name='buffalo_m')
3. Models path must be set to the local sidecar/models/ directory (not ~/.insightface)
4. Load MiniFAS 1M ONNX model from sidecar/models/minifas_1m.onnx
   Download URL: https://github.com/minivision-ai/Silent-Face-Anti-Spoofing (1M model)

Load InsightFace:
  app = insightface.app.FaceAnalysis(
      name='buffalo_m',
      root='./models',
      providers=['CPUExecutionProvider']
  )
  app.prepare(ctx_id=-1, det_size=(640, 640))

Load MiniFAS:
  import onnxruntime as ort
  minifas_session = ort.InferenceSession(
      './models/minifas_1m.onnx',
      providers=['CPUExecutionProvider']
  )

---

### 2C. Anti-Spoofing Logic (Multi-Scale Fusion — CRITICAL, implement exactly)

def predict_liveness(img_bgr: np.ndarray, bbox: list[float]) -> dict:
    """
    bbox = [x1, y1, x2, y2] from InsightFace detector.
    Run MiniFAS at two scales, fuse scores. Threshold: > 0.85 = live.
    """
    def crop_face_region(img, bbox, scale: float) -> np.ndarray:
        x1, y1, x2, y2 = bbox
        cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
        w = (x2 - x1) * scale
        h = (y2 - y1) * scale
        nx1 = max(0, int(cx - w / 2))
        ny1 = max(0, int(cy - h / 2))
        nx2 = min(img.shape[1], int(cx + w / 2))
        ny2 = min(img.shape[0], int(cy + h / 2))
        crop = img[ny1:ny2, nx1:nx2]
        return cv2.resize(crop, (80, 80))   # MiniFAS 1M input size

    def run_minifas(crop: np.ndarray) -> float:
        # Normalize to [0,1], channels last → first
        inp = crop.astype(np.float32) / 255.0
        inp = np.transpose(inp, (2, 0, 1))[np.newaxis, ...]
        output = minifas_session.run(None, {'input': inp})[0]
        # MiniFAS outputs [batch, 3] softmax: [background, spoof, live]
        scores = softmax(output[0])
        return float(scores[2])  # live class probability

    crop_1x  = crop_face_region(img_bgr, bbox, scale=1.0)   # tight: texture
    crop_27x = crop_face_region(img_bgr, bbox, scale=2.7)   # wide: context

    score_1x  = run_minifas(crop_1x)
    score_27x = run_minifas(crop_27x)

    # Average fusion
    fused_score = (score_1x + score_27x) / 2.0
    is_live = fused_score > 0.85

    return {
        "liveness_score": round(fused_score, 4),
        "is_live": is_live,
        "score_1x": round(score_1x, 4),
        "score_27x": round(score_27x, 4)
    }

---

### 2D. Main /analyze Endpoint

POST http://127.0.0.1:8765/analyze
Request body: { "image_base64": "..." }   ← raw base64, no data URI prefix

Processing pipeline:
1. Decode base64 → cv2 BGR image
2. Run app.get(img) to detect all faces
3. If len(faces) == 0 → return { "error": "No face detected in frame" }
4. If len(faces) > 1  → return { "error": "Multiple faces detected. Please ensure only your face is visible." }
5. face = faces[0]
6. bbox = face.bbox.tolist()   ← [x1, y1, x2, y2]
7. liveness = predict_liveness(img, bbox)
8. If not liveness["is_live"] → return {
       "faces_detected": 1,
       "is_live": False,
       "liveness_score": liveness["liveness_score"],
       "embedding": None,
       "error": "Liveness check failed. Please use a real face."
   }
9. embedding = face.embedding.tolist()   ← 512 floats
10. Verify len(embedding) == 512, else raise
11. Return:
   {
     "faces_detected": 1,
     "is_live": True,
     "liveness_score": liveness["liveness_score"],
     "embedding": embedding,   ← list of 512 floats
     "error": None
   }

---

### 2E. Health Endpoint
GET http://127.0.0.1:8765/health
Returns: { "status": "ready", "model": "buffalo_m", "antispoof": "minifas_1m" }
Tauri frontend polls this on startup before enabling attendance flow.

---

### 2F. Tauri v2 Sidecar Registration
In norm-ai-frontend/src-tauri/tauri.conf.json:

{
  "bundle": {
    "externalBin": ["sidecar/ai_pipeline"]
  }
}

In src-tauri/src/lib.rs — start sidecar on app setup:
use tauri::Manager;
use tauri_plugin_shell::ShellExt;

tauri::Builder::default()
  .setup(|app| {
      let sidecar_command = app.shell().sidecar("ai_pipeline")?;
      let (_rx, child) = sidecar_command.spawn()?;
      app.manage(child);
      Ok(())
  })

Build the sidecar with PyInstaller (creates platform binary):
pyinstaller --onefile --name ai_pipeline ai_pipeline.py

---

### PHASE 2 ACCEPTANCE CRITERIA
□ python ai_pipeline.py starts without errors on CPU
□ GET /health returns { "status": "ready" }
□ POST /analyze with a real selfie returns is_live: true + 512-element embedding
□ POST /analyze with a photo of a screen returns is_live: false
□ POST /analyze with no face returns error: "No face detected in frame"
□ No CUDA providers appear in ort.get_available_providers() output during run
□ Inference completes in < 4 seconds on a laptop CPU (i5/Ryzen 5 class)
```

---

# ═══════════════════════════════════════════
# PHASE 3 — Backend API (FastAPI)
# Paste this after MASTER CONTEXT
# ═══════════════════════════════════════════

```
## PHASE 3 GOAL
Implement all FastAPI routers. Business logic in services/. Routers only handle HTTP.
No AI runs here. Vector comparison uses pgvector SQL operator.

---

### 3A. RBAC Dependency (core/dependencies.py)

get_current_user(token) → User:
  - Decode JWT from Authorization: Bearer <token>
  - Fetch user from DB by id in token
  - Raise 401 if expired or invalid

role_required(*roles):
  - Decorator/dependency that checks current_user.role
  - Raises 403 HTTP if role not in allowed roles
  - Usage: Depends(role_required("teacher", "admin"))

---

### 3B. Rate Limiting (main.py)
from slowapi import Limiter
from slowapi.util import get_remote_address
limiter = Limiter(key_func=get_remote_address)
Apply @limiter.limit("10/minute") to all /api/auth/* routes

---

### 3C. All API Endpoints

#### AUTH ROUTER (/api/auth)

POST /api/auth/register/student
Body (multipart or JSON):
  email: str, password: str, name: str, register_number: str,
  department: str, section: str, counsellor_id: UUID | None,
  face_embedding: list[float]  ← 512 floats from sidecar
Validations:
  - len(face_embedding) must == 512, else 422
  - email format validated by Pydantic EmailStr
  - password min length 8
  - duplicate email → 409 "Email already registered"
  - duplicate register_number → 409 "Register number already exists"
Action: hash password, insert users row, insert students row with embedding
Returns: { success: true, data: { user_id, student_id } }

POST /api/auth/register/teacher
Body: email, password, name, department, position
Returns: { success: true, data: { user_id, teacher_id } }

POST /api/auth/register/admin  [admin role required — first admin seeded manually]
Body: email, password, name
Returns: { success: true, data: { user_id, admin_id } }

POST /api/auth/login
Body: { email: str, password: str }
Action: verify password with bcrypt
Returns: { success: true, data: { access_token, refresh_token, role, user_id } }
Errors: 404 "User not found. Please register.", 401 "Incorrect password."

POST /api/auth/refresh
Header: Authorization: Bearer <refresh_token>
Returns: { success: true, data: { access_token } }

---

#### STUDENTS ROUTER (/api/students)

GET /api/students/me  [role: student]
Returns: full student profile + counsellor name

PUT /api/students/me  [role: student]
Body (all optional): name, password, counsellor_id, face_embedding: list[float]
- If face_embedding provided, validate len==512, update vector in DB
Returns: updated student profile

GET /api/students/all  [role: teacher, admin]
Returns: all students (for admin); for teacher: only counsellor_id = current teacher

---

#### ATTENDANCE ROUTER (/api/attendance)

POST /api/attendance/verify  [role: student]
Body: { face_embedding: list[float], date: str (YYYY-MM-DD) }
Server-side logic:
  1. Check if date is a holiday (SELECT from holidays WHERE date = $date)
     → If yes: return 400 "This day is marked as a holiday."
  2. Check if date is Sunday → 400 "Sundays are holidays."
  3. Fetch time_slot WHERE date = $date
     → If no slot: return 400 "No attendance slot configured for today."
  4. Check current server time is between slot.start_time and slot.end_time
     → If outside window: return 400 "Attendance window is 8:30 AM – 10:00 AM."
  5. Check for existing attendance: SELECT from attendance_logs WHERE
     student_id=$id AND slot_id=$slot_id AND date=$date AND status='present'
     → If present: return 409 "Attendance already marked for this slot."
  6. Fetch student's face_embedding from DB
  7. Compute cosine similarity using pgvector operator:
     SELECT 1 - (face_embedding <=> $received_embedding::vector) AS similarity
     FROM students WHERE id = $student_id
  8. If similarity >= 0.45 → INSERT attendance (status='present', marked_by='system',
     face_match_score=similarity, marked_at=now())
  9. If similarity < 0.45 → return 401 "Face verification failed. Please retake."
Returns on success: { success: true, data: { attendance_id, marked_at, similarity } }

GET /api/attendance/status  [role: student]
Query: ?date=YYYY-MM-DD
Returns: { slot, status, marked_at } for that student's date

GET /api/attendance/history  [role: student]
Query: ?month=YYYY-MM
Returns: list of { date, status, slot_name } for the month

PUT /api/attendance/override  [role: teacher, admin]
Body: { student_id: UUID, slot_id: UUID, date: str, status: "present"|"absent" }
Validation: teacher can only update students where counsellor_id = current_teacher.id
Admin can update any student.
Upsert: INSERT ... ON CONFLICT (student_id, slot_id, date) DO UPDATE SET
  status=$status, marked_by='teacher', marked_at=now()
Returns: { success: true, data: { attendance_id } }

---

#### TIME SLOTS ROUTER (/api/timeslots)

GET /api/timeslots  [role: any authenticated]
Returns: all time slots

GET /api/timeslots/today  [role: any authenticated]
Returns: today's slot or null

POST /api/timeslots/generate  [role: admin]
Body: { date?: str }  ← defaults to today
Logic:
  - If date is Sunday → return 400
  - If date in holidays table → return 400
  - If slot already exists for date → return 409
  - INSERT time_slots (date, slot_name="Morning Attendance", start_time=08:30, end_time=10:00)
Returns: created slot

STARTUP TASK: On FastAPI startup event, run auto-slot generation for today:
  @app.on_event("startup")
  async def auto_generate_today_slot():
      today = date.today()
      if today.weekday() == 6:  # Sunday
          return
      # Check holiday
      holiday = await db.execute(select(Holiday).where(Holiday.date == today))
      if holiday.scalar():
          return
      # Insert slot if not exists
      existing = await db.execute(select(TimeSlot).where(TimeSlot.date == today))
      if not existing.scalar():
          db.add(TimeSlot(date=today))
          await db.commit()

---

#### HOLIDAYS ROUTER (/api/holidays)

GET /api/holidays  [role: any authenticated]
Returns: all holidays as [{ id, date, reason }]

POST /api/holidays  [role: teacher, admin]
Body: { date: str, reason?: str }
Validation: date cannot be in the past (admin override allowed)
Returns: created holiday

DELETE /api/holidays/{date}  [role: teacher, admin]
Removes the holiday marking for that date
Returns: { success: true }

---

#### TEACHERS ROUTER (/api/teachers)

GET /api/teachers  [role: student, teacher, admin]
Returns: [{ id, name, department }] ← for counsellor dropdown in registration

GET /api/teachers/my-students  [role: teacher]
Returns: all students WHERE counsellor_id = current_teacher.id,
         with today's attendance status per student

---

#### ADMIN ROUTER (/api/admin)

GET /api/admin/stats  [role: admin]
Returns: { total_students, total_teachers, today_present, today_absent, holidays_this_month }

GET /api/admin/all-students  [role: admin]
Returns: all students with today's attendance status

GET /api/admin/all-teachers  [role: admin]
Returns: all teachers with their student count

PUT /api/admin/ssid-config  [role: admin]
Body: { allowed_ssids: list[str] }
Stores in a config table (create app_config table: key, value, updated_at)
Returns: updated config

---

### 3D. Error Handlers (register in main.py)
- RequestValidationError → 422 with field-level messages
- HTTPException → pass through with correct status
- IntegrityError (psycopg) → 409 "Duplicate entry detected"
- Exception → 500 "Internal server error" (log full traceback, never expose to client)

---

### 3E. CORS (main.py)
Allow only Tauri origins:
origins = ["tauri://localhost", "https://tauri.localhost", "http://tauri.localhost"]
DO NOT use allow_origins=["*"] in production.

---

### PHASE 3 ACCEPTANCE CRITERIA
□ GET /docs shows all endpoints with correct schemas
□ POST /api/auth/login returns JWT with role field
□ POST /api/attendance/verify rejects duplicate with 409
□ POST /api/attendance/verify rejects holiday date with 400
□ Teacher cannot override a student who is not their counsellee (403)
□ All endpoints return { success, data, error } envelope
□ Rate limiter blocks > 10 req/min on auth routes (test with curl loop)
□ Startup event creates today's time slot if not holiday/Sunday
```

---

# ═══════════════════════════════════════════
# PHASE 4 — Frontend: Auth Pages (Login + Registration)
# Paste this after MASTER CONTEXT
# ═══════════════════════════════════════════

```
## PHASE 4 GOAL
Build Login, Role Select, Student Registration, and Teacher Registration pages.
Apply the full design system. Use React Hook Form + Zod for all forms.

---

### 4A. Axios Client (src/api/client.ts)

const api = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 10000,
});

Request interceptor:
  - Attach Authorization: Bearer <access_token> from Zustand store

Response interceptor (401 handling):
  - On 401: call POST /api/auth/refresh with refresh_token
  - If refresh succeeds: update access_token in store, retry original request
  - If refresh fails: clear store, navigate to /login

---

### 4B. Zustand Auth Store (src/store/authStore.ts)

State:
  - user: { id, email, role, name } | null
  - access_token: string | null
  - refresh_token: string | null

Actions:
  - setAuth(user, access_token, refresh_token)
  - clearAuth()  ← called on logout or token expiry

Persist to Tauri Store plugin (tauri-plugin-store) for session persistence:
  import { Store } from "@tauri-apps/plugin-store"
  const store = new Store("auth.dat")
  On setAuth: await store.set("auth", { user, access_token, refresh_token })
  On clearAuth: await store.delete("auth")
  On app init: load from store if present

---

### 4C. Login Page (src/pages/Login.tsx)

Layout: Full viewport, centered vertically and horizontally
Card: max-w-[420px], rounded-3xl, shadow-xl, p-10, bg-white

Top section:
  - App icon/logo (a simple geometric brain or spark SVG in primary color)
  - "Norm AI" in 32px bold, gradient text from #5B5FEF to #7B7DFF
  - Subtitle: "Smart Attendance for RMKEC" in text-2 color, 14px

Form fields (React Hook Form + Zod):
  - Email input: type="email", placeholder="you@rmkec.ac.in"
    Validation: z.string().email("Please enter a valid email address")
  - Password input: type="password" (toggle show/hide with eye icon)
    Validation: z.string().min(8, "Password must be at least 8 characters")

  Error display: Red text below each input field on invalid

Login button:
  - Full width, bg-gradient-to-r from-[#5B5FEF] to-[#7B7DFF], text-white
  - Loading spinner when submitting
  - Text: "Sign In"

API error display (shown below button):
  - Red bordered box with message from API
  - "User not found. Please register." for 404
  - "Incorrect password." for 401

Bottom link:
  - "New to Norm AI? Register →" → navigates to /register
  - Centered, text-primary color, hover underline

On success:
  - role === 'student' → navigate('/dashboard/student')
  - role === 'teacher' → navigate('/dashboard/teacher')
  - role === 'admin'   → navigate('/dashboard/admin')

---

### 4D. Role Select Page (src/pages/Register.tsx)

Two large cards side by side (flex-row, gap-6):

Student card:
  - Icon: graduation cap SVG (outlined, primary color)
  - Title: "I'm a Student"
  - Subtitle: "Mark your attendance"
  - On click → navigate('/register/student')

Teacher card:
  - Icon: chalkboard/person SVG (outlined, primary color)
  - Title: "I'm a Teacher"
  - Subtitle: "Manage your class"
  - On click → navigate('/register/teacher')

Each card: hover → scale-[1.03] transform, shadow-lg, border-2 border-transparent
            hover:border-[#5B5FEF] transition-all duration-200

Top: Back arrow to /login

---

### 4E. Student Registration Page (src/pages/RegisterStudent.tsx)

Two-column layout inside a max-w-[860px] card:
Left column: Form fields
Right column: Photo capture section

Form fields (all required, marked with asterisk in label):
  - Full Name*
  - Register Number* (uppercase transform)
  - Department* (dropdown: CSE, ECE, EEE, MECH, CIVIL, IT, AIDS, AIML)
  - Section* (dropdown: A, B, C, D)
  - Counsellor* (dropdown fetched from GET /api/teachers, shows "Name — Department")
  - Email* (EmailStr validation)
  - Password* (min 8 chars, show strength indicator)
  - Confirm Password* (must match password)

Photo Capture section:
  State machine with 3 states: IDLE | CAPTURING | REVIEW

  IDLE state:
    - Camera icon illustration
    - "Capture Your Face" heading
    - "Your photo will be used for attendance verification" subtitle
    - "Open Camera" button (primary)

  CAPTURING state (opens camera):
    - Live video feed using Tauri v2 camera API or browser getUserMedia
    - Face guide overlay: a rounded rectangle outline centered on frame
    - "Capture Photo" button
    - "Cancel" button

  REVIEW state (after capture):
    - Shows captured photo
    - "Retake" button (secondary)
    - "Accept" button (primary) → triggers AI processing

  PROCESSING state (after Accept):
    - Spinner: "Extracting face data..."
    - Call POST http://127.0.0.1:8765/analyze with base64 image
    - If error from sidecar (no face, multiple faces):
      → show error message, go back to CAPTURING state
    - If is_live = false:
      → show "Liveness check failed. Please capture in good lighting."
      → go back to CAPTURING state
    - If success:
      → store embedding in component state
      → show green checkmark: "Face captured successfully ✓"
      → DONE state

  DONE state:
    - Green success indicator
    - "Retake" option still available

Submit button:
  - Disabled until all fields valid AND face captured
  - On submit: POST /api/auth/register/student with all form data + embedding
  - On success: show SuccessModal (see below)
  - On error: show field-level or general error

Close button (top-right X):
  - Confirm dialog: "Cancel registration? Your progress will be lost."
  - On confirm: navigate('/login')

SuccessModal:
  - Lottie/CSS animated green checkmark (draw-circle animation)
  - "Registration Completed!" heading
  - "You can now sign in with your credentials." subtext
  - Auto-redirect to /login after 3 seconds with countdown

---

### 4F. Teacher Registration Page (src/pages/RegisterTeacher.tsx)

Simpler single-column layout inside max-w-[480px] card:
  - Full Name*
  - Department* (same dropdown as student)
  - Position* (e.g., Associate Professor, Professor, HOD)
  - Email*
  - Password*
  - Confirm Password*

No photo capture for teachers.
Same SuccessModal and Close button behavior as student registration.

---

### 4G. Form Validation Rules (Zod schemas)
- email: z.string().email()
- password: z.string().min(8).max(128)
- confirmPassword: must match password (z.superRefine or .refine)
- register_number: z.string().min(5).max(20).toUpperCase()
- name: z.string().min(2).max(255).trim()
- department/section/counsellor: z.string().min(1, "Please select an option")

Show errors inline below each field. Never show all errors at top of form.

---

### PHASE 4 ACCEPTANCE CRITERIA
□ Login form shows inline error for invalid email format before submission
□ Login navigates to correct dashboard based on returned role
□ "User not found" API error displayed in login page (not a toast)
□ Student registration blocks submit if no face captured
□ AI sidecar error (no face detected) shown in camera section, not a page crash
□ Successful registration triggers animated checkmark modal
□ Close button shows confirmation dialog, then redirects to /login
□ All required fields marked with red asterisk in label
□ Password strength indicator visible on student/teacher register
```

---

# ═══════════════════════════════════════════
# PHASE 5 — Student Dashboard
# Paste this after MASTER CONTEXT
# ═══════════════════════════════════════════

```
## PHASE 5 GOAL
Build the full Student Dashboard — layout, attendance flow, profile management.

---

### 5A. Dashboard Layout (src/components/layout/Layout.tsx)

Structure:
  [Fixed Left Sidebar 240px] [Main Content Area flex-1]
  [Top Header across main content area]

Sidebar:
  - Logo: "Norm AI" with icon at top (py-6, px-4)
  - Navigation items (with Lucide React icons):
    • Dashboard (LayoutDashboard icon)
    • Attendance History (CalendarDays icon)
    • Profile (UserCircle icon)
  - Active item: bg-gradient-to-r from-[#5B5FEF] to-[#7B7DFF] text-white rounded-xl
  - Inactive: text-[#64748B] hover:bg-[#F1F5F9] rounded-xl
  - Bottom: Logout button (LogOut icon, red on hover)

Top Header (sticky, bg-white/80 backdrop-blur border-b):
  - Left: Greeting ("Good morning, Madesh 👋") + "2nd Year CSE — Section A"
  - Right: Date badge, notification bell, avatar (initials fallback)

---

### 5B. Geofence + Attendance Zone (main card, Zone 1)

Card at top of dashboard. Two states:

ON CAMPUS state (SSID matches ALLOWED_SSIDS):
  - Green dot indicator: "Connected to RMKEC ✓"
  - WiFi icon + SSID name displayed
  - Current slot info: "Morning Attendance • 8:30 AM – 10:00 AM"
  - If within time window: "Mark Attendance" button (primary, full width of card)
  - If outside window: "Attendance window opens at 8:30 AM" (muted, button disabled)

OFF CAMPUS state:
  - Orange dot indicator: "Not on campus network"
  - Message: "Please connect to RMKEC or RMKEC2G WiFi to mark attendance"
  - Button disabled with tooltip

useGeofence hook (src/hooks/useGeofence.ts):
  - Calls Tauri command get_wifi_ssid every 30 seconds
  - Returns: { ssid: string | null, isOnCampus: boolean, lastChecked: Date }
  - ALLOWED_SSIDS imported from src/constants/geofence.ts:
    export const ALLOWED_SSIDS = ["RMKEC", "RMKEC2G"]  ← easy to change here

---

### 5C. Tauri v2 WiFi SSID Command (src-tauri/src/commands/wifi.rs)

#[tauri::command]
pub async fn get_wifi_ssid() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let output = std::process::Command::new("netsh")
            .args(&["wlan", "show", "interfaces"])
            .output()
            .map_err(|e| e.to_string())?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            if line.trim().starts_with("SSID") && !line.contains("BSSID") {
                if let Some(ssid) = line.split(':').nth(1) {
                    return Ok(ssid.trim().to_string());
                }
            }
        }
    }
    #[cfg(target_os = "macos")]
    {
        let output = std::process::Command::new("/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport")
            .arg("-I")
            .output()
            .map_err(|e| e.to_string())?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            if line.trim().starts_with("SSID:") {
                if let Some(ssid) = line.split(':').nth(1) {
                    return Ok(ssid.trim().to_string());
                }
            }
        }
    }
    #[cfg(target_os = "linux")]
    {
        let output = std::process::Command::new("nmcli")
            .args(&["-t", "-f", "active,ssid", "dev", "wifi"])
            .output()
            .map_err(|e| e.to_string())?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            if line.starts_with("yes:") {
                return Ok(line[4..].to_string());
            }
        }
    }
    Err("No WiFi connection detected".to_string())
}

Register in lib.rs: .invoke_handler(tauri::generate_handler![get_wifi_ssid])

---

### 5D. Camera + Attendance Modal (src/components/attendance/CameraModal.tsx)

Triggered when "Mark Attendance" is clicked. Full-screen modal overlay.

State machine: INIT → LIVENESS_CHECK → PROCESSING → SUCCESS | ERROR

INIT state:
  - Camera feed (getUserMedia, front camera preferred)
  - Oval face guide overlay on video
  - Text: "Position your face within the oval"
  - Auto-capture after liveness confirmed, OR manual "Capture" button
  - Close (X) button → confirm → closes modal

LIVENESS_CHECK (during live preview):
  - Capture frame every 2 seconds, send to sidecar /analyze
  - Show liveness indicator bar (0–100% animated)
  - If liveness_score > 0.85: auto-capture and move to PROCESSING
  - Show: "Hold still... ✓ Liveness confirmed!" feedback

PROCESSING state:
  - Spinner: "Verifying your identity..."
  - Show captured photo thumbnail
  - API call: POST /api/attendance/verify with embedding

SUCCESS state:
  - Large animated green checkmark
  - "Attendance Marked! ✓"
  - Timestamp: "Marked at 9:14 AM, 15 Jan 2025"
  - "Done" button closes modal

ERROR state:
  - Red X icon
  - Error message from API (e.g., "Face verification failed", "Already marked")
  - "Try Again" button → go back to INIT state
  - "Cancel" button → close modal

Always: Close (X) button top-right, any state.
         Shows confirm dialog if in PROCESSING state.

---

### 5E. Today's Attendance Summary Card (Zone 2)

Below the geofence card:
  - Card showing today's slot: "Morning Attendance • 8:30 – 10:00 AM"
  - Status badge: "Present" (green) | "Absent" (red) | "Pending" (gray)
  - Marked at timestamp if present
  - If holiday: "🎉 Today is a Holiday" with holiday reason

---

### 5F. Attendance History Page

Route: /dashboard/student/history
Month selector (prev/next arrows, current month default)
Calendar grid (7 cols):
  - Present days: green background dot
  - Absent days: red background dot
  - Holidays: yellow background
  - Sundays: gray background
  - Today: primary color outline

Below calendar: Attendance % for the month
  - Circle chart (CSS or recharts): "87% this month"

---

### 5G. Profile Section (slide-in panel from right)

Triggered by avatar click or "Profile" sidebar link.

Sections:
1. Basic Info (editable):
   - Name, Email (readonly), Register Number (readonly)
   - Department, Section, Counsellor (dropdown)
   - Password change: current_password + new_password + confirm

2. Profile Photo Update:
   - Current face photo thumbnail (or placeholder)
   - "Update Photo" button → triggers same camera flow as registration
   - New embedding extracted and sent via PUT /api/students/me
   - On success: toast "Profile photo updated ✓"

3. Academic Info (readonly):
   - Year of study, Counsellor name

Save button: PUT /api/students/me with changed fields only
On success: toast notification "Profile updated ✓"

---

### PHASE 5 ACCEPTANCE CRITERIA
□ Geofence status updates every 30 seconds without page reload
□ Mark Attendance button disabled when off-campus SSID
□ Liveness indicator animates during camera check
□ Attendance modal progresses through all states correctly
□ Duplicate attendance attempt shows "Attendance already marked" error
□ Holiday day shows holiday message instead of attendance button
□ Outside time window shows countdown or "window opens at 8:30 AM"
□ Attendance history calendar shows correct colored dots
□ Profile photo update triggers new AI embedding extraction
```

---

# ═══════════════════════════════════════════
# PHASE 6 — Teacher Dashboard
# Paste this after MASTER CONTEXT
# ═══════════════════════════════════════════

```
## PHASE 6 GOAL
Build the Teacher Dashboard with student attendance management and holiday calendar.

---

### 6A. Teacher Dashboard Layout
Same sidebar/header pattern as student dashboard.

Sidebar items:
  - Dashboard (LayoutDashboard)
  - My Students (Users)
  - Holiday Calendar (CalendarDays)
  - Profile (UserCircle)

Header greeting: "Good morning, [Teacher Name] • [Department] — [Position]"

---

### 6B. My Students Section

GET /api/teachers/my-students on mount.

Table component with:
  Columns: # | Name | Register No. | Dept | Section | Today's Status | Actions

Status badge:
  - "Present" → green badge
  - "Absent" → red badge
  - "Holiday" → yellow badge
  - "No Slot" → gray badge

Actions column per row (two buttons):
  - "Mark Present" button (green outlined, small):
    → PUT /api/attendance/override { student_id, slot_id, date: today, status: 'present' }
    → Optimistic UI update: immediately update badge to Present
    → Revert if API fails with toast error
  - "Mark Absent" button (red outlined, small):
    → Same flow with status: 'absent'

Search/filter bar above table:
  - Search by name or register number
  - Filter by section (dropdown)
  - Filter by status (Present / Absent / All)

Bulk actions bar (appears when rows selected via checkboxes):
  - "Mark all selected as Present"
  - "Mark all selected as Absent"
  → Calls PUT /api/attendance/override for each in sequence
  → Progress toast: "Updated 5 of 12 students..."

---

### 6C. Holiday Calendar Section

Route: /dashboard/teacher/holidays

Full month calendar (custom CSS grid, 7 columns):
  Header row: Sun | Mon | Tue | Wed | Thu | Fri | Sat
  Month navigation: left/right arrows, "July 2025" title

Date cell appearance:
  - Sunday: bg-[#FEE2E2] text-[#EF4444] (always red, non-clickable)
  - Holiday: bg-[#FEE2E2] border-2 border-[#EF4444]
             Shows reason as tooltip on hover
  - Today: border-2 border-[#5B5FEF]
  - Normal: bg-white hover:bg-[#F1F5F9] cursor-pointer

On click (non-Sunday date):
  Modal appears with:
    - Date displayed prominently
    - If NOT holiday:
      • "Mark as Holiday" button (red)
      • Optional reason input: placeholder "e.g., Republic Day"
      → POST /api/holidays { date, reason }
      → Close modal, update calendar cell to red
    - If IS holiday:
      • Holiday reason shown
      • "Remove Holiday" button (outlined red)
      → DELETE /api/holidays/{date}
      → Close modal, remove red background
    - Close (X) button top-right

GET /api/holidays on mount to highlight existing holidays.
Cache holiday dates in component state, update on add/remove.

---

### 6D. Teacher Profile Section
Same slide-in panel pattern as student.
Editable: Name, Department, Position, Password
No photo capture for teachers.

---

### PHASE 6 ACCEPTANCE CRITERIA
□ Teacher only sees their own counsellee students (not all students)
□ Mark Present/Absent updates status badge immediately (optimistic UI)
□ API failure reverts optimistic update with error toast
□ All Sundays are red and non-clickable in the calendar
□ Marked holidays show red background with reason on hover
□ Adding a holiday for today disables student attendance for that day
□ Holiday modal closes on X click without saving
□ Month navigation shows correct calendar for prev/next months
```

---

# ═══════════════════════════════════════════
# PHASE 7 — Admin Dashboard
# Paste this after MASTER CONTEXT
# ═══════════════════════════════════════════

```
## PHASE 7 GOAL
Build the Admin Dashboard for system-wide management.

---

### 7A. Admin Sidebar Items
  - Overview (BarChart3)
  - All Students (Users)
  - All Teachers (GraduationCap)
  - Holidays (CalendarX)
  - Settings (Settings)
  - Profile (UserCircle)

---

### 7B. Overview Page (Stats Cards)

GET /api/admin/stats on mount.

4 stat cards in a row:
  - Total Students (Users icon, primary color)
  - Total Teachers (GraduationCap icon, purple)
  - Present Today (CheckCircle icon, green)
  - Absent Today (XCircle icon, red)

Below: Recent Attendance Activity table
  Last 20 attendance records: Time | Student Name | Reg No | Status | Method (AI/Teacher)

---

### 7C. All Students Page
  Full table, same as teacher's students table but for ALL students.
  Teacher can only override their own counsellees; admin can override any.
  Extra column: Counsellor Name
  Export button: download as CSV (client-side, using Papa.unparse or similar)

---

### 7D. All Teachers Page
  Table: Name | Department | Position | Student Count | Actions
  Actions: View Students button → filtered student view for that teacher

---

### 7E. Settings Page

Section 1 — Geofence SSID Configuration:
  - Input list: SSID 1, SSID 2 (add/remove dynamically)
  - Default: ["RMKEC", "RMKEC2G"]
  - Save → PUT /api/admin/ssid-config
  - Note: "Changes take effect on next app restart"

Section 2 — Attendance Window:
  - Start time picker (default 08:30)
  - End time picker (default 10:00)
  - Save → PUT /api/admin/slot-config
  - Note: "Affects future auto-generated slots only"

Section 3 — Register New Admin:
  - Name, Email, Password form
  - POST /api/auth/register/admin

---

### PHASE 7 ACCEPTANCE CRITERIA
□ Admin can see all students and teachers
□ Admin can override attendance for any student
□ Admin can add/remove teachers from system
□ Stats cards show correct live counts
□ Settings page saves SSID config and reflects in geofence hook
□ New admin registration works
```

---

# ═══════════════════════════════════════════
# PHASE 8 — Integration, Error Handling & UX Polish
# Paste this after MASTER CONTEXT
# ═══════════════════════════════════════════

```
## PHASE 8 GOAL
Wire everything together, add production error handling, and polish UX.

---

### 8A. Global Toast System
Use a lightweight toast (react-hot-toast or custom):
  - Success: green background, checkmark icon, 3s auto-dismiss
  - Error: red background, X icon, 5s auto-dismiss with manual close
  - Info: primary color, 3s auto-dismiss
  - Loading: spinner, stays until dismissed programmatically

Usage pattern: call toast.success("Attendance marked!") after successful API calls.

---

### 8B. Loading States
Every API call must have a loading state. No naked await without UI feedback.
Use a global LoadingSpinner component.
Skeleton loaders (gray animated bars) for:
  - Student table in teacher dashboard
  - Attendance history calendar
  - Stats cards in admin

---

### 8C. Sidecar Health Check on App Startup
In App.tsx or main layout:
  - Poll GET http://127.0.0.1:8765/health every 2 seconds
  - Show "AI System Loading..." overlay until /health returns { status: "ready" }
  - Timeout after 30 seconds: show error "AI pipeline failed to start. Please restart the app."
  - Do NOT let user proceed to attendance flow until sidecar is ready

---

### 8D. Network Error Handling
In Axios client:
  - timeout: 10000 (10s) for all API requests
  - timeout: 30000 (30s) for AI sidecar requests
  - On network error: toast "Connection failed. Please check your network."
  - Retry: 3 attempts with exponential backoff (1s, 2s, 4s) for GET requests only
  - Never retry POST /api/attendance/verify (idempotency concern)

---

### 8E. React Error Boundary (src/components/ErrorBoundary.tsx)
Wrap entire app. On unhandled render error:
  - Show centered error card: "Something went wrong"
  - "Restart App" button (calls Tauri relaunch())
  - Log error to console (in dev) or Tauri log plugin (in production)

---

### 8F. Camera Cleanup
In CameraModal:
  - On component unmount: stop all camera tracks
    stream.getTracks().forEach(track => track.stop())
  - Wrap in useEffect cleanup function
  - Memory leak in camera stream = app crash for end users

---

### 8G. JWT Expiry UX
When access_token expires during a session:
  - Auto-refresh silently using interceptor
  - User never sees a logout
  - If refresh_token also expired: show toast "Session expired, please sign in again"
  - Navigate to /login

---

### 8H. Final UX Polish Checklist
□ All buttons have disabled state styling (opacity-50 cursor-not-allowed)
□ All inputs have focus-visible ring (keyboard accessibility)
□ All modals trap focus (no Tab escape) and close on Escape key
□ Camera modal shows "Please allow camera access" for permission denied
□ Empty states: "No students assigned to you yet" (teacher dashboard)
□ All date displays use consistent format: "15 Jan 2025, 9:14 AM"
□ Transitions: 200ms ease-in-out on all hover/active state changes
□ Page transitions: fade-in 150ms on route change
□ Confirm dialogs before destructive actions (remove holiday, logout)
□ Form fields preserve input on validation error (no full reset)

---

### PHASE 8 ACCEPTANCE CRITERIA
□ App shows "AI System Loading..." on startup until sidecar ready
□ Toast appears for every user action (success/error/info)
□ Camera stream properly stopped on modal close (check browser Task Manager)
□ Token expired → auto-refresh → user stays logged in seamlessly
□ All modals close on Escape key
□ Network disconnect shows toast, not a white crash screen
```

---

# ═══════════════════════════════════════════
# PHASE 9 — Production Hardening
# Paste this after MASTER CONTEXT
# ═══════════════════════════════════════════

```
## PHASE 9 GOAL
Make the application production-ready for deployment at RMKEC.

---

### 9A. Security Hardening

Backend:
□ All SQL via SQLAlchemy ORM only. Zero raw string SQL concatenation.
□ Face embeddings: never logged, never returned in API responses after registration
□ Passwords: bcrypt, never logged, never in API responses
□ JWT secret: minimum 64 chars, read from env, validated on startup
□ CORS: allow only Tauri origins (already done in Phase 3)
□ Rate limiting on auth routes (already done)
□ Validate Content-Type header on all POST endpoints
□ face_embedding validation: exactly 512 floats, each -10.0 to 10.0 range

Frontend / Tauri:
□ No API keys in frontend source code
□ Tauri CSP (Content Security Policy) in tauri.conf.json:
  "security": {
    "csp": "default-src 'self'; connect-src 'self' http://localhost:8000 http://127.0.0.1:8765"
  }
□ Tauri allowlist: enable only required APIs (shell for sidecar, http, notification)

---

### 9B. Database Indexes (add to Alembic migration)
CREATE INDEX idx_attendance_student_date ON attendance_logs(student_id, date);
CREATE INDEX idx_attendance_slot_date ON attendance_logs(slot_id, date);
CREATE INDEX idx_timeslots_date ON time_slots(date);
CREATE INDEX idx_holidays_date ON holidays(date);
CREATE INDEX idx_students_counsellor ON students(counsellor_id);

---

### 9C. Backend Performance
□ Use connection pooling: pool_size=10, max_overflow=20 in SQLAlchemy engine
□ pgvector cosine similarity query uses index:
  CREATE INDEX ON students USING ivfflat (face_embedding vector_cosine_ops) WITH (lists=100);
  (Run after inserting first 100+ students)
□ Background task for slot auto-generation (don't block request thread)
□ Alembic migration for production: run before deployment

---

### 9D. .env.example (commit this, never .env)
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/normai_db
SECRET_KEY=REPLACE_WITH_64_CHAR_RANDOM_STRING
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

---

### 9E. README Files

norm-ai-backend/README.md must include:
1. Prerequisites (Python 3.11, PostgreSQL 15, pgvector)
2. Setup: clone → pip install -r requirements.txt → copy .env → alembic upgrade head
3. Run: uvicorn app.main:app --reload
4. First admin setup: seed script or manual DB insert
5. API docs: http://localhost:8000/docs

norm-ai-frontend/README.md must include:
1. Prerequisites (Node 20, Rust, Tauri v2 prerequisites)
2. Setup: npm install → set backend URL in config
3. Sidecar setup: pip install -r sidecar/requirements-sidecar.txt → download models
4. Dev: npm run tauri dev
5. Build: npm run tauri build (creates installer for current OS)

---

### 9F. Tauri Build Config (tauri.conf.json)
{
  "productName": "Norm AI",
  "version": "1.0.0",
  "identifier": "ac.in.rmkec.normai",
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": ["icons/icon.png"],
    "externalBin": ["sidecar/ai_pipeline"]
  },
  "app": {
    "windows": [{
      "title": "Norm AI — Smart Attendance",
      "width": 1280,
      "height": 800,
      "minWidth": 1024,
      "minHeight": 700,
      "resizable": true,
      "fullscreen": false
    }]
  }
}

---

### FINAL PRODUCTION CHECKLIST
□ npm run tauri build produces installer without errors
□ Installed app starts sidecar automatically
□ All 3 user roles work end-to-end (register → login → dashboard → action)
□ Attendance marked via AI flow stores correct embedding match score
□ Teacher can override late-comer attendance after window closes
□ Holiday marking prevents attendance that day (both AI and manual)
□ Sunday auto-block works (no slot generated)
□ No console.error or unhandled promise rejections in production build
□ App tested on Windows 11 (primary target for RMKEC lab PCs)
□ Sidecar binary included in built installer
□ Database migrations run cleanly from scratch
```

---

# ═══════════════════════════════════════════
# QUICK REFERENCE — Frequently Needed Details
# Keep this tab open in Antigravity
# ═══════════════════════════════════════════

## WiFi SSID Constants
```typescript
// src/constants/geofence.ts — change SSIDs here
export const ALLOWED_SSIDS = ["RMKEC", "RMKEC2G"];
```

## Attendance Window
```
Start: 08:30 AM | End: 10:00 AM
Auto-generated daily (skip Sundays + holidays)
Teachers can override after window closes (late comers)
```

## Face Match Threshold
```
Cosine similarity >= 0.45 → attendance marked as present
Liveness threshold > 0.85 (fused MiniFAS score)
```

## Model Config
```
InsightFace: buffalo_m (medium, CPU-optimized)
Anti-spoofing: MiniFAS 1M
Scale: 1.0x (texture) + 2.7x (context), averaged
Embedding: 512-dimensional float32
ctx_id: -1 (forces CPU)
```

## Roles
```
student  → /dashboard/student
teacher  → /dashboard/teacher
admin    → /dashboard/admin
```

## Port Map
```
FastAPI backend:   http://localhost:8000
AI sidecar:        http://127.0.0.1:8765  (local only)
PostgreSQL:        localhost:5432
```

## Response Envelope (every API response)
```json
{ "success": true,  "data": { ... }, "error": null }
{ "success": false, "data": null,    "error": "Human readable message" }
```
