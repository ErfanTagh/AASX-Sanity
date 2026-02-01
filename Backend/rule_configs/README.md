# Rule Configuration System

This directory contains rule configuration files that define data cleaning rules in JSON format.

## Overview

The generalized rule engine allows you to define data cleaning rules as JSON configurations instead of hardcoded Python functions. This makes it easy to:
- Add new rules without code changes
- Share rule sets between projects
- Create custom rule presets for different domains
- Enable non-programmers to create rules

## Rule Configuration Format

Each rule is a JSON object with the following structure:

```json
{
  "id": 1,
  "name": "Rule Name",
  "category": "meta-model",
  "type": "remove_if_empty",
  "selector": {
    "modelType": "File"
  },
  "path": "value",
  "empty_type": "string"
}
```

### Required Fields

- `id`: Unique integer identifier for the rule
- `name`: Human-readable name
- `type`: Type of rule (see Rule Types below)

### Optional Fields

- `category`: Category for organization (e.g., "meta-model", "constraints")
- `selector`: Conditions that must match for rule to apply
- `path`: JSONPath-like path to target field
- `keys`: List of keys to operate on
- `field`: Field name to operate on
- `default`: Default value to set
- `conditions`: List of conditional configurations
- `transform`: Map of value transformations
- `empty_type`: Type of empty check ("list", "string", "dict", "null", "any")

## Rule Types

### 1. `remove_if_empty`

Removes fields/keys when they are empty.

```json
{
  "id": 1,
  "name": "Remove empty lists",
  "type": "remove_if_empty",
  "keys": ["qualifiers", "displayName"],
  "empty_type": "list"
}
```

### 2. `set_default`

Sets default values when fields are missing or empty.

```json
{
  "id": 5,
  "name": "Set file defaults",
  "type": "set_default",
  "selector": {"modelType": "File"},
  "field": "value",
  "default": "sample.png",
  "conditions": [
    {
      "field": "contentType",
      "value": "image/png",
      "set_to": "sample.png"
    }
  ]
}
```

### 3. `transform_value`

Transforms values based on a mapping.

```json
{
  "id": 15,
  "name": "Convert boolean strings",
  "type": "transform_value",
  "selector": {"valueType": "xs:boolean"},
  "path": "value",
  "transform": {
    "True": "1",
    "False": "0"
  }
}
```

### 4. `conditional_transform`

Applies transformations based on conditions.

```json
{
  "id": 8,
  "name": "Change entityType",
  "type": "conditional_transform",
  "conditions": {
    "if": {"entityType": "SelfManagedEntity"},
    "and_missing": ["globalAssetId"],
    "then": {"entityType": "CoManagedEntity"}
  }
}
```

### 5. `remove_from_nested`

Removes keys from nested structures.

```json
{
  "id": 12,
  "name": "Remove idShort from nested",
  "type": "remove_from_nested",
  "selector": {"typeValueListElement": "SubmodelElementCollection"},
  "path": "value[]",
  "remove_key": "idShort"
}
```

## Path Syntax

The rule engine supports simple path syntax:

- `"field"` - Direct field access
- `"parent.child"` - Nested field access
- `"array[]"` - Array traversal (for operations on all items)
- `"array[].field"` - Field within array items

## Available Presets

### `aas_rules.json`

Contains all 18 AAS-specific rules for Asset Administration Shell validation.

## Creating Custom Rules

1. Create a new JSON file in this directory
2. Define your rules as a JSON array
3. Load using `RuleLoader.load_preset("your_preset_name")`

Example:

```python
from rule_loader import RuleLoader

loader = RuleLoader()
engine = loader.load_preset("your_preset_name")
cleaned = engine.process_all(data)
```

## Migration from Old System

The `RuleAdapter` class provides backward compatibility:

```python
from rule_adapter import RuleAdapter

# Works like old system
adapter = RuleAdapter('aas_rules')
before, after, rule_id, complete_after, complete_before = adapter.clean_json_stepwise(data)
```

This allows gradual migration from hardcoded rules to JSON configurations.

