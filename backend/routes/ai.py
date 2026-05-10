import google.generativeai as genai
from flask import Blueprint, request, jsonify, g
from database import db_required
import json
import time

ai_bp = Blueprint("ai", __name__)

def get_gemini_key():
    # Fetch key from database settings
    row = g.db.execute("SELECT value FROM settings WHERE key = 'gemini_api_key'").fetchone()
    return row["value"] if row else None

@ai_bp.route("/suggest-prescription", methods=["POST"])
@db_required
def suggest_prescription():
    api_key = get_gemini_key()
    if not api_key:
        return jsonify({"error": "Gemini API key is not set in settings."}), 400

    data = request.json
    diagnosis = data.get("diagnosis", "")
    age = data.get("age", "")
    gender = data.get("gender", "")

    if not diagnosis:
        return jsonify({"error": "Diagnosis is required."}), 400

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-pro')

        prompt = f"""
        You are an expert dental assistant AI. 
        Patient Info: Age: {age}, Gender: {gender}.
        Diagnosis/Complaints: {diagnosis}

        Suggest a professional dental prescription in JSON format.
        Each drug must have:
        - name: Drug name (English)
        - dose: e.g., 500mg, 1g
        - timing: e.g., 3 times daily, after food
        - duration: e.g., 5 days, 1 week
        - form: e.g., Tablet, Capsule, Syrup
        - note: Brief instruction in Arabic (e.g., تجنب شرب الحليب معه)

        Return ONLY the JSON array of drugs. No extra text.
        Example format:
        [
          {{"name": "Amoxicillin", "dose": "500mg", "timing": "3 times daily", "duration": "5 days", "form": "Capsule", "note": "بعد الأكل"}}
        ]
        """

        genai.configure(api_key=api_key)
        
        # قائمة الموديلات المتاحة لهذا المفتاح
        try:
            # Prioritize Gemini 1.5 Flash 8B (Higher free rate limits)
            selected_model = "models/gemini-1.5-flash-8b"
            try:
                genai.get_model(selected_model)
            except:
                available_models = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
                selected_model = next((m for m in available_models if "1.5-flash-8b" in m), None) or \
                                 next((m for m in available_models if "1.5-flash" in m), None) or \
                                 available_models[0]
            
            if not selected_model:
                return jsonify({"error": "No compatible Gemini models found for this API key."}), 404
                
            model = genai.GenerativeModel(selected_model)
            
            response = None
            for attempt in range(5):
                try:
                    response = model.generate_content(prompt)
                    break
                except Exception as e:
                    if "429" in str(e) and attempt < 4:
                        wait_time = (attempt + 1) * 4 # 4s, 8s, 12s, 16s
                        time.sleep(wait_time)
                        continue
                    raise e
        except Exception as e:
            return jsonify({"error": f"AI Error: {str(e)}. Please check if your API key is correct and has access to Gemini."}), 500

        if not response or not response.text:
            return jsonify({"error": "AI returned an empty response. Please try again."}), 500

        # Clean response text
        clean_json = response.text.replace("```json", "").replace("```", "").strip()
        try:
            suggestions = json.loads(clean_json)
            return jsonify(suggestions)
        except Exception as json_err:
            return jsonify({"error": f"AI Response was not valid JSON: {response.text}"}), 500

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"AI Suggestion Error: {str(e)}"}), 500

@ai_bp.route("/complete-drug", methods=["POST"])
@db_required
def complete_drug():
    api_key = get_gemini_key()
    if not api_key:
        return jsonify({"error": "Gemini API key is not set in settings."}), 400

    data = request.json
    drug_name = data.get("drug_name", "")
    age = data.get("age", "")

    if not drug_name:
        return jsonify({"error": "Drug name is required."}), 400

    try:
        genai.configure(api_key=api_key)
        
        prompt = f"""
        You are a dental pharmacology expert. 
        Drug Name: {drug_name}
        Patient Age: {age}

        Provide full dental usage details in JSON format. 
        IMPORTANT: You MUST choose values from these lists ONLY:
        - category: [Analgesics, Antibiotics, Anti-inflammatories, Antivirals & Antifungals, Corticosteroids, Others]
        - form: [Tablets, Capsules, Syrup, Injection, Drops, Ointment, Cream, Gel, Suppositories, Spray, Patch, Mouthwash]
        - timing: [Once daily, Twice daily, Three times daily, Four times daily, Every 8 hours, Every 12 hours, As needed]
        - duration: [1 day, 2 days, 3 days, 4 days, 5 days, 7 days, 10 days, 14 days]

        Fields to return:
        - category: (from list)
        - dose: numeric value ONLY (e.g. 500)
        - timing: (from list)
        - duration: (from list)
        - form: (from list)
        - max_daily_dose: maximum safe daily limit in mg (numeric)
        - note: Brief instruction in Arabic
        - warn_pregnant, warn_breastfeed, warn_renal, warn_hepatic, warn_allergy, warn_diabetes, warn_blood_pressure: (medical advice)

        Return ONLY the JSON object.
        """

        # Prioritize Gemini 1.5 Flash 8B (Higher free rate limits)
        selected_model = "models/gemini-1.5-flash-8b"
        try:
            genai.get_model(selected_model)
        except:
            available_models = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
            selected_model = next((m for m in available_models if "1.5-flash-8b" in m), None) or \
                             next((m for m in available_models if "1.5-flash" in m), None) or \
                             (available_models[0] if available_models else "models/gemini-1.5-flash-8b")

        model = genai.GenerativeModel(selected_model)
        
        response = None
        for attempt in range(5):
            try:
                response = model.generate_content(prompt)
                break
            except Exception as e:
                if "429" in str(e) and attempt < 4:
                    wait_time = (attempt + 1) * 4 # 4s, 8s, 12s, 16s
                    time.sleep(wait_time)
                    continue
                raise e
        
        if not response or not response.text:
            return jsonify({"error": "AI returned an empty response. Please try again."}), 500
            
        clean_json = response.text.replace("```json", "").replace("```", "").strip()
        try:
            return jsonify(json.loads(clean_json))
        except Exception as json_err:
            return jsonify({"error": f"AI Response was not valid JSON: {response.text}"}), 500

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"AI Completion Error: {str(e)}"}), 500
