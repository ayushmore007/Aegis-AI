"""
Legitimate daily-use message detection — reduces false positives on bank OTPs,
UPI alerts, delivery updates, and other transactional SMS/notifications.
"""
import re

# Scammer explicitly asking for OTP/credentials — always treat as risky
_SCAM_REQUEST_PATTERNS = [
    r"share\s+(your|the|this|my)?\s*otp",
    r"send\s+(me|us|your|the)\s*otp",
    r"reply\s+with\s+(your|the)\s*otp",
    r"tell\s+(me|us)\s+(your|the)\s*otp",
    r"forward\s+(the|your)\s*otp",
    r"read\s+(out|me)\s+(the|your)\s*otp",
    r"what\s+is\s+(the|your)\s*otp",
    r"give\s+(me|us)\s+(your|the)\s*otp",
    r"otp\s+(bhejo|bhej|dedo|de do|bhej do)",
    r"otp\s+(share|send)\s+karo",
    r"enter\s+(your|the)\s*(otp|pin|cvv|password)\s+(here|below|on)",
    r"verify\s+by\s+(sending|sharing|entering)\s+(your|the)\s*otp",
    r"press\s+\d+\s+and\s+(share|send|enter)",
]

# Official OTP / verification notifications (SMS/app)
_LEGIT_OTP_PATTERNS = [
    r"\botp\b.{0,60}\b(do not share|don't share|never share|not share|is confidential)",
    r"\b(do not share|don't share|never share).{0,40}\botp\b",
    r"\botp\b.{0,30}\b(for|is|:|-)\b.{0,40}\b(login|sign[- ]?in|transaction|payment|verification|register)",
    r"\b(one[- ]time password|verification code|security code)\b.{0,40}\b(is|:|\d)",
    r"\b\d{4,8}\b.{0,30}\b(is your|is the)\b.{0,20}\b(otp|code|password|pin)\b",
    r"\b(otp|code|pin)\b.{0,20}\b(is|:|\-)\b.{0,10}\d{4,8}\b",
    r"\bvalid for \d+\s*(min|minutes|sec|seconds|hour)",
    r"\b(otp|code)\b.{0,40}\b(expires|valid till|valid until)\b",
    r"-\s*[A-Z]{2,12}\s*$",  # sender suffix e.g. -SBIACS, -HDFCBK
    r"\b(never ask|will never ask|do not disclose|never share|do not share|don't share)\b.{0,30}\b(otp|pin|password)\b",
    # Hindi / Hinglish legitimate OTP templates
    r"otp.{0,40}(share mat|mat karein|na karein|disclose mat)",
    r"(share mat|mat karo|disclose mat).{0,40}otp",
]

# Daily transactional / informational messages
_LEGIT_TRANSACTIONAL_PATTERNS = [
    r"\bout for delivery\b",
    r"\bhas been delivered\b",
    r"\border (confirmed|shipped|placed|dispatched)\b",
    r"\btrack(ing)? (your )?order\b",
    r"\bpayment of (rs\.?|inr)\b",
    r"\b(rs\.?|inr)\s*[\d,]+.{0,40}\b(credited|debited|received|paid|transferred)\b",
    r"\b(successfully|has been) (credited|debited)\b",
    r"\bupi ref( no)?\.?\s*[:\s]?\w+",
    r"\b(imps|neft|rtgs)\b.{0,40}\b(credited|debited|ref)\b",
    r"\baccount (ending|xx|x{2,})\b.{0,40}\b(credited|debited)\b",
    r"\b(electricity|water|gas|mobile|broadband|dth)\b.{0,40}\bbill\b",
    r"\brecharge (successful|done|completed)\b",
    r"\b(appointment|booking) (confirmed|reminder)\b",
    r"\b(flight|train|bus|cab)\b.{0,40}\b(confirmed|booked|scheduled)\b",
    r"\b(amazon|flipkart|swiggy|zomato|blinkit|myntra|meesho)\b.{0,50}\b(order|delivery|shipped)\b",
    r"\b(weather|forecast|news alert|rain|rainfall|monsoon|storm|thunderstorm|lightning|warning|cyclone|flood|heavy rain|disaster|alert)\b",
    r"(पुढील\s+\d+\s+तासात|पावसाची\s+शक्यता|मेघगर्जना|विजांच्या|पाऊस\s+पडण्याची|जोरदार\s+पाऊस|हवामान|अंदाज)",
    r"\b(thank you for|thanks for) (shopping|ordering|using|paying)\b",
    r"\bstatement (for|of)\b.{0,30}\b(account|card)\b",
    r"\b(minimum due|total due|amount due)\b.{0,40}\b(card|account)\b",
    r"\b(aadhaar|pan)\b.{0,40}\b(updated|linked|verified)\b.{0,30}\b(successfully|complete)\b",
]

# Telecom / carrier usage alerts and recharge reminders (not credential theft)
_LEGIT_TELECOM_PATTERNS = [
    r"\b(data|internet|high[- ]?speed)\b.{0,50}\b(consumed|used|exhausted|remaining|left|balance)\b",
    r"\b\d+\s*%\s*[:\-]?\s*(of\s+)?(daily|monthly)?\s*(data|internet|high[- ]?speed)\b",
    r"\b\d+\s*(gb|mb)\b.{0,40}\b(remaining|left|consumed|used|valid|per day)\b",
    r"\b(recharge|top[- ]?up|renew|validity|plan)\b.{0,50}\b(now|today|before|expires|expiring)\b",
    r"\b(recharge successful|recharge done|pack activated|plan activated)\b",
    r"\b(valid (till|until|upto|for)|validity)\b.{0,30}\b(\d|day|month|year)\b",
    r"\b(airtel|jio|vi\b|vodafone|idea|bsnl)\b.{0,60}\b(data|recharge|plan|offer|pack|bill)\b",
    r"\b(alert|notification|reminder)\b.{0,40}\b(data|recharge|validity|bill|usage)\b",
    r"\bpostpaid|prepaid\b.{0,40}\b(bill|due|payment|recharge)\b",
    r"\b(free|bonus|extra)\s+\d+\s*(gb|mb|sms|min)\b",
    r"\b(unlimited|daily)\s+(data|calls|sms)\b",
    r"\bi\.airtel\.in\b",
    r"\bairtel\.in\b",
    r"\bjio\.com\b",
    r"\bmyvi\.in\b",
    r"\b(available to take calls|missed call alert|is now available|now available to take calls|missed call)\b",
    # Hindi / Hinglish carrier templates
    r"data.{0,30}(khatam|khatm|khatam ho|khatam ho gaya|use ho gaya|bacha|baki)",
    r"recharge.{0,30}(karo|kar lo|karein|abhi)",
    r"pack.{0,30}(expire|khatam|renew)",
    r"validity.{0,20}(khatam|expire|baki)",
    # Marathi carrier templates
    r"data.{0,30}(संप|संपला|उरले|वापर)",
    r"recharge.{0,30}(करा|लवकर)",
]

# Brand offers / marketing — informational, not scam alerts
_PROMOTIONAL_PATTERNS = [
    r"\b(special offer|exclusive offer|limited offer|festive offer|mega offer)\b",
    r"\b(\d+\s*%\s*off|flat \d+%|upto \d+%|up to \d+%)\b",
    r"\b(sale|discount|cashback|deal of the day|flash sale)\b",
    r"\bshop now\b",
    r"\b(buy now|order now)\b.{0,30}\b(offer|sale|discount)\b",
    r"\b(new plan|new pack|upgrade plan|add[- ]?on)\b",
]

# Hindi / Marathi transactional
_LEGIT_REGIONAL_PATTERNS = [
    r"delivery",
    r"order",
    r"payment",
    r"credited",
    r"debited",
    r"bill",
    r"recharge",
    r"confirm",
]


def _matches_any(text: str, patterns: list[str]) -> bool:
    for pat in patterns:
        if re.search(pat, text, re.I | re.UNICODE):
            return True
    return False


def is_scam_credential_request(text: str) -> bool:
    """Caller/message explicitly asks user to share OTP or secrets."""
    if not text or not text.strip():
        return False
    lower = text.lower()
    if re.search(r"(never share|do not share|don't share|not share).{0,15}otp", lower):
        return False
    if is_legitimate_otp_notification(text):
        return False
    return _matches_any(text, _SCAM_REQUEST_PATTERNS)


def is_legitimate_otp_notification(text: str) -> bool:
    """Bank/app OTP delivery — not a scam request."""
    if not text or not text.strip():
        return False
    lower = text.lower()
    has_otp_signal = bool(
        re.search(r"\botp\b", lower)
        or re.search(r"\b(one[- ]time password|verification code|security code)\b", lower, re.I)
        or re.search(r"\b\d{4,8}\b", text)
    )
    if not has_otp_signal:
        return False
    return _matches_any(text, _LEGIT_OTP_PATTERNS)


def is_legitimate_telecom_message(text: str) -> bool:
    """Carrier data usage, recharge reminders, plan validity — not scams."""
    if not text or not text.strip():
        return False
    if is_scam_credential_request(text):
        return False
    return _matches_any(text, _LEGIT_TELECOM_PATTERNS)


def is_promotional_only(text: str) -> bool:
    """Marketing / offers without credential theft signals."""
    if not text or not text.strip():
        return False
    if is_scam_credential_request(text):
        return False
    lower = text.lower()
    scam_combo = (
        "share otp", "send otp", "verify account", "account blocked",
        "account suspended", "kyc expired", "legal action", "arrest",
        "customs seized", "lottery winner", "claim prize",
    )
    if any(s in lower for s in scam_combo):
        return False
    return _matches_any(text, _PROMOTIONAL_PATTERNS) or is_legitimate_telecom_message(text)


def is_legitimate_transactional(text: str) -> bool:
    """Delivery, payment, bill, booking confirmations."""
    if not text or not text.strip():
        return False
    if is_scam_credential_request(text):
        return False
    if is_legitimate_telecom_message(text):
        return True
    if _matches_any(text, _LEGIT_TRANSACTIONAL_PATTERNS):
        return True
    # Short informational with amount + no links asking action
    if re.search(r"(rs\.?|inr)\s*[\d,]+", text, re.I) and not re.search(
        r"https?://|click (here|link)|verify now|share otp", text, re.I
    ):
        if re.search(r"(credited|debited|received|paid|ref)", text, re.I):
            return True
    return False


def is_legitimate_service_message(text: str) -> bool:
    """
    True for everyday legitimate SMS/notifications that should not be flagged as scam.
    Scam credential requests always return False.
    """
    if not text or not len(text.strip()) >= 3:
        return False
    if is_scam_credential_request(text):
        return False
    if is_legitimate_otp_notification(text):
        return True
    if is_legitimate_transactional(text):
        return True
    if is_legitimate_telecom_message(text):
        return True
    if is_promotional_only(text):
        return True
    return False


def filter_keywords_for_context(text: str, keywords: list[str]) -> list[str]:
    """
    Remove contextual keywords (otp, kyc) when message matches legitimate patterns.
    Keeps high-risk phrases even on borderline messages.
    """
    if not keywords:
        return []
    if is_legitimate_service_message(text):
        return []
    contextual = {"otp", "kyc", "password", "urgent", "verify now", "bank account"}
    high = [k for k in keywords if k not in contextual]
    if high:
        return high
    # Single contextual keyword on non-legit message — keep for suspicious tier
    return keywords
