#pragma once

#include "handlers.hpp"
#include <string>
#include <functional>
#include <map>
#include <memory>

namespace api {

class HttpServer {
public:
    HttpServer(const std::string& host, int port);
    ~HttpServer();
    
    void start();
    void stop();
    bool isRunning() const { return running_; }
    
private:
    std::string host_;
    int port_;
    bool running_;
    std::unique_ptr<RequestHandler> handler_;
    
    // Simple HTTP request parsing
    struct HttpRequest {
        std::string method;
        std::string path;
        std::string body;
        std::map<std::string, std::string> headers;
    };
    
    struct HttpResponse {
        int status_code;
        std::string body;
        std::map<std::string, std::string> headers;
    };
    
    HttpRequest parseRequest(const std::string& raw_request);
    HttpResponse handleRequest(const HttpRequest& request);
    std::string buildResponse(const HttpResponse& response);
    std::string extractJsonFromMultipart(const std::string& body, const std::map<std::string, std::string>& headers);
    
    void handleConnection(int client_fd);
    void runServer();
    
    int server_fd_;
    std::thread server_thread_;
};

} // namespace api


