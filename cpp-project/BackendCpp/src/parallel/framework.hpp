#pragma once

#include "cpu_executor.hpp"
#ifdef CUDA_FOUND
#include "cuda_executor.hpp"
#endif
#include <vector>
#include <functional>
#include <memory>
#include <thread>

namespace parallel {

enum class Backend {
    CPU,
    CUDA,
    AUTO
};

template<typename T>
class ParallelFramework {
public:
    ParallelFramework();
    ~ParallelFramework();

    // CPU multi-threading execution
    template<typename Container, typename Func>
    void execute_cpu(Container& data, Func func);

    // CUDA GPU execution
    template<typename Container, typename Func>
    void execute_cuda(Container& data, Func func);

    // Auto-select best backend
    template<typename Container, typename Func>
    void execute(Container& data, Func func, Backend backend = Backend::AUTO);

    // Parallel for loop
    template<typename Container, typename Func>
    void parallel_for(Container& data, Func func, size_t num_threads = 0);

private:
    size_t get_optimal_thread_count() const;
    bool is_cuda_available() const;
    
    CPUExecutor cpu_executor_;
#ifdef CUDA_FOUND
    CUDAExecutor cuda_executor_;
#endif
};

} // namespace parallel

#include "framework_impl.hpp"


