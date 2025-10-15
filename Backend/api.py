from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from RuleBasedScriptToCheckBugsV04_1 import clean_json_iterative, save_cleaned_json, keys, keys_applied_length, clean_json_single_rule
from rule_processor import clean_json_stepwise
from helpers import normalize, extract_changed_parts_fast
import json
import os
from copy import deepcopy
from threading import Thread
from concurrent.futures import ThreadPoolExecutor

# Using pure Python helpers (C++ acceleration disabled)

app = Flask(__name__)
CORS(app)

# Global state to track processing
processing_state = {
    'all_changes': []  # Precomputed list (filled by background thread)
}

def clean_json_parallel(data, skip_rules=None):
    """
    Process JSON in parallel for faster cleaning.
    Splits top-level arrays and processes them concurrently.
    """
    if skip_rules is None:
        skip_rules = []
    
    # Check if data has parallelizable structure
    if not isinstance(data, dict):
        # Not a dict, just use normal iterative
        return clean_json_iterative(data, skip_rules=skip_rules)
    
    # Identify arrays that can be processed in parallel
    parallel_keys = []
    for key in ['assetAdministrationShells', 'submodels', 'conceptDescriptions']:
        if key in data and isinstance(data[key], list) and len(data[key]) > 0:
            parallel_keys.append(key)
    
    # If no parallelizable arrays, use normal processing
    if not parallel_keys:
        return clean_json_iterative(data, skip_rules=skip_rules)
    
    try:
        def clean_array(key_value_pair):
            key, value = key_value_pair
            # clean_json_iterative already does deepcopy internally, no need to copy here
            cleaned = clean_json_iterative(value, skip_rules=skip_rules)
            return key, cleaned
        
        # Process arrays in parallel
        with ThreadPoolExecutor(max_workers=min(len(parallel_keys), 4)) as executor:
            # Submit all parallel tasks
            key_value_pairs = [(key, data[key]) for key in parallel_keys]
            results = executor.map(clean_array, key_value_pairs)
        
        # Build result dict
        result = {}
        for key, cleaned_value in results:
            result[key] = cleaned_value
        
        # Add any remaining non-parallelized fields
        for key, value in data.items():
            if key not in parallel_keys:
                if isinstance(value, (dict, list)):
                    result[key] = clean_json_iterative(value, skip_rules=skip_rules)
                else:
                    result[key] = value
        
        return result
        
    except Exception as e:
        # Silently fall back to sequential processing
        return clean_json_iterative(data, skip_rules=skip_rules)

def precompute_all_changes(original_data):
    """
    Precompute all rule changes in background (optimistic - assumes accepts).
    Runs silently without UI feedback.
    """
    all_changes = []
    current_data = original_data
    skip_rules = []
    
    max_iterations = 100
    iteration = 0
    
    while iteration < max_iterations:
        iteration += 1
        
        # Find the next change
        before_fragment, after_fragment, found_rule, complete_after, complete_before = clean_json_stepwise(
            current_data, 
            skip_rules=skip_rules,
            snapshot=False  # Skip expensive deep copies in background - we don't display these directly
        )
        
        # If no more changes, we're done
        if found_rule is None or before_fragment is None:
            break
        
        # Fragments are always snapshotted, but complete_before might be None (when snapshot=False)
        # If complete_before is None, snapshot current_data as the before state
        if complete_before is None:
            complete_before = json.loads(json.dumps(current_data))
        
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
        # Use parallel processing for faster cleaning
        cleaned = clean_json_parallel(data, skip_rules=skip_rules)
        
        # Get FIRST change immediately (fast!)
        before_fragment, after_fragment, current_rule, complete_after_json, complete_before_json = clean_json_stepwise(data, skip_rules=[])
        
        if before_fragment:
            changed_parts = extract_changed_parts_fast(before_fragment, normalize(after_fragment))
        else:
            changed_parts = {"tree": {"before": None, "after": None}}
        
        # Store the original data for step-by-step processing
        processing_state['original_data'] = data
        processing_state['skip_rules'] = []
        processing_state['all_changes'] = []  # Will be filled by background
        
        # Start background thread to precompute remaining changes (silent)
        def background_precompute():
            try:
                all_changes = precompute_all_changes(data)
                processing_state['all_changes'] = all_changes
            except Exception as e:
                pass  # Silently handle errors
        
        thread = Thread(target=background_precompute, daemon=True)
        thread.start()
        
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
    """Endpoint to reject changes - invalidates precomputed list and uses old method"""
    try:
        data = request.get_json()
        if not data or 'current_data' not in data:
            return jsonify({'error': 'Current data is required'}), 400
        
        current_data = data['current_data']
        skip_rules = data.get('skip_rules', [])
        current_rule = data.get('current_rule')
        
        # Add the current rule to skip list
        if current_rule and current_rule not in skip_rules:
            skip_rules.append(current_rule)
        
        # REJECT invalidates precomputed list (it assumed all accepts)
        processing_state['all_changes'] = []  # Clear the list
        
        # Use old method (precomputed list is invalid after reject)
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
    """Endpoint to accept changes - uses precomputed list until reject"""
    try:
        data = request.get_json()
        skip_rules = data.get('skip_rules', [])
        current_rule = data.get('current_rule')
        complete_after_data = data.get('complete_after_data')
        
        # Add current rule to skip list
        if current_rule and current_rule not in skip_rules:
            skip_rules.append(current_rule)
        
        all_changes = processing_state.get('all_changes', [])
        
        # Use precomputed list if available (background done)
        if all_changes and len(all_changes) > 0:
            # FAST PATH: Use precomputed changes
            
            # Start from beginning and skip all rules in skip_rules
            # This handles the case where user used old method for first few accepts
            current_index = 0
            
            # Find next non-processed change
            while current_index < len(all_changes):
                next_change = all_changes[current_index]
                if next_change['rule_number'] not in skip_rules:
                    # Found next non-processed rule
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
                # Skip this rule, check next
                current_index += 1
            
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
        else:
            # FALLBACK: Background not ready yet, use old method
            
            if complete_after_data and current_rule:
                cleaned_data, changes_made = clean_json_single_rule(complete_after_data, current_rule)
                processing_state['original_data'] = cleaned_data
                processing_state['skip_rules'] = skip_rules
                
                result = process_json_data_step_by_step(cleaned_data, skip_rules=skip_rules)
                result['SKIP_RULES'] = skip_rules
                
                return jsonify({'status': 'accepted', 'message': 'Changes accepted', **result})
            else:
                return jsonify({'error': 'Complete after data not provided'}), 400
        
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

@app.route('/keys-applied-length', methods=['GET'])
def keys_applied_length_api():
    """Get the count of rules that have been applied"""
    return jsonify({'keys_applied_length': keys_applied_length()})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)