"""
Generalized Rule Engine for Data Cleaning

This module provides a flexible, configuration-driven rule engine that can
apply various data cleaning rules based on JSON configurations.
"""

import json
from copy import deepcopy
from typing import Dict, List, Any, Optional, Tuple, Callable


class RuleEngine:
    """
    A generalized rule engine that executes rules based on JSON configurations.
    """
    
    def __init__(self, rules_config: List[Dict[str, Any]]):
        """
        Initialize the rule engine with a list of rule configurations.
        
        Args:
            rules_config: List of rule configuration dictionaries
        """
        self.rules = self._load_rules(rules_config)
        self.applied_rules = []
    
    def _load_rules(self, rules_config: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Load and validate rule configurations."""
        loaded_rules = []
        for rule_config in rules_config:
            validated_rule = self._validate_rule(rule_config)
            if validated_rule:
                loaded_rules.append(validated_rule)
        return loaded_rules
    
    def _validate_rule(self, rule_config: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Validate a rule configuration."""
        required_fields = ['id', 'name', 'type']
        if not all(field in rule_config for field in required_fields):
            print(f"Warning: Rule missing required fields: {rule_config}")
            return None
        return rule_config
    
    def _matches_selector(self, obj: Any, selector: Dict[str, Any]) -> bool:
        """
        Check if an object matches the selector conditions.
        
        Args:
            obj: The object to check
            selector: Dictionary of key-value pairs that must match
        
        Returns:
            True if object matches all selector conditions
        """
        if not isinstance(obj, dict):
            return False
        
        for key, expected_value in selector.items():
            if key not in obj:
                return False
            if obj[key] != expected_value:
                return False
        return True
    
    def _get_nested_value(self, obj: Any, path: str) -> Tuple[Any, Optional[str], Optional[int]]:
        """
        Get a nested value using dot notation or array notation.
        Returns (value, parent_key, parent_index) for modification.
        
        Examples:
            "semanticId.keys" -> gets obj["semanticId"]["keys"]
            "value[].type" -> gets items in value array
        """
        if not path:
            return obj, None, None
        
        parts = path.split('.')
        current = obj
        parent = None
        parent_key = None
        parent_index = None
        
        for i, part in enumerate(parts):
            if part.endswith('[]'):
                # Array traversal - return parent for iteration
                key = part[:-2]
                if isinstance(current, dict) and key in current:
                    return current[key], key, None
                return None, None, None
            else:
                parent = current
                if isinstance(current, dict) and part in current:
                    current = current[part]
                    parent_key = part
                else:
                    return None, None, None
        
        return current, parent_key, parent_index
    
    def _is_empty(self, value: Any, empty_type: str) -> bool:
        """Check if a value is empty based on type."""
        if empty_type == "list":
            return isinstance(value, list) and len(value) == 0
        elif empty_type == "string":
            return isinstance(value, str) and value.strip() == ""
        elif empty_type == "dict":
            return isinstance(value, dict) and len(value) == 0
        elif empty_type == "null":
            return value is None
        elif empty_type == "any":
            return value is None or value == "" or value == [] or value == {}
        return False
    
    def _apply_remove_rule(self, obj: Any, rule: Dict[str, Any]) -> Tuple[Any, bool]:
        """Apply a remove rule."""
        if not isinstance(obj, dict):
            return obj, False
        
        changed = False
        
        # Handle path-based removal
        if 'path' in rule:
            path = rule['path']
            value, parent_key, _ = self._get_nested_value(obj, path)
            
            if value is not None and parent_key:
                empty_type = rule.get('empty_type', 'any')
                if self._is_empty(value, empty_type):
                    if parent_key in obj:
                        del obj[parent_key]
                        changed = True
        
        # Handle multiple paths
        elif 'paths' in rule:
            for path_config in rule['paths']:
                if isinstance(path_config, str):
                    path = path_config
                    empty_type = rule.get('empty_type', 'any')
                else:
                    path = path_config.get('path', '')
                    empty_type = path_config.get('empty_type', rule.get('empty_type', 'any'))
                
                value, parent_key, _ = self._get_nested_value(obj, path)
                if value is not None and parent_key and self._is_empty(value, empty_type):
                    if parent_key in obj:
                        del obj[parent_key]
                        changed = True
        
        # Handle direct key removal
        elif 'keys' in rule:
            empty_type = rule.get('empty_type', 'list')
            for key in rule['keys']:
                if key in obj and self._is_empty(obj[key], empty_type):
                    del obj[key]
                    changed = True
        
        return obj, changed
    
    def _apply_set_default_rule(self, obj: Any, rule: Dict[str, Any]) -> Tuple[Any, bool]:
        """Apply a set default value rule."""
        if not isinstance(obj, dict):
            return obj, False
        
        changed = False
        field = rule.get('field', 'value')
        default = rule.get('default')
        conditions = rule.get('conditions', [])
        
        # Handle multiple fields (like rule 6 with first.keys and second.keys)
        if isinstance(field, list):
            for f in field:
                result, field_changed = self._set_field_default(obj, f, default, conditions, rule)
                if field_changed:
                    changed = True
        else:
            result, field_changed = self._set_field_default(obj, field, default, conditions, rule)
            if field_changed:
                changed = True
        
        # Handle additional fields (like rule 16 adding valueId)
        if 'additional_fields' in rule:
            for key, value in rule['additional_fields'].items():
                if key not in obj:
                    obj[key] = deepcopy(value)
                    changed = True
        
        # Handle fixing empty values in arrays
        if rule.get('fix_empty_text', False):
            actual_field = field[0] if isinstance(field, list) else field
            if actual_field in obj:
                if isinstance(obj[actual_field], list):
                    for item in obj[actual_field]:
                        if isinstance(item, dict) and 'text' in item:
                            text_val = item.get('text')
                            if text_val is None or (isinstance(text_val, str) and text_val.strip() == ""):
                                item['text'] = default[0].get('text', 'EMPTY') if isinstance(default, list) and default else 'EMPTY'
                                changed = True
        
        return obj, changed
    
    def _set_field_default(self, obj: Dict[str, Any], field: str, default: Any, conditions: List[Dict], rule: Dict[str, Any]) -> Tuple[Any, bool]:
        """Helper to set default for a single field."""
        changed = False
        
        # Handle nested paths
        if '.' in field:
            parts = field.split('.')
            current = obj
            for i, part in enumerate(parts[:-1]):
                if part not in current:
                    return obj, False
                current = current[part]
                if not isinstance(current, dict):
                    return obj, False
            
            last_part = parts[-1]
            field_value = current.get(last_part)
            
            # Check if field is missing or empty
            if field_value is None or self._is_empty(field_value, 'any'):
                if conditions:
                    for condition in conditions:
                        if condition.get('field') == field and self._check_condition(obj, condition):
                            current[last_part] = condition.get('set_to', default)
                            changed = True
                            break
                else:
                    if default is not None:
                        current[last_part] = deepcopy(default)
                        changed = True
            # Check if empty list/array
            elif isinstance(field_value, list) and len(field_value) == 0:
                if conditions:
                    for condition in conditions:
                        if condition.get('field') == field and self._check_condition(obj, condition):
                            current[last_part] = condition.get('set_to', default)
                            changed = True
                            break
                else:
                    if default is not None:
                        current[last_part] = deepcopy(default)
                        changed = True
        else:
            # Direct field
            if field not in obj or self._is_empty(obj[field], 'any'):
                if conditions:
                    for condition in conditions:
                        if condition.get('field') == field and self._check_condition(obj, condition):
                            obj[field] = condition.get('set_to', default)
                            changed = True
                            break
                else:
                    if default is not None:
                        obj[field] = deepcopy(default)
                        changed = True
        
        return obj, changed
    
    def _apply_transform_rule(self, obj: Any, rule: Dict[str, Any]) -> Tuple[Any, bool]:
        """Apply a transform/value conversion rule."""
        if not isinstance(obj, dict):
            return obj, False
        
        changed = False
        path = rule.get('path', '')
        transform_map = rule.get('transform', {})
        
        # Handle nested path transformations
        if '[]' in path:
            # Array transformation
            base_path = path.split('[]')[0]
            field = path.split('[]')[1].lstrip('.')
            
            value, parent_key, _ = self._get_nested_value(obj, base_path)
            if isinstance(value, list):
                for item in value:
                    if isinstance(item, dict) and field in item:
                        old_value = item[field]
                        if old_value in transform_map:
                            item[field] = transform_map[old_value]
                            changed = True
        else:
            # Direct field transformation
            if path in obj:
                old_value = obj[path]
                if old_value in transform_map:
                    obj[path] = transform_map[old_value]
                    changed = True
        
        return obj, changed
    
    def _apply_conditional_transform_rule(self, obj: Any, rule: Dict[str, Any]) -> Tuple[Any, bool]:
        """Apply a conditional transformation rule."""
        if not isinstance(obj, dict):
            return obj, False
        
        conditions = rule.get('conditions', {})
        if_conditions = conditions.get('if', {})
        and_missing = conditions.get('and_missing', [])
        then_action = conditions.get('then', {})
        
        # Check if conditions match
        matches = True
        for key, value in if_conditions.items():
            if obj.get(key) != value:
                matches = False
                break
        
        if matches:
            # Check missing fields
            for field in and_missing:
                if field in obj:
                    matches = False
                    break
        
        if matches:
            # Apply transformation
            for key, value in then_action.items():
                obj[key] = value
            return obj, True
        
        return obj, False
    
    def _apply_remove_from_nested_rule(self, obj: Any, rule: Dict[str, Any]) -> Tuple[Any, bool]:
        """Apply a rule that removes keys from nested structures."""
        if not isinstance(obj, dict):
            return obj, False
        
        changed = False
        path = rule.get('path', '')
        remove_key = rule.get('remove_key')
        
        if '[]' in path:
            base_path = path.split('[]')[0]
            value, _, _ = self._get_nested_value(obj, base_path)
            if isinstance(value, list):
                for item in value:
                    if isinstance(item, dict) and remove_key in item:
                        del item[remove_key]
                        changed = True
        
        return obj, changed
    
    def _check_condition(self, obj: Dict[str, Any], condition: Dict[str, Any]) -> bool:
        """Check if an object matches a condition."""
        if 'field' in condition:
            field = condition['field']
            expected_value = condition.get('value')
            when = condition.get('when', {})
            
            # Handle nested field paths
            if '.' in field:
                parts = field.split('.')
                current = obj
                for part in parts:
                    if not isinstance(current, dict) or part not in current:
                        return False
                    current = current[part]
                field_value = current
            else:
                if field not in obj:
                    return False
                field_value = obj[field]
            
            if expected_value is not None and field_value != expected_value:
                return False
            
            # Check 'when' conditions
            for key, value in when.items():
                if isinstance(value, dict) and 'not' in value:
                    # Handle "not" conditions (e.g., {"not": "xs:string"})
                    if obj.get(key) == value['not']:
                        return False
                elif isinstance(value, dict) and '.' in key:
                    # Nested when condition
                    parts = key.split('.')
                    current = obj
                    for part in parts:
                        if not isinstance(current, dict) or part not in current:
                            return False
                        current = current[part]
                    if current != value:
                        return False
                else:
                    if obj.get(key) != value:
                        return False
            return True
        return False
    
    def apply_rule(self, obj: Any, rule: Dict[str, Any]) -> Tuple[Any, bool]:
        """
        Apply a single rule to an object.
        
        Returns:
            Tuple of (modified_object, changed)
        """
        # Check selector if present
        if 'selector' in rule:
            if not self._matches_selector(obj, rule['selector']):
                return obj, False
        
        rule_type = rule['type']
        
        if rule_type == 'remove_if_empty':
            return self._apply_remove_rule(obj, rule)
        elif rule_type == 'set_default':
            return self._apply_set_default_rule(obj, rule)
        elif rule_type == 'transform_value':
            return self._apply_transform_rule(obj, rule)
        elif rule_type == 'conditional_transform':
            return self._apply_conditional_transform_rule(obj, rule)
        elif rule_type == 'remove_from_nested':
            return self._apply_remove_from_nested_rule(obj, rule)
        else:
            print(f"Warning: Unknown rule type: {rule_type}")
            return obj, False
    
    def process_stepwise(self, obj: Any, skip_rules: Optional[List[int]] = None, snapshot: bool = True) -> Tuple[Any, Any, Optional[int], Any, Any]:
        """
        Process rules stepwise, finding the first applicable rule.
        
        Returns:
            Tuple of (before_fragment, after_fragment, rule_id, complete_after, complete_before)
        """
        if skip_rules is None:
            skip_rules = []
        
        root = deepcopy(obj)
        stack = [(None, None, root)]  # (parent, key, current)
        
        while stack:
            parent, key, current = stack.pop()
            
            # Handle list operations (like rule 18)
            if isinstance(current, list):
                for rule in self.rules:
                    rule_id = rule['id']
                    if rule_id in skip_rules:
                        continue
                    
                    # Check if this is a list operation rule
                    if rule.get('list_operation', False):
                        before_fragment = deepcopy(current)
                        complete_before = deepcopy(root) if snapshot else None
                        
                        modified, changed = self._apply_list_operation_rule(current, rule)
                        
                        if changed:
                            if parent is None:
                                root = modified
                            else:
                                if isinstance(parent, dict):
                                    parent[key] = modified
                                else:
                                    parent[key] = modified
                            
                            after_fragment = deepcopy(modified)
                            complete_after = deepcopy(root) if snapshot else root
                            
                            self.applied_rules.append(rule_id)
                            return before_fragment, after_fragment, rule_id, complete_after, complete_before
            
            # Try each rule on current node
            for rule in self.rules:
                rule_id = rule['id']
                if rule_id in skip_rules:
                    continue
                
                # Skip list operation rules here (handled above)
                if rule.get('list_operation', False):
                    continue
                
                # Create snapshot for fragment
                before_fragment = deepcopy(current)
                complete_before = deepcopy(root) if snapshot else None
                
                # Apply rule
                modified, changed = self.apply_rule(current, rule)
                
                if changed:
                    # Update parent reference
                    if parent is None:
                        root = modified
                    else:
                        if isinstance(parent, dict):
                            parent[key] = modified
                        else:
                            parent[key] = modified
                    
                    after_fragment = deepcopy(modified)
                    complete_after = deepcopy(root) if snapshot else root
                    
                    self.applied_rules.append(rule_id)
                    return before_fragment, after_fragment, rule_id, complete_after, complete_before
            
            # Push children to stack
            if isinstance(current, dict):
                for child_key, child_val in current.items():
                    if isinstance(child_val, (dict, list)):
                        stack.append((current, child_key, child_val))
            elif isinstance(current, list):
                for idx, child_val in enumerate(current):
                    if isinstance(child_val, (dict, list)):
                        stack.append((current, idx, child_val))
        
        return None, None, None, None, None
    
    def _apply_list_operation_rule(self, obj: Any, rule: Dict[str, Any]) -> Tuple[Any, bool]:
        """Apply a rule that operates on lists (like removing items)."""
        if not isinstance(obj, list):
            return obj, False
        
        selector = rule.get('selector', {})
        new_list = []
        
        for item in obj:
            should_remove = False
            
            if isinstance(item, dict):
                # Check if item matches selector
                matches = True
                for key, value in selector.items():
                    if item.get(key) != value:
                        matches = False
                        break
                
                if matches:
                    # Check additional conditions
                    path = rule.get('path', '')
                    if path:
                        path_value, _, _ = self._get_nested_value(item, path)
                        empty_type = rule.get('empty_type', 'any')
                        if self._is_empty(path_value, empty_type):
                            should_remove = True
                    else:
                        should_remove = True
                
                if not should_remove:
                    new_list.append(item)
            else:
                new_list.append(item)
        
        return new_list, len(new_list) != len(obj)
    
    def process_all(self, obj: Any, skip_rules: Optional[List[int]] = None) -> Any:
        """
        Process all rules iteratively until no more changes occur.
        
        Args:
            obj: The object to process
            skip_rules: List of rule IDs to skip
        
        Returns:
            The processed object
        """
        if skip_rules is None:
            skip_rules = []
        
        obj = deepcopy(obj)
        max_iterations = 1000
        iteration = 0
        
        while iteration < max_iterations:
            iteration += 1
            changed_any = False
            
            stack = [(None, None, obj)]
            root = obj
            
            while stack:
                parent, key, current = stack.pop()
                
                # Try all rules on current node
                for rule in self.rules:
                    rule_id = rule['id']
                    if rule_id in skip_rules:
                        continue
                    
                    modified, changed = self.apply_rule(current, rule)
                    if changed:
                        if parent is None:
                            root = modified
                            current = modified
                        else:
                            if isinstance(parent, dict):
                                parent[key] = modified
                            else:
                                parent[key] = modified
                            current = modified
                        changed_any = True
                        self.applied_rules.append(rule_id)
                
                # Push children
                if isinstance(current, dict):
                    for child_key, child_val in current.items():
                        if isinstance(child_val, (dict, list)):
                            stack.append((current, child_key, child_val))
                elif isinstance(current, list):
                    for idx, child_val in enumerate(current):
                        if isinstance(child_val, (dict, list)):
                            stack.append((current, idx, child_val))
            
            obj = root
            
            if not changed_any:
                break
        
        return obj
    
    def get_applied_rules(self) -> List[int]:
        """Get list of applied rule IDs."""
        return list(set(self.applied_rules))
    
    def clear_applied_rules(self):
        """Clear the applied rules tracking."""
        self.applied_rules = []

