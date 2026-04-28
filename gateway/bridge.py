import serial
import json
import sqlite3
import time

# --- Configuration ---
# LOOK AT YOUR ARDUINO IDE: What is the Port name? (e.g., /dev/cu.usbmodern1101)
SERIAL_PORT = '/dev/cu.usbmodem1101' 
BAUD_RATE = 9600
DB_NAME = "audit_log.sqlite3"

# 1. Initialize Database
def init_db():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS logs 
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, 
                  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, 
                  event TEXT, 
                  details TEXT)''')
    conn.commit()
    conn.close()

# 2. Log Data to Database
def log_to_db(event, details):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("INSERT INTO logs (event, details) VALUES (?, ?)", (event, str(details)))
    conn.commit()
    conn.close()
    print(f"Logged: {event} | {details}")

# 3. Main Bridge Loop
def start_bridge():
    init_db()
    print(f"Bridge Active. Listening on {SERIAL_PORT}...")
    
    try:
        # Open Serial Connection
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        time.sleep(2) # Wait for Arduino to reset
        
        while True:
            if ser.in_waiting > 0:
                # Read line from Arduino
                line = ser.readline().decode('utf-8').strip()
                
                try:
                    # Parse JSON
                    data = json.loads(line)
                    event_type = data.get("event", "unknown")
                    
                    # Save to DB
                    log_to_db(event_type, data)
                    
                except json.JSONDecodeError:
                    # Ignore non-JSON lines (like random noise)
                    continue
                    
    except KeyboardInterrupt:
        print("\nBridge Shutting Down.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    start_bridge()