from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from RuleBasedScriptToCheckBugsV04_1 import clean_json_iterative, save_cleaned_json, keys, keys_applied_length, clean_json_single_rule
from rule_processor import clean_json_stepwise
from helpers import normalize, extract_changed_parts_fast
import json
import os
from copy import deepcopy
from threading import Thread

# Using pure Python helpers (C++ acceleration disabled)

app = Flask(__name__)
CORS(app)

# Global state to track processing
processing_state = {
    'all_changes': [],  # Precomputed list of all rule changes
    'current_index': 0,  # Current position in the changes list
    'upload_progress': {
        'status': 'idle',  # 'idle', 'precomputing', 'complete'
        'current_rule': 0,
        'total_rules': 18,  # Total rules to check (1-18)
        'message': ''
    }
}

def precompute_all_changes(original_data):
    """
    Precompute all rule changes upfront for faster accept/reject.
    Returns a list of all changes with their metadata.
    Updates progress state for frontend tracking.
    """
    all_changes = []
    current_data = original_data
    skip_rules = []
    
    # Update progress state
    processing_state['upload_progress']['status'] = 'precomputing'
    processing_state['upload_progress']['current_rule'] = 0
    processing_state['upload_progress']['total_rules'] = 18  # Set total upfront
    processing_state['upload_progress']['message'] = 'Starting analysis...'
    
    print("Starting precomputation of all changes...")
    max_iterations = 100  # Safety limit
    iteration = 0
    rules_checked = 0
    
    while iteration < max_iterations:
        iteration += 1
        
        # Update progress based on rules checked (will be updated below)
        processing_state['upload_progress']['current_rule'] = rules_checked
        processing_state['upload_progress']['message'] = f'Checking rules...'
        
        # Find the next change
        before_fragment, after_fragment, found_rule, complete_after, complete_before = clean_json_stepwise(
            current_data, 
            skip_rules=skip_rules
        )
        
        # If no more changes, we're done
        if found_rule is None or before_fragment is None:
            print(f"No more changes found after {len(all_changes)} rules")
            rules_checked = 18  # Mark all rules as checked
            processing_state['upload_progress']['current_rule'] = rules_checked
            processing_state['upload_progress']['message'] = f'Found {len(all_changes)} changes'
            break
        
        # Increment rules checked
        rules_checked += 1
        
        print(f"Found change for rule {found_rule}")
        processing_state['upload_progress']['current_rule'] = rules_checked
        processing_state['upload_progress']['message'] = f'Found change in rule {found_rule}'
        
        # Extract the diff for display
        changed_parts = extract_changed_parts_fast(before_fragment, normalize(after_fragment))
        
        change_record = {
            'rule_number': found_rule,
            'before_fragment': before_fragment,
            'after_fragment': after_fragment,
            'before_diff': changed_parts["tree"]["before"],
            'after_diff': changed_parts["tree"]["after"],
            'complete_before': complete_before,
            'complete_after': complete_after
        }
        all_changes.append(change_record)
        
        # Update current_data to include this change and skip this rule
        current_data = complete_after
        skip_rules.append(found_rule)
    
    print(f"Precomputed {len(all_changes)} total changes")
    
    # Mark as complete
    processing_state['upload_progress']['status'] = 'complete'
    processing_state['upload_progress']['current_rule'] = 18  # All 18 rules checked
    processing_state['upload_progress']['message'] = f'Complete! Found {len(all_changes)} changes'
    
    return all_changes

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
    # Check if it's a file upload or JSON data in body
    if request.is_json:
        # JSON data sent in request body (for Accept All & Download)
        try:
            request_data = request.get_json()
            data = request_data.get('json_data')
            skip_rules = request_data.get('skip_rules', [])
            
            if not data:
                return jsonify({'error': 'No json_data provided'}), 400
        except Exception as e:
            return jsonify({'error': f'Invalid JSON data: {str(e)}'}), 400
    else:
        # Traditional file upload
        if 'file' not in request.files:
            return jsonify({'error': 'No file part'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400
        
        try:
            data = json.load(file)
            skip_rules = []
        except Exception as e:
            return jsonify({'error': f'Invalid JSON: {str(e)}'}), 400
    
    try:
        cleaned = clean_json_iterative(data, skip_rules=skip_rules)
        
        # Get FIRST change immediately (fast!)
        before_fragment, after_fragment, current_rule, complete_after_json, complete_before_json = clean_json_stepwise(data, skip_rules=[])
        
        if before_fragment:
            changed_parts = extract_changed_parts_fast(before_fragment, normalize(after_fragment))
        else:
            changed_parts = {"tree": {"before": None, "after": None}}
        
        # Store initial state
        processing_state['original_data'] = data
        processing_state['skip_rules'] = []
        processing_state['current_index'] = 0
        processing_state['all_changes'] = []  # Will be filled by background thread
        processing_state['upload_progress']['status'] = 'precomputing'
        
        # OPTIMIZATION: Start background thread to precompute remaining changes
        def background_precompute():
            print("🚀 Starting background precomputation...")
            all_changes = precompute_all_changes(data)
            processing_state['all_changes'] = all_changes
            print(f"✅ Background precomputation complete: {len(all_changes)} changes")
        
        thread = Thread(target=background_precompute, daemon=True)
        thread.start()
        print("📤 Returning first rule immediately, precomputing rest in background...")
        
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
    """Endpoint to reject changes - uses precomputed list (always ready)"""
    try:
        data = request.get_json()
        skip_rules = data.get('skip_rules', [])
        current_rule = data.get('current_rule')
        
        # Add current rule to skip list
        if current_rule and current_rule not in skip_rules:
            skip_rules.append(current_rule)
        
        # Use precomputed changes (background thread already finished by now)
        all_changes = processing_state.get('all_changes', [])
        processing_state['current_index'] += 1
        current_index = processing_state.get('current_index', 0)
        
        # Find next non-rejected change
        while current_index < len(all_changes):
            next_change = all_changes[current_index]
            if next_change['rule_number'] not in skip_rules:
                result = {
                    "BEFORE": next_change['before_diff'],
                    "AFTER": next_change['after_diff'],
                    "CURRENT_RULE": next_change['rule_number'],
                    "Complete_after_data": next_change['complete_after'],
                    "Complete_before_data": next_change['complete_before'],
                    "Before_data": next_change['before_fragment'],
                    "After_data": next_change['after_fragment'],
                    "MORE_CHANGES": True,
                    "SKIP_RULES": skip_rules
                }
                return jsonify({'status': 'rejected', 'message': 'Changes rejected', **result})
            processing_state['current_index'] += 1
            current_index = processing_state['current_index']
        
        # No more changes
        return jsonify({
            'status': 'rejected',
            'message': 'All changes processed',
            "BEFORE": None,
            "AFTER": None,
            "CURRENT_RULE": None,
            "MORE_CHANGES": False,
            "SKIP_RULES": skip_rules
        })
        
    except Exception as e:
        return jsonify({'error': f'Processing error: {str(e)}'}), 500

@app.route('/accept-changes', methods=['POST'])
def accept_changes():
    """Endpoint to accept changes - uses precomputed list (always ready)"""
    try:
        data = request.get_json()
        skip_rules = data.get('skip_rules', [])
        current_rule = data.get('current_rule')
        
        # Add current rule to skip list
        if current_rule and current_rule not in skip_rules:
            skip_rules.append(current_rule)
        
        # Use precomputed changes (background thread already finished by now)
        all_changes = processing_state.get('all_changes', [])
        processing_state['current_index'] += 1
        current_index = processing_state.get('current_index', 0)
        
        # Find next non-rejected change
        while current_index < len(all_changes):
            next_change = all_changes[current_index]
            if next_change['rule_number'] not in skip_rules:
                result = {
                    "BEFORE": next_change['before_diff'],
                    "AFTER": next_change['after_diff'],
                    "CURRENT_RULE": next_change['rule_number'],
                    "Complete_after_data": next_change['complete_after'],
                    "Complete_before_data": next_change['complete_before'],
                    "Before_data": next_change['before_fragment'],
                    "After_data": next_change['after_fragment'],
                    "MORE_CHANGES": True,
                    "SKIP_RULES": skip_rules
                }
                return jsonify({'status': 'accepted', 'message': 'Changes accepted', **result})
            processing_state['current_index'] += 1
            current_index = processing_state['current_index']
        
        # No more changes
        return jsonify({
            'status': 'accepted',
            'message': 'All changes processed',
            "BEFORE": None,
            "AFTER": None,
            "CURRENT_RULE": None,
            "MORE_CHANGES": False,
            "SKIP_RULES": skip_rules
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

@app.route('/upload-progress', methods=['GET'])
def get_upload_progress():
    """Get the current upload/precomputation progress"""
    return jsonify(processing_state['upload_progress'])

@app.route('/keys-applied-length', methods=['GET'])
def keys_applied_length_api():
    """Get the count of rules that will be processed (from precomputed list)"""
    print("DEBUG API: keys_applied_length")
    total_changes = len(processing_state.get('all_changes', []))
    return jsonify({'keys_applied_length': total_changes})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)