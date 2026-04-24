import re
import os
import requests
import base64
from cryptography.fernet import Fernet
from dotenv import load_dotenv

load_dotenv()
VT_API_KEY = os.getenv("VIRUSTOTAL_API_KEY")

# --- Encryption Utils ---
# We use cryptography.fernet to encrypt our dummy dataset so it cannot be easily "Ctrl+F"ed by a hacker

KEY_FILE = "secret.key"

def generate_key():
    """Generates a key and saves it into a file"""
    if not os.path.exists(KEY_FILE):
        key = Fernet.generate_key()
        with open(KEY_FILE, "wb") as key_file:
            key_file.write(key)

def load_key():
    """Loads the key from the current directory named `secret.key`"""
    return open(KEY_FILE, "rb").read()

def encrypt_file(filename, output_filename=None):
    """Encrypts a file explicitly"""
    key = load_key()
    f = Fernet(key)
    with open(filename, "rb") as file:
        file_data = file.read()
    encrypted_data = f.encrypt(file_data)
    out = output_filename if output_filename else filename
    with open(out, "wb") as file:
        file.write(encrypted_data)

def decrypt_file_to_memory(filename):
    """Decrypts a file and returns its content in memory as string"""
    key = load_key()
    f = Fernet(key)
    with open(filename, "rb") as file:
        encrypted_data = file.read()
    decrypted_data = f.decrypt(encrypted_data)
    return decrypted_data.decode('utf-8')

# --- Keyword & Link Extraction Utils ---

SCAM_KEYWORDS = [
    "otp", "urgent", "verify now", "bank account", "lottery", "kyc", 
    "password", "winner", "claim", "free money", "act now", "suspended",
    "limited time", "gift card", "crypto", "bitcoin",
    "scan to receive", "enter pin to receive", "verification fee",
    "cashback claim", "refund failure", "qr code verification",
    "merchant payment failed", "pay to open account"
]

SUSPICIOUS_DOMAINS = ["bit.ly", "tinyurl.com", "goo.gl", "t.co", "ow.ly", "is.gd"]

def detect_scam_keywords(text):
    """Detect common scam keywords in text."""
    text_lower = text.lower()
    detected = [word for word in SCAM_KEYWORDS if word in text_lower]
    return detected

def extract_links(text):
    """Extract URLs from text using regex."""
    url_pattern = re.compile(r'https?://(?:[-\w.]|(?:%[\da-fA-F]{2}))+')
    links = url_pattern.findall(text)
    return links

def flag_suspicious_links(links):
    """Check if links belong to known suspicious domains / link shorteners, or flag via VirusTotal."""
    suspicious = []
    
    # Fast check known dangerous/shortened domains
    for link in links:
        if any(domain in link for domain in SUSPICIOUS_DOMAINS):
            if link not in suspicious:
                suspicious.append(link)
                
    # Use VirusTotal if API key is provided and links exist
    if VT_API_KEY and links:
        headers = {"x-apikey": VT_API_KEY}
        for link in links:
            if link in suspicious:
                continue
            
            try:
                # VirusTotal requires URL-safe base64 encoded strings without padding
                url_id = base64.urlsafe_b64encode(link.encode()).decode().strip("=")
                vt_url = f"https://www.virustotal.com/api/v3/urls/{url_id}"
                
                resp = requests.get(vt_url, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    analysis = data.get("data", {}).get("attributes", {}).get("last_analysis_stats", {})
                    if analysis.get("malicious", 0) > 0 or analysis.get("suspicious", 0) > 1:
                        suspicious.append(link)
            except Exception as e:
                print(f"VT API Error for {link}: {e}")
                
    return suspicious

# --- Social Engineering Susceptibility Utils ---

def calculate_susceptibility_score(scores):
    """
    scores: list of 7 risk values chosen in the survey.
    Returns: Score 0-100 and level (str)
    """
    total_risk = sum(scores)
    
    # max possible from new questions: 30(q1) + 40(q2) + 40(q3) + 30(q4) + 30(q5) + 30(q6) + 30(q7) = 230
    max_possible_risk = 230 
    
    risk_score = (total_risk / max_possible_risk) * 100
    
    if risk_score <= 15:
        level = "LOW RISK"
    elif risk_score <= 40:
        level = "MEDIUM RISK"
    elif risk_score <= 75:
        level = "HIGH RISK"
    else:
        level = "CRITICAL RISK"
        
    return int(risk_score), level
