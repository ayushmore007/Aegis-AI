import streamlit as st
import requests
import json

# Automatically loads secrets from .streamlit/secrets.toml
SUPABASE_URL = st.secrets["supabase"]["url"]
SUPABASE_KEY = st.secrets["supabase"]["key"]

# Base REST headers mapping to the Anon Key
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

def init_db():
    pass

def create_user(first_name, last_name, email, password):
    """Register a new user directly into Supabase Auth via REST."""
    url = f"{SUPABASE_URL}/auth/v1/signup"
    data = {
        "email": email, 
        "password": password,
        "data": {
            "first_name": first_name,
            "last_name": last_name
        }
    }
    try:
        response = requests.post(url, headers=HEADERS, json=data)
        if response.status_code in [200, 201]:
            return True, "Account registered natively."
        err_msg = response.json().get("msg", response.json().get("message", "Registration rejected by Cloud."))
        return False, err_msg
    except Exception as e:
        return False, f"Network fault: {e}"

def verify_user(email, password):
    """Authenticate via Supabase Auth REST and cache JWT Tokens."""
    url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
    data = {"email": email, "password": password}
    try:
        response = requests.post(url, headers=HEADERS, json=data)
        if response.status_code == 200:
            json_data = response.json()
            st.session_state['sb_access'] = json_data['access_token']
            st.session_state['sb_user_id'] = json_data['user']['id']
            st.session_state['sb_user_meta'] = json_data['user'].get('user_metadata', {})
            return True, "Success"
        err_msg = response.json().get('error_description', 'Invalid Credentials.')
        return False, err_msg
    except Exception as e:
        return False, f"Network fault: {e}"

def update_risk_score(email, score):
    """Pushes updated risk score to Supabase via REST UPSERT."""
    access = st.session_state.get('sb_access')
    user_id = st.session_state.get('sb_user_id')
    
    if not access or not user_id:
        return
        
    url = f"{SUPABASE_URL}/rest/v1/profiles"
    auth_headers = HEADERS.copy()
    auth_headers["Authorization"] = f"Bearer {access}"
    # Upsert directive
    auth_headers["Prefer"] = "resolution=merge-duplicates"
    
    data = {
        "id": user_id, 
        "email": email, 
        "risk_score": score
    }
    
    try:
        requests.post(url, headers=auth_headers, json=data)
    except Exception:
        st.error("Secure Cloud Data Sync Interrupted.")

def get_risk_score(email):
    """Retrieve a specific user's risk score natively from Supabase."""
    url = f"{SUPABASE_URL}/rest/v1/profiles?email=eq.{email}&select=risk_score"
    try:
        response = requests.get(url, headers=HEADERS)
        if response.status_code == 200:
            data = response.json()
            if data:
                return data[0].get("risk_score", 0)
        return 0
    except Exception:
        return 0

def get_all_profiles():
    """Retrieve all profiles from Supabase to construct the global Admin Dashboard."""
    url = f"{SUPABASE_URL}/rest/v1/profiles?select=*"
    try:
        response = requests.get(url, headers=HEADERS)
        if response.status_code == 200:
            return response.json()
        return []
    except Exception:
        return []
