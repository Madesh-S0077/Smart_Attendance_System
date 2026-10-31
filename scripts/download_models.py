"""Download the AI models the sidecar needs into sidecar/models/.

Usage (from repo root, with the backend/sidecar venv active):
    python scripts/download_models.py
"""
import shutil
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MODELS = ROOT / "norm-ai-frontend" / "src-tauri" / "sidecar" / "models"
MINIFAS_URL = (
    "https://huggingface.co/garciafido/minifasnet-v2-anti-spoofing-onnx/"
    "resolve/main/minifasnet_v2.onnx"
)  # ONNX export of upstream MiniFASNetV2 2.7_80x80 (Apache-2.0)


def main() -> None:
    MODELS.mkdir(parents=True, exist_ok=True)

    from insightface.app import FaceAnalysis

    print("Downloading InsightFace buffalo_l ...")
    app = FaceAnalysis(
        name="buffalo_l",
        allowed_modules=["detection", "recognition"],
        providers=["CPUExecutionProvider"],
    )
    app.prepare(ctx_id=-1, det_size=(640, 640))
    src = Path.home() / ".insightface" / "models" / "buffalo_l"
    shutil.copytree(src, MODELS / "buffalo_l", dirs_exist_ok=True)

    target = MODELS / "minifas_1m.onnx"
    if not target.exists():
        print("Downloading MiniFASNet anti-spoofing model ...")
        urllib.request.urlretrieve(MINIFAS_URL, target)
    print(f"Done. Models in {MODELS}")


if __name__ == "__main__":
    main()
