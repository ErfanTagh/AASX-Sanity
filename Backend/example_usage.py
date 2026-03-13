"""
Example usage of the generalized rule engine

This demonstrates how to use the new rule system.
"""

import json
from rule_loader import RuleLoader
from rule_adapter import RuleAdapter
from rule_engine import RuleEngine

# Example 1: Load AAS rules preset
print("=" * 60)
print("Example 1: Loading AAS Rules Preset")
print("=" * 60)

loader = RuleLoader()
engine = loader.load_preset('aas_rules')

# Get rule information
rules_info = loader.get_rule_info(engine.rules)
print(f"Loaded {rules_info['total_rules']} rules")
print(f"Categories: {list(rules_info['rules_by_category'].keys())}")

# Example 2: Process data with rules
print("\n" + "=" * 60)
print("Example 2: Processing Data")
print("=" * 60)

# Sample data
sample_data = {
    "modelType": "File",
    "contentType": "image/png",
    "value": "",
    "qualifiers": [],
    "idShort": ""
}

print("Before:")
print(json.dumps(sample_data, indent=2))

# Process with rules
cleaned = engine.process_all(sample_data)

print("\nAfter:")
print(json.dumps(cleaned, indent=2))
print(f"\nApplied rules: {engine.get_applied_rules()}")

# Example 3: Using the adapter (backward compatible)
print("\n" + "=" * 60)
print("Example 3: Using Rule Adapter (Backward Compatible)")
print("=" * 60)

adapter = RuleAdapter('aas_rules')
before, after, rule_id, complete_after, complete_before = adapter.clean_json_stepwise(sample_data)

if rule_id:
    print(f"Found change: Rule {rule_id}")
    print(f"Before fragment: {json.dumps(before, indent=2)}")
    print(f"After fragment: {json.dumps(after, indent=2)}")

# Example 4: Creating custom rules
print("\n" + "=" * 60)
print("Example 4: Custom Rules")
print("=" * 60)

custom_rules = [
    {
        "id": 100,
        "name": "Remove null values",
        "category": "general",
        "type": "remove_if_empty",
        "keys": ["nullField"],
        "empty_type": "null"
    },
    {
        "id": 101,
        "name": "Set default name",
        "category": "general",
        "type": "set_default",
        "field": "name",
        "default": "Unknown"
    }
]

custom_engine = loader.create_engine(custom_rules)
test_data = {"nullField": None, "other": "value"}
cleaned_custom = custom_engine.process_all(test_data)

print("Custom rules applied:")
print(f"Before: {json.dumps(test_data)}")
print(f"After: {json.dumps(cleaned_custom)}")

print("\n" + "=" * 60)
print("Examples complete!")
print("=" * 60)

