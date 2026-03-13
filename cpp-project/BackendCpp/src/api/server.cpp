#include "server.hpp"
#include "../utils/logger.hpp"
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <sstream>
#include <iostream>
#include <algorithm>
#include <cstring>
#include <cctype>

namespace api {

HttpServer::HttpServer(const std::string& host, int port) 
    : host_(host), port_(port), running_(false), server_fd_(-1) {
    handler_ = std::make_unique<RequestHandler>();
}

HttpServer::~HttpServer() {
    stop();
}

void HttpServer::start() {
    if (running_) return;
    
    // Create socket
    server_fd_ = socket(AF_INET, SOCK_STREAM, 0);
    if (server_fd_ < 0) {
        utils::Logger::getInstance().error("Failed to create socket");
        return;
    }
    
    // Set socket options
    int opt = 1;
    if (setsockopt(server_fd_, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt)) < 0) {
        utils::Logger::getInstance().error("Failed to set socket options");
        close(server_fd_);
        return;
    }
    
    // Bind socket
    struct sockaddr_in address;
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = INADDR_ANY;
    address.sin_port = htons(port_);
    
    if (bind(server_fd_, (struct sockaddr*)&address, sizeof(address)) < 0) {
        utils::Logger::getInstance().error("Failed to bind socket");
        close(server_fd_);
        return;
    }
    
    // Listen
    if (listen(server_fd_, 10) < 0) {
        utils::Logger::getInstance().error("Failed to listen");
        close(server_fd_);
        return;
    }
    
    running_ = true;
    server_thread_ = std::thread(&HttpServer::runServer, this);
    
    utils::Logger::getInstance().info("HTTP Server started on " + host_ + ":" + std::to_string(port_));
}

void HttpServer::stop() {
    if (!running_) return;
    
    running_ = false;
    
    if (server_fd_ >= 0) {
        close(server_fd_);
        server_fd_ = -1;
    }
    
    if (server_thread_.joinable()) {
        server_thread_.join();
    }
    
    utils::Logger::getInstance().info("HTTP Server stopped");
}

void HttpServer::runServer() {
    while (running_) {
        struct sockaddr_in client_address;
        socklen_t client_len = sizeof(client_address);
        
        int client_fd = accept(server_fd_, (struct sockaddr*)&client_address, &client_len);
        
        if (client_fd < 0) {
            if (running_) {
                utils::Logger::getInstance().error("Failed to accept connection");
            }
            continue;
        }
        
        // Handle connection in current thread (for simplicity)
        // In production, use thread pool
        handleConnection(client_fd);
        close(client_fd);
    }
}

void HttpServer::handleConnection(int client_fd) {
    std::string request_str;
    char buffer[8192] = {0};
    
    // Read the full request (handle large bodies)
    ssize_t total_read = 0;
    while (true) {
        ssize_t bytes_read = read(client_fd, buffer, sizeof(buffer) - 1);
        if (bytes_read <= 0) {
            break;
        }
        buffer[bytes_read] = '\0';
        request_str.append(buffer, bytes_read);
        total_read += bytes_read;
        
        // Check if we've read the complete request
        // For multipart, Content-Length header tells us the size
        if (request_str.find("\r\n\r\n") != std::string::npos) {
            // Check if there's a Content-Length header
            size_t content_length_pos = request_str.find("Content-Length:");
            if (content_length_pos != std::string::npos) {
                size_t cl_start = request_str.find_first_of("0123456789", content_length_pos);
                size_t cl_end = request_str.find_first_not_of("0123456789", cl_start);
                if (cl_end == std::string::npos) cl_end = request_str.find("\r\n", cl_start);
                if (cl_end != std::string::npos) {
                    std::string cl_str = request_str.substr(cl_start, cl_end - cl_start);
                    try {
                        size_t content_length = std::stoul(cl_str);
                        size_t header_end = request_str.find("\r\n\r\n");
                        size_t body_start = header_end + 4;
                        if (request_str.length() - body_start >= content_length) {
                            break;  // We have the full body
                        }
                    } catch (...) {
                        // Invalid Content-Length, continue reading
                    }
                }
            } else {
                // No Content-Length, for multipart look for closing boundary
                if (request_str.find("multipart/form-data") != std::string::npos) {
                    // Look for closing boundary marker
                    if (request_str.find("----\r\n") != std::string::npos) {
                        if (static_cast<size_t>(bytes_read) < sizeof(buffer) - 1) {
                            break;  // Last chunk was small, probably end
                        }
                    }
                } else {
                    // Not multipart, headers-only request
                    break;
                }
            }
        }
        
        // Safety limit
        if (total_read > 50 * 1024 * 1024) {  // 50MB limit
            break;
        }
    }
    
    if (request_str.empty()) {
        return;
    }
    
    HttpRequest request = parseRequest(request_str);
    HttpResponse response = handleRequest(request);
    
    std::string response_str = buildResponse(response);
    send(client_fd, response_str.c_str(), response_str.length(), 0);
}

HttpServer::HttpRequest HttpServer::parseRequest(const std::string& raw_request) {
    HttpRequest request;
    std::istringstream stream(raw_request);
    std::string line;
    
    // Parse first line (method and path)
    if (std::getline(stream, line)) {
        std::istringstream first_line(line);
        first_line >> request.method >> request.path;
    }
    
    // Parse headers
    while (std::getline(stream, line) && line != "\r" && !line.empty()) {
        size_t colon_pos = line.find(':');
        if (colon_pos != std::string::npos) {
            std::string key = line.substr(0, colon_pos);
            std::string value = line.substr(colon_pos + 1);
            // Trim whitespace
            value.erase(0, value.find_first_not_of(" \t"));
            value.erase(value.find_last_not_of(" \t") + 1);
            request.headers[key] = value;
        }
    }
    
    // Parse body
    size_t body_start = raw_request.find("\r\n\r\n");
    if (body_start != std::string::npos) {
        request.body = raw_request.substr(body_start + 4);
    }
    
    return request;
}

HttpServer::HttpResponse HttpServer::handleRequest(const HttpRequest& request) {
    HttpResponse response;
    response.headers["Content-Type"] = "application/json";
    response.headers["Access-Control-Allow-Origin"] = "*";
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    response.headers["Access-Control-Allow-Headers"] = "Content-Type";
    
    // Handle OPTIONS (CORS preflight)
    if (request.method == "OPTIONS") {
        response.status_code = 200;
        response.body = "";
        return response;
    }
    
    std::string path = request.path;
    
        try {
        if (request.method == "POST") {
            if (path == "/upload") {
                // Handle both JSON body and multipart/form-data
                std::string json_data = extractJsonFromMultipart(request.body, request.headers);
                if (json_data.empty()) {
                    // Check if body is already JSON (not multipart)
                    if (!request.body.empty() && (request.body.front() == '{' || request.body.front() == '[')) {
                        json_data = request.body;  // Direct JSON
                    } else {
                        response.status_code = 400;
                        response.body = R"({"error":"No valid JSON data found in request"})";
                        return response;
                    }
                }
                response.body = handler_->handleUpload(json_data);
                response.status_code = 200;
            } else if (path == "/get-next-change") {
                response.body = handler_->handleGetNextChange(request.body);
                response.status_code = 200;
            } else if (path == "/accept-changes") {
                response.body = handler_->handleAcceptChanges(request.body);
                response.status_code = 200;
            } else if (path == "/reject-changes") {
                response.body = handler_->handleRejectChanges(request.body);
                response.status_code = 200;
            } else if (path == "/clean-specific-rule") {
                response.body = handler_->handleCleanSpecificRule(request.body);
                response.status_code = 200;
            } else if (path == "/scan-issues") {
                // Handle multipart/form-data for file upload
                std::string json_data = extractJsonFromMultipart(request.body, request.headers);
                if (json_data.empty()) {
                    json_data = request.body;  // Try as direct JSON
                }
                response.body = handler_->handleScanIssues(json_data);
                response.status_code = 200;
            } else if (path == "/get-all-changes-for-rule") {
                response.body = handler_->handleGetAllChangesForRule(request.body);
                response.status_code = 200;
            } else {
                response.status_code = 404;
                response.body = R"({"status":"error","error":"Not found"})";
            }
        } else if (request.method == "GET") {
            if (path == "/health") {
                response.body = handler_->handleHealth();
                response.status_code = 200;
            } else if (path == "/get-precomputed-changes") {
                response.body = handler_->handleGetPrecomputedChanges();
                response.status_code = 200;
            } else if (path == "/keys-applied-length") {
                response.body = handler_->handleKeysAppliedLength();
                response.status_code = 200;
            } else {
                response.status_code = 404;
                response.body = R"({"status":"error","error":"Not found"})";
            }
        } else {
            response.status_code = 405;
            response.body = R"({"status":"error","error":"Method not allowed"})";
        }
    } catch (const std::exception& e) {
        response.status_code = 500;
        response.body = R"({"status":"error","error":")" + std::string(e.what()) + "\"}";
    }
    
    return response;
}

std::string HttpServer::extractJsonFromMultipart(const std::string& body, const std::map<std::string, std::string>& headers) {
    // Check if it's multipart/form-data (case-insensitive)
    std::string content_type;
    for (const auto& [key, value] : headers) {
        std::string lower_key = key;
        std::transform(lower_key.begin(), lower_key.end(), lower_key.begin(), ::tolower);
        if (lower_key == "content-type") {
            content_type = value;
            break;
        }
    }
    
    if (content_type.empty()) {
        return "";  // Not multipart
    }
    
    // Convert to lowercase for comparison
    std::string lower_content_type = content_type;
    std::transform(lower_content_type.begin(), lower_content_type.end(), lower_content_type.begin(), ::tolower);
    if (lower_content_type.find("multipart/form-data") == std::string::npos) {
        return "";  // Not multipart
    }
    
    // Extract boundary (case-insensitive)
    size_t boundary_pos = lower_content_type.find("boundary=");
    if (boundary_pos == std::string::npos) {
        return "";
    }
    
    std::string boundary = content_type.substr(boundary_pos + 9);  // "boundary=" is 9 chars
    // Remove quotes if present
    if (!boundary.empty() && boundary.front() == '"' && boundary.back() == '"') {
        boundary = boundary.substr(1, boundary.length() - 2);
    }
    // Trim whitespace and semicolons
    boundary.erase(0, boundary.find_first_not_of(" \t;"));
    size_t last_char = boundary.find_last_not_of(" \t;");
    if (last_char != std::string::npos) {
        boundary = boundary.substr(0, last_char + 1);
    }
    
    if (boundary.empty()) {
        return "";
    }
    
    std::string boundary_marker = "--" + boundary;
    
    // Log boundary for debugging
    utils::Logger::getInstance().info("Multipart boundary: " + boundary + ", marker: " + boundary_marker);
    
    // Find the file part (look for Content-Disposition with filename)
    size_t file_start = body.find(boundary_marker);
    if (file_start == std::string::npos) {
        // Try without leading --
        file_start = body.find(boundary);
        if (file_start != std::string::npos) {
            boundary_marker = boundary;
        } else {
            return "";
        }
    }
    
    // Find the start of the file content (after headers)
    size_t content_start = body.find("\r\n\r\n", file_start);
    if (content_start == std::string::npos) {
        // Try with just \n\n
        content_start = body.find("\n\n", file_start);
        if (content_start == std::string::npos) {
            return "";
        }
        content_start += 2;
    } else {
        content_start += 4;  // Skip "\r\n\r\n"
    }
    
    // Find the end of the file content (before next boundary)
    // The boundary should appear on its own line, so look for \r\n--boundary or \n--boundary
    size_t next_boundary = std::string::npos;
    
    // Search for boundary that appears after the content (not the one we started with)
    // Look for the pattern: \r\n--boundary or \n--boundary
    std::string search_pattern1 = "\r\n" + boundary_marker;
    std::string search_pattern2 = "\n" + boundary_marker;
    
    size_t found1 = body.find(search_pattern1, content_start);
    size_t found2 = body.find(search_pattern2, content_start);
    
    if (found1 != std::string::npos && found2 != std::string::npos) {
        next_boundary = std::min(found1, found2);
    } else if (found1 != std::string::npos) {
        next_boundary = found1;
    } else if (found2 != std::string::npos) {
        next_boundary = found2;
    }
    
    // If not found, try closing boundary
    if (next_boundary == std::string::npos) {
        std::string closing_boundary = "--" + boundary + "--";
        std::string search_close1 = "\r\n" + closing_boundary;
        std::string search_close2 = "\n" + closing_boundary;
        
        size_t found_close1 = body.find(search_close1, content_start);
        size_t found_close2 = body.find(search_close2, content_start);
        
        if (found_close1 != std::string::npos && found_close2 != std::string::npos) {
            next_boundary = std::min(found_close1, found_close2);
        } else if (found_close1 != std::string::npos) {
            next_boundary = found_close1;
        } else if (found_close2 != std::string::npos) {
            next_boundary = found_close2;
        }
    }
    
    size_t content_end;
    if (next_boundary != std::string::npos) {
        // Found boundary, content ends just before it
        content_end = next_boundary;
        // Back up to remove trailing \r\n or \n
        while (content_end > content_start && 
               (body[content_end - 1] == '\n' || body[content_end - 1] == '\r')) {
            content_end--;
        }
    } else {
        // No boundary found, use end of body
        content_end = body.length();
        // Remove trailing \r\n
        while (content_end > content_start && 
               (body[content_end - 1] == '\n' || body[content_end - 1] == '\r')) {
            content_end--;
        }
    }
    
    // Extract JSON content
    if (content_end <= content_start) {
        utils::Logger::getInstance().error("Invalid content range: start=" + std::to_string(content_start) + ", end=" + std::to_string(content_end));
        return "";
    }
    
    std::string json_content = body.substr(content_start, content_end - content_start);
    
    // Debug logging
    utils::Logger::getInstance().info("Extracted content: start=" + std::to_string(content_start) + 
                                      ", end=" + std::to_string(content_end) + 
                                      ", length=" + std::to_string(json_content.length()));
    
    // Check if content contains boundary markers (shouldn't)
    if (json_content.find("--") != std::string::npos) {
        size_t boundary_pos = json_content.find("--");
        utils::Logger::getInstance().error("Found '--' in extracted content at position " + 
                                          std::to_string(boundary_pos) + 
                                          ". Content around it: " + 
                                          json_content.substr(std::max(0, (int)boundary_pos - 30), 60));
        // Remove everything from the boundary marker onwards
        json_content = json_content.substr(0, boundary_pos);
    }
    
    // Remove trailing \r\n, \n, and whitespace
    while (!json_content.empty()) {
        char last = json_content.back();
        if (last == '\n' || last == '\r' || last == ' ' || last == '\t') {
            json_content.pop_back();
        } else {
            break;
        }
    }
    
    // Remove leading whitespace
    while (!json_content.empty()) {
        char first = json_content.front();
        if (first == ' ' || first == '\t' || first == '\n' || first == '\r') {
            json_content.erase(0, 1);
        } else {
            break;
        }
    }
    
    // Validate it looks like JSON (starts with { or [)
    if (json_content.empty() || (json_content.front() != '{' && json_content.front() != '[')) {
        utils::Logger::getInstance().error("Extracted content doesn't look like JSON. First 100 chars: " + 
                                          json_content.substr(0, std::min(json_content.length(), size_t(100))));
        return "";
    }
    
    utils::Logger::getInstance().info("Successfully extracted JSON, length: " + std::to_string(json_content.length()));
    
    return json_content;
}

std::string HttpServer::buildResponse(const HttpResponse& response) {
    std::ostringstream oss;
    
    // Status line
    oss << "HTTP/1.1 " << response.status_code << " ";
    switch (response.status_code) {
        case 200: oss << "OK"; break;
        case 404: oss << "Not Found"; break;
        case 405: oss << "Method Not Allowed"; break;
        case 500: oss << "Internal Server Error"; break;
        default: oss << "Unknown"; break;
    }
    oss << "\r\n";
    
    // Headers
    for (const auto& [key, value] : response.headers) {
        oss << key << ": " << value << "\r\n";
    }
    
    // Content-Length
    oss << "Content-Length: " << response.body.length() << "\r\n";
    
    // End headers
    oss << "\r\n";
    
    // Body
    oss << response.body;
    
    return oss.str();
}

} // namespace api


