#include "processor.hpp"
#include <algorithm>
#include <iostream>
#include <sstream>
#include <cctype>
#include <unordered_set>

namespace json_processor {

JsonProcessor::JsonProcessor() {
    // Initialize framework
}

json JsonProcessor::cleanJson(const json& data, bool use_parallel) {
    json result = data;
    
    if (use_parallel && data.is_array() && data.size() > 1000) {
        // Use parallel processing for large arrays
        return cleanLargeArray(result);
    }
    
    // Sequential cleaning for small data
    return cleanAll(result);
}

json JsonProcessor::cleanAll(const json& data) {
    json result = deepCopy(data);
    
    bool changed = true;
    int iterations = 0;
    while (changed && iterations < 100) {
        changed = false;
        iterations++;
        
        // Process nested structures recursively FIRST
        if (result.is_object()) {
            for (auto& [key, value] : result.items()) {
                if (value.is_object() || value.is_array()) {
                    value = cleanAll(value);
                }
            }
        } else if (result.is_array()) {
            for (auto& item : result) {
                if (item.is_object() || item.is_array()) {
                    item = cleanAll(item);
                }
            }
        }
        
        // Then apply rules to current level (after children are cleaned)
        if (result.is_object()) {
            if (rule1_remove_empty_lists(result)) changed = true;
            if (rule2_remove_empty_strings(result)) changed = true;
            if (rule3_remove_null_values(result)) changed = true;
            if (rule4_remove_empty_objects(result)) changed = true;
            if (rule5_remove_duplicates(result)) changed = true;
            if (rule6_convert_boolean_strings(result, false)) changed = true;
            if (rule7_fix_language_codes(result)) changed = true;
        }
    }
    
    return result;
}

json JsonProcessor::cleanLargeArray(const json& array) {
    if (!array.is_array()) return array;
    
    json result = array;
    
    // Process array elements in parallel
    framework_.parallel_for(result, [this](json& item) {
        if (item.is_object()) {
            // Apply cleaning rules to each object
            bool changed = true;
            int iterations = 0;
            while (changed && iterations < 10) {
                changed = false;
                iterations++;
                if (rule1_remove_empty_lists(item)) changed = true;
                if (rule2_remove_empty_strings(item)) changed = true;
                if (rule3_remove_null_values(item)) changed = true;
                if (rule4_remove_empty_objects(item)) changed = true;
            }
        }
    });
    
    return result;
}

bool JsonProcessor::rule1_remove_empty_lists(json& obj) {
    if (!obj.is_object()) return false;
    
    bool changed = false;
    std::vector<std::string> keys_to_delete;
    
    for (auto& [key, value] : obj.items()) {
        if (value.is_array() && value.empty()) {
            keys_to_delete.push_back(key);
        }
    }
    
    for (const auto& key : keys_to_delete) {
        obj.erase(key);
        changed = true;
    }
    
    return changed;
}

bool JsonProcessor::rule2_remove_empty_strings(json& obj) {
    if (!obj.is_object()) return false;
    
    bool changed = false;
    std::vector<std::string> keys_to_delete;
    
    for (auto& [key, value] : obj.items()) {
        if (value.is_string()) {
            std::string str = value.get<std::string>();
            if (str.empty() || std::all_of(str.begin(), str.end(), ::isspace)) {
                keys_to_delete.push_back(key);
            }
        }
    }
    
    for (const auto& key : keys_to_delete) {
        obj.erase(key);
        changed = true;
    }
    
    return changed;
}

bool JsonProcessor::rule3_remove_null_values(json& obj) {
    if (!obj.is_object()) return false;
    
    bool changed = false;
    std::vector<std::string> keys_to_delete;
    
    for (auto& [key, value] : obj.items()) {
        if (value.is_null()) {
            keys_to_delete.push_back(key);
        }
    }
    
    for (const auto& key : keys_to_delete) {
        obj.erase(key);
        changed = true;
    }
    
    return changed;
}

bool JsonProcessor::rule4_remove_empty_objects(json& obj) {
    if (!obj.is_object()) return false;
    
    bool changed = false;
    std::vector<std::string> keys_to_delete;
    
    for (auto& [key, value] : obj.items()) {
        if (value.is_object() && value.empty()) {
            keys_to_delete.push_back(key);
        }
    }
    
    for (const auto& key : keys_to_delete) {
        obj.erase(key);
        changed = true;
    }
    
    return changed;
}

bool JsonProcessor::rule5_remove_duplicates(json& obj) {
    if (!obj.is_object()) return false;
    
    bool changed = false;
    
    for (auto& [key, value] : obj.items()) {
        if (value.is_array()) {
            std::unordered_set<std::string> seen;
            json new_array = json::array();
            
            for (const auto& item : value) {
                std::string item_str = item.dump();
                if (seen.find(item_str) == seen.end()) {
                    seen.insert(item_str);
                    new_array.push_back(item);
                } else {
                    changed = true;
                }
            }
            
            if (changed) {
                obj[key] = new_array;
            }
        }
    }
    
    return changed;
}

bool JsonProcessor::rule6_convert_boolean_strings(json& obj, bool numeric_mode) {
    if (!obj.is_object()) return false;
    
    bool changed = false;
    
    for (auto& [key, value] : obj.items()) {
        if (value.is_string()) {
            std::string str = value.get<std::string>();
            std::string lower_str = str;
            std::transform(lower_str.begin(), lower_str.end(), lower_str.begin(), ::tolower);
            
            if (lower_str == "true" || lower_str == "1" || lower_str == "yes" || lower_str == "y" || lower_str == "on") {
                if (numeric_mode) {
                    obj[key] = "1";
                } else {
                    obj[key] = true;
                }
                changed = true;
            } else if (lower_str == "false" || lower_str == "0" || lower_str == "no" || lower_str == "n" || lower_str == "off") {
                if (numeric_mode) {
                    obj[key] = "0";
                } else {
                    obj[key] = false;
                }
                changed = true;
            }
        }
    }
    
    return changed;
}

bool JsonProcessor::rule7_fix_language_codes(json& obj) {
    if (!obj.is_object()) return false;
    
    bool changed = false;
    
    // Check direct "language" field
    if (obj.contains("language") && obj["language"].is_string()) {
        std::string lang = obj["language"].get<std::string>();
        if (!lang.empty() && lang.back() == '?') {
            obj["language"] = lang.substr(0, lang.length() - 1);
            changed = true;
        }
    }
    
    // Check nested objects and arrays
    for (auto& [key, value] : obj.items()) {
        if (value.is_object()) {
            if (rule7_fix_language_codes(value)) {
                changed = true;
            }
        } else if (value.is_array()) {
            for (auto& item : value) {
                if (item.is_object()) {
                    if (rule7_fix_language_codes(item)) {
                        changed = true;
                    }
                }
            }
        }
    }
    
    return changed;
}

JsonProcessor::StepwiseResult JsonProcessor::cleanStepwise(json& data, const std::vector<int>& skip_rules) {
    StepwiseResult result;
    std::unordered_set<int> skip_set(skip_rules.begin(), skip_rules.end());
    
    json root = deepCopy(data);
    bool found = false;
    
    processRecursive(root, skip_set, result, found);
    
    if (found) {
        result.complete_after = root;
        result.complete_before = deepCopy(data);
    }
    
    return result;
}

void JsonProcessor::processRecursive(json& node, std::unordered_set<int>& skip_rules, StepwiseResult& result, bool& found) {
    if (found) return;
    
    if (node.is_object()) {
        // Try rules 1-4, 6-7 on objects
        std::vector<std::pair<int, std::function<bool(json&)>>> rules = {
            {1, [this](json& obj) { return rule1_remove_empty_lists(obj); }},
            {2, [this](json& obj) { return rule2_remove_empty_strings(obj); }},
            {3, [this](json& obj) { return rule3_remove_null_values(obj); }},
            {4, [this](json& obj) { return rule4_remove_empty_objects(obj); }},
            {6, [this](json& obj) { return rule6_convert_boolean_strings(obj, false); }},
            {7, [this](json& obj) { return rule7_fix_language_codes(obj); }},
        };
        
        for (auto& [rule_id, rule_func] : rules) {
            if (skip_rules.find(rule_id) != skip_rules.end()) continue;
            
            json before = deepCopy(node);
            if (rule_func(node)) {
                result.before_fragment = before;
                result.after_fragment = node;
                result.rule_id = rule_id;
                result.has_change = true;
                found = true;
                return;
            }
        }
        
        // Process children
        for (auto& [key, value] : node.items()) {
            if (value.is_object() || value.is_array()) {
                processRecursive(value, skip_rules, result, found);
                if (found) return;
            }
        }
    } else if (node.is_array()) {
        // Try rule 5 on arrays
        if (skip_rules.find(5) == skip_rules.end()) {
            json before = deepCopy(node);
            bool changed = false;
            
            std::unordered_set<std::string> seen;
            json new_array = json::array();
            
            for (const auto& item : node) {
                std::string item_str = item.dump();
                if (seen.find(item_str) == seen.end()) {
                    seen.insert(item_str);
                    new_array.push_back(item);
                } else {
                    changed = true;
                }
            }
            
            if (changed) {
                result.before_fragment = before;
                result.after_fragment = new_array;
                result.rule_id = 5;
                result.has_change = true;
                found = true;
                return;
            }
        }
        
        // Process array items
        for (auto& item : node) {
            if (item.is_object() || item.is_array()) {
                processRecursive(item, skip_rules, result, found);
                if (found) return;
            }
        }
    }
}

json JsonProcessor::deepCopy(const json& src) {
    return json::parse(src.dump());
}

bool JsonProcessor::applyRule(json& obj, int rule_id, bool boolean_numeric_mode) {
    // Apply rule iteratively (like cleanAll but only for one rule)
    bool changed = true;
    int iterations = 0;
    
    while (changed && iterations < 100) {
        changed = false;
        iterations++;
        
        // Process nested structures recursively FIRST
        if (obj.is_object()) {
            for (auto& [key, value] : obj.items()) {
                if (value.is_object() || value.is_array()) {
                    if (applyRuleRecursive(value, rule_id, boolean_numeric_mode)) {
                        changed = true;
                    }
                }
            }
        } else if (obj.is_array()) {
            for (auto& item : obj) {
                if (item.is_object() || item.is_array()) {
                    if (applyRuleRecursive(item, rule_id, boolean_numeric_mode)) {
                        changed = true;
                    }
                }
            }
        }
        
        // Then apply the rule to the current level (after children are cleaned)
        if (obj.is_object()) {
            bool rule_changed = false;
            switch (rule_id) {
                case 1: rule_changed = rule1_remove_empty_lists(obj); break;
                case 2: rule_changed = rule2_remove_empty_strings(obj); break;
                case 3: rule_changed = rule3_remove_null_values(obj); break;
                case 4: rule_changed = rule4_remove_empty_objects(obj); break;
                case 5: rule_changed = rule5_remove_duplicates(obj); break;
                case 6: rule_changed = rule6_convert_boolean_strings(obj, boolean_numeric_mode); break;
                case 7: rule_changed = rule7_fix_language_codes(obj); break;
                default: return false;
            }
            if (rule_changed) {
                changed = true;
            }
        }
    }
    
    return changed;
}

bool JsonProcessor::applyRuleRecursive(json& obj, int rule_id, bool boolean_numeric_mode) {
    bool changed = false;
    
    // First, recursively process nested structures
    if (obj.is_object()) {
        for (auto& [key, value] : obj.items()) {
            if (value.is_object() || value.is_array()) {
                if (applyRuleRecursive(value, rule_id, boolean_numeric_mode)) {
                    changed = true;
                }
            }
        }
    } else if (obj.is_array()) {
        for (auto& item : obj) {
            if (item.is_object() || item.is_array()) {
                if (applyRuleRecursive(item, rule_id, boolean_numeric_mode)) {
                    changed = true;
                }
            }
        }
    }
    
    // Then apply the rule to the current level (after children are cleaned)
    if (obj.is_object()) {
        bool rule_changed = false;
        switch (rule_id) {
            case 1: rule_changed = rule1_remove_empty_lists(obj); break;
            case 2: rule_changed = rule2_remove_empty_strings(obj); break;
            case 3: rule_changed = rule3_remove_null_values(obj); break;
            case 4: rule_changed = rule4_remove_empty_objects(obj); break;
            case 5: rule_changed = rule5_remove_duplicates(obj); break;
            case 6: rule_changed = rule6_convert_boolean_strings(obj, boolean_numeric_mode); break;
            case 7: rule_changed = rule7_fix_language_codes(obj); break;
            default: return changed;
        }
        if (rule_changed) {
            changed = true;
        }
    }
    
    return changed;
}

JsonProcessor::IssueCounts JsonProcessor::scanForIssues(const json& data) {
    IssueCounts counts;
    scanRecursive(data, counts);
    return counts;
}

void JsonProcessor::scanRecursive(const json& node, IssueCounts& counts) {
    if (node.is_null()) return;
    
    if (node.is_object()) {
        for (const auto& [key, value] : node.items()) {
            if (value.is_array() && value.empty()) {
                counts.empty_lists++;
                counts.total_issues++;
            } else if (value.is_string()) {
                std::string str = value.get<std::string>();
                if (str.empty() || std::all_of(str.begin(), str.end(), ::isspace)) {
                    counts.empty_strings++;
                    counts.total_issues++;
                }
            } else if (value.is_null()) {
                counts.null_values++;
                counts.total_issues++;
            } else if (value.is_object() && value.empty()) {
                counts.empty_objects++;
                counts.total_issues++;
            } else if (value.is_array() && !value.empty()) {
                int duplicates = countDuplicatesInArray(value);
                if (duplicates > 0) {
                    counts.duplicates += duplicates;
                    counts.total_issues += duplicates;
                }
            }
        }
        
        // Recursively scan children
        for (const auto& [key, value] : node.items()) {
            if (value.is_object() || value.is_array()) {
                scanRecursive(value, counts);
            }
        }
    } else if (node.is_array()) {
        int duplicates = countDuplicatesInArray(node);
        if (duplicates > 0) {
            counts.duplicates += duplicates;
            counts.total_issues += duplicates;
        }
        
        // Recursively scan children
        for (const auto& item : node) {
            if (item.is_object() || item.is_array()) {
                scanRecursive(item, counts);
            }
        }
    }
}

int JsonProcessor::countDuplicatesInArray(const json& array) {
    if (!array.is_array() || array.empty()) {
        return 0;
    }
    
    std::unordered_set<std::string> seen;
    int duplicates = 0;
    
    for (const auto& item : array) {
        std::string item_str = item.dump();
        if (seen.find(item_str) != seen.end()) {
            duplicates++;
        } else {
            seen.insert(item_str);
        }
    }
    
    return duplicates;
}

std::vector<JsonProcessor::IndividualChange> JsonProcessor::getAllChangesForRule(
    const json& root, int rule_id, const std::vector<int>& skip_rules) {
    
    std::vector<IndividualChange> changes;
    
    if (root.is_null()) {
        return changes;
    }
    
    std::unordered_set<int> skip_set(skip_rules.begin(), skip_rules.end());
    if (skip_set.find(rule_id) != skip_set.end()) {
        return changes;
    }
    
    getAllChangesRecursive(root, rule_id, skip_set, changes);
    return changes;
}

void JsonProcessor::getAllChangesRecursive(const json& node, int rule_id, 
                                          const std::unordered_set<int>& skip_rules,
                                          std::vector<IndividualChange>& changes,
                                          const std::string& parent_path) {
    
    if (node.is_object()) {
        json test_obj = deepCopy(node);
        bool changed = false;
        
        // Apply the rule to see what changes
        switch (rule_id) {
            case 1: changed = rule1_remove_empty_lists(test_obj); break;
            case 2: changed = rule2_remove_empty_strings(test_obj); break;
            case 3: changed = rule3_remove_null_values(test_obj); break;
            case 4: changed = rule4_remove_empty_objects(test_obj); break;
            case 5: changed = rule5_remove_duplicates(test_obj); break;
            case 6: changed = rule6_convert_boolean_strings(test_obj, false); break;
            case 7: changed = rule7_fix_language_codes(test_obj); break;
            default: return;
        }
        
        if (changed) {
            if (rule_id == 6 || rule_id == 7) {
                // Rules 6 and 7 modify values, not remove fields
                // Compare field by field to find modified values
                for (const auto& [key, value] : node.items()) {
                    if (test_obj.contains(key)) {
                        json before_value = value;
                        json after_value = test_obj[key];
                        
                        if (before_value != after_value) {
                            std::string path = buildPath(parent_path, key);
                            changes.push_back({
                                path,
                                key,
                                before_value,
                                after_value,
                                rule_id,
                                node,
                                test_obj
                            });
                        }
                    }
                }
            } else {
                // Rules 1-5 remove fields
                // Find which fields were removed
                for (const auto& [key, value] : node.items()) {
                    if (!test_obj.contains(key)) {
                        std::string path = buildPath(parent_path, key);
                        json parent_after = deepCopy(node);
                        parent_after.erase(key);
                        
                        changes.push_back({
                            path,
                            key,
                            value,
                            json(nullptr),  // Field removed = null
                            rule_id,
                            node,
                            parent_after
                        });
                    }
                }
            }
        }
        
        // Recursively process children
        for (const auto& [key, value] : node.items()) {
            if (value.is_object() || value.is_array()) {
                std::string child_path = buildPath(parent_path, key);
                getAllChangesRecursive(value, rule_id, skip_rules, changes, child_path);
            }
        }
    } else if (node.is_array()) {
        // Handle Rule 5 (duplicates) for arrays
        if (rule_id == 5) {
            json test_array = deepCopy(node);
            std::unordered_set<std::string> seen;
            json new_array = json::array();
            std::vector<int> duplicate_indices;
            
            for (size_t i = 0; i < node.size(); i++) {
                std::string item_str = node[i].dump();
                if (seen.find(item_str) != seen.end()) {
                    duplicate_indices.push_back(i);
                } else {
                    seen.insert(item_str);
                    new_array.push_back(node[i]);
                }
            }
            
            if (!duplicate_indices.empty()) {
                for (int idx : duplicate_indices) {
                    std::string path = buildPath(parent_path, "[" + std::to_string(idx) + "]");
                    changes.push_back({
                        path,
                        "[" + std::to_string(idx) + "]",
                        node[idx],
                        json(nullptr),
                        rule_id,
                        node,
                        new_array
                    });
                }
            }
        }
        
        // Recursively process array items
        for (size_t i = 0; i < node.size(); i++) {
            const json& item = node[i];
            if (item.is_object() || item.is_array()) {
                std::string child_path = buildPath(parent_path, "[" + std::to_string(i) + "]");
                getAllChangesRecursive(item, rule_id, skip_rules, changes, child_path);
            }
        }
    }
}

std::string JsonProcessor::buildPath(const std::string& parent_path, const std::string& field) {
    if (parent_path.empty()) {
        return field;
    }
    if (field.front() == '[') {
        return parent_path + field;  // Array index
    }
    return parent_path + "." + field;
}

} // namespace json_processor


