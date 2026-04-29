import asyncio
import serial
import serial.tools.list_ports
import json
import os
import time
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# NEW: Imported get_recent_logs
from database import init_db, log_event, log_attempt, get_recent_attempts, get_recent_logs, wipe_db

load_dotenv()
init_db()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def find_arduino_port():
    ports = serial.tools.list_ports.comports()
    for port in ports:
        if "usbmodem" in port.device or "CH340" in port.description or "Arduino" in port.description:
            return port.device
    return os.getenv("SERIAL_PORT", "/dev/cu.usbmodem1101")

PORT = find_arduino_port()
BAUD = int(os.getenv("BAUD_RATE", 9600))
SECRET_CODE = os.getenv("SAFE_CODE", "404")
AUTO_LOCK_TIMEOUT = int(os.getenv("AUTO_LOCK", 5000))

ser = None
connected_clients = set()
START_TIME = time.time()

current_attempt = ""
current_digit = 0 
failed_attempts = 0
lockout_until = 0

try:
    ser = serial.Serial(PORT, BAUD, timeout=0.1)
    print(f"✅ Hardware linked on {PORT}")
except Exception as e:
    print(f"⚠️ SERIAL ERROR: Dashboard running in simulation mode.")

async def broadcast(message: dict):
    if connected_clients:
        data = json.dumps(message)
        await asyncio.gather(*[client.send_text(data) for client in connected_clients])

async def serial_reader():
    global current_attempt, current_digit, failed_attempts, lockout_until, ser
    while True:
        if ser and ser.in_waiting > 0:
            try:
                line = ser.readline().decode('utf-8').strip()
                data = json.loads(line)
                
                if data.get("event") == "btn_press":
                    if time.time() < lockout_until:
                        continue 
                        
                    log_event("button_press", data["id"])
                    
                    if data["id"] == "btn_1":
                        current_digit = (current_digit + 1) % 10
                        preview = current_attempt + str(current_digit) + "_"
                        await broadcast({"type": "LIVE_PREVIEW", "current": preview})
                    
                    elif data["id"] == "btn_2":
                        current_attempt += str(current_digit)
                        current_digit = 0 
                        await broadcast({"type": "LIVE_PREVIEW", "current": current_attempt})
                        
                        if len(current_attempt) == 3:
                            if current_attempt == SECRET_CODE:
                                failed_attempts = 0
                                ser.write(b'U')
                                log_attempt(current_attempt, "SUCCESS")
                                await broadcast({"type": "AUTH_RESULT", "status": "SUCCESS"})
                                
                                async def auto_lock():
                                    await asyncio.sleep(AUTO_LOCK_TIMEOUT / 1000.0) 
                                    if ser:
                                        ser.write(b'L')
                                    await broadcast({"type": "AUTH_RESULT", "status": "LOCKED"})
                                    
                                asyncio.create_task(auto_lock())
                            else:
                                failed_attempts += 1
                                log_attempt(current_attempt, "DENIED")
                                
                                if failed_attempts >= 3:
                                    lockout_until = time.time() + 60
                                    log_event("SYSTEM_LOCKOUT", "3 consecutive failed attempts.")
                                    await broadcast({"type": "SYSTEM_LOCKOUT", "duration": 60})
                                else:
                                    await broadcast({"type": "AUTH_RESULT", "status": "DENIED"})
                            
                            current_attempt = ""
            except json.JSONDecodeError:
                pass 
        await asyncio.sleep(0.01)

async def watchdog_pinger():
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
    return {
        "status": "online", 
        "port": PORT,
        "uptime_seconds": int(time.time() - START_TIME),
        "recent_attempts": get_recent_attempts(),
        "recent_logs": get_recent_logs(), # NEW: Send logs to UI
        "current_config": {
            "pin": SECRET_CODE,
            "timeout": AUTO_LOCK_TIMEOUT
        }
    }

class ConfigUpdate(BaseModel):
    new_pin: str
    timeout: int

@app.post("/update_config")
async def update_config(config: ConfigUpdate):
    global SECRET_CODE, AUTO_LOCK_TIMEOUT
    SECRET_CODE = config.new_pin
    AUTO_LOCK_TIMEOUT = config.timeout
    
    try:
        with open(".env", "r") as f:
            lines = f.readlines()
            
        with open(".env", "w") as f:
            for line in lines:
                if line.startswith("SAFE_CODE="):
                    f.write(f"SAFE_CODE={config.new_pin}\n")
                elif line.startswith("AUTO_LOCK="):
                    f.write(f"AUTO_LOCK={config.timeout}\n")
                elif not line.startswith("SERIAL_PORT") and not line.startswith("BAUD_RATE"):
                    f.write(line)
            
            if not any(l.startswith("SAFE_CODE=") for l in lines):
                f.write(f"SAFE_CODE={config.new_pin}\n")
            if not any(l.startswith("AUTO_LOCK=") for l in lines):
                f.write(f"AUTO_LOCK={config.timeout}\n")
                
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.delete("/wipe_logs")
async def wipe_logs_endpoint():
    try:
        wipe_db()
        return {"status": "success"}
    except Exception as e:
        return {"status": "error"}