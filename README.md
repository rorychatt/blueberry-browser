# 🫐 Blueberry Browser

Blueberry Browser is a next-generation browser built with Electron, React, Rust, and AI-native automation.

---

## 🚀 Setup & Development

### 1. Install Dependencies

```bash
vp install
# or pnpm install
```

### 2. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Configure your local LLM provider in `.env`:

```env
LLM_PROVIDER=ollama
LLM_MODEL=opencode
OLLAMA_ENDPOINT=http://localhost:11434
OLLAMA_MODEL=opencode
```

Make sure [Ollama](https://ollama.com) is running and the model is downloaded:

```bash
ollama run opencode
```

### 3. Run Development App

```bash
vp dev
# or pnpm dev
```

---

## 🧪 E2E Test Suite

Blueberry Browser features a custom Rust-based E2E test runner (`blueberry-core`) that automates headless browser workflows and evaluates page state using the local LLM.

### 1. Build the Test Runner

```bash
cargo build --manifest-path src/code/Cargo.toml
```

### 2. Run a Single Test

```bash
./src/code/target/debug/blueberry-core run tests/console_log_test.yaml
```

### 3. Run All Tests Sequentially

```bash
for f in tests/*.yaml; do ./src/code/target/debug/blueberry-core run "$f"; done
```
