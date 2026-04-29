# Cipher-Node

![React](https://img.shields.io/badge/React-Frontend-blue)
![Tailwind](https://img.shields.io/badge/TailwindCSS-Styling-06B6D4)
![Vite](https://img.shields.io/badge/Vite-Bundler-646CFF)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688)
![Python](https://img.shields.io/badge/Python-Logic-3776AB)
![Arduino](https://img.shields.io/badge/Arduino-Hardware-00979D)
![SQLite](https://img.shields.io/badge/SQLite-Database-003B57)
![License](https://img.shields.io/badge/License-MIT-yellow)

> Zero-trust IoT edge node featuring a C++ physical relay, Python WebSocket brain, and a live React glassmorphism dashboard.

Cipher-Node bridges the gap between physical hardware and high-end web architecture. By stripping the hardware of all logic (acting purely as a "Dumb Terminal"), the Python backend securely manages access controls, audit logging, and hardware timeouts, while broadcasting real-time data to a cyber-security styled React dashboard.

---

## Architecture Breakdown

Cipher-Node is divided into three distinct layers:

1. The Edge Node (/firmware)
   - A C++ Arduino environment operating as a dumb terminal. 
   - Blindly reads physical button states and transmits them as JSON over Serial USB.
   - Features a 5-second Watchdog "Deadman Switch." If the Python brain crashes or disconnects, the hardware physically slams the servo shut to default to maximum security.

2. The Brain (/backend)
   - A Python FastAPI server acting as the logic controller.
   - Parses the JSON stream, enforces the Cycle/Enter logic, and validates the access PIN against a local .env file.
   - Maintains a SQLite database (audit_log.sqlite3) to track threat analysis and unlock attempts.
   - Pings the hardware every 2 seconds to satisfy the Watchdog timer during authorised unlocks.

3. The Command Centre (/frontend)
   - A React + Vite dashboard utilising Tailwind CSS v4 for a deep-navy glassmorphism UI.
   - Connects to the Brain via WebSockets for real-time, zero-latency updates (Live Input Preview, Node Status, Raw JSON streams).
   - Uses Recharts to visualise historical access attempts from the SQLite database.

---

## File Structure

    Cipher-Node/
    ├── backend/                  # The Logic Controller
    │   ├── .env                  # Secrets & Port config
    │   ├── database.py           # SQLite initialisation and queries
    │   └── main.py               # FastAPI server & Serial parser
    ├── firmware/                 # The Dumb Terminal
    │   └── CipherNode.ino        # C++ hardware relay code
    ├── frontend/                 # The Command Centre
    │   ├── src/                  # React UI components & Tailwind CSS
    │   ├── index.html            # Vite entry point
    │   ├── package.json          # Node dependencies
    │   ├── postcss.config.js     # Tailwind v4 configuration
    │   └── vite.config.js        # Vite build configuration

---

## Quick Start Guide

### 1. Hardware Setup
- Flash firmware/CipherNode.ino to your Arduino.
- Ensure your physical buttons are on Pins 2 & 3, LEDs on 8 & 9, and the Servo on Pin 10.

### 2. Backend Initialisation
Navigate to the backend directory and install the requirements:

    cd backend
    pip install fastapi uvicorn pyserial websockets pydantic python-dotenv

Create a .env file in the backend folder and update the port to match your machine:

    SERIAL_PORT=/dev/cu.usbmodem1101
    BAUD_RATE=9600
    SAFE_CODE=404

Boot the brain:

    python3 -m uvicorn main:app --reload

### 3. Frontend Launch
Navigate to the frontend directory in a new terminal:

    cd frontend
    npm install
    npm run dev

Open http://localhost:5173 in your browser. The dashboard will automatically connect to the WebSocket and sync with the hardware.

---

## Security Features
* State Isolation: Passwords are never stored on the physical device.
* NVRAM Updates: The UI can dynamically rewrite the .env file to update access codes without a hard reboot.
* Socket Logging: Every physical interaction is tracked, logged in SQLite, and streamable in the raw Live Logs terminal.