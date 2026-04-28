import sqlite3
from datetime import datetime

DB_NAME = "audit_log.sqlite3"

def init_db():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    # Log every raw event (button presses, boot, watchdog)
    c.execute('''CREATE TABLE IF NOT EXISTS logs 
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, 
                  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, 
                  event TEXT, 
                  details TEXT)''')
    # Log specific unlock attempts for the dashboard charts
    c.execute('''CREATE TABLE IF NOT EXISTS attempts 
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, 
                  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, 
                  code_entered TEXT, 
                  result TEXT)''')
    conn.commit()
    conn.close()

def log_event(event, details=""):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("INSERT INTO logs (event, details) VALUES (?, ?)", (event, str(details)))
    conn.commit()
    conn.close()