# Original Workflow Structure - Notes for Generalization

## Overview
This document captures the original workflow structure from the first implementation with 18 AAS-specific rules, so we can replicate it exactly with generalized rules.

## Core Workflow Architecture

### 1. **File Upload & Initial Processing** (`/upload` endpoint)

**Original Flow:**
```
User uploads JSON
  ↓
POST /upload (file)
  ↓
┌─────────────────────────────────────┐
│ 1. clean_json_iterative(data)      │ ← Apply ALL 18 rules at once
│    - Uses clean_json_parallel()    │   Returns: fully cleaned JSON
│    - Applies all rules iteratively │
└─────────────────────────────────────┘
  ↓
┌─────────────────────────────────────┐
│ 2. clean_json_stepwise(data)       │ ← Find FIRST rule change
│    - Finds first applicable rule   │   Returns: (before, after, rule_num, complete_before, complete_after)
│    - Returns fragment + full state  │
└─────────────────────────────────────┘
  ↓
┌─────────────────────────────────────┐
│ 3. Background Thread                │ ← Precompute all changes
│    - precompute_all_changes()      │   (15-30x faster with snapshot=False)
│    - Caches for "Accept All"        │
└─────────────────────────────────────┘
  ↓
Response to Frontend:
{
  "JSON": cleaned,              // Fully cleaned JSON (all rules applied)
  "KEYS": keys(),               // List of applied rule IDs
  "Before_data": before_fragment,
  "After_data": after_fragment,
  "Complete_after_data": complete_after_json,
  "Complete_before_data": complete_before_json,
  "CURRENT_RULE": current_rule,  // First rule number found
  "SKIP_RULES": [],
  "BEFORE": changed_parts["before"],
  "AFTER": changed_parts["after"]
}
```

**Key Points:**
- `/upload` does TWO things simultaneously:
  1. **Full clean**: Applies all rules at once → `cleaned` JSON
  2. **Stepwise discovery**: Finds first rule change → for interactive review
- Background thread precomputes all changes for fast "Accept All"
- Response includes both fully cleaned JSON AND first stepwise change

### 2. **Three-Tab Display Structure**

**Tab 1: Quick Clean (Shells)**
- Shows **fully cleaned JSON** (from `"JSON"` field)
- Displays as shell cards with syntax highlighting
- Shows applied rules with badges
- Download button for cleaned JSON

**Tab 2: Rule Validation**
- Shows **first rule change** for review
- Before/After side-by-side comparison
- Accept / Reject / Accept All buttons
- Status counters (Pending/Approved/Rejected)

**Tab 3: Changes & Results**
- Three-pane view: Original → Current → Final
- Rule validation history table
- Download options for any state

### 3. **Accept Changes Flow** (`/accept-changes` endpoint)

**Original Flow:**
```
User clicks "Accept"
  ↓
POST /accept-changes
{
  "complete_after_data": current_state,
  "current_rule": rule_number,
  "skip_rules": [list of skipped]
}
  ↓
┌─────────────────────────────────────┐
│ 1. clean_json_single_rule()        │ ← Apply current rule COMPLETELY
│    - Applies rule repeatedly        │   (until no more changes)
│    - Returns fully applied state   │
└─────────────────────────────────────┘
  ↓
┌─────────────────────────────────────┐
│ 2. Add rule to skip_rules           │
└─────────────────────────────────────┘
  ↓
┌─────────────────────────────────────┐
│ 3. clean_json_stepwise()           │ ← Find NEXT rule
│    - With updated skip_rules        │
│    - Returns next change or null   │
└─────────────────────────────────────┘
  ↓
Response:
{
  "status": "accepted",
  "BEFORE": next_before,
  "AFTER": next_after,
  "CURRENT_RULE": next_rule,
  "Complete_after_data": next_complete_after,
  "Complete_before_data": next_complete_before,
  "MORE_CHANGES": true/false,
  "SKIP_RULES": updated_skip_rules
}
```

**Key Points:**
- `clean_json_single_rule()` applies ONE rule completely (iteratively)
- Then finds NEXT rule using `clean_json_stepwise()` with updated `skip_rules`
- If background cache ready, uses precomputed changes (fast path)

### 4. **Reject Changes Flow** (`/reject-changes` endpoint)

**Original Flow:**
```
User clicks "Reject"
  ↓
POST /reject-changes
{
  "current_data": current_state,
  "current_rule": rule_number,
  "skip_rules": [list]
}
  ↓
┌─────────────────────────────────────┐
│ 1. Add current_rule to skip_rules   │
└─────────────────────────────────────┘
  ↓
┌─────────────────────────────────────┐
│ 2. Invalidate precomputed cache    │ ← User rejected, so cache assumptions wrong
└─────────────────────────────────────┘
  ↓
┌─────────────────────────────────────┐
│ 3. clean_json_stepwise()           │ ← Find NEXT rule (excluding rejected)
│    - With updated skip_rules        │
└─────────────────────────────────────┘
  ↓
Response: Next rule or "No more changes"
```

### 5. **Accept All & Download Flow**

**Original Flow:**
```
User clicks "Accept All & Download"
  ↓
Loop for each remaining rule:
  POST /accept-changes
    ↓
  [If cache ready: Use precomputed (FAST)]
  [Else: Apply rule + find next]
    ↓
  Update UI: "Rule X accepted..."
  ↓
[Continue until no more rules]
  ↓
Download final JSON
```

**Key Points:**
- Uses precomputed cache if available (15-30x faster)
- Otherwise applies rules one by one
- Updates UI progress during loop

## Core Functions Structure

### `clean_json_iterative(obj, keys_to_clean, skip_rules)`
- **Purpose**: Apply ALL rules at once, iteratively
- **Returns**: Fully cleaned JSON
- **How it works**:
  1. Stack-based traversal
  2. For each node, apply ALL rules until stable
  3. Then recurse to children
  4. Returns root with all rules applied

### `clean_json_stepwise(obj, keys_to_clean, skip_rules, snapshot)`
- **Purpose**: Find FIRST applicable rule change
- **Returns**: `(before_fragment, after_fragment, rule_num, complete_after, complete_before)`
- **How it works**:
  1. Stack-based traversal
  2. For each node, try rules in order
  3. Return FIRST change found
  4. Includes fragment (for diff) and complete state (for applying)

### `clean_json_single_rule(obj, rule_number, keys_to_clean)`
- **Purpose**: Apply ONE specific rule completely
- **Returns**: `(cleaned_obj, total_changes_made)`
- **How it works**:
  1. Applies rule repeatedly until no more changes
  2. Returns fully applied state

## Rule Structure (Original 18 Rules)

**Rule Format:**
```python
def apply_rule_N_description(obj):
    """
    Rule description
    """
    # Check conditions
    # Apply transformation
    # Return (modified_obj, changed: bool)
    return modified_obj, changed
```

**Rule Categories:**
1. **Meta-Model Rules** (1-4, 7, 11-12, 16, 18): Structure validation
2. **Constraint Rules** (5-6, 8-10, 13-15, 17): Value/type fixes

**Rule Application Order:**
- Rules applied in numbered order (1-18)
- Each rule applied until stable before moving to next
- `skip_rules` parameter allows excluding specific rules

## Frontend State Management

**Global Variables:**
- `lastCleanedJson`: Fully cleaned JSON (all rules)
- `originalJson`: Original uploaded JSON
- `before`, `after`: Current rule fragments
- `before_full`, `after_full`: Complete states for current rule
- `complete_after_data`, `complete_before_data`: Full JSON states
- `currentRule`: Current rule number
- `skipRules`: List of rejected rule numbers
- `keys`: Applied rule IDs
- `changeHistory`: Array of all accept/reject decisions

**Tab Content:**
- **Tab 1**: `lastCleanedJson` → Shell cards
- **Tab 2**: `before` / `after` → Rule validation UI
- **Tab 3**: `originalJson` / `complete_after_data` / `lastCleanedJson` → Three-pane view

## Key Design Principles

1. **Dual Processing**: Always do both full clean AND stepwise discovery
2. **Background Optimization**: Precompute changes while user reviews
3. **State Preservation**: Keep complete before/after states for each rule
4. **Fragment + Complete**: Return both fragment (for diff) and complete state (for applying)
5. **Rule Tracking**: Track applied/rejected rules via `skip_rules`
6. **Iterative Application**: Rules applied until stable (no more changes)

## Generalization Requirements

To replicate this workflow with generalized rules:

1. **Keep same function signatures**:
   - `clean_json_iterative()` → Apply all rules
   - `clean_json_stepwise()` → Find first rule
   - `clean_json_single_rule()` → Apply one rule completely

2. **Replace rule list**:
   - Instead of 18 specific AAS rules
   - Use 4 (or more) general rules
   - Same rule format: `(rule_num, rule_func)`

3. **Maintain same API responses**:
   - Same JSON structure
   - Same field names
   - Same workflow

4. **Keep same frontend behavior**:
   - Three tabs work the same
   - Accept/Reject flow identical
   - State management unchanged

## Current Status

✅ **Implemented:**
- 4 general rules (empty lists, empty strings, null values, empty objects)
- `clean_json_stepwise()` with general rules
- `/upload` endpoint doing full clean + stepwise
- Frontend displaying cleaned JSON in Tab 1

🔄 **To Complete:**
- Ensure `clean_json_iterative()` matches original behavior
- Implement `clean_json_single_rule()` for general rules
- Ensure `/accept-changes` and `/reject-changes` work identically
- Background precomputation (if needed)
- All three tabs working as original

## Notes

- The original system was designed for AAS JSON but the workflow is generic
- The 18 rules were specific, but the architecture supports any rules
- Generalization means: same workflow, different rules
- Performance optimizations (background precomputation) should be preserved

