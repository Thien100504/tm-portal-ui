# ⚛️ Portal UI - Task Manager Frontend

This repository contains the full user interface source code for the Task Manager AI system.

## 🛠️ Tech Stack
- **Framework:** React 18
- **Build Tool:** Vite
- **Language:** TypeScript
- **Styling:** TailwindCSS v4
- **State Management:** Zustand
- **Data Fetching:** TanStack React Query v5

## ⚡ Quick Start (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Dev Server
```bash
npm run dev
```

The app runs at `http://localhost:3000`. All requests to `/api` and `/ws` are automatically proxied by Vite to the Backend running at `http://localhost:8000`.

## 🚀 CI/CD
The project is configured with GitLab CI/CD in `.gitlab-ci.yml`. It automatically lints, builds static files and packages them into an Nginx Docker container to serve in Production.
