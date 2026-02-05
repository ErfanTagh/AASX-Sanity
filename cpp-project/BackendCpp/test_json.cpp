// Simple test to verify JSON processing works
#include "src/json/processor.hpp"
#include <iostream>

int main() {
    std::cout << "Testing JSON Processor..." << std::endl;
    
    json_processor::JsonProcessor processor;
    
    // Test JSON with various issues
    json test_data = {
        {"empty_list", json::array()},
        {"empty_string", ""},
        {"null_value", nullptr},
        {"empty_object", json::object()},
        {"valid_field", "value"},
        {"boolean_string", "true"},
        {"duplicate_array", {1, 2, 2, 3, 3, 3}},
        {"language_code", "en?"}
    };
    
    std::cout << "\nOriginal JSON:" << std::endl;
    std::cout << test_data.dump(2) << std::endl;
    
    // Clean JSON
    json cleaned = processor.cleanAll(test_data);
    
    std::cout << "\nCleaned JSON:" << std::endl;
    std::cout << cleaned.dump(2) << std::endl;
    
    // Verify cleaning worked
    bool success = true;
    if (cleaned.contains("empty_list")) {
        std::cerr << "ERROR: empty_list should be removed!" << std::endl;
        success = false;
    }
    if (cleaned.contains("empty_string")) {
        std::cerr << "ERROR: empty_string should be removed!" << std::endl;
        success = false;
    }
    if (cleaned.contains("null_value")) {
        std::cerr << "ERROR: null_value should be removed!" << std::endl;
        success = false;
    }
    if (cleaned.contains("empty_object")) {
        std::cerr << "ERROR: empty_object should be removed!" << std::endl;
        success = false;
    }
    if (cleaned["boolean_string"] != true) {
        std::cerr << "ERROR: boolean_string should be converted to true!" << std::endl;
        success = false;
    }
    if (cleaned["language_code"] != "en") {
        std::cerr << "ERROR: language_code should be 'en' not 'en?'!" << std::endl;
        success = false;
    }
    
    if (success) {
        std::cout << "\n✅ All tests passed!" << std::endl;
        return 0;
    } else {
        std::cerr << "\n❌ Some tests failed!" << std::endl;
        return 1;
    }
}


