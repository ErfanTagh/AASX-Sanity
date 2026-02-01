import json

# =============================================================================
# HELPERS
# =============================================================================

def del_key(obj, keys_to_delete):
    """Helper function to delete keys from object"""
    for key in keys_to_delete:
        obj.pop(key, None)
    return obj

# =============================================================================
# GENERAL RULE FUNCTIONS (4 general rules)
# =============================================================================

def rule_1_remove_empty_lists(obj):
    """
    Remove fields with empty arrays [].
    Checks all keys in the object and removes any that have empty list values.
    """
    if not isinstance(obj, dict):
        return obj, False
    
    keys_to_delete = []
    for key, value in obj.items():
        if isinstance(value, list) and len(value) == 0:
            keys_to_delete.append(key)
    
    if keys_to_delete:
        obj = del_key(obj, keys_to_delete)
        return obj, True
    return obj, False

def rule_2_remove_empty_strings(obj):
    """
    Remove fields with empty or whitespace-only strings "".
    Checks all keys in the object and removes any that have empty or whitespace-only string values.
    """
    if not isinstance(obj, dict):
        return obj, False
    
    keys_to_delete = []
    for key, value in obj.items():
        if isinstance(value, str) and value.strip() == "":
            keys_to_delete.append(key)
    
    if keys_to_delete:
        obj = del_key(obj, keys_to_delete)
        return obj, True
    return obj, False

def rule_3_remove_null_values(obj):
    """
    Remove fields with null values.
    Checks all keys in the object and removes any that have None/null values.
    """
    if not isinstance(obj, dict):
        return obj, False
    
    keys_to_delete = []
    for key, value in obj.items():
        if value is None:
            keys_to_delete.append(key)
    
    if keys_to_delete:
        obj = del_key(obj, keys_to_delete)
        return obj, True
    return obj, False

def rule_4_remove_empty_objects(obj):
    """
    Remove fields with empty objects {}.
    Checks all keys in the object and removes any that have empty dictionary values.
    """
    if not isinstance(obj, dict):
        return obj, False
    
    keys_to_delete = []
    for key, value in obj.items():
        if isinstance(value, dict) and len(value) == 0:
            keys_to_delete.append(key)
    
    if keys_to_delete:
        obj = del_key(obj, keys_to_delete)
        return obj, True
    return obj, False

# =============================================================================
# STEPWISE CLEANER (type-aware dispatcher)
# =============================================================================

def clean_json_stepwise(obj, keys_to_clean=None, skip_rules=None, snapshot=True):
    """
    Runs the cleaning rules until the first change is found.
    Returns (before_fragment, after_fragment, rule_num, complete_after_json, complete_before_json).
    If no change is found, returns (None, None, None, None, None).
    complete_after_json is the full JSON with the change applied.
    complete_before_json is the full JSON before the change was applied.
    rule_num is the rule that was applied (needed for rejection handling).
    """
    print(f"    → clean_json_stepwise called (snapshot={snapshot}, skip_rules={skip_rules})")
    
    if skip_rules is None:
        skip_rules = []
    
    # General rules - apply to all fields in dictionaries
    dict_rules = [
        (1, rule_1_remove_empty_lists),
        (2, rule_2_remove_empty_strings),
        (3, rule_3_remove_null_values),
        (4, rule_4_remove_empty_objects),
    ]
    list_rules = []  # No list-specific rules needed for general cleaning

    root = obj
    stack = [(None, None, obj)]  # (parent, key, current)
    items_processed = 0

    while stack:
        parent, key, current = stack.pop()
        items_processed += 1
        
        if items_processed % 100 == 0:  # Log every 100 items
            print(f"      Scanning tree: {items_processed} items processed...")

        # Dict rules
        if isinstance(current, dict):
            
            for rule_num, rule_func in dict_rules:
                if rule_num in skip_rules:
                    continue
                # Always snapshot fragments (needed for diff), but optionally skip complete snapshots
                before_fragment = json.loads(json.dumps(current))
                complete_before = json.loads(json.dumps(root)) if (snapshot and root is not None) else None
                
                modified, changed = rule_func(current)
                if changed:
                    print(f"    ✓ FOUND CHANGE: Rule {rule_num} (scanned {items_processed} items)")
                    
                    if parent is None:
                        root = modified
                    else:
                        parent[key] = modified
                    
                    after_fragment = json.loads(json.dumps(modified))
                    complete_after = json.loads(json.dumps(root)) if (snapshot and root is not None) else root
                    
                    return before_fragment, after_fragment, rule_num, complete_after, complete_before

            for child_key, child_val in current.items():
                if isinstance(child_val, (dict, list)):
                    stack.append((current, child_key, child_val))

        # List rules
        elif isinstance(current, list):
            for rule_num, rule_func in list_rules:
                if rule_num in skip_rules:
                    continue
                # Always snapshot fragments (needed for diff), but optionally skip complete snapshots
                before_fragment = json.loads(json.dumps(current))
                complete_before = json.loads(json.dumps(root)) if (snapshot and root is not None) else None
                
                modified, changed = rule_func(current)
                if changed:
                    print(f"    ✓ FOUND CHANGE: Rule {rule_num} (scanned {items_processed} items)")
                    
                    if parent is None:
                        root = modified
                    else:
                        parent[key] = modified
                    
                    after_fragment = json.loads(json.dumps(modified))
                    complete_after = json.loads(json.dumps(root)) if (snapshot and root is not None) else root
                    
                    return before_fragment, after_fragment, rule_num, complete_after, complete_before

            for idx, child_val in enumerate(current):
                if isinstance(child_val, (dict, list)):
                    stack.append((current, idx, child_val))

        # Primitives are ignored

    print(f"    ✓ clean_json_stepwise complete: Scanned {items_processed} items, no changes found")
    return None, None, None, None, None

