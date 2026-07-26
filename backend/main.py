from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os
import io
import re
import hashlib
import random
import time

from dotenv import load_dotenv

# Load repo-root .env when running locally (Render uses dashboard env vars)
load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from preprocess import translate_to_english
from model import predict_text
from utils import detect_scam_keywords, extract_links, flag_suspicious_links
from speech import process_audio
from audio_io import save_upload_async, cleanup_temp_dir
from risk_engine import classify_risk
from sms_msg91 import normalize_phone_key, send_otp_sms

app = FastAPI(title="Aegis AI Backend")

_origins_raw = os.getenv("ALLOWED_ORIGINS", "*")
_allow_origins = (
    ["*"]
    if _origins_raw.strip() == "*"
    else [o.strip() for o in _origins_raw.split(",") if o.strip()]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ScanRequest(BaseModel):
    text: str
    sender: Optional[str] = None


class VishingTranscriptRequest(BaseModel):
    transcript: str
    phone_number: Optional[str] = None


class PhoneOtpSendRequest(BaseModel):
    phone: str
    email: Optional[str] = None


class PhoneOtpVerifyRequest(BaseModel):
    phone: str
    otp: str
    email: Optional[str] = None


# In-memory OTP store (use Redis/Supabase in production)
_phone_otp_store: dict[str, tuple[str, float]] = {}


@app.on_event("startup")
async def startup_event():
    import threading
    from speech import preload_whisper_model
    threading.Thread(target=preload_whisper_model, daemon=True).start()


@app.get("/")
def read_root():
    return {"status": "Aegis AI Backend is running securely."}

@app.get("/api/user/profile")
def get_user_profile(email: str = "guest@example.com", phone: Optional[str] = None):
    hash_obj = hashlib.md5(email.encode())
    hash_int = int(hash_obj.hexdigest(), 16)
    user_id = str(hash_int)[:9]

    if phone and phone.strip():
        display_phone = phone.strip()
    else:
        phone_part = str(hash_int)[9:19]
        if len(phone_part) < 10:
            phone_part = phone_part.ljust(10, "0")
        display_phone = f"(+1) {phone_part[:3]}-{phone_part[3:6]}-{phone_part[6:10]}"

    return {"user_id": user_id, "phone": display_phone}


@app.post("/api/auth/send-phone-otp")
def send_phone_otp(req: PhoneOtpSendRequest):
    phone = (req.phone or "").strip()
    if len(re.sub(r"\D", "", phone)) < 10:
        return {"ok": False, "error": "Invalid phone number — enter a 10-digit mobile number"}

    phone_key = normalize_phone_key(phone)
    code = f"{random.randint(100000, 999999)}"
    _phone_otp_store[phone_key] = (code, time.time() + 600)

    msg91_key = os.getenv("MSG91_AUTH_KEY")
    twilio_sid = os.getenv("TWILIO_ACCOUNT_SID")

    if msg91_key:
        sent, err = send_otp_sms(phone, code)
        if not sent:
            _phone_otp_store.pop(phone_key, None)
            return {"ok": False, "error": err or "Failed to send OTP via SMS"}
    elif twilio_sid:
        sent, err = _send_twilio_sms(phone, code)
        if not sent:
            _phone_otp_store.pop(phone_key, None)
            return {"ok": False, "error": err or "Failed to send OTP via SMS"}

    resp = {"ok": True, "message": "OTP sent to your phone"}
    if os.getenv("OTP_DEV_MODE", "false").lower() in ("1", "true", "yes"):
        resp["dev_otp"] = code
    return resp


def _send_twilio_sms(phone: str, code: str) -> tuple[bool, str | None]:
    """Optional Twilio fallback if MSG91 is not configured."""
    try:
        from twilio.rest import Client

        sid = os.getenv("TWILIO_ACCOUNT_SID")
        token = os.getenv("TWILIO_AUTH_TOKEN")
        from_number = os.getenv("TWILIO_PHONE_NUMBER")
        if not all([sid, token, from_number]):
            return False, "Twilio is not fully configured."

        mobile = normalize_phone_key(phone)
        to_number = f"+{mobile}" if not phone.strip().startswith("+") else phone.strip()

        client = Client(sid, token)
        client.messages.create(
            body=f"Your Aegis AI verification code is {code}. Valid for 10 minutes.",
            from_=from_number,
            to=to_number,
        )
        return True, None
    except ImportError:
        return False, "Twilio library not installed."
    except Exception as e:
        return False, str(e)


@app.post("/api/auth/verify-phone-otp")
def verify_phone_otp(req: PhoneOtpVerifyRequest):
    phone = normalize_phone_key((req.phone or "").strip())
    otp = (req.otp or "").strip()
    stored = _phone_otp_store.get(phone)
    if not stored:
        return {"ok": False, "error": "No OTP requested for this number. Send OTP again."}
    code, expires = stored
    if time.time() > expires:
        del _phone_otp_store[phone]
        return {"ok": False, "error": "OTP expired. Request a new code."}
    if otp != code:
        return {"ok": False, "error": "Invalid OTP"}
    del _phone_otp_store[phone]
    display = phone[2:] if phone.startswith("91") and len(phone) == 12 else phone
    return {"ok": True, "message": "Phone verified", "phone": display}

@app.post("/api/scan")
def scan_text(req: ScanRequest):
    try:
        return analyze_text(req.text, scan_links=True, sender=req.sender)
    except Exception as e:
        return {"error": f"Scan failed: {e}", "risk": "ERROR", "label": "error", "confidence": 0}


class FetchGmailRequest(BaseModel):
    email: str
    app_password: str


@app.post("/api/gmail/fetch")
def fetch_gmail_emails(req: FetchGmailRequest):
    import imaplib
    import email as email_lib
    from email.header import decode_header
    import socket
    import traceback
    import logging

    logger = logging.getLogger("aegis.gmail")

    username = req.email.strip()
    app_password = req.app_password.strip()

    if not username or not app_password:
        return {"error": "Gmail address and App Password are required.", "emails": []}

    # Validate email format
    if "@" not in username:
        return {"error": "Please enter a valid email address.", "emails": []}

    mail = None
    try:
        # Establish SSL connection to Gmail IMAP with timeout
        mail = imaplib.IMAP4_SSL("imap.gmail.com", timeout=30)
        mail.login(username, app_password)
    except imaplib.IMAP4.error as e:
        err_msg = str(e)
        logger.warning(f"IMAP login failed for {username}: {err_msg}")
        if "AUTHENTICATIONFAILED" in err_msg.upper() or "Invalid credentials" in err_msg:
            return {
                "error": "Authentication failed. Please check your Gmail address and App Password. "
                         "Make sure you're using a 16-character App Password, not your regular Gmail password.",
                "emails": []
            }
        return {"error": f"Gmail login failed: {err_msg}", "emails": []}
    except socket.timeout:
        logger.warning(f"IMAP connection timed out for {username}")
        return {"error": "Connection to Gmail timed out. Please try again.", "emails": []}
    except socket.gaierror as e:
        logger.warning(f"DNS resolution failed for imap.gmail.com: {e}")
        return {"error": "Cannot resolve imap.gmail.com. Server may have network restrictions.", "emails": []}
    except ConnectionRefusedError:
        logger.warning("IMAP connection refused")
        return {"error": "Connection to Gmail was refused. The server may block outbound IMAP connections.", "emails": []}
    except OSError as e:
        logger.warning(f"IMAP OS-level connection error: {e}")
        return {"error": f"Network error connecting to Gmail: {str(e)}", "emails": []}
    except Exception as e:
        logger.error(f"Unexpected IMAP connection error: {traceback.format_exc()}")
        return {"error": f"Failed to connect to Gmail: {str(e)}", "emails": []}

    try:
        mail.select("inbox")
        # Search for all emails
        status, messages = mail.search(None, "ALL")
        if status != "OK":
            return {"error": "Failed to search inbox.", "emails": []}

        email_ids = messages[0].split()

        if not email_ids:
            mail.close()
            mail.logout()
            return {"emails": []}

        # Fetch the last 5 emails
        latest_email_ids = email_ids[-5:]
        fetched_emails = []

        for idx, e_id in enumerate(reversed(latest_email_ids)):
            try:
                res, msg_data = mail.fetch(e_id, "(RFC822)")
                if res != "OK":
                    continue
                for response_part in msg_data:
                    if isinstance(response_part, tuple):
                        msg = email_lib.message_from_bytes(response_part[1])

                        # Decode subject
                        subject = "No Subject"
                        if msg["Subject"]:
                            try:
                                subject_parts = decode_header(msg["Subject"])
                                decoded_parts = []
                                for part, encoding in subject_parts:
                                    if isinstance(part, bytes):
                                        decoded_parts.append(part.decode(encoding if encoding else "utf-8", errors="ignore"))
                                    else:
                                        decoded_parts.append(str(part))
                                subject = "".join(decoded_parts)
                            except Exception:
                                subject = str(msg["Subject"])

                        # Decode from address
                        from_address = "Unknown Sender"
                        if msg["From"]:
                            try:
                                from_parts = decode_header(msg["From"])
                                decoded_parts = []
                                for part, encoding in from_parts:
                                    if isinstance(part, bytes):
                                        decoded_parts.append(part.decode(encoding if encoding else "utf-8", errors="ignore"))
                                    else:
                                        decoded_parts.append(str(part))
                                from_address = "".join(decoded_parts)
                            except Exception:
                                from_address = str(msg["From"])

                        # Get email body
                        body = ""
                        if msg.is_multipart():
                            for part in msg.walk():
                                content_type = part.get_content_type()
                                content_disposition = str(part.get("Content-Disposition"))
                                if content_type == "text/plain" and "attachment" not in content_disposition:
                                    try:
                                        payload = part.get_payload(decode=True)
                                        if payload:
                                            body = payload.decode("utf-8", errors="ignore")
                                    except Exception:
                                        pass
                                    break
                        else:
                            try:
                                payload = msg.get_payload(decode=True)
                                if payload:
                                    body = payload.decode("utf-8", errors="ignore")
                            except Exception:
                                pass

                        # Limit the body length for scan preview
                        snippet = body[:500] if body else "No readable text content."

                        fetched_emails.append({
                            "id": f"gmail_{idx}_{e_id.decode()}",
                            "from": from_address,
                            "subject": subject,
                            "body": snippet,
                            "status": "PENDING",
                            "result": None
                        })
            except Exception as inner_e:
                logger.warning(f"Failed to parse email {e_id}: {inner_e}")
                continue

        mail.close()
        mail.logout()
        return {"emails": fetched_emails}
    except Exception as e:
        logger.error(f"Failed to fetch emails: {traceback.format_exc()}")
        try:
            mail.close()
            mail.logout()
        except Exception:
            pass
        return {"error": f"Failed to fetch emails: {type(e).__name__}: {str(e)}", "emails": []}


class FetchGmailOAuthRequest(BaseModel):
    access_token: str


@app.post("/api/gmail/fetch-oauth")
def fetch_gmail_emails_oauth(req: FetchGmailOAuthRequest):
    import requests

    access_token = req.access_token.strip()
    if not access_token:
        return {"error": "Access token is required.", "emails": []}

    headers = {"Authorization": f"Bearer {access_token}"}

    try:
        # Step 1: List the latest 5 messages from Gmail inbox
        list_url = "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5&q=is:inbox"
        res = requests.get(list_url, headers=headers)
        if res.status_code != 200:
            return {"error": f"Failed to list messages: {res.json().get('error', {}).get('message', 'Unknown error')}", "emails": []}

        messages_data = res.json()
        messages = messages_data.get("messages", [])

        if not messages:
            return {"emails": []}

        fetched_emails = []

        # Step 2: Fetch details for each message
        for idx, msg_meta in enumerate(messages):
            msg_id = msg_meta["id"]
            detail_url = f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{msg_id}?format=full"
            detail_res = requests.get(detail_url, headers=headers)
            
            if detail_res.status_code == 200:
                msg_data = detail_res.json()
                
                # Extract headers
                headers_list = msg_data.get("payload", {}).get("headers", [])
                subject = "No Subject"
                from_address = "Unknown Sender"
                
                for h in headers_list:
                    if h["name"].lower() == "subject":
                        subject = h["value"]
                    elif h["name"].lower() == "from":
                        from_address = h["value"]
                
                # Extract body snippet
                body_snippet = msg_data.get("snippet", "No preview available.")
                
                fetched_emails.append({
                    "id": f"gmail_oauth_{idx}_{msg_id}",
                    "from": from_address,
                    "subject": subject,
                    "body": body_snippet,
                    "status": "PENDING",
                    "result": None
                })
        
        return {"emails": fetched_emails}

    except Exception as e:
        return {"error": f"Failed to fetch Gmail REST API: {str(e)}", "emails": []}


@app.post("/api/vishing/analyze-transcript")
def analyze_vishing_transcript(req: VishingTranscriptRequest):
    """Analyze call transcript for vishing (mobile-friendly, no large audio upload)."""
    t = (req.transcript or "").strip()
    if len(t) < 3:
        return {"error": "Transcript too short", "status": 400}
    result = analyze_text(t, scan_links=False, source="vishing")
    result["phone_number"] = req.phone_number
    result["source"] = "vishing_transcript"
    return result


async def _transcribe_upload(file: UploadFile, fast: bool = False):
    import asyncio
    from functools import partial

    temp_dir = None
    temp_path = None
    try:
        temp_path, temp_dir = await save_upload_async(file)
        loop = asyncio.get_running_loop()
        fn = partial(process_audio, temp_path, fast=fast)
        audio_result = await loop.run_in_executor(None, fn)
        text = audio_result[0]
        method = audio_result[1] if len(audio_result) > 1 else ""
        lang = audio_result[2] if len(audio_result) > 2 else ""
        return text, method, lang, None
    except ValueError as e:
        return None, None, None, str(e)
    except Exception as e:
        return None, None, None, f"Audio processing failed: {e}"
    finally:
        if temp_dir:
            cleanup_temp_dir(temp_dir)


@app.post("/api/transcribe-audio")
async def transcribe_audio(file: UploadFile = File(...), fast: bool = True):
    """Transcribe only — fast=True uses Google Speech on a trimmed clip (Call Guard)."""
    text, method, lang, err = await _transcribe_upload(file, fast=fast)
    if err:
        return {"error": err, "transcription": None, "status": 400}
    if text and not str(text).startswith("Error"):
        out = {"transcription": text, "method": method}
        if lang:
            out["detected_language"] = lang
        return out
    err_msg = text or "No speech detected. Use speakerphone during the call."
    if str(err_msg).startswith("Error:"):
        err_msg = str(err_msg)[6:].strip()
    return {"error": err_msg, "transcription": None, "status": 400}


@app.post("/api/call-guard/analyze")
async def call_guard_analyze(
    file: UploadFile = File(...),
    phone: Optional[str] = Form(None),
):
    """One request: fast transcribe + scam analysis (avoids double round-trip timeouts)."""
    text, method, lang, err = await _transcribe_upload(file, fast=True)
    if err:
        return {"error": err, "risk": "ERROR", "label": "error", "confidence": 0, "status": 400}
    if not text or str(text).startswith("Error"):
        err_msg = text or "No speech detected."
        if str(err_msg).startswith("Error:"):
            err_msg = str(err_msg)[6:].strip()
        return {
            "error": err_msg,
            "risk": "ERROR",
            "label": "error",
            "confidence": 0,
            "status": 400,
            "transcription": None,
        }
    result = analyze_text(text, scan_links=False, source="call_guard")
    result["transcription"] = text
    result["method"] = method
    result["phone_number"] = phone
    result["source"] = "call_guard"
    if lang or text:
        from language_utils import normalize_stt_language

        result["detected_language"] = normalize_stt_language(lang, text)
    return result


@app.post("/api/scan-audio")
async def scan_audio(file: UploadFile = File(...)):
    transcribed_text, method, detected_lang, err = await _transcribe_upload(file, fast=False)
    if err:
        return {
            "error": err,
            "risk": "ERROR",
            "label": "error",
            "confidence": 0,
            "status": 400,
        }

    if transcribed_text and not str(transcribed_text).startswith("Error"):
        try:
            result = analyze_text(transcribed_text, scan_links=False, source="vishing")
        except Exception as e:
            return {
                "error": f"Analysis failed after transcription: {e}",
                "transcription": transcribed_text,
                "method": method,
                "risk": "ERROR",
                "label": "error",
                "confidence": 0,
            }
        result["transcription"] = transcribed_text
        result["method"] = method
        if detected_lang or transcribed_text:
            from language_utils import normalize_stt_language

            result["detected_language"] = normalize_stt_language(detected_lang, transcribed_text)
        return result

    err_msg = transcribed_text or "No speech detected in audio."
    if str(err_msg).startswith("Error:"):
        err_msg = str(err_msg)[6:].strip()
    return {
        "error": err_msg,
        "risk": "ERROR",
        "label": "error",
        "confidence": 0,
        "status": 400,
    }

        

def analyze_text(text: str, scan_links=False, sender: str | None = None, source: str | None = None):
    if not text or not str(text).strip():
        return {"error": "Empty text", "risk": "ERROR", "label": "error", "confidence": 0}

    from language_utils import detect_text_language

    english_text = translate_to_english(text)
    is_translated = (english_text != text)

    if not english_text or not str(english_text).strip():
        return {"error": "Could not process text", "risk": "ERROR", "label": "error", "confidence": 0}

    prediction_label, confidence = predict_text(english_text)
    # Scan both original and translated text for regional scam phrases
    kw_en = detect_scam_keywords(english_text)
    kw_orig = detect_scam_keywords(text) if text != english_text else []
    detected_keywords = list(dict.fromkeys(kw_en + kw_orig))

    suspicious_links = []
    if scan_links:
        all_links = extract_links(english_text) + extract_links(text)
        all_links = list(dict.fromkeys(all_links))
        suspicious_links = flag_suspicious_links(all_links)

    final_status, reason, display_label = classify_risk(
        prediction_label,
        confidence,
        detected_keywords,
        suspicious_links,
        scan_links,
        text,
        english_text,
        sender=sender,
        source=source,
    )

    detected_language = detect_text_language(text)

    return {
        "label": display_label,
        "risk": final_status,
        "confidence": confidence / 100.0,
        "reason": reason,
        "detected_keywords": detected_keywords,
        "suspicious_links": suspicious_links,
        "is_translated": is_translated,
        "english_text": english_text,
        "detected_language": detected_language,
        "sender": sender,
    }
