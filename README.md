# WiFiFoFum Packet Analyzer

A simple web application for uploading and analyzing WiFi packet capture files.

## Getting Started

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Start the FastAPI server:
   ```bash
   python main.py
   ```

   The API will be available at http://localhost:8000

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the React development server:
   ```bash
   npm start
   ```

   The web app will be available at http://localhost:3000

## Usage

1. Open http://localhost:3000 in your browser
2. Upload a packet capture file (.pcap, .pcapng, or .cap)
3. View the uploaded files in the left panel
4. Click on an upload to see placeholder analysis results

## Current Status

This is a minimal working application with:
- ✅ File upload functionality
- ✅ Basic API endpoints
- ✅ Simple React frontend
- ✅ PSQL data storage
- ❌ No actual packet analysis yet (placeholder data only)

## Next Steps

- Implement actual packet parsing
- Add real analysis features
- Improve UI/UX
