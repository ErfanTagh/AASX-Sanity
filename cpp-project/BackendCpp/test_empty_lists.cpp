#include "src/json/processor.hpp"
#include <iostream>
#include <fstream>
#include <sstream>

using json = nlohmann::json;

int main(int argc, char* argv[]) {
    std::string filename = "sample_test.json";
    if (argc > 1) {
        filename = argv[1];
    }
    
    // Read JSON file
    std::ifstream file(filename);
    if (!file.is_open()) {
        std::cerr << "Error: Could not open file " << filename << std::endl;
        return 1;
    }
    
    std::stringstream buffer;
    buffer << file.rdbuf();
    file.close();
    
    json data;
    try {
        data = json::parse(buffer.str());
    } catch (const json::parse_error& e) {
        std::cerr << "Error parsing JSON: " << e.what() << std::endl;
        return 1;
    }
    
    std::cout << "=== Testing Empty List Removal ===" << std::endl;
    std::cout << "Original file: " << filename << std::endl;
    
    // Check for empty lists before cleaning
    std::cout << "\nChecking for empty lists BEFORE cleaning..." << std::endl;
    int empty_lists_before = 0;
    std::function<void(const json&)> checkEmptyLists = [&](const json& node) {
        if (node.is_object()) {
            for (const auto& [key, value] : node.items()) {
                if (value.is_array() && value.empty()) {
                    empty_lists_before++;
                    std::cout << "  Found empty list: " << key << std::endl;
                } else if (value.is_object() || value.is_array()) {
                    checkEmptyLists(value);
                }
            }
        } else if (node.is_array()) {
            for (const auto& item : node) {
                if (item.is_object() || item.is_array()) {
                    checkEmptyLists(item);
                }
            }
        }
    };
    checkEmptyLists(data);
    std::cout << "Total empty lists found: " << empty_lists_before << std::endl;
    
    // Clean the JSON
    json_processor::JsonProcessor processor;
    json cleaned = processor.cleanAll(data);
    
    // Check for empty lists after cleaning
    std::cout << "\nChecking for empty lists AFTER cleaning..." << std::endl;
    int empty_lists_after = 0;
    checkEmptyLists(cleaned);
    std::cout << "Total empty lists found: " << empty_lists_after << std::endl;
    
    // Check specific fields mentioned by user
    std::cout << "\nChecking specific fields (relatedProducts, reviews, specifications)..." << std::endl;
    std::function<void(const json&, const std::string&)> checkSpecificFields = [&](const json& node, const std::string& path) {
        if (node.is_object()) {
            for (const auto& [key, value] : node.items()) {
                std::string current_path = path.empty() ? key : path + "." + key;
                if (key == "relatedProducts" || key == "reviews" || key == "specifications") {
                    if (value.is_array() && value.empty()) {
                        std::cout << "  WARNING: Found empty " << key << " at path: " << current_path << std::endl;
                    } else if (value.is_array() && !value.empty()) {
                        std::cout << "  OK: " << key << " at path: " << current_path << " has " << value.size() << " items" << std::endl;
                    } else if (!value.is_array()) {
                        std::cout << "  INFO: " << key << " at path: " << current_path << " is not an array" << std::endl;
                    }
                }
                if (value.is_object() || value.is_array()) {
                    checkSpecificFields(value, current_path);
                }
            }
        } else if (node.is_array()) {
            for (size_t i = 0; i < node.size(); i++) {
                std::string current_path = path + "[" + std::to_string(i) + "]";
                if (node[i].is_object() || node[i].is_array()) {
                    checkSpecificFields(node[i], current_path);
                }
            }
        }
    };
    checkSpecificFields(cleaned, "");
    
    // Write cleaned JSON to file
    std::string output_filename = filename + ".cleaned";
    std::ofstream outfile(output_filename);
    if (outfile.is_open()) {
        outfile << cleaned.dump(2);
        outfile.close();
        std::cout << "\nCleaned JSON written to: " << output_filename << std::endl;
    }
    
    return 0;
}

