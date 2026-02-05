#pragma once

#include <vector>
#include <string>

namespace parallel {

class CUDAExecutor {
public:
    CUDAExecutor();
    ~CUDAExecutor();

    bool is_available() const { return cuda_available_; }

    // Bulk string operations
    void normalize_strings(std::vector<std::string>& strings);
    void remove_whitespace(std::vector<std::string>& strings);

private:
    bool cuda_available_;
    int device_count_;
    
    void check_cuda_availability();
};

} // namespace parallel


