#include "api/server.hpp"
#include "utils/logger.hpp"
#include <iostream>
#include <csignal>
#include <cstdlib>
#include <thread>
#include <chrono>

api::HttpServer* g_server = nullptr;

void signal_handler(int /*signal*/) {
    if (g_server) {
        utils::Logger::getInstance().info("Shutting down server...");
        g_server->stop();
    }
    exit(0);
}

int main(int /*argc*/, char* /*argv*/[]) {
    // Set up signal handlers
    signal(SIGINT, signal_handler);
    signal(SIGTERM, signal_handler);
    
    // Get port from environment or use default
    const char* port_str = std::getenv("SERVER_PORT");
    int port = port_str ? std::atoi(port_str) : 5001;
    
    const std::string host = "0.0.0.0";
    
    utils::Logger::getInstance().info("Starting AAS Sanity C++ Backend");
    utils::Logger::getInstance().info("Server will listen on " + host + ":" + std::to_string(port));
    
    api::HttpServer server(host, port);
    g_server = &server;
    
    try {
        server.start();
        
        // Keep server running
        while (server.isRunning()) {
            std::this_thread::sleep_for(std::chrono::seconds(1));
        }
        
    } catch (const std::exception& e) {
        utils::Logger::getInstance().error("Server error: " + std::string(e.what()));
        return 1;
    }
    
    return 0;
}

