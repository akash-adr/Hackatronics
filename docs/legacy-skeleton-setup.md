# DER-02: Threat-Zone Estimation (Infrastructure Skeleton)

This is a basic full-stack skeleton with a React frontend, FastAPI backend, and MySQL database wired together.

## 1. Database Setup

1. Make sure you have a local MySQL server running.
2. Log in to your MySQL server and create the database:
   ```sql
   CREATE DATABASE der02_db;
   ```

## 2. Backend Setup

1. Open a new terminal and navigate to the backend directory:
   ```bash
   cd der02/backend
   ```
2. Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Open `.env` and fill in your local MySQL credentials (e.g., `DB_PASSWORD`).
4. Set up a virtual environment and install dependencies:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```
5. Run the backend server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   *Note: On startup, the backend will automatically create the `test_pings` table if it doesn't exist.*

## 3. Frontend Setup

1. Open another new terminal and navigate to the frontend directory:
   ```bash
   cd der02/frontend
   ```
2. Install dependencies (if not already installed):
   ```bash
   npm install
   ```
3. Run the Vite development server:
   ```bash
   npm run dev
   ```

## 4. Verification Checklist

- [ ] Does the FastAPI backend start without errors on `http://localhost:8000`?
- [ ] Does the Vite dev server start on `http://localhost:5173`?
- [ ] Can you open the React frontend in your browser?
- [ ] When you click **"Ping Backend"**, does it show `{"status": "ok", "message": "backend is alive"}`?
- [ ] When you type a message and click **"Save to DB"**, does it say `Success`?
- [ ] When you click **"Load Saved Messages"**, does your message appear in the list?
