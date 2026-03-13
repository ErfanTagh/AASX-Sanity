#pragma once

#include <string>
#include <mutex>
#include <iostream>

namespace utils {

enum class LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARNING = 2,
    ERROR = 3
};

class Logger {
public:
    static Logger& getInstance();
    
    void log(LogLevel level, const std::string& message);
    void setMinLevel(LogLevel level) { min_level_ = level; }
    
    void debug(const std::string& msg) { log(LogLevel::DEBUG, msg); }
    void info(const std::string& msg) { log(LogLevel::INFO, msg); }
    void warning(const std::string& msg) { log(LogLevel::WARNING, msg); }
    void error(const std::string& msg) { log(LogLevel::ERROR, msg); }

private:
    Logger() : min_level_(LogLevel::INFO) {}
    ~Logger() = default;
    Logger(const Logger&) = delete;
    Logger& operator=(const Logger&) = delete;
    
    LogLevel min_level_;
    std::mutex mutex_;
    
    std::string levelToString(LogLevel level);
};

} // namespace utils


