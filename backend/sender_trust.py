"""
Trusted SMS sender IDs (Indian DLT headers) and official brand domains.
Used to reduce false positives on carrier, bank, and delivery notifications.
"""
import re

# DLT / sender-id fragments (matched against SMS originating address)
_TRUSTED_SENDER_FRAGMENTS = [
    "AIRTEL", "JIO", "JIOINF", "VI-", "VICARE", "IDEA", "BSNL",
    "HDFCBK", "SBIACS", "ICICIB", "AXISBK", "KOTAKB", "PNBSMS",
    "PAYTMB", "PHONEPE", "GPAY", "AMAZON", "FLPKRT", "SWIGGY",
    "ZOMATO", "BLINKT", "MYNTRA", "MEESHO", "FEDEX", "BLUEDT",
    "DTDC", "INDPOST", "NPCI", "UIDAI", "GOVTIN", "ITDEPT",
    "TRAI", "DOTGOI", "NSE", "BSE", "SEBI", "IRCTC", "OLACAB",
    "UBERIN", "RAPIDO", "DMART", "BIGBKT", "NYKAA", "LIC",
    "NDMA", "GOVT",
]

_TRUSTED_SENDER_RE = re.compile(
    r"(?:" + "|".join(re.escape(s) for s in _TRUSTED_SENDER_FRAGMENTS) + r")",
    re.I,
)

# Official domains — links from these are not treated as suspicious shorteners
TRUSTED_LINK_DOMAINS = [
    "airtel.in", "jio.com", "myvi.in", "bsnl.in", "paytm.com", "phonepe.com",
    "amazon.in", "flipkart.com", "swiggy.com", "zomato.com", "blinkit.com",
    "myntra.com", "meesho.com", "hdfcbank.com", "icicibank.com", "sbi.co.in",
    "axisbank.com", "kotak.com", "google.com", "g.co", "apple.com",
    "uidai.gov.in", "gov.in", "nic.in", "irctc.co.in", "npci.org.in",
    "olacabs.com", "uber.com", "rapido.bike", "licindia.in",
]


def normalize_sender(sender: str | None) -> str:
    if not sender:
        return ""
    return re.sub(r"[\s\-_]+", "", sender.strip().upper())


def is_trusted_sender(sender: str | None) -> bool:
    """True for known DLT headers like AD-AIRTEL-S, JD-JIOINF, VM-ViCARE."""
    s = normalize_sender(sender)
    if not s or len(s) < 3:
        return False
    return bool(_TRUSTED_SENDER_RE.search(s))


def is_trusted_link(url: str) -> bool:
    lower = (url or "").lower()
    return any(domain in lower for domain in TRUSTED_LINK_DOMAINS)


def sender_category(sender: str | None) -> str | None:
    """Rough category for logging / reason strings."""
    s = normalize_sender(sender)
    if not s:
        return None
    if re.search(r"AIRTEL|JIO|JIOINF|VI|VICARE|IDEA|BSNL", s, re.I):
        return "telecom"
    if re.search(r"HDFC|SBI|ICICI|AXIS|KOTAK|PNB|BANK", s, re.I):
        return "bank"
    if re.search(r"PAYTM|PHONEPE|GPAY|NPCI", s, re.I):
        return "payment"
    if re.search(r"AMAZON|FLPKRT|SWIGGY|ZOMATO|BLINKT|MYNTRA|MEESHO", s, re.I):
        return "commerce"
    return "service"
