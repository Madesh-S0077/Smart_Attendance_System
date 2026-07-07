# Norm AI — Smart Attendance System (Tauri Frontend client)

Tauri desktop frontend client for the Norm AI Smart Attendance System. Built using React, TypeScript, TailwindCSS, Lucide React icons, and Tauri v2.

## Prerequisites

- **Node.js**: version 20.x or above (npm version 10+)
- **Rust Compiler**: Installed via [rustup](https://rustup.rs/) (stable channel)
- **Tauri v2 Prerequisites**: Platform-specific build tools (C++ build tools and SDKs on Windows, build-essential on Linux, Xcode on macOS)

## Setup & Installation

1. **Clone the repository** and navigate to the frontend directory:
   ```bash
   cd norm-ai-frontend
   ```

2. **Install node dependencies**:
   ```bash
   npm install
   ```

3. **Configure API connection**:
   The Axios client links to the backend REST API. Check or configure the backend API target URL in `src/api/client.ts`. By default, it connects to: `http://localhost:8000`

## AI Sidecar Setup

The local AI pipeline executes as a Tauri sidecar binary to perform face analysis and liveness checks on client machines.

1. Navigate to the sidecar folder inside Tauri source:
   ```bash
   cd src-tauri/sidecar
   ```
2. Install Python dependencies:
   ```bash
   pip install -r requirements-sidecar.txt
   ```
3. Download InsightFace and MiniFAS ONNX model files and place them in the `models/` directory inside `src-tauri/sidecar/models/`.

## Running in Development

Start the app in hot-reloading development mode:
```bash
npm run tauri dev
```
Tauri will compile Rust crates, spawn the AI sidecar, load the web fronted on `http://localhost:1420`, and open the native system window.

## Production Build

Build the optimized, standalone desktop installer for the current OS:
```bash
npm run tauri build
```
This builds Vite static files, compiles Rust packages in release mode, bundles the AI sidecar binary, and packages the app into platform-specific installers (e.g. `.msi` for Windows, `.dmg` for macOS, `.deb` for Debian/Ubuntu).
