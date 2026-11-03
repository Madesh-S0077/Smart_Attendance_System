Models directory - downloaded AI model weights go here (gitignored).

  buffalo_l/        InsightFace buffalo_l (SCRFD detection + ArcFace recognition)
  minifas_1m.onnx   Silent-Face-Anti-Spoofing MiniFASNetV2 ONNX export (2.7x crop, 80x80; class order [spoof, live, spoof])

Download everything with:
  python scripts/download_models.py

MiniFAS source: https://github.com/minivision-ai/Silent-Face-Anti-Spoofing
