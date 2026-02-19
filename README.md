# Database Anonymiser Upgraded Version

---


#  Installation

## 1️. Clone Repository

```bash
git clone <your-repo-url>
cd database-anonymiser
```

---

## 2️. Install Backend Dependencies

```bash
npm install
```

---

## 3️. Install UI Dependencies

```bash
cd ui
npm install
cd ..
```

---


#  Running the Platform

## Start Backend API

```bash
npm run platform:api
```

Default API:  
`http://localhost:5050`

---

## Start Frontend UI

In another terminal:

```bash
npm run platform:ui
```

Open browser:

```
http://localhost:3000
```

---

# Enable AI Recommendations (Ollama)

AI recommendations are optional.

The tool works fully without AI (heuristic fallback will be used automatically).

---

## Step 1 – Install Ollama

### Linux / WSL

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### Mac

Download and install from:

https://ollama.com

Verify installation:

```bash
ollama --version
```

---

## Step 2 – Pull Model

We use:

```bash
ollama pull phi3:mini
```

---

## Step 3 – Start Ollama

```bash
ollama serve
```

You should see:

```
Listening on 127.0.0.1:11434
```

⚠️ Keep this running.

---

## What If Ollama Is Not Running?

- AI step will fallback automatically
- The tool continues to work normally
- No crashes

---
