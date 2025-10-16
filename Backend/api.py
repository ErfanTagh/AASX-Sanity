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
import time
from datetime import datetime

# Using pure Python helpers (C++ acceleration disabled)

app = Flask(__name__)
CORS(app)

# Configuration for handling large files
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max file size
app.config['JSON_SORT_KEYS'] = False

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
    
    print(f"    clean_json_parallel: skip_rules={skip_rules}")
    
    # Check if data has parallelizable structure
    if not isinstance(data, dict):
        # Not a dict, just use normal iterative
        print("    → Not a dict, using iterative")
        return clean_json_iterative(data, skip_rules=skip_rules)
    
    # Identify arrays that can be processed in parallel
    parallel_keys = []
    for key in ['assetAdministrationShells', 'submodels', 'conceptDescriptions']:
        if key in data and isinstance(data[key], list) and len(data[key]) > 0:
            parallel_keys.append(key)
    
    print(f"    → Found parallel keys: {parallel_keys}")
    
    # If no parallelizable arrays, use normal processing
    if not parallel_keys:
        print("    → No parallel keys, using iterative")
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
    start_time = time.time()
    start_timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"\n🚀 [BACKGROUND THREAD] Precomputation STARTED at {start_timestamp}")
    
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
            print(f"  ✓ No more changes found after {iteration-1} iterations")
            break
        
        print(f"  Background: Rule {found_rule} found (iteration {iteration})")
        
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
    
    end_time = time.time()
    end_timestamp = datetime.now().strftime("%H:%M:%S")
    elapsed = end_time - start_time
    
    print(f"✅ Background FINISHED at {end_timestamp}")
    print(f"⏱️  Total: {elapsed:.2f}s ({len(all_changes)} changes)")
    
    return all_changes

def process_json_data_step_by_step(input_data, skip_rules=None):
    """
    Process JSON data through the cleaning pipeline step by step.
    Returns one change at a time for user review.
    """
    print(f"  [STEP-BY-STEP] Called with skip_rules={skip_rules}")
    try:
        # Process with optimized snapshot=False for speed
        input_copy = json.loads(json.dumps(input_data))  # Deep copy once
        before, after, current_rule, complete_after, complete_before = clean_json_stepwise(input_copy, skip_rules=skip_rules, snapshot=False)
        print(f"  [STEP-BY-STEP] Found rule: {current_rule}")
        
        # Check if any change was made
        if current_rule is None or current_rule == 0:
            return {
                "BEFORE": None,
                "AFTER": None,
                "CURRENT_RULE": None,
                "MORE_CHANGES": False,
                "MESSAGE": "No more changes found. Processing complete."
            }
        
        # Create proper snapshots for display (after finding the change)
        before = json.loads(json.dumps(before))
        after = json.loads(json.dumps(after))
        if complete_before is None:
            complete_before = json.loads(json.dumps(input_data))  # Use original input
        complete_after = json.loads(json.dumps(complete_after)) if complete_after else None
        
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
    print("📤 /upload endpoint called")
    
    # Check if it's a file upload or JSON data in body
    if request.is_json:
        # JSON data sent in request body (for Accept All & Download)
        print("  → Request is JSON data (not file upload)")
        try:
            request_data = request.get_json()
            data = request_data.get('json_data')
            skip_rules = request_data.get('skip_rules', [])
            
            if not data:
                print("  ❌ No json_data provided")
                return jsonify({'error': 'No json_data provided'}), 400
            print(f"  ✓ JSON data loaded, skip_rules: {skip_rules}")
        except Exception as e:
            print(f"  ❌ Error parsing JSON data: {e}")
            return jsonify({'error': f'Invalid JSON data: {str(e)}'}), 400
    else:
        # Traditional file upload
        print("  → Request is file upload")
        if 'file' not in request.files:
            print("  ❌ No file part in request")
            return jsonify({'error': 'No file part'}), 400
        
        file = request.files['file']
        print(f"  → File received: {file.filename}")
        
        if file.filename == '':
            print("  ❌ Empty filename")
            return jsonify({'error': 'No selected file'}), 400
        
        try:
            print(f"  → Attempting to parse JSON from file: {file.filename}")
            data = json.load(file)
            skip_rules = []
            print(f"  ✓ JSON parsed successfully! Size: {len(str(data))} chars")
        except Exception as e:
            print(f"  ❌ JSON parsing error: {e}")
            return jsonify({'error': f'Invalid JSON: {str(e)}'}), 400
    
    print("  → Starting processing...")
    
    # Clear keys_applied global for fresh tracking
    import RuleBasedScriptToCheckBugsV04_1
    RuleBasedScriptToCheckBugsV04_1.keys_applied.clear()
    print("  → Cleared keys_applied tracker")
    
    try:
        # Use parallel processing for faster cleaning
        print(f"  → Running clean_json_parallel with skip_rules={skip_rules}...")
        cleaned = clean_json_parallel(data, skip_rules=skip_rules)
        data_changed = str(data) != str(cleaned)
        print(f"  ✓ Parallel cleaning complete")
        print(f"     - Data changed: {data_changed}")
        print(f"     - keys_applied count: {len(RuleBasedScriptToCheckBugsV04_1.keys_applied)}")
        print(f"     - keys_applied list: {list(set(RuleBasedScriptToCheckBugsV04_1.keys_applied))}")
        
        # Get FIRST change immediately
        print("  → Finding first rule change (FOR USER DISPLAY)...")
        before_fragment, after_fragment, current_rule, complete_after_json, complete_before_json = clean_json_stepwise(data, skip_rules=[])
        print(f"  ✓ First rule found for display: {current_rule}")
        
        if before_fragment:
            changed_parts = extract_changed_parts_fast(before_fragment, normalize(after_fragment))
        else:
            changed_parts = {"tree": {"before": None, "after": None}}
        
        # Store the original data for step-by-step processing
        processing_state['original_data'] = data
        processing_state['skip_rules'] = []
        processing_state['all_changes'] = []  # Will be filled by background
        
        # Start background thread to precompute remaining changes
        print("  → Starting background precomputation thread...")
        def background_precompute():
            try:
                all_changes = precompute_all_changes(data)
                processing_state['all_changes'] = all_changes
                print(f"💾 Stored {len(all_changes)} changes in cache")
            except Exception as e:
                print(f"❌ Background error: {e}")
                import traceback
                traceback.print_exc()
        
        thread = Thread(target=background_precompute, daemon=True)
        thread.start()
        print("  ✓ Background thread started")
        
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
        
        print("  ✓ Preparing response...")
        print(f"  → Response includes:")
        print(f"     - Cleaned JSON: {len(str(cleaned))} chars")
        print(f"     - Current Rule: {current_rule}")
        print(f"     - KEYS count: {len(keys())}")
        
        response = jsonify({
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
        print("✅ /upload completed successfully\n")
        return response
        
    except Exception as e:
        print(f"❌ Processing error: {e}")
        import traceback
        traceback.print_exc()
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