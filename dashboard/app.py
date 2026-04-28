import streamlit as st
import pandas as pd
import sqlite3
import serial
import time

# --- Config ---
DB_NAME = "audit_log.sqlite3"
SERIAL_PORT = '/dev/cu.usbmodem1101' # Match your bridge.py

st.set_page_config(page_title="Cipher-Node Ops", layout="wide")

st.title("🔒 Cipher-Node | Security Command Center")
st.markdown("---")

# --- Sidebar: Remote Control ---
st.sidebar.header("System Controls")
if st.sidebar.button("🚨 EMERGENCY UNLOCK", type="primary"):
    try:
        ser = serial.Serial(SERIAL_PORT, 9600, timeout=1)
        time.sleep(2)
        ser.write(b'U') # Send 'U' for Unlock to Arduino
        ser.close()
        st.sidebar.success("Unlock Command Sent!")
    except Exception as e:
        st.sidebar.error(f"Error: {e}")

if st.sidebar.button("🔒 RELOCK SYSTEM"):
    try:
        ser = serial.Serial(SERIAL_PORT, 9600, timeout=1)
        time.sleep(2)
        ser.write(b'L') # Send 'L' for Lock
        ser.close()
        st.sidebar.info("Lock Command Sent!")
    except Exception as e:
        st.sidebar.error(f"Error: {e}")

# --- Main Dashboard ---
def get_data():
    conn = sqlite3.connect(DB_NAME)
    df = pd.read_sql_query("SELECT * FROM logs ORDER BY timestamp DESC", conn)
    conn.close()
    return df

col1, col2 = st.columns([2, 1])

with col1:
    st.subheader("📜 Live Audit Trail")
    data = get_data()
    st.dataframe(data, use_container_width=True, height=500)

with col2:
    st.subheader("📊 Threat Analytics")
    denied_count = len(data[data['event'] == 'access_denied'])
    granted_count = len(data[data['event'] == 'access_granted'])
    
    st.metric("Failed Attempts", denied_count, delta="- High Risk" if denied_count > 5 else "Normal")
    st.metric("Successful Entries", granted_count)
    
    if not data.empty:
        st.write("Event Distribution")
        st.bar_chart(data['event'].value_counts())

# Auto-refresh the page every 5 seconds
time.sleep(5)
st.rerun()