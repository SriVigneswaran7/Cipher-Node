import asyncio
import serial
import json
import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from database import init_db, log_event

load_dotenv()
init_db()

app = FastAPI()

# Enable CORS so React can talk to us
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
PORT = os.getenv("SERIAL_PORT")
BAUD = int(os.getenv("BAUD_RATE"))
SECRET_CODE = os.getenv("SAFE_CODE")

# Global State
ser = None
connected_clients = set()
current_attempt = ""

try:
    ser = serial.Serial(PORT, BAUD, timeout=0.1)
except Exception as e:
    print(f"⚠️ SERIAL ERROR: {e}. Dashboard will run in simulation mode.")

async def broadcast(message: dict):
    """Sends data to all connected React clients via WebSockets"""
    if connected_clients:
        data = json.dumps(message)
        await asyncio.gather(*[client.send_text(data) for client in connected_clients])

async def serial_reader():
    """Listens to the Arduino and processes logic"""
    global current_attempt, ser
    while True:
        if ser and ser.in_waiting > 0:
            try:
                line = ser.readline().decode('utf-8').strip()
                data = json.loads(line)
                
                if data.get("event") == "btn_press":
                    # Logic for the "Cloud Brain"
                    val = 1 if data["id"] == "btn_1" else 2 # Example: btn1 is '1', btn2 is '2'
                    current_attempt += str(val)
                    
                    # Log and Broadcast for Live Preview
                    log_event("button_press", data["id"])
                    await broadcast({"type": "LIVE_PREVIEW", "current": current_attempt})
                    
                    # Check if 3 digits are reached
                    if len(current_attempt) == 3:
                        if current_attempt == SECRET_CODE:
                            ser.write(b'U') # Send UNLOCK
                            await broadcast({"type": "AUTH_RESULT", "status": "SUCCESS"})
                        else:
                            await broadcast({"type": "AUTH_RESULT", "status": "DENIED"})
                        
                        current_attempt = "" # Reset
            except:
                pass
        await asyncio.sleep(0.01)

async def watchdog_pinger():
    """Sends 'P' to Arduino every 2 seconds to keep it from locking"""
    while True:
        if ser:
            ser.write(b'P')
        await asyncio.sleep(2)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(serial_reader())
    asyncio.create_task(watchdog_pinger())

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)
    try:
        while True:
            await websocket.receive_text() # Keep connection alive
    except WebSocketDisconnect:
        connected_clients.remove(websocket)

@app.get("/status")
def get_status():
    return {"status": "online", "port": PORT}