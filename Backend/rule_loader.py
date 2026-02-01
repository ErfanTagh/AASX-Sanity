"""
Rule Loader - Loads and manages rule configurations
"""

import json
import os
from typing import List, Dict, Any, Optional
from rule_engine import RuleEngine


class RuleLoader:
    """Loads rule configurations from JSON files."""
    
    def __init__(self, config_dir: str = None):
        """
        Initialize the rule loader.
        
        Args:
            config_dir: Directory containing rule configuration files
        """
        if config_dir is None:
            # Default to Backend/rule_configs
            current_dir = os.path.dirname(os.path.abspath(__file__))
            config_dir = os.path.join(current_dir, 'rule_configs')
        
        self.config_dir = config_dir
        self._ensure_config_dir()
    
    def _ensure_config_dir(self):
        """Ensure the configuration directory exists."""
        if not os.path.exists(self.config_dir):
            os.makedirs(self.config_dir)
    
    def load_rules_from_file(self, filename: str) -> List[Dict[str, Any]]:
        """
        Load rules from a JSON file.
        
        Args:
            filename: Name of the rule configuration file
        
        Returns:
            List of rule configurations
        """
        filepath = os.path.join(self.config_dir, filename)
        
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Rule configuration file not found: {filepath}")
        
        with open(filepath, 'r', encoding='utf-8') as f:
            rules = json.load(f)
        
        if not isinstance(rules, list):
            raise ValueError(f"Rule configuration must be a list, got {type(rules)}")
        
        return rules
    
    def load_rules_from_json(self, rules_json: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Load rules from a JSON object (already parsed).
        
        Args:
            rules_json: List of rule configuration dictionaries
        
        Returns:
            List of rule configurations
        """
        return rules_json
    
    def create_engine(self, rules: List[Dict[str, Any]]) -> RuleEngine:
        """
        Create a RuleEngine instance from rule configurations.
        
        Args:
            rules: List of rule configuration dictionaries
        
        Returns:
            RuleEngine instance
        """
        return RuleEngine(rules)
    
    def load_preset(self, preset_name: str) -> RuleEngine:
        """
        Load a preset rule configuration.
        
        Args:
            preset_name: Name of the preset (e.g., 'aas_rules')
        
        Returns:
            RuleEngine instance
        """
        filename = f"{preset_name}.json"
        rules = self.load_rules_from_file(filename)
        return self.create_engine(rules)
    
    def list_available_presets(self) -> List[str]:
        """
        List all available rule preset files.
        
        Returns:
            List of preset names (without .json extension)
        """
        if not os.path.exists(self.config_dir):
            return []
        
        presets = []
        for filename in os.listdir(self.config_dir):
            if filename.endswith('.json'):
                presets.append(filename[:-5])  # Remove .json extension
        
        return presets
    
    def save_rules_to_file(self, rules: List[Dict[str, Any]], filename: str):
        """
        Save rules to a JSON file.
        
        Args:
            rules: List of rule configurations
            filename: Name of the file to save to
        """
        filepath = os.path.join(self.config_dir, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(rules, f, indent=2, ensure_ascii=False)
    
    def get_rule_info(self, rules: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Get information about a set of rules.
        
        Args:
            rules: List of rule configurations
        
        Returns:
            Dictionary with rule information
        """
        info = {
            'total_rules': len(rules),
            'rules_by_category': {},
            'rules_by_type': {},
            'rule_list': []
        }
        
        for rule in rules:
            category = rule.get('category', 'uncategorized')
            rule_type = rule.get('type', 'unknown')
            
            info['rules_by_category'][category] = info['rules_by_category'].get(category, 0) + 1
            info['rules_by_type'][rule_type] = info['rules_by_type'].get(rule_type, 0) + 1
            
            info['rule_list'].append({
                'id': rule.get('id'),
                'name': rule.get('name'),
                'category': category,
                'type': rule_type
            })
        
        return info

