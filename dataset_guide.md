# Aegis AI — Dataset Creation & Upload Guide

Since you are building a custom NLP phishing detection engine for Aegis AI, your model will need a high-quality dataset. Here is a definitive guide on how to create, label, and feed this dataset into a machine learning pipeline (similar to the FraudLens reference).

## 1. Structure of the Dataset

You need a structured tabular format, usually a `.csv` or `.json` file. The simplest and most effective format for classification is CSV with at least two columns: `text` and `label`.

### Required Columns:
- `text`: The string of the SMS, Email, WhatsApp message, or transcript of an audio call.
- `label`: The exact category of the scam.

### Emulating FraudLens Labels:
Based on the FraudLens repository, a good starting point for labels:
- `safe` (Normal conversations, OTPs from legitimate sources)
- `refund_scam` (e.g., "You have received ₹5000 refund, click here")
- `impersonation` (e.g., "Hi mum, my phone broke, send money to this new number")
- `verification_fraud` (e.g., "Your KYC is pending, account will be blocked")
- `phishing` (e.g., "Win a free iPhone, login to claim")

## 2. Collecting the Data

Because high-quality Hindi/Hinglish/English scam datasets are rare, you will need to aggregate them:
1. **Public Datasets:** Search Kaggle for "SMS Spam Collection Dataset" or "Phishing Email Dataset".
2. **Crowdsourcing Request:** Ask friends and family to forward spam messages to you.
3. **Synthetic Generation (AI):** You can use GPT-4 or Claude to generate thousands of highly realistic scam messages. 
   - *Prompt Example:* "Generate 50 examples of Indian UPI verification fraud SMS messages in Hinglish."

## 3. Formatting the CSV

Your `dataset.csv` should look like this:

```csv
text,label
"Dear customer, your SBI account will be blocked today. Update KYC urgently: http://sbi-kyc-verify.com",verification_fraud
"Hey buddy, are we still meeting at 5 PM today?",safe
"Sir I accidentally sent 500 rs to your gpay, please return it",refund_scam
"Congratulations! Your mobile number won 1,000,000 in the global lottery.",phishing
```

## 4. Feeding it into the NLP Engine (Python/Colab)

Once your CSV is ready, the standard process to train the AI model involves Python and libraries like `Transformers` (Hugging Face) and `scikit-learn`.

### Step A: Load the Dataset
```python
import pandas as pd

# Load the dataset
df = pd.read_csv("dataset.csv")

# Ensure there are no empty strings
df.dropna(inplace=True)
```

### Step B: Train a Baseline Model (Easiest way)
If you don't want to fine-tune a massive neural network right away, a standard TF-IDF + Naive Bayes or FastText model works well for text classification.

```python
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import make_pipeline

X_train, X_test, y_train, y_test = train_test_split(df['text'], df['label'], test_size=0.2)

# Create a machine learning pipeline
model = make_pipeline(TfidfVectorizer(), MultinomialNB())

# Train the model
model.fit(X_train, y_train)

# Test it
print(model.predict(["Your account is blocked, click here to recover"]))
```

### Step C: Advanced (Fine-Tuning BERT/DistilBERT)
To emulate FraudLens precisely:
1. Open Google Colab.
2. Upload `dataset.csv`.
3. Use the `transformers` library's `Trainer` API to fine-tune `distilbert-base-uncased` (or a multilingual equivalent like `xlm-roberta-base` for Hinglish).
4. Export the model weights and load them into a FastAPI or Flask backend, which your React frontend will call via `POST /predict`.

## 5. Connecting AI to Aegis AI Frontend
Inside the `Aegis AI` app, you will have an interface in `/home` where the user types a text. 
The React app will make a `fetch()` call:

```javascript
const analyzeText = async (inputText) => {
  const response = await fetch("http://localhost:8000/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: inputText })
  });
  const result = await response.json();
  return result; // { label: 'phishing', confidence: 0.94 }
}
```
