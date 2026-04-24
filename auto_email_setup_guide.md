# Auto Email Scanner - Complete Setup Guide

Because Aegis AI automatically scans live emails in the background without requiring the user to constantly refresh the website, this feature runs as a **Daemon** (a continuous background Python process) connected directly to Gmail's API securely via OAuth.

## Step 1: Create Google Cloud Credentials
To legally read a user's Gmail inbox, you must fetch authorization tokens from Google:
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a New Project called "Aegis AI Email Scanner".
3. Search for the **Gmail API** in the library and click **Enable**.
4. Go to **Credentials**, click **Create Credentials**, and select **OAuth client ID**. Choose "Desktop Application".
5. Download the file and rename it to `credentials.json`. Place it directly inside your `backend` folder.

## Step 2: Install Google API Libraries
You need to install Google's official Python packages. Open a terminal in your `backend` folder and run:
```bash
pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib
```

## Step 3: Run the Scanner Script
Now, run the script I wrote for you:
```bash
python auto_email_scanner.py
```

### What happens when you run it?
1. **First Time Authentication:** The script will automatically open a Google Login page in your web browser. You will log in and grant Aegis Read-Only access. The script will save the returned authorization into a `token.json` file on your computer so you never have to log in manually again.
2. **Infinite Background Loop:** The script traps the terminal in a secure loop. It sweeps your inbox, extracts the text from the top 10 most recent *Unread* emails, and pushes them through the exact same `model.py` Machine Learning pipeline the website uses. 
3. **Threat Detection & Logging:** It will print the scanning results straight into the terminal. Once complete, it automatically goes to sleep for 5 minutes before waking up and checking for new emails again!
