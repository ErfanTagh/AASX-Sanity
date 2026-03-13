#pragma once

#include "../parallel/framework.hpp"
#include <nlohmann/json.hpp>
#include <string>
#include <vector>
#include <unordered_set>
#include <functional>

using json = nlohmann::json;

namespace json_processor {

class JsonProcessor {
public:
    JsonProcessor();
    
    // Clean JSON using parallel processing
    json cleanJson(const json& data, bool use_parallel = true);
    
    // Clean large arrays in parallel
    json cleanLargeArray(const json& array);
    
    // Stepwise cleaning (like Python/Go versions)
    struct StepwiseResult {
        json before_fragment;
        json after_fragment;
        int rule_id;
        json complete_before;
        json complete_after;
        bool has_change;
        
        StepwiseResult() : rule_id(0), has_change(false) {}
    };
    
    StepwiseResult cleanStepwise(json& data, const std::vector<int>& skip_rules = {});
    
    // Apply specific rule
    bool applyRule(json& obj, int rule_id, bool boolean_numeric_mode = false);
    
    // Helper function for recursive rule application
    bool applyRuleRecursive(json& obj, int rule_id, bool boolean_numeric_mode = false);
    
    // Clean all rules iteratively
    json cleanAll(const json& data);
    
    // Scan for issues without fixing
    struct IssueCounts {
        int empty_lists = 0;
        int empty_strings = 0;
        int null_values = 0;
        int empty_objects = 0;
        int duplicates = 0;
        int total_issues = 0;
    };
    
    IssueCounts scanForIssues(const json& data);
    
    // Get all changes for a specific rule
    struct IndividualChange {
        std::string path;
        std::string field_name;
        json before_value;
        json after_value;
        int rule_id;
        json parent_before;
        json parent_after;
    };
    
    std::vector<IndividualChange> getAllChangesForRule(const json& root, int rule_id, const std::vector<int>& skip_rules = {});

private:
    parallel::ParallelFramework<json> framework_;
    
    // Rule functions
    bool rule1_remove_empty_lists(json& obj);
    bool rule2_remove_empty_strings(json& obj);
    bool rule3_remove_null_values(json& obj);
    bool rule4_remove_empty_objects(json& obj);
    bool rule5_remove_duplicates(json& obj);
    bool rule6_convert_boolean_strings(json& obj, bool numeric_mode = false);
    bool rule7_fix_language_codes(json& obj);
    
    // Helper functions
    void processRecursive(json& node, std::unordered_set<int>& skip_rules, StepwiseResult& result, bool& found);
    json deepCopy(const json& src);
    
    // Scan helpers
    void scanRecursive(const json& node, IssueCounts& counts);
    int countDuplicatesInArray(const json& array);
    
    // Get all changes helpers
    void getAllChangesRecursive(const json& node, int rule_id, const std::unordered_set<int>& skip_rules,
                                std::vector<IndividualChange>& changes, const std::string& parent_path = "");
    std::string buildPath(const std::string& parent_path, const std::string& field);
};

} // namespace json_processor

