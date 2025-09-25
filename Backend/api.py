from platform import java_ver
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from RuleBasedScriptToCheckBugsV04_1 import clean_json_iterative, save_cleaned_json, keys
from rule_processor import clean_json_stepwise # Import from new file
from helpers import  normalize, extract_changed_parts_fast
import json
import os
import traceback
from copy import deepcopy

# Using pure Python helpers (C++ acceleration disabled)

app = Flask(__name__)
CORS(app)

# Global state to track processing
processing_state = {}

def process_json_data_step_by_step(input_data, skip_rules=None):
    """
    Process JSON data through the cleaning pipeline step by step.
    Returns one change at a time for user review.
    """
    try:
        # Process the data through the cleaning pipeline
        before, after, current_rule, complete_after, complete_before = clean_json_stepwise(input_data, skip_rules=skip_rules)

        
        
        # Check if any change was made
        if current_rule is None or current_rule == 0:
            return {
                "BEFORE": None,
                "AFTER": None,
                "CURRENT_RULE": None,
                "MORE_CHANGES": False,
                "MESSAGE": "No more changes found. Processing complete."
            }
        
        # Log specific details about the change
        # Extract only the changed parts - compare before vs after
        changed_parts = extract_changed_parts_fast(before, normalize(after))
        
        
        return {
            "BEFORE": changed_parts["tree"]["before"],
            "AFTER": changed_parts["tree"]["after"],
            "CURRENT_RULE": current_rule,
            "Complete_after_data": complete_after,
            "Complete_before_data": complete_before,
            "MORE_CHANGES": True,
            "MESSAGE": f"Rule {current_rule} applied. Review the changes below."
        }
        
    except Exception as e:
        raise e

@app.route('/upload', methods=['POST'])
def upload_json():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    try:
        data = json.load(file)
    except Exception as e:
        return jsonify({'error': f'Invalid JSON: {str(e)}'}), 400
    
    try:
        cleaned = clean_json_iterative(data)
        
        # Process the data through the cleaning pipeline for diff tracking
        before_fragment, after_fragment, current_rule, complete_after_json, complete_before_json = clean_json_stepwise(data, skip_rules=[])
        
        # Extract only the changed parts - compare before vs after
        changed_parts = extract_changed_parts_fast(before_fragment, normalize(after_fragment))
        print("After data: ", after_fragment)
        
        # Store the original data for step-by-step processing
        processing_state['original_data'] = data
        processing_state['skip_rules'] = []
        
        # Optionally save the cleaned file
        save_file = request.form.get('save_file', 'false').lower() == 'true'
        if save_file:
            try:
                filename = save_cleaned_json(cleaned)
                return jsonify({
                    'cleaned_data': cleaned,
                    'saved_file': filename,
                    'download_url': f'/download/{filename}',
                    'BEFORE': changed_parts["tree"]["before"], 
                    'AFTER': changed_parts["tree"]["after"]
                })
            except Exception as e:
                # Continue without saving, just return the cleaned data
                pass

        return jsonify({
            "JSON": cleaned, 
            "KEYS": keys(), 
            "Before_data": before_fragment,
            "After_data": after_fragment,
            "Complete_after_data": complete_after_json,
            "Complete_before_data": complete_before_json,
            "CURRENT_RULE": current_rule,
            "SKIP_RULES": processing_state['skip_rules'],
            "BEFORE": changed_parts["tree"]["before"], 
            "AFTER": changed_parts["tree"]["after"]
        })
        
    except Exception as e:
        return jsonify({'error': f'Processing error: {str(e)}'}), 500

@app.route('/get-next-change', methods=['POST'])
def get_next_change():
    """Get the next change in the step-by-step processing"""
    try:
        data = request.get_json()
        if not data or 'current_data' not in data:
            return jsonify({'error': 'Current data is required'}), 400
        
        current_data = data['current_data']
        skip_rules = data.get('skip_rules', [])
        
        result = process_json_data_step_by_step(current_data, skip_rules=skip_rules)
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': f'Processing error: {str(e)}'}), 500

@app.route('/reject-changes', methods=['POST'])
def reject_changes():
    """Endpoint to reject changes and try next available rule"""
    try:
        data = request.get_json()
        if not data or 'current_data' not in data:
            return jsonify({'error': 'Current data is required'}), 400
        
        current_data = data['current_data']
        skip_rules = data.get('skip_rules', [])
        
        # Add the current rule to skip list
        if 'current_rule' in data and data['current_rule']:
            skip_rules.append(data['current_rule'])
        
        result = process_json_data_step_by_step(current_data, skip_rules=skip_rules)
        
        # Add the updated skip_rules to the result
        result['SKIP_RULES'] = skip_rules
        
        return jsonify({
            'status': 'rejected',
            'message': 'Changes rejected, trying next available rule',
            **result
        })
        
    except Exception as e:
        return jsonify({'error': f'Processing error: {str(e)}'}), 500

@app.route('/accept-changes', methods=['POST'])
def accept_changes():
    """Endpoint to accept changes and apply cleaned data"""
    try:
        data = request.get_json()
        if not data or 'current_data' not in data or 'after_data' not in data:
            return jsonify({'error': 'Current data and after data are required'}), 400
        
        current_data = data['current_data']
        after_data = data['after_data']
        skip_rules = data.get('skip_rules', [])
        
       
        print(f"DEBUG ACCEPT: skip_rules: {skip_rules}")
        print(f"DEBUG ACCEPT: after_data keys: {list(after_data.keys()) if isinstance(after_data, dict) else 'not a dict'}")
        print(f"DEBUG ACCEPT: after_data content: {json.dumps(after_data, indent=2)}")
        print(f"DEBUG ACCEPT: current_data content: {json.dumps(current_data, indent=2)}")
        
        # Use the complete JSON data that was returned from the initial processing
        # This contains the full JSON with the accepted change already applied
        complete_after_data = data.get('complete_after_data')
        if complete_after_data:
            # Use the complete JSON with the change applied
            processing_state['original_data'] = complete_after_data
            processing_state['skip_rules'] = skip_rules
            
            # Re-run the entire cleaning process with the updated data
            result = process_json_data_step_by_step(complete_after_data, skip_rules=skip_rules)
            
            # Add the current skip_rules to the result
            result['SKIP_RULES'] = skip_rules
        else:
            # This should not happen with the new approach, but keep as safety fallback
            return jsonify({'error': 'Complete after data not provided'}), 400
        
        return jsonify({
            'status': 'accepted',
            'message': 'Changes accepted and applied',
            **result
        })
        
    except Exception as e:
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

@app.route('/download-current-state', methods=['POST'])
def download_current_state():
    """Endpoint to download the current state of JSON during step-by-step processing"""
    try:
        data = request.get_json()
        if not data or 'current_data' not in data:
            return jsonify({'error': 'Current data is required'}), 400
        
        current_data = data['current_data']
        
        # Create a temporary filename
        import time
        filename = f"current_state_{int(time.time())}.json"
        
        # Save the current data to a temporary file
        project_root = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
        file_path = os.path.join(project_root, filename)
        
        with open(file_path, 'w') as f:
            json.dump(current_data, f, indent=2)
        
        return jsonify({
            'success': True,
            'filename': filename,
            'download_url': f'/download/{filename}'
        })
        
    except Exception as e:
        return jsonify({'error': f'Error creating download: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
