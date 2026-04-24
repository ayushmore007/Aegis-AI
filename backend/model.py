import os
import pickle
import pandas as pd
import requests
from io import StringIO
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import make_pipeline
from utils import generate_key, load_key, encrypt_file, decrypt_file_to_memory
from preprocess import preprocess_text

MODEL_FILE = "phishing_model.pkl"
DATA_FILE = "dataset.csv"
ENCRYPTED_DATA_FILE = "dataset.csv.enc"

# URL for a widely used mirror of the Kaggle SMS Spam Collection dataset
SPAM_DATASET_URL = "https://raw.githubusercontent.com/justmarkham/pycon-2016-tutorial/master/data/sms.tsv"
def create_and_encrypt_dataset():
    """Download a real spam dataset, map labels, and save it securely as encrypted data."""
    if not os.path.exists("secret.key"):
        generate_key()
    
    print("Downloading Kaggle Spam Dataset mirror...")
    response = requests.get(SPAM_DATASET_URL)
    response.raise_for_status()
    
    # The dataset is tab-separated with columns: 'label', 'message' -> 'ham' or 'spam'
    df = pd.read_csv(StringIO(response.text), sep='\t', names=['label', 'text'])
    
    # Map 'ham' -> 'safe', 'spam' -> 'phishing'
    df['label'] = df['label'].map({'ham': 'safe', 'spam': 'phishing'})
    
    # Save standard temporary file
    df.to_csv(DATA_FILE, index=False)
    
    # Encrypt the file
    encrypt_file(DATA_FILE, ENCRYPTED_DATA_FILE)
    
    # Remove the standard plaintext file so hackers can't "Ctrl+F"
    if os.path.exists(DATA_FILE):
        os.remove(DATA_FILE)
    print("Dataset securely generated and encrypted.")

def load_encrypted_dataset():
    """Load and decrypt the dataset directly into memory."""
    if not os.path.exists(ENCRYPTED_DATA_FILE):
        create_and_encrypt_dataset()
        
    decrypted_str = decrypt_file_to_memory(ENCRYPTED_DATA_FILE)
    df = pd.read_csv(StringIO(decrypted_str))
    
    # Preprocess text
    df['cleaned_text'] = df['text'].apply(preprocess_text)
    return df

def train_model():
    """Trains the NLP Phishing Detection Model and saves it."""
    print("Loading data...")
    df = load_encrypted_dataset()
    
    print("Training model...")
    # Using TF-IDF and Multinomial NB Pipeline
    model = make_pipeline(TfidfVectorizer(), MultinomialNB())
    
    X = df['cleaned_text']
    y = df['label']
    
    model.fit(X, y)
    
    with open(MODEL_FILE, "wb") as f:
        pickle.dump(model, f)
    
    print("Model successfully trained and saved!")

def predict_text(text):
    """Predicts whether text is safe or phishing, returns label & confidence."""
    if not os.path.exists(MODEL_FILE):
        train_model()
        
    with open(MODEL_FILE, "rb") as f:
        model = pickle.load(f)
        
    clean_text = preprocess_text(text)
    
    prediction = model.predict([clean_text])[0]
    probabilities = model.predict_proba([clean_text])[0]
    
    classes = model.classes_
    prob_dict = dict(zip(classes, probabilities))
    
    # Calculate confidence as percentage
    confidence = round(prob_dict[prediction] * 100, 2)
    return prediction, confidence
