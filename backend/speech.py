import os
import uuid

try:
    import imageio_ffmpeg
    ffmpeg_dir = os.path.dirname(imageio_ffmpeg.get_ffmpeg_exe())
    if ffmpeg_dir not in os.environ.get("PATH", ""):
        os.environ["PATH"] += os.pathsep + ffmpeg_dir
except Exception:
    pass

ALLOWED_EXTENSIONS = {'wav', 'mp3', 'm4a', 'ogg', 'flac'}
_whisper_model = None

def process_audio(audio_file_path):
    """
    Converts audio file to text using Whisper directly.
    We fallback to standard Google Web Speech API if Whisper fails.
    """
    global _whisper_model
    
    try:
        import whisper
        import warnings
        warnings.filterwarnings("ignore")
        if _whisper_model is None:
            _whisper_model = whisper.load_model("base.en")
            
        # fp16=False is CRITICAL for preventing silent freezing on non-CUDA CPUs
        result = _whisper_model.transcribe(audio_file_path, fp16=False)
        return result["text"], "Whisper (Local)"
            
    except Exception as whisper_err:
        import speech_recognition as sr
        try:
            recognizer = sr.Recognizer()
            with sr.AudioFile(audio_file_path) as source:
                recognizer.adjust_for_ambient_noise(source)
                audio_data = recognizer.record(source)
                text = recognizer.recognize_google(audio_data)
                return text, "Google Web API (Fallback)"
        except Exception as sr_e:
            return f"Error: Whisper failed ({str(whisper_err)}) AND Google fallback failed ({str(sr_e)}). Ensure ffmpeg is installed for non-WAV files.", "Error"

def save_uploaded_audio(uploaded_file):
    """Save Streamlit uploaded file securely into an isolated temp dir, blocking path traversal."""
    temp_dir = "temp_audio"
    os.makedirs(temp_dir, exist_ok=True)
    
    # Verify extension securely
    ext = uploaded_file.name.split('.')[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError("Invalid file extension detected. Access blocked.")
        
    # Generate isolated UUID
    safe_filename = f"{uuid.uuid4().hex}.{ext}"
    file_path = os.path.join(temp_dir, safe_filename)
    
    with open(file_path, "wb") as f:
        f.write(uploaded_file.getbuffer())
    return file_path
