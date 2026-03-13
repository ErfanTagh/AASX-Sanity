// Example usage of the Parallel Computing Framework and JSON Processor

#include "src/json/processor.hpp"
#include "src/parallel/framework.hpp"
#include <iostream>
#include <vector>
#include <chrono>

using namespace std::chrono;

void example_parallel_framework() {
    std::cout << "\n=== Parallel Framework Example ===" << std::endl;
    
    // Create a large vector
    std::vector<int> data(1000000, 0);
    
    parallel::ParallelFramework<int> framework;
    
    auto start = high_resolution_clock::now();
    
    // Process in parallel
    framework.execute_cpu(data, [](int& x) {
        x = x * 2 + 1;
    });
    
    auto end = high_resolution_clock::now();
    auto duration = duration_cast<milliseconds>(end - start);
    
    std::cout << "Processed " << data.size() << " elements in " 
              << duration.count() << " ms" << std::endl;
    std::cout << "First few values: ";
    for (size_t i = 0; i < std::min(size_t(5), data.size()); ++i) {
        std::cout << data[i] << " ";
    }
    std::cout << std::endl;
}

void example_json_cleaning() {
    std::cout << "\n=== JSON Cleaning Example ===" << std::endl;
    
    json_processor::JsonProcessor processor;
    
    // Create test JSON with issues
    json test_data = {
        {"empty_list", json::array()},
        {"empty_string", ""},
        {"null_value", nullptr},
        {"empty_object", json::object()},
        {"valid_field", "value"},
        {"boolean_string", "true"},
        {"duplicate_array", {1, 2, 2, 3, 3, 3}}
    };
    
    std::cout << "Original JSON:" << std::endl;
    std::cout << test_data.dump(2) << std::endl;
    
    // Clean JSON
    json cleaned = processor.cleanAll(test_data);
    
    std::cout << "\nCleaned JSON:" << std::endl;
    std::cout << cleaned.dump(2) << std::endl;
}

void example_stepwise_cleaning() {
    std::cout << "\n=== Stepwise Cleaning Example ===" << std::endl;
    
    json_processor::JsonProcessor processor;
    
    json test_data = {
        {"empty_list", json::array()},
        {"empty_string", ""},
        {"null_value", nullptr}
    };
    
    json working_copy = test_data;
    
    // Process step by step
    int step = 1;
    while (true) {
        auto result = processor.cleanStepwise(working_copy);
        
        if (!result.has_change) {
            std::cout << "No more changes found." << std::endl;
            break;
        }
        
        std::cout << "\nStep " << step << ": Rule " << result.rule_id << std::endl;
        std::cout << "Before: " << result.before_fragment.dump() << std::endl;
        std::cout << "After: " << result.after_fragment.dump() << std::endl;
        
        // Accept the change
        working_copy = result.complete_after;
        step++;
        
        if (step > 10) break; // Safety limit
    }
}

int main() {
    std::cout << "AAS Sanity C++ Backend - Examples" << std::endl;
    std::cout << "===================================" << std::endl;
    
    try {
        example_parallel_framework();
        example_json_cleaning();
        example_stepwise_cleaning();
        
        std::cout << "\n=== Examples completed successfully ===" << std::endl;
    } catch (const std::exception& e) {
        std::cerr << "Error: " << e.what() << std::endl;
        return 1;
    }
    
    return 0;
}


