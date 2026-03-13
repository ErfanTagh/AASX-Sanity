#pragma once

#include <nlohmann/json.hpp>
#include <string>

using json = nlohmann::json;

namespace json_processor {

json parseJsonFile(const std::string& filename);
json parseJsonString(const std::string& json_str);
std::string jsonToString(const json& j, int indent = -1);

} // namespace json_processor


