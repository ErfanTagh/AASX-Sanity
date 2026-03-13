// Test parallel framework
#include "src/parallel/framework.hpp"
#include <iostream>
#include <vector>
#include <chrono>

using namespace std::chrono;

int main() {
    std::cout << "Testing Parallel Framework..." << std::endl;
    
    // Create large vector
    const size_t size = 1000000;
    std::vector<int> data(size, 0);
    
    parallel::ParallelFramework<int> framework;
    
    std::cout << "Processing " << size << " elements..." << std::endl;
    
    auto start = high_resolution_clock::now();
    
    // Process in parallel
    framework.execute_cpu(data, [](int& x) {
        x = x * 2 + 1;
    });
    
    auto end = high_resolution_clock::now();
    auto duration = duration_cast<milliseconds>(end - start);
    
    std::cout << "Completed in " << duration.count() << " ms" << std::endl;
    
    // Verify results
    bool success = true;
    for (size_t i = 0; i < std::min(size_t(100), data.size()); ++i) {
        if (data[i] != 1) {
            std::cerr << "ERROR: data[" << i << "] = " << data[i] << " (expected 1)" << std::endl;
            success = false;
            break;
        }
    }
    
    if (success) {
        std::cout << "✅ Parallel processing test passed!" << std::endl;
        std::cout << "First 10 values: ";
        for (size_t i = 0; i < 10; ++i) {
            std::cout << data[i] << " ";
        }
        std::cout << std::endl;
        return 0;
    } else {
        std::cerr << "❌ Parallel processing test failed!" << std::endl;
        return 1;
    }
}


