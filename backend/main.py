from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import io
import hashlib

from preprocess import translate_to_english
from model import predict_text
from utils import detect_scam_keywords, extract_links, flag_suspicious_links
from speech import process_audio, save_uploaded_audio

app = FastAPI(title="Aegis AI Backend")

# Allow CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ScanRequest(BaseModel):
    text: str

@app.get("/")
def read_root():
    return {"status": "Aegis AI Backend is running securely."}

@app.get("/api/user/profile")
def get_user_profile(email: str = "guest@example.com"):
    # Generate a consistent "genuine" looking user id and phone number based on email
    hash_obj = hashlib.md5(email.encode())
    hash_int = int(hash_obj.hexdigest(), 16)
    
    user_id = str(hash_int)[:9] # 9 digit user ID
    
    # Generate a phone number based on another part of the hash
    phone_part = str(hash_int)[9:19]
    if len(phone_part) < 10:
        phone_part = phone_part.ljust(10, '0')
    phone = f"(+1) {phone_part[:3]}-{phone_part[3:6]}-{phone_part[6:10]}"
    
    return {
        "user_id": user_id,
        "phone": phone
    }

@app.post("/api/scan")
def scan_text(req: ScanRequest):
    return analyze_text(req.text, scan_links=True)

@app.post("/api/scan-audio")
async def scan_audio(file: UploadFile = File(...)):
    # Save the uploaded file temporarily using async read
    temp_path = f"temp_{file.filename}"
    with open(temp_path, "wb") as f:
        content = await file.read()
        f.write(content)
        
    try:
        # Prevent Thread Blocking! 
        # Whisper transcription is extremely CPU heavy and synchronous. 
        # If we run it directly in an `async def` route, it freezes the entire FastAPI event loop,
        # which causes the UI fetch to hang indefinitely!
        import asyncio
        loop = asyncio.get_running_loop()
        transcribed_text, method = await loop.run_in_executor(None, process_audio, temp_path)
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return {"error": str(e), "status": 500}
        
    if os.path.exists(temp_path):
        os.remove(temp_path)
        
    if transcribed_text and not transcribed_text.startswith("Error"):
        # Text analysis is fast enough, but we should probably background it too
        result = analyze_text(transcribed_text, scan_links=False)
        result["transcription"] = transcribed_text
        result["method"] = method
        return result
    else:
        return {"error": transcribed_text, "status": 500}

        

def analyze_text(text: str, scan_links=False):
    if not text.strip():
        return {"error": "Empty text"}
        
    english_text = translate_to_english(text)
    is_translated = (english_text != text)
    
    # 1. ML Prediction
    prediction_label, confidence = predict_text(english_text)
    
    # 2. Keyword detection
    detected_keywords = detect_scam_keywords(english_text)
    
    # 3. Link Extraction
    suspicious_links = []
    all_links = []
    if scan_links:
        all_links = extract_links(english_text)
        suspicious_links = flag_suspicious_links(all_links)
        
    # Determine Risk Status
    final_status = "SAFE"
    reason = "No malicious patterns or external links detected. Message appears genuine."
    
    if prediction_label == "phishing" or len(detected_keywords) > 2 or (scan_links and len(suspicious_links) > 0):
        final_status = "SCAM"
        reason = "Multiple high-risk fraud signatures identified including predatory phrasing or malicious links."
    elif len(detected_keywords) > 0 or prediction_label == "phishing":
        final_status = "SUSPICIOUS"
        reason = "Some suspicious urgency or keywords detected. Exercise high caution."
    elif confidence < 60:
        final_status = "SUSPICIOUS"
        reason = "AI confidence is low or slightly alarming phrasing detected."
        
    return {
        "label": prediction_label,
        "risk": final_status,
        "confidence": confidence / 100.0, # Normalizing max 1.0 for frontend UI
        "reason": reason,
        "detected_keywords": detected_keywords,
        "suspicious_links": suspicious_links,
        "is_translated": is_translated,
        "english_text": english_text
    }
