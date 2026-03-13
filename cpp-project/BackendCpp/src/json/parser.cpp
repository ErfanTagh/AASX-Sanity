#include "parser.hpp"
#include <fstream>
#include <sstream>
#include <iostream>

namespace json_processor {

json parseJsonFile(const std::string& filename) {
    std::ifstream file(filename);
    if (!file.is_open()) {
        throw std::runtime_error("Cannot open file: " + filename);
    }
    
    json j;
    file >> j;
    return j;
}

json parseJsonString(const std::string& json_str) {
    return json::parse(json_str);
}

std::string jsonToString(const json& j, int indent) {
    if (indent >= 0) {
        return j.dump(indent);
    }
    return j.dump();
}

} // namespace json_processor

