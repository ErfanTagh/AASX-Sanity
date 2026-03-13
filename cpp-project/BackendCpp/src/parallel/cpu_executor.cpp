#include "cpu_executor.hpp"
#include <iostream>

namespace parallel {

CPUExecutor::CPUExecutor(size_t num_threads) 
    : thread_count_(num_threads == 0 ? std::thread::hardware_concurrency() : num_threads) {
    if (thread_count_ == 0) thread_count_ = 4; // Default to 4 threads
    std::cout << "CPUExecutor initialized with " << thread_count_ << " threads" << std::endl;
}

CPUExecutor::~CPUExecutor() {
    // Cleanup if needed
}

} // namespace parallel


