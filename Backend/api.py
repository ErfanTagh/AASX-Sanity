from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS


from RuleBasedScriptToCheckBugsV04_1 import clean_json, save_cleaned_json, keys
import json
import os
import traceback

app = Flask(__name__)
CORS(app)
@app.route('/upload', methods=['POST'])
def upload_json():
    print("=== Upload request received ===")
    print(f"Request method: {request.method}")
    print(f"Request files: {request.files}")
    
    if 'file' not in request.files:
        print("No file part in request")
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    print(f"File received: {file.filename}")
    
    if file.filename == '':
        print("No selected file")
        return jsonify({'error': 'No selected file'}), 400
    
    try:
        print("Attempting to parse JSON...")
        data = json.load(file)
        print(f"JSON parsed successfully. Data type: {type(data)}")
    except Exception as e:
        print(f"Invalid JSON: {e}")
        print(f"Full traceback: {traceback.format_exc()}")
        return jsonify({'error': f'Invalid JSON: {str(e)}'}), 400
    
    try:
        print("Calling clean_json function...")
        cleaned = clean_json(data)
        keys_applied = keys()

        # Optionally save the cleaned file
        save_file = request.form.get('save_file', 'false').lower() == 'true'
        if save_file:
            try:
                filename = save_cleaned_json(cleaned)
                print(f"Saved cleaned file: {filename}")
                return jsonify({
                    'cleaned_data': cleaned,
                    'saved_file': filename,
                    'download_url': f'/download/{filename}'
                })
            except Exception as e:
                print(f"Error saving file: {e}")
                # Continue without saving, just return the cleaned data

        return  jsonify({"JSON": cleaned, "KEYS": keys()})
        
    except Exception as e:
        print(f"Error in clean_json: {e}")
        print(f"Full traceback: {traceback.format_exc()}")
        return jsonify({'error': f'Processing error: {str(e)}'}), 500
@app.route('/download/<filename>', methods=['GET'])
def download_file(filename):
    # Only allow .json files and prevent directory traversal
    if not filename.endswith('.json') or '/' in filename or '\\' in filename:
        return jsonify({'error': 'Invalid filename'}), 400
    project_root = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
    file_path = os.path.join(project_root, filename)
    if not os.path.isfile(file_path):
        return jsonify({'error': 'File not found'}), 404
    return send_from_directory(project_root, filename, as_attachment=True)

if __name__ == '__main__':
    app.run(debug=True)
