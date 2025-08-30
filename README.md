# Pawketeer Wi-Fi Packet Analyzer

A web application for uploading and analyzing Wi-Fi packet capture files (.pcap, .pcapng, .cap).

## 🚀 Current Status

This is a minimal but working application with:
✅ File upload functionality
✅ Vite + React + Tailwind frontend
✅ FastAPI backend with API endpoints
✅ PostgreSQL data storage (via Podman)
❌ Only basic packet analysis so far

## 🛠️ Next Steps

Implement actual packet parsing logic
Add specialized analysis agents
Extend real-world Wi-Fi analysis features
Enhance UI/UX with additional Tailwind components
Provide authorization mechanism

## ⚙️ Getting Started

### Backend Setup (FastAPI)

1. Navigate to the backend directory:
   '''bash
   cd backend
   '''
2. Create and activate a virtual environment:
   '''bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   '''
3. Install dependencies:
   '''bash
   pip install -r requirements.txt
   '''
4. Start the FastAPI server:
   '''bash
   uvicorn main:app --reload
   '''
5. API available at → http://localhost:8000/docs

### Database Setup (PostgreSQL via Podman)

1. Start the database container:
   '''bash
   podman-compose up -d postgres
   '''
2. Default connection details (configure in .env as needed):
   '''bash
   POSTGRES_DB=wifi_analyzer
   POSTGRES_USER=wifi_user
   POSTGRES_PASSWORD=wifi_password
   POSTGRES_PORT=5432
   '''
3. Confirm the container is healthy:
   '''bash
   podman ps
   '''

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```

   The web app will be available at http://localhost:3000

## Usage

1. Open http://localhost:3000 in your browser
2. Upload a packet capture file (.pcap, .pcapng, or .cap)
3. View the uploaded files in the left panel
4. Click on an upload to see placeholder analysis results
