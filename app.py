from flask import Flask, render_template, request, jsonify, send_file
from flask_cors import CORS
import pytesseract
from PIL import Image
from gtts import gTTS
from deep_translator import GoogleTranslator
import os
import tempfile
# speech_recognition can fail to import in some minimal Python builds (missing aifc)
# Import lazily and handle absence so the app can start under Gunicorn.
try:
    import speech_recognition as sr
except Exception:
    sr = None
import base64
from uuid import uuid4
from werkzeug.utils import secure_filename
import logging
import sys

app = Flask(__name__)
CORS(app)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['DOWNLOAD_FOLDER'] = 'downloads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Create necessary directories
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['DOWNLOAD_FOLDER'], exist_ok=True)
os.makedirs('static/css', exist_ok=True)
os.makedirs('static/js', exist_ok=True)
os.makedirs('templates', exist_ok=True)

# Configure logging to stdout for Render
logging.basicConfig(stream=sys.stdout, level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
app.logger.info('Logging configured')


@app.route('/health')
def health():
    return jsonify({'status': 'ok'}), 200

# Set the path to the Tesseract executable
if os.name == 'nt':  # Windows
    pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
else:  # Linux
    pytesseract.pytesseract.tesseract_cmd = '/usr/bin/tesseract'

# Language dictionaries
OCR_LANGUAGES = {
    "English (eng)": "eng",
    "French (fra)": "fra",
    "Spanish (spa)": "spa",
    "German (deu)": "deu",
    "Chinese (Simplified) (chi_sim)": "chi_sim",
    "Chinese (Traditional) (chi_tra)": "chi_tra",
    "Japanese (jpn)": "jpn",
    "Korean (kor)": "kor",
    "Arabic (ara)": "ara",
    "Russian (rus)": "rus",
    "Italian (ita)": "ita",
    "Portuguese (por)": "por",
    "Dutch (nld)": "nld",
    "Hindi (hin)": "hin",
    "Turkish (tur)": "tur",
    "Vietnamese (vie)": "vie",
    "Thai (tha)": "tha",
    "Greek (ell)": "ell",
    "Hebrew (heb)": "heb",
    "Polish (pol)": "pol",
    "Swedish (swe)": "swe",
    "Finnish (fin)": "fin",
    "Danish (dan)": "dan",
    "Norwegian (nor)": "nor",
    "Czech (ces)": "ces",
    "Hungarian (hun)": "hun",
    "Romanian (ron)": "ron",
    "Ukrainian (ukr)": "ukr",
    "Bulgarian (bul)": "bul",
    "Croatian (hrv)": "hrv",
    "Slovak (slk)": "slk",
    "Slovenian (slv)": "slv",
    "Estonian (est)": "est",
    "Latvian (lav)": "lav",
    "Lithuanian (lit)": "lit",
    "Malay (msa)": "msa",
    "Indonesian (ind)": "ind",
    "Filipino (fil)": "fil",
    "Urdu (urd)": "urd",
    "Persian (fas)": "fas",
    "Bengali (ben)": "ben",
    "Tamil (tam)": "tam",
    "Telugu (tel)": "tel",
    "Kannada (kan)": "kan",
    "Malayalam (mal)": "mal",
    "Sinhala (sin)": "sin",
    "Burmese (mya)": "mya",
    "Khmer (khm)": "khm",
    "Lao (lao)": "lao",
    "Tibetan (bod)": "bod",
    "Mongolian (mon)": "mon",
    "Nepali (nep)": "nep",
}

# Mapping from Tesseract codes to gTTS codes for audio generation
TESSERACT_TO_GTTS = {
    "eng": "en",
    "fra": "fr",
    "spa": "es",
    "deu": "de",
    "chi_sim": "zh-CN",
    "chi_tra": "zh-TW",
    "jpn": "ja",
    "kor": "ko",
    "ara": "ar",
    "rus": "ru",
    "ita": "it",
    "por": "pt",
    "nld": "nl",
    "hin": "hi",
    "tur": "tr",
    "vie": "vi",
    "tha": "th",
    "ell": "el",
    "heb": "he",
    "pol": "pl",
    "swe": "sv",
    "fin": "fi",
    "dan": "da",
    "nor": "no",
    "ces": "cs",
    "hun": "hu",
    "ron": "ro",
    "ukr": "uk",
    "bul": "bg",
    "hrv": "hr",
    "slk": "sk",
    "slv": "sl",
    "est": "et",
    "lav": "lv",
    "lit": "lt",
    "msa": "ms",
    "ind": "id",
    "fil": "tl",
    "urd": "ur",
    "fas": "fa",
    "ben": "bn",
    "tam": "ta",
    "tel": "te",
    "kan": "kn",
    "mal": "ml",
    "sin": "si",
    "mya": "my",
    "khm": "km",
    "lao": "lo",
    "bod": "bo",
    "mon": "mn",
    "nep": "ne",
}

OUTPUT_LANGUAGES = {
    "English (en)": "en",
    "French (fr)": "fr",
    "Spanish (es)": "es",
    "German (de)": "de",
    "Chinese (Simplified) (zh-CN)": "zh-CN",
    "Chinese (Traditional) (zh-TW)": "zh-TW",
    "Japanese (ja)": "ja",
    "Korean (ko)": "ko",
    "Arabic (ar)": "ar",
    "Russian (ru)": "ru",
    "Italian (it)": "it",
    "Portuguese (pt)": "pt",
    "Dutch (nl)": "nl",
    "Hindi (hi)": "hi",
    "Turkish (tr)": "tr",
    "Vietnamese (vi)": "vi",
    "Thai (th)": "th",
    "Greek (el)": "el",
    "Hebrew (he)": "he",
    "Polish (pl)": "pl",
    "Swedish (sv)": "sv",
    "Finnish (fi)": "fi",
    "Danish (da)": "da",
    "Norwegian (no)": "no",
    "Czech (cs)": "cs",
    "Hungarian (hu)": "hu",
    "Romanian (ro)": "ro",
    "Ukrainian (uk)": "uk",
    "Bulgarian (bg)": "bg",
    "Croatian (hr)": "hr",
    "Slovak (sk)": "sk",
    "Slovenian (sl)": "sl",
    "Estonian (et)": "et",
    "Latvian (lv)": "lv",
    "Lithuanian (lt)": "lt",
    "Malay (ms)": "ms",
    "Indonesian (id)": "id",
    "Filipino (tl)": "tl",
    "Urdu (ur)": "ur",
    "Persian (fa)": "fa",
    "Bengali (bn)": "bn",
    "Tamil (ta)": "ta",
    "Telugu (te)": "te",
    "Kannada (kn)": "kn",
    "Malayalam (ml)": "ml",
}

def match_language_from_text(spoken_text, language_options):
    """Match spoken text with language options"""
    if not spoken_text:
        return None
    
    spoken_text = spoken_text.lower().strip()
    
    # Common language name mappings
    language_mappings = {
        'tamil': 'Tamil (tam)',
        'tamizh': 'Tamil (tam)',
        'english': 'English (eng)',
        'french': 'French (fra)',
        'spanish': 'Spanish (spa)',
        'german': 'German (deu)',
        'chinese': 'Chinese (Simplified) (chi_sim)',
        'japanese': 'Japanese (jpn)',
        'korean': 'Korean (kor)',
        'arabic': 'Arabic (ara)',
        'russian': 'Russian (rus)',
        'hindi': 'Hindi (hin)',
        'telugu': 'Telugu (tel)',
        'malayalam': 'Malayalam (mal)',
        'kannada': 'Kannada (kan)',
    }
    
    # Check mappings first
    for key, value in language_mappings.items():
        if spoken_text == key or spoken_text in key or key in spoken_text:
            return value
    
    # Direct matching
    for lang_name in language_options:
        lang_lower = lang_name.lower()
        if spoken_text in lang_lower or lang_lower.startswith(spoken_text):
            return lang_name
    
    return None

@app.route('/')
def index():
    return render_template('index.html', ocr_languages=OCR_LANGUAGES, output_languages=OUTPUT_LANGUAGES)

@app.route('/recognize_speech', methods=['POST'])
def recognize_speech():
    """Handle speech recognition from browser audio"""
    # Ensure speech_recognition is available when this route is called.
    if sr is None:
        try:
            import speech_recognition as sr_local
            globals()['sr'] = sr_local
        except Exception as e:
            return jsonify({'success': False, 'error': f'speech_recognition not available on this server: {e}'})

    try:
        audio_data = request.files['audio']
        language_type = request.form.get('type', 'ocr')
        
        # Save audio temporarily
        temp_audio = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
        audio_data.save(temp_audio.name)
        
        # Recognize speech
        recognizer = sr.Recognizer()
        with sr.AudioFile(temp_audio.name) as source:
            audio = recognizer.record(source)
            text = recognizer.recognize_google(audio)
        
        # Clean up temp file
        os.unlink(temp_audio.name)
        
        # Match language based on type
        if language_type == 'ocr':
            matched = match_language_from_text(text, list(OCR_LANGUAGES.keys()))
        else:
            matched = match_language_from_text(text, list(OUTPUT_LANGUAGES.keys()))
        
        if matched:
            return jsonify({'success': True, 'text': text, 'matched_language': matched})
        else:
            return jsonify({'success': False, 'error': f'Could not match "{text}" with any language', 'text': text})
    
    except sr.UnknownValueError:
        return jsonify({'success': False, 'error': 'Could not understand audio'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/process_image', methods=['POST'])
def process_image():
    """Process uploaded image with OCR, translation, and optional audio"""
    try:
        image_file = request.files['image']
        ocr_lang = request.form.get('ocr_lang')
        output_lang = request.form.get('output_lang')
        generate_audio = request.form.get('generate_audio') == 'true'
        show_summary = request.form.get('show_summary') == 'true'
        
        # Save uploaded image
        filename = secure_filename(image_file.filename)
        image_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        image_file.save(image_path)
        
        # Extract text with OCR
        img = Image.open(image_path)
        extracted_text = pytesseract.image_to_string(img, lang=OCR_LANGUAGES[ocr_lang])
        extracted_text = extracted_text.strip() if extracted_text else "No text could be extracted"
        
        # Calculate OCR confidence and word count if available
        data = pytesseract.image_to_data(img, lang=OCR_LANGUAGES[ocr_lang], output_type=pytesseract.Output.DICT)
        confidences = []
        for c in data.get('conf', []):
            if isinstance(c, (int, float)):
                if c >= 0:
                    confidences.append(int(c))
            elif isinstance(c, str) and c.strip().replace('.', '', 1).isdigit():
                try:
                    value = float(c)
                    if value >= 0:
                        confidences.append(int(value))
                except ValueError:
                    continue
        avg_confidence = round(sum(confidences) / len(confidences), 1) if confidences else None
        word_count = len(extracted_text.split()) if extracted_text else 0
        
        result = {
            'ocr_text': extracted_text,
            'translated_text': None,
            'summary': None,
            'ocr_audio_file': None,
            'translated_audio_file': None,
            'summary_audio_file': None,
            'ocr_lang': ocr_lang,
            'output_lang': output_lang,
            'ocr_confidence': avg_confidence,
            'word_count': word_count
        }
        
        # Translate if needed
        if OCR_LANGUAGES[ocr_lang] != OUTPUT_LANGUAGES[output_lang]:
            try:
                if len(extracted_text) <= 5000:
                    translated_text = GoogleTranslator(source='auto', target=OUTPUT_LANGUAGES[output_lang]).translate(extracted_text)
                else:
                    # Handle long text
                    chunks = [extracted_text[i:i+5000] for i in range(0, len(extracted_text), 5000)]
                    translated_chunks = []
                    for chunk in chunks:
                        translated_chunks.append(GoogleTranslator(source='auto', target=OUTPUT_LANGUAGES[output_lang]).translate(chunk))
                    translated_text = ' '.join(translated_chunks)
                result['translated_text'] = translated_text
            except Exception as translation_error:
                result['translated_text'] = f"Translation failed: {str(translation_error)}. Please check your internet connection."
                result['translation_error'] = str(translation_error)
        else:
            result['translated_text'] = "Source and target languages are the same - no translation needed"
        
        # Generate summary
        if show_summary:
            text_to_summarize = result['translated_text'] if result['translated_text'] else extracted_text
            paragraphs = [p for p in text_to_summarize.split('\n\n') if p.strip()]
            result['summary'] = '\n\n'.join(paragraphs[:3])
        
        # Generate audio for OCR extraction
        if generate_audio and extracted_text and extracted_text.strip():
            try:
                ocr_audio_filename = secure_filename(f'ocr_{uuid4().hex}.mp3')
                ocr_audio_path = os.path.join(app.config['DOWNLOAD_FOLDER'], ocr_audio_filename)
                ocr_lang_code = OCR_LANGUAGES[ocr_lang]
                # Convert Tesseract code to gTTS code
                gtts_lang_code = TESSERACT_TO_GTTS.get(ocr_lang_code, "en")
                tts_ocr = gTTS(text=extracted_text[:3000], lang=gtts_lang_code, slow=False)
                tts_ocr.save(ocr_audio_path)
                result['ocr_audio_file'] = ocr_audio_filename
            except Exception as audio_error:
                pass  # Silently fail audio generation for OCR text
        
        # Generate audio for translation
        if generate_audio and result['translated_text'] and result['translated_text'].strip() and "no translation needed" not in result['translated_text'].lower() and "Translation failed" not in result['translated_text']:
            try:
                translated_audio_filename = secure_filename(f'translated_{uuid4().hex}.mp3')
                translated_audio_path = os.path.join(app.config['DOWNLOAD_FOLDER'], translated_audio_filename)
                tts_translated = gTTS(text=result['translated_text'][:3000], lang=OUTPUT_LANGUAGES[output_lang], slow=False)
                tts_translated.save(translated_audio_path)
                result['translated_audio_file'] = translated_audio_filename
            except Exception as audio_error:
                pass  # Silently fail audio generation for translated text

        # Generate audio for summary
        if generate_audio and result['summary'] and result['summary'].strip():
            try:
                summary_audio_filename = secure_filename(f'summary_{uuid4().hex}.mp3')
                summary_audio_path = os.path.join(app.config['DOWNLOAD_FOLDER'], summary_audio_filename)
                tts_summary = gTTS(text=result['summary'][:3000], lang=OUTPUT_LANGUAGES[output_lang], slow=False)
                tts_summary.save(summary_audio_path)
                result['summary_audio_file'] = summary_audio_filename
            except Exception as audio_error:
                pass  # Silently fail audio generation for summary

        # Clean up uploaded image
        os.unlink(image_path)
        
        return jsonify({'success': True, 'result': result})
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/translate_text', methods=['POST'])
def translate_text():
    """Translate raw OCR text and optionally generate audio or summary"""
    try:
        ocr_text = request.form.get('ocr_text', '').strip()
        output_lang = request.form.get('output_lang')
        generate_audio = request.form.get('generate_audio') == 'true'
        show_summary = request.form.get('show_summary') == 'true'
        ocr_lang = request.form.get('ocr_lang', None)

        if not ocr_text:
            return jsonify({'success': False, 'error': 'OCR text is required for translation'})
        if not output_lang:
            return jsonify({'success': False, 'error': 'Output language is required'})

        translated_text = None
        translation_error = None
        if ocr_text and (ocr_lang is None or OCR_LANGUAGES.get(ocr_lang) != OUTPUT_LANGUAGES[output_lang]):
            try:
                if len(ocr_text) <= 5000:
                    translated_text = GoogleTranslator(source='auto', target=OUTPUT_LANGUAGES[output_lang]).translate(ocr_text)
                else:
                    chunks = [ocr_text[i:i+5000] for i in range(0, len(ocr_text), 5000)]
                    translated_chunks = []
                    for chunk in chunks:
                        translated_chunks.append(GoogleTranslator(source='auto', target=OUTPUT_LANGUAGES[output_lang]).translate(chunk))
                    translated_text = ' '.join(translated_chunks)
            except Exception as trans_error:
                translated_text = f"Translation failed: Please check your internet connection."
                translation_error = str(trans_error)
        else:
            translated_text = "Source and target languages are the same - no translation needed"

        summary = None
        if show_summary:
            paragraphs = [p for p in translated_text.split('\n\n') if p.strip()]
            summary = '\n\n'.join(paragraphs[:3])

        translated_audio_file = None
        if generate_audio and translated_text and translated_text.strip() and "no translation needed" not in translated_text.lower() and "Translation failed" not in translated_text:
            try:
                translated_audio_filename = secure_filename(f'translated_{uuid4().hex}.mp3')
                translated_audio_path = os.path.join(app.config['DOWNLOAD_FOLDER'], translated_audio_filename)
                tts_translated = gTTS(text=translated_text[:3000], lang=OUTPUT_LANGUAGES[output_lang], slow=False)
                tts_translated.save(translated_audio_path)
                translated_audio_file = translated_audio_filename
            except Exception as audio_error:
                pass  # Silently fail audio generation, the translated text is still available

        return jsonify({
            'success': True,
            'result': {
                'ocr_text': ocr_text,
                'translated_text': translated_text,
                'summary': summary,
                'translated_audio_file': translated_audio_file,
                'ocr_lang': ocr_lang,
                'output_lang': output_lang,
                'translation_error': translation_error
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/audio/<filename>')
def serve_audio(filename):
    try:
        audio_path = os.path.join(app.config['DOWNLOAD_FOLDER'], secure_filename(filename))
        return send_file(audio_path, mimetype='audio/mpeg')
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/download_audio/<filename>')
def download_audio(filename):
    try:
        audio_path = os.path.join(app.config['DOWNLOAD_FOLDER'], secure_filename(filename))
        return send_file(audio_path, as_attachment=True, download_name='output.mp3')
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)