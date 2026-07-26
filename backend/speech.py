import os
import uuid
import shutil
import subprocess
import tempfile
import struct
import re

ALLOWED_EXTENSIONS = {"wav", "mp3", "m4a", "ogg", "flac", "webm", "aac", "3gp", "amr"}
MIN_AUDIO_BYTES = 1_000
CALL_GUARD_MIN_PCM_MS = 400
_whisper_model = None

_GOOGLE_LANG_CHAIN = [
    "hi-IN", "mr-IN", "bn-IN", "gu-IN", "kn-IN", "ml-IN", "pa-IN",
    "ta-IN", "te-IN", "en-IN", "en-US", "en-GB",
]


def _transcript_quality_score(text: str) -> float:
    """Score transcript candidates — prefer longer, word-rich, non-garbage output."""
    t = (text or "").strip()
    if not t or len(t) < 2:
        return 0.0
    words = re.findall(r"[\w\u0900-\u097F\u0980-\u09FF\u0A80-\u0AFF\u0B80-\u0BFF\u0C00-\u0C7F]+", t)
    if len(words) < 1:
        return 0.0
    alpha = sum(c.isalnum() or c.isspace() for c in t) / max(len(t), 1)
    if alpha < 0.5:
        return 0.0
    # Penalize obvious hallucinations
    lower = t.lower()
    if lower in {"thank you", "thanks for watching", "subtitle", "music"}:
        return 0.0
    return len(words) * 2.0 + min(len(t), 200) * 0.05 + alpha * 10


def _enhance_call_audio(wav_path: str) -> str:
    """Normalize phone call audio without clipping (better for multilingual ASR)."""
    out_dir = tempfile.mkdtemp(prefix="aegis_enh_")
    out = os.path.join(out_dir, f"{uuid.uuid4().hex}.wav")
    cmd = [
        _ffmpeg_executable(),
        "-y",
        "-i",
        wav_path,
        "-af",
        "highpass=f=80,lowpass=f=3800,dynaudnorm=f=50:g=7",
        "-ar",
        "16000",
        "-ac",
        "1",
        out,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
    if proc.returncode == 0 and os.path.isfile(out) and os.path.getsize(out) > MIN_AUDIO_BYTES:
        return out
    return amplify_wav(wav_path, gain_db=12.0)


def _ensure_ffmpeg_on_path():
    try:
        import imageio_ffmpeg

        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        ffmpeg_dir = os.path.dirname(ffmpeg_exe)
        target_exe = os.path.join(ffmpeg_dir, "ffmpeg.exe")
        if not os.path.exists(target_exe) and os.name == "nt":
            shutil.copy(ffmpeg_exe, target_exe)
        if ffmpeg_dir not in os.environ.get("PATH", ""):
            os.environ["PATH"] = ffmpeg_dir + os.pathsep + os.environ.get("PATH", "")
    except Exception as e:
        print(f"ffmpeg path setup note: {e}")


_ensure_ffmpeg_on_path()


def _ffmpeg_executable():
    return shutil.which("ffmpeg") or "ffmpeg"


def _wav_duration_ms(path: str) -> int:
    try:
        import wave

        with wave.open(path, "rb") as w:
            frames = w.getnframes()
            rate = w.getframerate() or 16000
            return int(frames * 1000 / rate)
    except Exception:
        return 0


def _wav_peak_amplitude(path: str) -> int:
    """Max abs 16-bit sample value in WAV."""
    try:
        import wave

        peak = 0
        with wave.open(path, "rb") as w:
            frames = w.readframes(w.getnframes())
        for i in range(0, len(frames) - 1, 2):
            sample = struct.unpack("<h", frames[i : i + 2])[0]
            peak = max(peak, abs(sample))
        return peak
    except Exception:
        return 0


def validate_audio_file(path: str) -> None:
    if not os.path.isfile(path):
        raise ValueError("Audio file was not saved correctly. Please try again.")
    size = os.path.getsize(path)
    if size < MIN_AUDIO_BYTES:
        raise ValueError(
            "Audio is too short or empty. Record at least 3–5 seconds of clear speech "
            "(use speakerphone for calls)."
        )
    if path.lower().endswith(".wav"):
        dur = _wav_duration_ms(path)
        if dur < CALL_GUARD_MIN_PCM_MS:
            raise ValueError(
                f"Recording is only {dur}ms long. Use speakerphone and speak for at least 5 seconds."
            )


def amplify_wav(wav_path: str, gain_db: float = 18.0) -> str:
    """Boost quiet phone-call recordings before speech recognition."""
    out_dir = tempfile.mkdtemp(prefix="aegis_amp_")
    out = os.path.join(out_dir, f"{uuid.uuid4().hex}.wav")
    cmd = [
        _ffmpeg_executable(),
        "-y",
        "-i",
        wav_path,
        "-af",
        f"volume={gain_db}dB,highpass=f=80",
        "-ar",
        "16000",
        "-ac",
        "1",
        out,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
    if proc.returncode == 0 and os.path.isfile(out) and os.path.getsize(out) > MIN_AUDIO_BYTES:
        return out
    return wav_path


def trim_wav_max_seconds(wav_path: str, max_seconds: int = 60) -> str:
    dur_ms = _wav_duration_ms(wav_path)
    if dur_ms <= 0 or dur_ms <= max_seconds * 1000:
        return wav_path
    out_dir = tempfile.mkdtemp(prefix="aegis_trim_")
    trimmed = os.path.join(out_dir, f"{uuid.uuid4().hex}.wav")
    cmd = [
        _ffmpeg_executable(),
        "-y",
        "-i",
        wav_path,
        "-t",
        str(max_seconds),
        "-ar",
        "16000",
        "-ac",
        "1",
        trimmed,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if proc.returncode == 0 and os.path.isfile(trimmed) and os.path.getsize(trimmed) > MIN_AUDIO_BYTES:
        return trimmed
    return wav_path


def convert_to_wav(input_path: str) -> str:
    ext = os.path.splitext(input_path)[1].lower().lstrip(".")
    if ext == "wav":
        validate_audio_file(input_path)
        return input_path

    out_dir = tempfile.mkdtemp(prefix="aegis_audio_")
    wav_path = os.path.join(out_dir, f"{uuid.uuid4().hex}.wav")
    cmd = [
        _ffmpeg_executable(),
        "-y",
        "-err_detect",
        "ignore_err",
        "-i",
        input_path,
        "-ar",
        "16000",
        "-ac",
        "1",
        "-vn",
        wav_path,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if proc.returncode != 0 or not os.path.isfile(wav_path) or os.path.getsize(wav_path) < MIN_AUDIO_BYTES:
        err = (proc.stderr or proc.stdout or "").strip()
        if "end of file" in err.lower() or "end of input" in err.lower():
            raise ValueError(
                "Recording was empty or cut off. Turn on speakerphone during the call."
            )
        raise ValueError(f"Could not read audio file. {(err or '')[-400:]}")
    validate_audio_file(wav_path)
    return wav_path


def _normalize_transcript(text: str) -> str:
    t = (text or "").strip()
    if not t:
        return ""
    noise = {
        "thank you.",
        "thanks for watching.",
        "subtitle",
        "[music]",
        "(music)",
    }
    if t.lower() in noise:
        return ""
    if len(t) < 1:
        return ""
    return t


def _compress_for_gemini(wav_path: str, max_seconds: int | None = None) -> str:
    """Compress audio to low-bitrate mono MP3 to minimize upload size and avoid timeouts."""
    out_dir = tempfile.mkdtemp(prefix="aegis_gemini_")
    compressed = os.path.join(out_dir, f"{uuid.uuid4().hex}.mp3")
    cmd = [
        _ffmpeg_executable(),
        "-y",
        "-i",
        wav_path,
        "-codec:a",
        "libmp3lame",
        "-b:a",
        "32k",
        "-ac",
        "1",
    ]
    if max_seconds:
        cmd += ["-t", str(max_seconds)]
    cmd.append(compressed)
    
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if proc.returncode == 0 and os.path.isfile(compressed) and os.path.getsize(compressed) > MIN_AUDIO_BYTES:
            return compressed
    except Exception:
        pass
    
    # Fallback to trim_wav_max_seconds if compression failed
    if os.path.isfile(compressed):
        try:
            os.remove(compressed)
        except OSError:
            pass
    try:
        os.rmdir(out_dir)
    except OSError:
        pass
    return trim_wav_max_seconds(wav_path, max_seconds) if max_seconds else wav_path


def _gemini_transcribe(wav_path: str, max_seconds: int | None = None) -> tuple[str, str, str]:
    api_key = (os.getenv("GEMINI_API_KEY") or "").strip()
    if not api_key:
        raise ValueError("GEMINI_API_KEY not configured")

    import base64
    import requests
    import json

    work = _compress_for_gemini(wav_path, max_seconds)
    created_compressed = work != wav_path

    try:
        with open(work, "rb") as f:
            audio_data = f.read()

        encoded_audio = base64.b64encode(audio_data).decode("utf-8")

        mime_type = "audio/wav"
        if work.lower().endswith(".mp3"):
            mime_type = "audio/mp3"
        elif work.lower().endswith(".m4a"):
            mime_type = "audio/m4a"
        elif work.lower().endswith(".ogg"):
            mime_type = "audio/ogg"

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        headers = {"Content-Type": "application/json"}

        prompt = (
            "You are an expert audio transcriber. Transcribe this audio recording of a phone call. "
            "The call might be in English, Hindi, Marathi, Tamil, Telugu, Bengali, or a mix of these (e.g. Hinglish). "
            "Provide a highly accurate transcription and translation in the required JSON format."
        )

        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": encoded_audio
                            }
                        },
                        {
                            "text": prompt
                        }
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.0,
                "responseMimeType": "application/json",
                "responseSchema": {
                    "type": "OBJECT",
                    "properties": {
                        "transcription": {
                            "type": "STRING",
                            "description": "Verbatim transcription in the original language(s) spoken."
                        },
                        "translation": {
                            "type": "STRING",
                            "description": "Accurate English translation of the transcription. If the spoken language is English, this should match the transcription."
                        },
                        "language": {
                            "type": "STRING",
                            "description": "Detected language (e.g., 'English', 'Hindi', 'Hinglish', 'Marathi', etc.)."
                        }
                    },
                    "required": ["transcription", "translation", "language"]
                }
            }
        }

        response = requests.post(url, headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        resp_json = response.json()

        content_text = resp_json["candidates"][0]["content"]["parts"][0]["text"].strip()
        result = json.loads(content_text)
        transcription = result.get("transcription", "").strip()
        translation = result.get("translation", "").strip()
        lang = result.get("language", "").strip()

        text_to_return = translation or transcription
        method = f"Gemini 1.5 Flash ({lang})"

        from language_utils import normalize_stt_language
        lang_key = normalize_stt_language(lang, text_to_return)

        return text_to_return, method, lang_key
    except Exception as e:
        raise ValueError(f"Gemini transcription failed: {e}")
    finally:
        if created_compressed and work and os.path.isfile(work):
            try:
                parent = os.path.dirname(work)
                os.remove(work)
                if parent and os.path.isdir(parent) and "aegis_gemini_" in parent:
                    os.rmdir(parent)
            except OSError:
                pass


def preload_whisper_model():
    global _whisper_model
    try:
        if (os.getenv("CALL_GUARD_WHISPER_FALLBACK", "true").lower() in ("1", "true", "yes")):
            import whisper
            model_name = os.getenv("WHISPER_MODEL", "base")
            print(f"Preloading Whisper model '{model_name}'...")
            _whisper_model = whisper.load_model(model_name)
            print("Whisper model preloaded successfully!")
    except Exception as e:
        print(f"Failed to preload Whisper: {e}")


def _whisper_transcribe(wav_path: str, max_seconds: int | None = None) -> tuple[str, str, str]:
    global _whisper_model
    import whisper
    import warnings

    warnings.filterwarnings("ignore")
    if _whisper_model is None:
        model_name = os.getenv("WHISPER_MODEL", "base")
        _whisper_model = whisper.load_model(model_name)

    work = trim_wav_max_seconds(wav_path, max_seconds) if max_seconds else wav_path

    tr = _whisper_model.transcribe(
        work,
        fp16=False,
        task="transcribe",
        language=None,
        temperature=(0.0, 0.2, 0.4),
        best_of=3,
        beam_size=5,
        condition_on_previous_text=True,
        no_speech_threshold=0.45,
        initial_prompt=(
            "Phone call in Hindi, English, Marathi, Tamil, Telugu, Bengali, or mixed Hinglish. "
            "Bank, OTP, scam, lottery, KYC, UPI, police, customs."
        ),
    )
    lang = tr.get("language") or ""
    native = _normalize_transcript(tr.get("text", ""))
    if native:
        from language_utils import normalize_stt_language

        lang_key = normalize_stt_language(lang, native)
        from preprocess import translate_to_english

        if lang.startswith("en") or (native.isascii() and len(native) > 10):
            return native, f"Whisper ({lang or 'en'})", lang_key
        english = translate_to_english(native)
        if english and english.strip() and english.strip() != native.strip():
            return english.strip(), f"Whisper ({lang or 'auto'}) + translation", lang_key
        return native, f"Whisper ({lang or 'auto'})", lang_key

    tr_en = _whisper_model.transcribe(
        work,
        fp16=False,
        task="translate",
        language=None,
        temperature=0.0,
        condition_on_previous_text=False,
        no_speech_threshold=0.45,
    )
    lang2 = tr_en.get("language") or lang
    en = _normalize_transcript(tr_en.get("text", ""))
    if en:
        from language_utils import normalize_stt_language

        return en, "Whisper (multilingual → English)", normalize_stt_language(lang2, en)

    return "", "", lang2 or lang


def _google_multilingual(wav_path: str, for_call_guard: bool = False) -> tuple[str, str, str]:
    import speech_recognition as sr

    recognizer = sr.Recognizer()
    if for_call_guard:
        recognizer.energy_threshold = 100
        recognizer.dynamic_energy_threshold = True
        recognizer.pause_threshold = 0.7
    else:
        recognizer.energy_threshold = 200
        recognizer.dynamic_energy_threshold = True

    with sr.AudioFile(wav_path) as source:
        if not for_call_guard:
            recognizer.adjust_for_ambient_noise(source, duration=0.25)
        audio_data = recognizer.record(source)

    best_text = ""
    best_score = 0.0
    best_lang = ""
    best_method = ""

    # Prioritize Hindi, Marathi, English for Indian scam calls
    lang_chain = ["hi-IN", "mr-IN", "en-IN", "en-US"] + [
        lc for lc in _GOOGLE_LANG_CHAIN if lc not in ("hi-IN", "mr-IN", "en-IN", "en-US")
    ]

    for lang_code in lang_chain:
        try:
            text = recognizer.recognize_google(audio_data, language=lang_code)
            text = _normalize_transcript(text)
            score = _transcript_quality_score(text)
            if score > best_score:
                best_score = score
                best_text = text
                best_lang = lang_code
        except sr.UnknownValueError:
            continue
        except sr.RequestError:
            break

    if not best_text:
        return "", "", ""

    from language_utils import normalize_stt_language

    lang_key = normalize_stt_language(best_lang, best_text)

    if best_lang.startswith("en"):
        return best_text, f"Google Speech ({best_lang})", lang_key

    from preprocess import translate_to_english

    en = translate_to_english(best_text)
    return (en or best_text).strip(), f"Google Speech ({best_lang}) + translation", lang_key


def _no_speech_message(peak: int, dur_ms: int) -> str:
    if peak < 300:
        return (
            f"Recording looks silent (peak={peak}, {dur_ms // 1000}s). "
            "Many phones block the mic during cellular calls — use speakerphone, or paste a transcript in Vishing."
        )
    return (
        f"No speech detected ({dur_ms // 1000}s audio). Speak clearly on speakerphone, "
        "or paste what was said in Vishing → Analyze transcript."
    )


def process_audio(audio_file_path: str, fast: bool = False):
    wav_path = None
    created_wav = False
    trimmed_path = None
    amplified_path = None
    whisper_error = ""

    try:
        validate_audio_file(audio_file_path)
        wav_path = convert_to_wav(audio_file_path)
        created_wav = wav_path != audio_file_path

        if (os.getenv("GEMINI_API_KEY") or "").strip():
            try:
                max_sec = int(os.getenv("CALL_GUARD_MAX_AUDIO_SEC", "120")) if fast else None
                text, method, lang = _gemini_transcribe(wav_path, max_seconds=max_sec)
                if text:
                    return text, method, lang
            except Exception as e:
                print(f"Gemini transcription failed, falling back: {e}")

        if fast:
            max_sec = int(os.getenv("CALL_GUARD_MAX_AUDIO_SEC", "120"))
            trimmed_path = trim_wav_max_seconds(wav_path, max_sec)
            amplified_path = _enhance_call_audio(trimmed_path)
            work_path = amplified_path

            dur_ms = _wav_duration_ms(work_path)
            peak = _wav_peak_amplitude(work_path)
            whisper_sec = int(os.getenv("CALL_GUARD_WHISPER_SEC", "90"))
            whisper_first = os.getenv("CALL_GUARD_WHISPER_FIRST", "false").lower() in (
                "1", "true", "yes",
            )
            use_whisper = os.getenv("CALL_GUARD_WHISPER_FALLBACK", "true").lower() in (
                "1", "true", "yes",
            )

            def _try_whisper():
                nonlocal whisper_error
                try:
                    text, method, lang = _whisper_transcribe(work_path, max_seconds=whisper_sec)
                    if text:
                        return text, method, lang
                except Exception as e:
                    whisper_error = str(e)
                return None

            def _try_google():
                try:
                    text, method, lang = _google_multilingual(work_path, for_call_guard=True)
                    if text:
                        return text, method, lang
                except Exception as e:
                    nonlocal whisper_error
                    if not whisper_error:
                        whisper_error = str(e)
                return None

            whisper_error = ""
            if whisper_first and use_whisper:
                hit = _try_whisper()
                if hit:
                    return hit
                hit = _try_google()
                if hit:
                    return hit
            else:
                hit = _try_google()
                if hit:
                    return hit
                if use_whisper:
                    hit = _try_whisper()
                    if hit:
                        return hit

            msg = _no_speech_message(peak, dur_ms)
            if whisper_error:
                msg += f" (engine: {whisper_error[:120]})"
            return f"Error: {msg}", "Error", ""

        try:
            text, method, lang = _google_multilingual(wav_path)
            if text:
                return text, method, lang
        except Exception:
            pass

        try:
            text, method, lang = _whisper_transcribe(wav_path, max_seconds=120)
            if text:
                return text, method, lang
        except Exception as e:
            whisper_error = str(e)

        return (
            "Error: No speech detected. Speak clearly for at least 3–5 seconds (speakerphone helps).",
            "Error",
            "",
        )
    finally:
        for path, is_temp in [(amplified_path, True), (trimmed_path, True), (wav_path, created_wav)]:
            if is_temp and path and os.path.isfile(path):
                try:
                    parent = os.path.dirname(path)
                    os.remove(path)
                    if parent and os.path.isdir(parent) and "aegis_" in parent:
                        os.rmdir(parent)
                except OSError:
                    pass


def save_uploaded_audio(uploaded_file):
    temp_dir = "temp_audio"
    os.makedirs(temp_dir, exist_ok=True)
    ext = uploaded_file.name.split(".")[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError("Invalid file extension. Use WAV, MP3, M4A, OGG, or FLAC.")
    safe_filename = f"{uuid.uuid4().hex}.{ext}"
    file_path = os.path.join(temp_dir, safe_filename)
    with open(file_path, "wb") as f:
        f.write(uploaded_file.getbuffer())
    return file_path
