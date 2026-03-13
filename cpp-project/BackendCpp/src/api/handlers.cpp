#include "handlers.hpp"
#include "../utils/logger.hpp"
#include "../json/parser.hpp"
#include <sstream>
#include <iostream>
#include <algorithm>
#include <nlohmann/json.hpp>

namespace api {

RequestHandler::RequestHandler() {
    // Initialize processor
}

std::string RequestHandler::handleUpload(const std::string& json_data) {
    try {
        // Check if json_data is empty or whitespace only
        if (json_data.empty() || json_data.find_first_not_of(" \t\n\r") == std::string::npos) {
            json error_response;
            error_response["error"] = "No JSON data provided";
            return error_response.dump(2);
        }
        
        json request_data;
        json data;
        
        // Try to parse as JSON object (might contain json_data field)
        try {
            request_data = json::parse(json_data);
            if (request_data.contains("json_data")) {
                // Extract json_data field
                data = request_data["json_data"];
            } else {
                // Direct JSON data
                data = request_data;
            }
        } catch (const json::parse_error& e) {
            // If parsing fails, try as direct JSON
            try {
                data = json::parse(json_data);
            } catch (const json::parse_error& e2) {
                json error_response;
                error_response["error"] = "Invalid JSON: " + std::string(e2.what());
                utils::Logger::getInstance().error("JSON parse error: " + std::string(e2.what()));
                return error_response.dump(2);
            }
        }
        
        original_data_ = data;
        current_data_ = data;
        
        applied_rules_.clear();
        rejected_rules_.clear();
        precomputed_changes_.clear();
        
        // Get skip_rules if provided
        std::vector<int> skip_rules;
        if (request_data.contains("skip_rules") && request_data["skip_rules"].is_array()) {
            for (const auto& rule : request_data["skip_rules"]) {
                skip_rules.push_back(rule.get<int>());
            }
        }
        
        // Clean the JSON
        json cleaned = processor_.cleanJson(current_data_, true);
        
        // Get first change for stepwise processing
        json data_copy = current_data_;  // cleanStepwise modifies in place
        auto stepwise_result = processor_.cleanStepwise(data_copy);
        
        json response;
        response["JSON"] = cleaned;
        response["KEYS"] = json::array();
        
        if (stepwise_result.has_change) {
            response["Before_data"] = stepwise_result.before_fragment;
            response["After_data"] = stepwise_result.after_fragment;
            response["Complete_after_data"] = stepwise_result.complete_after;
            response["Complete_before_data"] = stepwise_result.complete_before;
            response["CURRENT_RULE"] = stepwise_result.rule_id;
            
            // Create simple diff (before/after fragments)
            response["BEFORE"] = stepwise_result.before_fragment;
            response["AFTER"] = stepwise_result.after_fragment;
        } else {
            response["Before_data"] = nullptr;
            response["After_data"] = nullptr;
            response["Complete_after_data"] = nullptr;
            response["Complete_before_data"] = nullptr;
            response["CURRENT_RULE"] = nullptr;
            response["BEFORE"] = nullptr;
            response["AFTER"] = nullptr;
        }
        
        response["SKIP_RULES"] = skip_rules;
        
        // Return as direct JSON (not wrapped in status/data)
        return response.dump(2);
    } catch (const std::exception& e) {
        utils::Logger::getInstance().error("Upload error: " + std::string(e.what()));
        json error_response;
        error_response["error"] = e.what();
        return error_response.dump(2);
    }
}

std::string RequestHandler::handleGetNextChange(const std::string& request_data) {
    try {
        json request = json::parse(request_data);
        std::vector<int> skip_rules;
        
        if (request.contains("skip_rules") && request["skip_rules"].is_array()) {
            for (const auto& rule : request["skip_rules"]) {
                skip_rules.push_back(rule.get<int>());
            }
        }
        
        // Add applied and rejected rules to skip
        skip_rules.insert(skip_rules.end(), applied_rules_.begin(), applied_rules_.end());
        skip_rules.insert(skip_rules.end(), rejected_rules_.begin(), rejected_rules_.end());
        
        json current_data = request.contains("current_data") ? request["current_data"] : current_data_;
        json data_copy = current_data;  // cleanStepwise modifies in place
        auto result = processor_.cleanStepwise(data_copy, skip_rules);
        
        json response;
        if (result.has_change) {
            response["BEFORE"] = result.before_fragment;
            response["AFTER"] = result.after_fragment;
            response["CURRENT_RULE"] = result.rule_id;
            response["Complete_after_data"] = result.complete_after;
            response["Complete_before_data"] = result.complete_before;
            response["MORE_CHANGES"] = true;
            response["MESSAGE"] = "Rule " + std::to_string(result.rule_id) + " applied. Review the changes below.";
        } else {
            response["BEFORE"] = nullptr;
            response["AFTER"] = nullptr;
            response["CURRENT_RULE"] = nullptr;
            response["MORE_CHANGES"] = false;
            response["MESSAGE"] = "No more changes found. Processing complete.";
        }
        
        return response.dump(2);
    } catch (const std::exception& e) {
        utils::Logger::getInstance().error("GetNextChange error: " + std::string(e.what()));
        json error_response;
        error_response["error"] = e.what();
        return error_response.dump(2);
    }
}

std::string RequestHandler::handleAcceptChanges(const std::string& request_data) {
    try {
        json request = json::parse(request_data);
        
        int current_rule = -1;
        if (request.contains("current_rule") && !request["current_rule"].is_null()) {
            current_rule = request["current_rule"].get<int>();
            if (std::find(applied_rules_.begin(), applied_rules_.end(), current_rule) == applied_rules_.end()) {
                applied_rules_.push_back(current_rule);
            }
        }
        
        // Update current_data_ with the accepted change
        if (request.contains("complete_after_data")) {
            current_data_ = request["complete_after_data"];
        }
        
        // Get skip_rules
        std::vector<int> skip_rules;
        if (request.contains("skip_rules") && request["skip_rules"].is_array()) {
            for (const auto& rule : request["skip_rules"]) {
                skip_rules.push_back(rule.get<int>());
            }
        }
        skip_rules.insert(skip_rules.end(), applied_rules_.begin(), applied_rules_.end());
        skip_rules.insert(skip_rules.end(), rejected_rules_.begin(), rejected_rules_.end());
        
        auto result = processor_.cleanStepwise(current_data_, skip_rules);
        
        json response;
        response["status"] = "accepted";
        response["message"] = "Changes accepted";
        
        if (result.has_change) {
            response["BEFORE"] = result.before_fragment;
            response["AFTER"] = result.after_fragment;
            response["CURRENT_RULE"] = result.rule_id;
            response["Complete_after_data"] = result.complete_after;
            response["Complete_before_data"] = result.complete_before;
            response["Before_data"] = result.before_fragment;
            response["After_data"] = result.after_fragment;
            response["MORE_CHANGES"] = true;
        } else {
            response["BEFORE"] = nullptr;
            response["AFTER"] = nullptr;
            response["CURRENT_RULE"] = nullptr;
            response["MORE_CHANGES"] = false;
        }
        
        response["SKIP_RULES"] = skip_rules;
        
        return response.dump(2);
    } catch (const std::exception& e) {
        utils::Logger::getInstance().error("AcceptChanges error: " + std::string(e.what()));
        json error_response;
        error_response["error"] = e.what();
        return error_response.dump(2);
    }
}

std::string RequestHandler::handleRejectChanges(const std::string& request_data) {
    try {
        json request = json::parse(request_data);
        
        int current_rule = -1;
        if (request.contains("current_rule") && !request["current_rule"].is_null()) {
            current_rule = request["current_rule"].get<int>();
            if (std::find(rejected_rules_.begin(), rejected_rules_.end(), current_rule) == rejected_rules_.end()) {
                rejected_rules_.push_back(current_rule);
            }
        }
        
        json current_data = request.contains("current_data") ? request["current_data"] : current_data_;
        
        // Get skip_rules
        std::vector<int> skip_rules;
        if (request.contains("skip_rules") && request["skip_rules"].is_array()) {
            for (const auto& rule : request["skip_rules"]) {
                skip_rules.push_back(rule.get<int>());
            }
        }
        skip_rules.insert(skip_rules.end(), applied_rules_.begin(), applied_rules_.end());
        skip_rules.insert(skip_rules.end(), rejected_rules_.begin(), rejected_rules_.end());
        
        json data_copy = current_data;  // cleanStepwise modifies in place
        auto result = processor_.cleanStepwise(data_copy, skip_rules);
        
        json response;
        response["status"] = "rejected";
        response["message"] = "Changes rejected, trying next available rule";
        
        if (result.has_change) {
            response["BEFORE"] = result.before_fragment;
            response["AFTER"] = result.after_fragment;
            response["CURRENT_RULE"] = result.rule_id;
            response["Complete_after_data"] = result.complete_after;
            response["Complete_before_data"] = result.complete_before;
            response["MORE_CHANGES"] = true;
        } else {
            response["BEFORE"] = nullptr;
            response["AFTER"] = nullptr;
            response["CURRENT_RULE"] = nullptr;
            response["MORE_CHANGES"] = false;
        }
        
        response["SKIP_RULES"] = skip_rules;
        
        return response.dump(2);
    } catch (const std::exception& e) {
        utils::Logger::getInstance().error("RejectChanges error: " + std::string(e.what()));
        json error_response;
        error_response["error"] = e.what();
        return error_response.dump(2);
    }
}

std::string RequestHandler::handleCleanSpecificRule(const std::string& request_data) {
    try {
        json request = json::parse(request_data);
        
        if (!request.contains("rule_id")) {
            json error_response;
            error_response["error"] = "Missing rule_id";
            return error_response.dump(2);
        }
        
        int rule_id = request["rule_id"].get<int>();
        json data = request.contains("json_data") ? request["json_data"] : 
                    (request.contains("data") ? request["data"] : current_data_);
        
        // Get boolean conversion mode for Rule 6
        bool boolean_numeric_mode = false;
        if (rule_id == 6 && request.contains("boolean_conversion_mode")) {
            std::string mode = request["boolean_conversion_mode"].get<std::string>();
            boolean_numeric_mode = (mode == "numeric");
        }
        
        json result = data;
        processor_.applyRule(result, rule_id, boolean_numeric_mode);
        
        // Also scan for issues
        auto counts = processor_.scanForIssues(result);
        
        json issues;
        issues["empty_lists"] = counts.empty_lists;
        issues["empty_strings"] = counts.empty_strings;
        issues["null_values"] = counts.null_values;
        issues["empty_objects"] = counts.empty_objects;
        issues["duplicates"] = counts.duplicates;
        issues["total_issues"] = counts.total_issues;
        
        json response;
        response["success"] = true;
        response["cleaned_json"] = result;
        response["issues"] = issues;
        
        return response.dump(2);
    } catch (const std::exception& e) {
        utils::Logger::getInstance().error("CleanSpecificRule error: " + std::string(e.what()));
        json error_response;
        error_response["error"] = e.what();
        return error_response.dump(2);
    }
}

std::string RequestHandler::handleScanIssues(const std::string& json_data) {
    try {
        json data = json::parse(json_data);
        
        auto counts = processor_.scanForIssues(data);
        
        json issues;
        issues["empty_lists"] = counts.empty_lists;
        issues["empty_strings"] = counts.empty_strings;
        issues["null_values"] = counts.null_values;
        issues["empty_objects"] = counts.empty_objects;
        issues["duplicates"] = counts.duplicates;
        issues["total_issues"] = counts.total_issues;
        
        json response;
        response["success"] = true;
        response["has_issues"] = counts.total_issues > 0;
        response["issues"] = issues;
        
        return response.dump(2);
    } catch (const std::exception& e) {
        utils::Logger::getInstance().error("ScanIssues error: " + std::string(e.what()));
        json error_response;
        error_response["error"] = e.what();
        return error_response.dump(2);
    }
}

std::string RequestHandler::handleGetAllChangesForRule(const std::string& request_data) {
    try {
        json request = json::parse(request_data);
        
        if (!request.contains("rule_id")) {
            return createErrorResponse("Missing rule_id");
        }
        
        int rule_id = request["rule_id"].get<int>();
        if (rule_id < 1 || rule_id > 7) {
            return createErrorResponse("Invalid rule_id. Must be 1, 2, 3, 4, 5, 6, or 7");
        }
        
        json data = request.contains("current_data") ? request["current_data"] : current_data_;
        std::vector<int> skip_rules;
        
        if (request.contains("skip_rules") && request["skip_rules"].is_array()) {
            for (const auto& rule : request["skip_rules"]) {
                skip_rules.push_back(rule.get<int>());
            }
        }
        
        auto changes = processor_.getAllChangesForRule(data, rule_id, skip_rules);
        
        json changes_array = json::array();
        for (const auto& change : changes) {
            json change_obj;
            change_obj["path"] = change.path;
            change_obj["fieldName"] = change.field_name;
            change_obj["beforeValue"] = change.before_value;
            change_obj["afterValue"] = change.after_value;
            change_obj["ruleId"] = change.rule_id;
            
            // For Rule 5, send full arrays; for others, send parent objects
            if (rule_id == 5) {
                change_obj["parentBefore"] = change.parent_before;
                change_obj["parentAfter"] = change.parent_after;
            } else {
                change_obj["parentBefore"] = change.parent_before;
                change_obj["parentAfter"] = change.parent_after;
            }
            
            changes_array.push_back(change_obj);
        }
        
        json response;
        response["ruleId"] = rule_id;
        response["changes"] = changes_array;
        response["count"] = changes.size();
        response["MESSAGE"] = "Found " + std::to_string(changes.size()) + " changes for Rule " + std::to_string(rule_id);
        
        return response.dump(2);
    } catch (const std::exception& e) {
        utils::Logger::getInstance().error("GetAllChangesForRule error: " + std::string(e.what()));
        return createErrorResponse(e.what());
    }
}

std::string RequestHandler::handleGetPrecomputedChanges() {
    json response;
    response["all_changes"] = precomputed_changes_;
    response["is_computing"] = false;
    response["count"] = precomputed_changes_.size();
    
    return response.dump(2);
}

std::string RequestHandler::handleKeysAppliedLength() {
    json response;
    response["keys_applied_length"] = applied_rules_.size();
    
    return response.dump(2);
}

std::string RequestHandler::handleHealth() {
    json response;
    response["status"] = "ok";
    
    return response.dump(2);
}

std::string RequestHandler::createResponse(const std::string& status, const json& data) {
    json response;
    response["status"] = status;
    response["data"] = data;
    return response.dump(2);
}

std::string RequestHandler::createErrorResponse(const std::string& error_message) {
    json response;
    response["status"] = "error";
    response["error"] = error_message;
    return response.dump(2);
}

} // namespace api

