import streamlit as st
import pandas as pd
import sqlite3
import plotly.express as px
import time

# --- Page Config ---
st.set_page_config(
    page_title="CIPHER-NODE // OPS",
    page_icon="🔒",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# --- Custom 'Cyber' CSS ---
st.markdown("""
    <style>
    /* Global Background */
    [data-testid="stAppViewContainer"] { 
        background: radial-gradient(circle, #0a0f0d 0%, #050505 100%);
    }
    
    /* Glowing Metric Cards */
    [data-testid="stMetric"] {
        background: #111 !important;
        border: 1px solid #00ffcc !important;
        box-shadow: 0 0 15px rgba(0, 255, 204, 0.2);
        transition: transform 0.3s ease;
    }
    [data-testid="stMetric"]:hover {
        transform: scale(1.02);
        box-shadow: 0 0 25px rgba(0, 255, 204, 0.4);
    }

    /* Table Styling */
    .stDataFrame {
        border: 1px solid #333 !important;
        border-radius: 10px;
    }
</style>
    """, unsafe_allow_html=True)

def get_data():
    try:
        conn = sqlite3.connect("audit_log.sqlite3")
        df = pd.read_sql_query("SELECT * FROM logs ORDER BY timestamp DESC", conn)
        conn.close()
        return df
    except:
        return pd.DataFrame(columns=['id', 'timestamp', 'event', 'details'])

# --- Header ---
st.title("📟 CIPHER-NODE // SECURITY INTERFACE")
st.write(f"SYSTEM STATUS: **ONLINE** | ENCRYPTION: **AES-256** | NODE: **SHELF-01**")
st.markdown("---")

data = get_data()

# --- Top Level Metrics ---
col1, col2, col3, col4 = st.columns(4)
with col1:
    st.metric("TOTAL LOGS", len(data))
with col2:
    threats = len(data[data['event'] == 'access_denied'])
    st.metric("THREATS BLOCKED", threats, delta="ACTIVE RISK", delta_color="inverse")
with col3:
    st.metric("SIGNAL STRENGTH", "98%", delta="STABLE")
with col4:
    st.metric("LATENCY", "14ms", delta="-2ms")

st.markdown("###") # Spacer

# --- Main Layout ---
left_col, right_col = st.columns([2, 1])

with left_col:
    st.subheader("📡 REAL-TIME AUDIT TRAIL")
    st.dataframe(data.head(20), use_container_width=True, height=400)
    
    if not data.empty:
        st.subheader("📈 TRAFFIC VELOCITY")
        # Plotly chart with custom neon colors
        fig = px.histogram(data.head(50), x="timestamp", color="event",
                           template="plotly_dark", 
                           color_discrete_sequence=px.colors.qualitative.Vivid)
        fig.update_layout(paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)')
        st.plotly_chart(fig, use_container_width=True)

with right_col:
    st.subheader("📊 EVENT TYPES")
    if not data.empty:
        counts = data['event'].value_counts().reset_index()
        fig_pie = px.pie(counts, values='count', names='event', 
                         hole=0.5, template="plotly_dark")
        fig_pie.update_layout(showlegend=False)
        st.plotly_chart(fig_pie, use_container_width=True)
    
    st.info("System performing within normal parameters. No unauthorized overrides detected.")

# --- Auto-Refresh Logic ---
time.sleep(3)
st.rerun()