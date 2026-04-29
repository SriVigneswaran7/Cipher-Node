import sqlite3

DB_NAME = "audit_log.sqlite3"

def init_db():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    
    # Logs every physical interaction and system event
    c.execute('''CREATE TABLE IF NOT EXISTS logs 
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, 
                  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, 
                  event TEXT, 
                  details TEXT)''')
                  
    # Logs full 3-digit attempts for the UI charts
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

def log_attempt(code, result):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("INSERT INTO attempts (code_entered, result) VALUES (?, ?)", (str(code), str(result)))
    conn.commit()
    conn.close()

def get_recent_attempts():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    # Fetch last 7 attempts for the chart
    c.execute("SELECT timestamp, result FROM attempts ORDER BY id DESC LIMIT 7")
    data = c.fetchall()
    conn.close()
    
    formatted_data = []
    for row in reversed(data): 
        time_string = row[0][-8:] # Extract HH:MM:SS
        formatted_data.append({"time": time_string, "status": row[1]})
        
    return formatted_data

# NEW: Purge function for the Security Dashboard
def wipe_db():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("DELETE FROM logs")
    c.execute("DELETE FROM attempts")
    conn.commit()
    conn.close()