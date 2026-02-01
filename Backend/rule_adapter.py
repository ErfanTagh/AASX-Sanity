"""
Rule Adapter - Bridges old hardcoded rules with new generalized rule engine

This adapter allows gradual migration from the old system to the new one.
"""

from rule_loader import RuleLoader
from rule_engine import RuleEngine
from typing import Optional, List, Dict, Any, Tuple
import json


class RuleAdapter:
    """
    Adapter that provides compatibility between old rule system and new generalized engine.
    """
    
    def __init__(self, preset_name: str = 'aas_rules'):
        """
        Initialize the adapter with a rule preset.
        
        Args:
            preset_name: Name of the rule preset to load
        """
        self.loader = RuleLoader()
        self.engine: Optional[RuleEngine] = None
        self.preset_name = preset_name
        self._load_engine()
    
    def _load_engine(self):
        """Load the rule engine with the preset."""
        try:
            self.engine = self.loader.load_preset(self.preset_name)
        except FileNotFoundError:
            print(f"Warning: Preset '{self.preset_name}' not found, using empty engine")
            self.engine = RuleEngine([])
    
    def reload_preset(self, preset_name: str):
        """Reload with a different preset."""
        self.preset_name = preset_name
        self._load_engine()
    
    def load_custom_rules(self, rules: List[Dict[str, Any]]):
        """Load custom rules instead of a preset."""
        self.engine = self.loader.create_engine(rules)
    
    def clean_json_stepwise(self, obj: Any, keys_to_clean=None, skip_rules: Optional[List[int]] = None, snapshot: bool = True) -> Tuple[Any, Any, Optional[int], Any, Any]:
        """
        Stepwise cleaning compatible with old API.
        
        Args:
            obj: JSON object to clean
            keys_to_clean: (Deprecated, kept for compatibility)
            skip_rules: List of rule IDs to skip
            snapshot: Whether to create full snapshots
        
        Returns:
            Tuple of (before_fragment, after_fragment, rule_id, complete_after, complete_before)
        """
        if self.engine is None:
            return None, None, None, None, None
        
        self.engine.clear_applied_rules()
        return self.engine.process_stepwise(obj, skip_rules=skip_rules, snapshot=snapshot)
    
    def clean_json_iterative(self, obj: Any, skip_rules: Optional[List[int]] = None) -> Any:
        """
        Iterative cleaning compatible with old API.
        
        Args:
            obj: JSON object to clean
            skip_rules: List of rule IDs to skip
        
        Returns:
            Cleaned JSON object
        """
        if self.engine is None:
            return obj
        
        self.engine.clear_applied_rules()
        return self.engine.process_all(obj, skip_rules=skip_rules)
    
    def clean_json_single_rule(self, obj: Any, rule_number: int) -> Tuple[Any, int]:
        """
        Apply a single rule repeatedly.
        
        Args:
            obj: JSON object to clean
            rule_number: Rule ID to apply
        
        Returns:
            Tuple of (cleaned_object, total_changes_made)
        """
        if self.engine is None:
            return obj, 0
        
        # Create a temporary engine with only this rule
        all_rules = self.engine.rules
        single_rule = [r for r in all_rules if r['id'] == rule_number]
        
        if not single_rule:
            raise ValueError(f"Rule {rule_number} not found")
        
        temp_engine = RuleEngine(single_rule)
        temp_engine.clear_applied_rules()
        
        # Apply repeatedly until no changes
        cleaned = obj
        total_changes = 0
        max_iterations = 1000
        
        for _ in range(max_iterations):
            before = json.dumps(cleaned)
            cleaned = temp_engine.process_all(cleaned, skip_rules=[])
            after = json.dumps(cleaned)
            
            if before == after:
                break
            
            total_changes += len(temp_engine.get_applied_rules())
            temp_engine.clear_applied_rules()
        
        return cleaned, total_changes
    
    def get_rules_info(self) -> Dict[str, Any]:
        """
        Get information about loaded rules.
        
        Returns:
            Dictionary with rule information
        """
        if self.engine is None:
            return {'total_rules': 0, 'rules': []}
        
        return self.loader.get_rule_info(self.engine.rules)
    
    def get_applied_rules(self) -> List[int]:
        """Get list of applied rule IDs."""
        if self.engine is None:
            return []
        return self.engine.get_applied_rules()
    
    def clear_applied_rules(self):
        """Clear applied rules tracking."""
        if self.engine:
            self.engine.clear_applied_rules()
    
    def get_rule_descriptions(self) -> List[Dict[str, Any]]:
        """
        Get rule descriptions compatible with old API.
        
        Returns:
            List of dictionaries with 'id' and 'desc' keys
        """
        if self.engine is None:
            return []
        
        rules_info = []
        for rule in self.engine.rules:
            rules_info.append({
                'id': rule['id'],
                'desc': rule.get('name', f"Rule {rule['id']}")
            })
        
        return rules_info

