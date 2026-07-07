"""
ai_pipeline.py — Norm AI Local AI Sidecar Server
=================================================
Runs as a Tauri sidecar process on 127.0.0.1:8765.
Only accessible from the Tauri webview — never exposed to the network.

Pipeline per /analyze request:
  1. Decode base64 JPEG → OpenCV BGR frame
  2. Run InsightFace buffalo_l — detect faces + extract 512-dim embedding
  3. If 1 face found → run MiniFAS 1M anti-spoofing at 2 scales (1.0x, 2.7x)
  4. Fuse liveness scores → threshold > 0.85
  5. If live → return L2-normalized 512-dim embedding + metadata

CRITICAL RULES (never violate):
  - CPU-only inference. CUDA provider MUST NOT be present.
  - Liveness threshold: fused_score > 0.85 (multi-scale MiniFAS fusion)
  - Exactly 1 face must be visible — reject 0 or 2+ faces
  - Face embedding is always L2-normalized before returning
"""

from __future__ import annotations

import base64
import io
import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image
from pydantic import BaseModel

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="[AI-SIDECAR] %(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
    stream=sys.stderr,
)
logger = logging.getLogger("normai.sidecar")

# ── Paths ─────────────────────────────────────────────────────────────────────
# When frozen by PyInstaller, __file__ is inside the bundle.
# sys._MEIPASS is the temp extraction dir for --onefile builds.
if getattr(sys, "frozen", False):
    BASE_DIR = Path(sys._MEIPASS)  # type: ignore[attr-defined]
else:
    BASE_DIR = Path(__file__).parent

MODELS_DIR = BASE_DIR / "models"
MINIFAS_PATH = MODELS_DIR / "minifas_1m.onnx"

# ── Constants ─────────────────────────────────────────────────────────────────
LIVENESS_THRESHOLD: float = 0.85      # multi-scale MiniFAS fusion threshold
EMBEDDING_DIM: int = 512              # InsightFace buffalo_l output dim (w600k_r50.onnx)
HOST: str = "127.0.0.1"              # sidecar-only, never 0.0.0.0
PORT: int = 8765
MINIFAS_INPUT_SIZE: tuple[int, int] = (80, 80)

# ── Global model handles (loaded once at startup) ─────────────────────────────
_face_app = None
_minifas_session = None
_models_ready: bool = False


# ═══════════════════════════════════════════════════════════════════════════════
# 1. STARTUP GUARDS
# ═══════════════════════════════════════════════════════════════════════════════

def _enforce_cpu_only() -> None:
    """Abort if a GPU execution provider is present — safety guard."""
    import onnxruntime as ort

    available = ort.get_available_providers()
    logger.info("ONNX available providers: %s", available)

    if "CUDAExecutionProvider" in available:
        raise RuntimeError(
            "GPU CUDA provider detected in onnxruntime. "
            "This project requires the CPU-only onnxruntime package. "
            "Run: pip uninstall onnxruntime-gpu && pip install onnxruntime"
        )
    if "TensorrtExecutionProvider" in available:
        raise RuntimeError(
            "TensorRT provider detected. CPU-only inference is required."
        )
    logger.info("✅ CPU-only verification passed: no GPU providers detected.")


def _ensure_models_dir() -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)


def _load_insightface() -> object:
    """Load InsightFace buffalo_l — download automatically if not cached.

    We use buffalo_l (not buffalo_m) because buffalo_l reliably ships
    det_10g.onnx (SCRFD detection) + w600k_r50.onnx (ArcFace recognition).
    buffalo_m has a known issue in newer InsightFace versions where
    det_500m.onnx is missing from the zip, causing an AssertionError.

    InsightFace with root=X expects model files at X/models/<name>/*.onnx
    BASE_DIR is the sidecar/ folder → sidecar/models/buffalo_l/*.onnx
    """
    from insightface.app import FaceAnalysis

    # IMPORTANT: root must be BASE_DIR (the sidecar folder), NOT MODELS_DIR.
    # InsightFace appends /models/<name>/ to root internally.
    insightface_root = str(BASE_DIR)
    logger.info("Loading InsightFace buffalo_l | root=%s …", insightface_root)

    face_app = FaceAnalysis(
        name="buffalo_l",
        root=insightface_root,
        # Only load detection + recognition — skip genderage/landmark
        # to avoid assertion errors on optional sub-models
        allowed_modules=["detection", "recognition"],
        providers=["CPUExecutionProvider"],  # CPU-only
    )
    # ctx_id=-1 = CPU; det_size controls SCRFD detector input resolution
    face_app.prepare(ctx_id=-1, det_size=(640, 640))

    logger.info("✅ InsightFace buffalo_l ready.")
    return face_app


def _load_minifas() -> object:
    """Load MiniFAS 1M ONNX model."""
    import onnxruntime as ort

    if not MINIFAS_PATH.exists():
        logger.warning(
            "⚠️  MiniFAS model not found at %s\n"
            "   Download the 1M variant from:\n"
            "   https://github.com/minivision-ai/Silent-Face-Anti-Spoofing\n"
            "   → resources/anti_spoof_models/2.7_80x80_MiniFASNetV1SE.onnx\n"
            "   Save it as: %s",
            MINIFAS_PATH,
            MINIFAS_PATH,
        )
        return None

    logger.info("Loading MiniFAS 1M from %s …", MINIFAS_PATH)

    sess_options = ort.SessionOptions()
    sess_options.intra_op_num_threads = 4
    sess_options.inter_op_num_threads = 1
    sess_options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
    sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

    session = ort.InferenceSession(
        str(MINIFAS_PATH),
        sess_options=sess_options,
        providers=["CPUExecutionProvider"],  # CPU-only — never CUDA
    )

    # Log actual input/output shapes for debugging
    inp = session.get_inputs()[0]
    out = session.get_outputs()[0]
    logger.info(
        "✅ MiniFAS ready | input: %s %s | output: %s %s",
        inp.name, inp.shape, out.name, out.shape,
    )
    return session


# ═══════════════════════════════════════════════════════════════════════════════
# 2. IMAGE UTILITIES
# ═══════════════════════════════════════════════════════════════════════════════

def _decode_base64_image(image_base64: str) -> np.ndarray:
    """
    Decode a raw base64 string (no data URI prefix) to a BGR OpenCV frame.
    Accepts JPEG or PNG.
    """
    try:
        img_bytes = base64.b64decode(image_base64)
    except Exception as exc:
        raise ValueError(f"Invalid base64 data: {exc}") from exc

    img_array = np.frombuffer(img_bytes, dtype=np.uint8)
    frame = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError(
            "Failed to decode image. Ensure the base64 encodes a valid JPEG or PNG."
        )
    return frame


def _softmax(x: np.ndarray) -> np.ndarray:
    """Numerically stable softmax (no scipy dependency)."""
    e_x = np.exp(x - np.max(x))
    return e_x / e_x.sum()


# ═══════════════════════════════════════════════════════════════════════════════
# 3. LIVENESS — MULTI-SCALE MINIFAS FUSION
# ═══════════════════════════════════════════════════════════════════════════════

def _crop_face_region(
    img: np.ndarray,
    bbox: list[float],
    scale: float,
) -> np.ndarray:
    """
    Crop a scaled bounding box region and resize to MiniFAS input size (80×80).

    Args:
        img:   Full BGR frame.
        bbox:  [x1, y1, x2, y2] from InsightFace detector.
        scale: Expansion factor (1.0 = tight crop, 2.7 = wide context).

    Returns:
        80×80 BGR crop ready for MiniFAS inference.
    """
    x1, y1, x2, y2 = bbox
    cx, cy = (x1 + x2) / 2.0, (y1 + y2) / 2.0
    w = (x2 - x1) * scale
    h = (y2 - y1) * scale

    nx1 = max(0, int(cx - w / 2))
    ny1 = max(0, int(cy - h / 2))
    nx2 = min(img.shape[1], int(cx + w / 2))
    ny2 = min(img.shape[0], int(cy + h / 2))

    crop = img[ny1:ny2, nx1:nx2]
    if crop.size == 0:
        # Fallback: use the full frame if bbox is degenerate
        crop = img
    return cv2.resize(crop, MINIFAS_INPUT_SIZE)


def _run_minifas_single(crop: np.ndarray) -> float:
    """
    Run one MiniFAS forward pass on an 80×80 BGR crop.

    MiniFAS outputs [batch, 3] softmax logits: [background, spoof, live].
    We return the 'live' class probability (index 2).
    """
    # Normalise to [0, 1] and convert HWC → CHW → NCHW
    inp = crop.astype(np.float32) / 255.0
    inp = np.transpose(inp, (2, 0, 1))[np.newaxis, ...]  # (1, 3, 80, 80)

    # Use the model's actual input name (typically 'input' for MiniFAS 1M)
    input_name = _minifas_session.get_inputs()[0].name
    raw_output = _minifas_session.run(None, {input_name: inp})[0]  # (1, 3)

    scores = _softmax(raw_output[0])  # (3,) — [background, spoof, live]
    live_prob = float(scores[2])
    return live_prob


def predict_liveness(img_bgr: np.ndarray, bbox: list[float]) -> dict:
    """
    Multi-scale MiniFAS anti-spoofing fusion.

    Runs the model at two scales:
      - 1.0× (tight): captures fine texture / screen artefacts
      - 2.7× (wide):  captures context / depth cues

    Averages both scores. Returns is_live=True only if fused_score > 0.85.

    Args:
        img_bgr: Full BGR frame from webcam.
        bbox:    [x1, y1, x2, y2] face bounding box from InsightFace.

    Returns:
        dict with keys: is_live, liveness_score, score_1x, score_27x
    """
    if _minifas_session is None:
        # MiniFAS not downloaded yet — fail open with warning
        logger.warning(
            "MiniFAS model not loaded. Skipping liveness check (dev mode). "
            "Download the model to enable anti-spoofing."
        )
        return {
            "liveness_score": 0.0,
            "is_live": False,
            "score_1x": 0.0,
            "score_27x": 0.0,
            "warning": "MiniFAS model not found. Download minifas_1m.onnx to sidecar/models/",
        }

    crop_1x = _crop_face_region(img_bgr, bbox, scale=1.0)
    crop_27x = _crop_face_region(img_bgr, bbox, scale=2.7)

    score_1x = _run_minifas_single(crop_1x)
    score_27x = _run_minifas_single(crop_27x)

    fused_score = (score_1x + score_27x) / 2.0
    is_live = fused_score > LIVENESS_THRESHOLD

    return {
        "liveness_score": round(fused_score, 4),
        "is_live": is_live,
        "score_1x": round(score_1x, 4),
        "score_27x": round(score_27x, 4),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 4. FACE EMBEDDING
# ═══════════════════════════════════════════════════════════════════════════════

def _extract_embedding(face) -> list[float]:
    """
    Extract and L2-normalise the 512-dim InsightFace embedding.

    Normalisation ensures consistent cosine similarity in pgvector.
    """
    raw: np.ndarray = face.embedding  # shape (512,), float32
    if raw is None or len(raw) != EMBEDDING_DIM:
        raise ValueError(
            f"Expected {EMBEDDING_DIM}-dim embedding, got {len(raw) if raw is not None else 'None'}."
        )
    norm = np.linalg.norm(raw)
    if norm > 0:
        raw = raw / norm
    return raw.tolist()


# ═══════════════════════════════════════════════════════════════════════════════
# 5. FASTAPI APP
# ═══════════════════════════════════════════════════════════════════════════════

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load all models on startup before accepting requests."""
    global _face_app, _minifas_session, _models_ready

    logger.info("═" * 60)
    logger.info("Norm AI Sidecar — starting up on %s:%d", HOST, PORT)
    logger.info("Models dir: %s", MODELS_DIR)
    logger.info("═" * 60)

    # 1. CPU-only safety check
    _enforce_cpu_only()

    # 2. Ensure models directory exists
    _ensure_models_dir()

    # 3. Load InsightFace
    try:
        _face_app = _load_insightface()
    except Exception as exc:
        logger.error("❌ Failed to load InsightFace: %s", exc)
        raise

    # 4. Load MiniFAS (optional — warns if not downloaded)
    try:
        _minifas_session = _load_minifas()
    except Exception as exc:
        logger.error("❌ Failed to load MiniFAS: %s", exc)
        # Don't abort — sidecar can still run (liveness will fail gracefully)

    _models_ready = True
    logger.info("✅ Sidecar ready — accepting requests")
    logger.info("═" * 60)

    yield  # Server runs here

    logger.info("Sidecar shutting down.")


app = FastAPI(
    title="Norm AI Sidecar",
    description="Local AI inference server — face detection, liveness, embedding extraction.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None,   # disable Swagger in production sidecar
    redoc_url=None,
)

# Allow calls only from the Tauri webview origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "tauri://localhost",
        "https://tauri.localhost",
        "http://localhost:1420",
        "http://127.0.0.1:1420",
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


# ── Request/Response schemas ──────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    image_base64: str  # raw base64, no "data:image/..." prefix


class AnalyzeResponse(BaseModel):
    faces_detected: int
    is_live: bool
    liveness_score: float
    embedding: Optional[list[float]]  # 512 floats, L2-normalised; None if not live
    error: Optional[str]


class HealthResponse(BaseModel):
    status: str
    model: str
    antispoof: str
    minifas_loaded: bool


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse, tags=["system"])
async def health() -> HealthResponse:
    """
    Tauri frontend polls this on startup before enabling the attendance flow.
    Returns 'ready' once all models are loaded.
    """
    return HealthResponse(
        status="ready" if _models_ready else "loading",
        model="buffalo_l",
        antispoof="minifas_1m",
        minifas_loaded=_minifas_session is not None,
    )


@app.post("/analyze", response_model=AnalyzeResponse, tags=["inference"])
async def analyze(body: AnalyzeRequest) -> AnalyzeResponse:
    """
    Full face analysis pipeline:
      decode → detect → liveness → embed

    Expects exactly 1 face in the frame.
    Returns 512-dim L2-normalised embedding only if liveness passes.
    """
    if not _models_ready or _face_app is None:
        raise HTTPException(
            status_code=503,
            detail="Models are still loading. Please retry in a moment.",
        )

    # ── Step 1: Decode image ──────────────────────────────────────────────────
    try:
        img_bgr = _decode_base64_image(body.image_base64)
    except ValueError as exc:
        return AnalyzeResponse(
            faces_detected=0,
            is_live=False,
            liveness_score=0.0,
            embedding=None,
            error=str(exc),
        )

    # ── Step 2: Face detection ────────────────────────────────────────────────
    try:
        faces = _face_app.get(img_bgr)
    except Exception as exc:
        logger.exception("InsightFace detection error")
        return AnalyzeResponse(
            faces_detected=0,
            is_live=False,
            liveness_score=0.0,
            embedding=None,
            error=f"Face detection failed: {exc}",
        )

    # ── Step 3: Face count validation ─────────────────────────────────────────
    if len(faces) == 0:
        return AnalyzeResponse(
            faces_detected=0,
            is_live=False,
            liveness_score=0.0,
            embedding=None,
            error="No face detected in frame. Please position your face clearly in front of the camera.",
        )

    if len(faces) > 1:
        return AnalyzeResponse(
            faces_detected=len(faces),
            is_live=False,
            liveness_score=0.0,
            embedding=None,
            error="Multiple faces detected. Please ensure only your face is visible.",
        )

    face = faces[0]
    bbox: list[float] = face.bbox.tolist()  # [x1, y1, x2, y2]

    # ── Step 4: Liveness detection ────────────────────────────────────────────
    try:
        liveness = predict_liveness(img_bgr, bbox)
    except Exception as exc:
        logger.exception("Liveness detection error")
        return AnalyzeResponse(
            faces_detected=1,
            is_live=False,
            liveness_score=0.0,
            embedding=None,
            error=f"Anti-spoofing check failed: {exc}",
        )

    liveness_score: float = liveness["liveness_score"]
    is_live: bool = liveness["is_live"]

    logger.info(
        "Liveness | score_1x=%.4f score_27x=%.4f fused=%.4f is_live=%s",
        liveness["score_1x"],
        liveness["score_27x"],
        liveness_score,
        is_live,
    )

    if not is_live:
        return AnalyzeResponse(
            faces_detected=1,
            is_live=False,
            liveness_score=liveness_score,
            embedding=None,
            error=(
                f"Liveness check failed (score: {liveness_score:.2f}, "
                f"threshold: {LIVENESS_THRESHOLD}). "
                "Please use a real face — photos or screens are not accepted."
            ),
        )

    # ── Step 5: Extract embedding ─────────────────────────────────────────────
    try:
        embedding = _extract_embedding(face)
    except ValueError as exc:
        logger.error("Embedding extraction error: %s", exc)
        return AnalyzeResponse(
            faces_detected=1,
            is_live=True,
            liveness_score=liveness_score,
            embedding=None,
            error=str(exc),
        )

    assert len(embedding) == EMBEDDING_DIM, (
        f"Embedding dimension mismatch: expected {EMBEDDING_DIM}, got {len(embedding)}"
    )

    logger.info("✅ Analysis complete | liveness=%.4f | embedding[0:3]=%s…", liveness_score, embedding[:3])

    return AnalyzeResponse(
        faces_detected=1,
        is_live=True,
        liveness_score=liveness_score,
        embedding=embedding,
        error=None,
    )


# ── Global error handler ──────────────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled sidecar error")
    return JSONResponse(
        status_code=500,
        content={
            "faces_detected": 0,
            "is_live": False,
            "liveness_score": 0.0,
            "embedding": None,
            "error": f"Internal sidecar error: {exc}",
        },
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 6. ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    uvicorn.run(
        app,
        host=HOST,
        port=PORT,
        log_level="info",
        access_log=True,
        # Single worker — models are loaded once in the main process
        workers=1,
    )
