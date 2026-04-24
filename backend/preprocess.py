import string
import nltk 
from deep_translator import GoogleTranslator

def download_nltk_resources():
    """Download NLTK resources silently."""
    try:
        nltk.download('stopwords', quiet=True)
        nltk.download('punkt', quiet=True)
    except Exception as e:
        print(f"Error downloading NLTK resources: {e}")

download_nltk_resources()

from nltk.corpus import stopwords

def preprocess_text(text):
    """
    Cleans text by:
    1. Lowercasing
    2. Removing punctuation
    3. Removing stopwords
    """
    if not isinstance(text, str):
        return ""
    
    # Lowercase
    text = text.lower()
    
    # Remove punctuation
    text = text.translate(str.maketrans('', '', string.punctuation))
    
    # Remove stopwords
    try:
        stop_words = set(stopwords.words('english'))
        words = text.split()
        cleaned_words = [word for word in words if word not in stop_words]
        return " ".join(cleaned_words)
    except Exception:
        # Fallback if stopwords fail to load
        return text

def translate_to_english(text):
    """
    Translates any foreign language into English. 
    If already English or translation fails, returns original text.
    """
    if not isinstance(text, str) or not text.strip():
        return text
    try:
        translator = GoogleTranslator(source='auto', target='en')
        translated = translator.translate(text)
        return translated if translated else text
    except Exception as e:
        print(f"Translation failed: {e}")
        return text
