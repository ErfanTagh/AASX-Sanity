// Test JSON cleaning with a real file
#include "src/json/processor.hpp"
#include "src/json/parser.hpp"
#include <iostream>
#include <fstream>
#include <iomanip>

void printSection(const std::string& title) {
    std::cout << "\n" << std::string(70, '=') << std::endl;
    std::cout << "  " << title << std::endl;
    std::cout << std::string(70, '=') << std::endl;
}

void printComparison(const json& before, const json& after) {
    std::cout << "\n📊 BEFORE CLEANING:" << std::endl;
    std::cout << std::string(70, '-') << std::endl;
    std::cout << before.dump(2) << std::endl;
    
    std::cout << "\n✨ AFTER CLEANING:" << std::endl;
    std::cout << std::string(70, '-') << std::endl;
    std::cout << after.dump(2) << std::endl;
}

void countFieldsRecursive(const json& j, int& total, int& empty) {
    if (j.is_object()) {
        for (const auto& [key, value] : j.items()) {
            total++;
            if (value.is_null() || 
                (value.is_string() && value.get<std::string>().empty()) ||
                (value.is_array() && value.empty()) ||
                (value.is_object() && value.empty())) {
                empty++;
            }
            if (value.is_object() || value.is_array()) {
                countFieldsRecursive(value, total, empty);
            }
        }
    } else if (j.is_array()) {
        for (const auto& item : j) {
            if (item.is_object() || item.is_array()) {
                countFieldsRecursive(item, total, empty);
            }
        }
    }
}

void analyzeChanges(const json& before, const json& after) {
    std::cout << "\n📈 ANALYSIS:" << std::endl;
    std::cout << std::string(70, '-') << std::endl;
    
    int before_total = 0, before_empty = 0;
    int after_total = 0, after_empty = 0;
    
    countFieldsRecursive(before, before_total, before_empty);
    countFieldsRecursive(after, after_total, after_empty);
    
    std::cout << "Fields before cleaning: " << before_total << " (empty/null: " << before_empty << ")" << std::endl;
    std::cout << "Fields after cleaning: " << after_total << " (empty/null: " << after_empty << ")" << std::endl;
    std::cout << "Fields removed: " << (before_total - after_total) << std::endl;
    std::cout << "Reduction: " << std::fixed << std::setprecision(1) 
              << (100.0 * (before_total - after_total) / before_total) << "%" << std::endl;
}

void testStepwiseCleaning(json_processor::JsonProcessor& processor, json& data) {
    printSection("STEPWISE CLEANING TEST");
    
    json working_copy = data;
    std::vector<int> applied_rules;
    std::vector<int> rejected_rules;
    int step = 1;
    
    std::cout << "\nProcessing changes step by step...\n" << std::endl;
    
    while (step <= 20) { // Safety limit
        std::vector<int> skip_rules;
        skip_rules.insert(skip_rules.end(), applied_rules.begin(), applied_rules.end());
        skip_rules.insert(skip_rules.end(), rejected_rules.begin(), rejected_rules.end());
        
        auto result = processor.cleanStepwise(working_copy, skip_rules);
        
        if (!result.has_change) {
            std::cout << "✅ No more changes found after " << (step - 1) << " steps." << std::endl;
            break;
        }
        
        std::cout << "Step " << step << ": Rule " << result.rule_id << std::endl;
        std::cout << "  Before: " << result.before_fragment.dump() << std::endl;
        std::cout << "  After:  " << result.after_fragment.dump() << std::endl;
        
        // Accept the change
        working_copy = result.complete_after;
        applied_rules.push_back(result.rule_id);
        step++;
    }
    
    std::cout << "\n📋 Summary:" << std::endl;
    std::cout << "  Total steps: " << (step - 1) << std::endl;
    std::cout << "  Rules applied: ";
    for (size_t i = 0; i < applied_rules.size(); ++i) {
        std::cout << applied_rules[i];
        if (i < applied_rules.size() - 1) std::cout << ", ";
    }
    std::cout << std::endl;
}

int main(int argc, char* argv[]) {
    std::cout << "\n" << std::string(70, '=') << std::endl;
    std::cout << "  AAS Sanity C++ Backend - JSON Cleaning Test" << std::endl;
    std::cout << std::string(70, '=') << std::endl;
    
    // Get input file
    std::string input_file = "test_data.json";
    if (argc > 1) {
        input_file = argv[1];
    }
    
    try {
        // Load JSON file
        printSection("LOADING JSON FILE");
        std::cout << "Loading: " << input_file << std::endl;
        
        json original_data = json_processor::parseJsonFile(input_file);
        std::cout << "✅ File loaded successfully!" << std::endl;
        std::cout << "File size: " << original_data.dump().length() << " bytes" << std::endl;
        
        // Create processor
        json_processor::JsonProcessor processor;
        
        // Test 1: Clean all at once
        printSection("TEST 1: CLEAN ALL RULES");
        json cleaned_all = processor.cleanAll(original_data);
        printComparison(original_data, cleaned_all);
        analyzeChanges(original_data, cleaned_all);
        
        // Test 2: Stepwise cleaning
        json working_copy = original_data;
        testStepwiseCleaning(processor, working_copy);
        
        // Test 3: Save cleaned result
        printSection("SAVING RESULTS");
        std::string output_file = "test_data_cleaned.json";
        std::ofstream out(output_file);
        if (out.is_open()) {
            out << cleaned_all.dump(2);
            out.close();
            std::cout << "✅ Cleaned JSON saved to: " << output_file << std::endl;
        } else {
            std::cerr << "❌ Failed to save output file" << std::endl;
        }
        
        // Final summary
        printSection("TEST SUMMARY");
        std::cout << "✅ All tests completed successfully!" << std::endl;
        std::cout << "\nFiles:" << std::endl;
        std::cout << "  Input:  " << input_file << std::endl;
        std::cout << "  Output: " << output_file << std::endl;
        
    } catch (const std::exception& e) {
        std::cerr << "\n❌ ERROR: " << e.what() << std::endl;
        return 1;
    }
    
    return 0;
}

