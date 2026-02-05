#pragma once

#include "../json/processor.hpp"
#include <string>
#include <memory>

namespace api {

class RequestHandler {
public:
    RequestHandler();
    
    // API endpoint handlers
    std::string handleUpload(const std::string& json_data);
    std::string handleGetNextChange(const std::string& request_data);
    std::string handleAcceptChanges(const std::string& request_data);
    std::string handleRejectChanges(const std::string& request_data);
    std::string handleCleanSpecificRule(const std::string& request_data);
    std::string handleScanIssues(const std::string& json_data);
    std::string handleGetAllChangesForRule(const std::string& request_data);
    std::string handleGetPrecomputedChanges();
    std::string handleKeysAppliedLength();
    std::string handleHealth();
    
private:
    json_processor::JsonProcessor processor_;
    json current_data_;
    json original_data_;
    std::vector<int> applied_rules_;
    std::vector<int> rejected_rules_;
    std::vector<json> precomputed_changes_;
    
    std::string createResponse(const std::string& status, const json& data);
    std::string createErrorResponse(const std::string& error_message);
};

} // namespace api


