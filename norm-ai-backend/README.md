# Norm AI — Smart Attendance System (Backend API)

REST API backend for the Norm AI Smart Attendance System. Built using FastAPI, PostgreSQL, pgvector, and SQLAlchemy ORM.

## Prerequisites

- **Python**: version 3.11.x (Python 3.12/3.13 are also supported)
- **PostgreSQL**: version 15+
- **pgvector Extension**: Installed and enabled on your PostgreSQL server

## Setup & Installation

1. **Clone the repository** and navigate to the backend directory:
   ```bash
   cd norm-ai-backend
   ```

2. **Create and activate a virtual environment**:
   ```bash
   python -m venv .venv
   # On Windows:
   .venv\Scripts\activate
   # On macOS/Linux:
   source .venv/bin/activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Setup environment configuration**:
   - Copy `.env.example` to `.env`:
     ```bash
     copy .env.example .env
     ```
   - Generate a secure 64-character minimum HMAC secret key for JWT signatures (e.g. using `openssl rand -hex 32` or python's `secrets.token_hex(32)`) and populate `SECRET_KEY` in `.env`.
   - Update `DATABASE_URL` with your PostgreSQL credentials.

5. **Run database migrations**:
   - Run the database migration script to construct the schema and indexes:
     ```bash
     alembic upgrade head
     ```

## Run the Application

Start the local FastAPI development server:
```bash
uvicorn app.main:app --reload
```
The REST API server will run at: `http://localhost:8000`

## Initial Admin Setup

An administrator user must be seeded in the database before first use.
1. Run the seed script:
   ```bash
   python app/seed_admin.py
   # Or run via python command:
   # python -m app.seed_admin
   ```
2. This creates the default administrator login:
   - **Email**: `admin@rmkec.ac.in`
   - **Password**: `AdminPassword123!`

## API Documentation

FastAPI automatically generates interactive OpenAPI Swagger documentation.
- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc UI**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
