#include "cuda_executor.hpp"
#include <iostream>
#include <algorithm>
#include <cctype>

#ifdef CUDA_FOUND
#include <cuda_runtime.h>
#endif

namespace parallel {

CUDAExecutor::CUDAExecutor() : cuda_available_(false), device_count_(0) {
    check_cuda_availability();
}

CUDAExecutor::~CUDAExecutor() {
    // Cleanup
}

void CUDAExecutor::check_cuda_availability() {
#ifdef CUDA_FOUND
    cudaError_t err = cudaGetDeviceCount(&device_count_);
    if (err == cudaSuccess && device_count_ > 0) {
        cuda_available_ = true;
        cudaDeviceProp device_prop;
        cudaGetDeviceProperties(&device_prop, 0);
        std::cout << "CUDA available: " << device_prop.name 
                  << " (Compute " << device_prop.major << "." << device_prop.minor << ")" << std::endl;
    } else {
        std::cout << "CUDA not available, using CPU fallback" << std::endl;
    }
#else
    std::cout << "CUDA support not compiled, using CPU fallback" << std::endl;
    cuda_available_ = false;
#endif
}

void CUDAExecutor::normalize_strings(std::vector<std::string>& strings) {
    // CPU fallback implementation
    for (auto& str : strings) {
        // Normalize string (trim trailing whitespace)
        while (!str.empty() && std::isspace(str.back())) {
            str.pop_back();
        }
        // Trim leading whitespace
        str.erase(str.begin(), std::find_if(str.begin(), str.end(), [](unsigned char ch) {
            return !std::isspace(ch);
        }));
    }
    
    // TODO: CUDA implementation for very large string arrays
    // if (cuda_available_ && strings.size() > 100000) {
    //     // Launch CUDA kernel
    // }
}

void CUDAExecutor::remove_whitespace(std::vector<std::string>& strings) {
    // CPU fallback implementation
    for (auto& str : strings) {
        str.erase(std::remove_if(str.begin(), str.end(), ::isspace), str.end());
    }
    
    // TODO: CUDA implementation for very large string arrays
    // if (cuda_available_ && strings.size() > 100000) {
    //     // Launch CUDA kernel
    // }
}

} // namespace parallel

