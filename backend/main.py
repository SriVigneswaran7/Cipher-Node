import asyncio
import serial
import json
import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from database import init_db, log_event, log_attempt, get_recent_attempts

load_dotenv()
init_db()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

PORT = os.getenv("SERIAL_PORT", "/dev/cu.usbmodem1101")
BAUD = int(os.getenv("BAUD_RATE", 9600))
SECRET_CODE = os.getenv("SAFE_CODE", "404")

ser = None
connected_clients = set()

# State variables for hardware logic
current_attempt = ""
current_digit = 0 

try:
    ser = serial.Serial(PORT, BAUD, timeout=0.1)
except Exception as e:
    print(f"⚠️ SERIAL ERROR: {e}. Dashboard will run in simulation mode.")

async def broadcast(message: dict):
    """Pushes real-time JSON data to the React frontend"""
    if connected_clients:
        data = json.dumps(message)
        await asyncio.gather(*[client.send_text(data) for client in connected_clients])

async def serial_reader():
    """Parses JSON from Arduino and applies Cycle/Enter logic"""
    global current_attempt, current_digit, ser
    while True:
        if ser and ser.in_waiting > 0:
            try:
                line = ser.readline().decode('utf-8').strip()
                data = json.loads(line)
                
                if data.get("event") == "btn_press":
                    log_event("button_press", data["id"])
                    
                    # Cycle Button
                    if data["id"] == "btn_1":
                        current_digit = (current_digit + 1) % 10
                        preview = current_attempt + str(current_digit) + "_"
                        await broadcast({"type": "LIVE_PREVIEW", "current": preview})
                    
                    # Enter Button
                    elif data["id"] == "btn_2":
                        current_attempt += str(current_digit)
                        current_digit = 0 
                        await broadcast({"type": "LIVE_PREVIEW", "current": current_attempt})
                        
                        # Validate Password at 3 Digits
                        if len(current_attempt) == 3:
                            if current_attempt == SECRET_CODE:
                                ser.write(b'U')
                                log_attempt(current_attempt, "SUCCESS")
                                await broadcast({"type": "AUTH_RESULT", "status": "SUCCESS"})
                                
                                # NEW: The True Hardware Auto-Lock
                                async def auto_lock():
                                    await asyncio.sleep(5) # Wait 5 seconds
                                    if ser:
                                        ser.write(b'L') # Physically lock the Arduino
                                    await broadcast({"type": "AUTH_RESULT", "status": "LOCKED"}) # Tell React
                                    
                                asyncio.create_task(auto_lock())

                            else:
                                log_attempt(current_attempt, "DENIED")
                                await broadcast({"type": "AUTH_RESULT", "status": "DENIED"})
                            
                            current_attempt = "" # Reset
            except json.JSONDecodeError:
                pass # Ignore malformed serial noise
        await asyncio.sleep(0.01)

async def watchdog_pinger():
    """Satisfies the Arduino Deadman Switch by pinging every 2 seconds"""
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
            await websocket.receive_text()
    except WebSocketDisconnect:
        connected_clients.remove(websocket)

@app.get("/analytics")
def get_analytics():
    """REST endpoint for React to fetch historical chart data"""
    return {
        "status": "online", 
        "port": PORT,
        "recent_attempts": get_recent_attempts()
    }

from pydantic import BaseModel

# Define what the incoming data looks like
class ConfigUpdate(BaseModel):
    new_pin: str

@app.post("/update_config")
async def update_config(config: ConfigUpdate):
    global SECRET_CODE
    
    # 1. Update the live memory so it works instantly
    SECRET_CODE = config.new_pin
    
    # 2. Rewrite the .env file so it remembers after a reboot
    try:
        with open(".env", "r") as f:
            lines = f.readlines()
            
        with open(".env", "w") as f:
            for line in lines:
                if line.startswith("SAFE_CODE="):
                    f.write(f"SAFE_CODE={config.new_pin}\n")
                else:
                    f.write(line)
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}