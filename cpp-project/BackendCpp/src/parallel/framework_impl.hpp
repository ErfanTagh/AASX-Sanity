#pragma once

#include "framework.hpp"
#include <algorithm>

namespace parallel {

template<typename T>
ParallelFramework<T>::ParallelFramework() : cpu_executor_()
#ifdef CUDA_FOUND
    , cuda_executor_()
#endif
{
}

template<typename T>
ParallelFramework<T>::~ParallelFramework() {
}

template<typename T>
template<typename Container, typename Func>
void ParallelFramework<T>::execute_cpu(Container& data, Func func) {
    cpu_executor_.parallel_for(data, func);
}

template<typename T>
template<typename Container, typename Func>
void ParallelFramework<T>::execute_cuda(Container& data, Func func) {
#ifdef CUDA_FOUND
    if (cuda_executor_.is_available()) {
        // For now, fallback to CPU
        // CUDA implementation will be added for specific operations
        execute_cpu(data, func);
    } else {
        execute_cpu(data, func);
    }
#else
    execute_cpu(data, func);
#endif
}

template<typename T>
template<typename Container, typename Func>
void ParallelFramework<T>::execute(Container& data, Func func, Backend backend) {
    if (backend == Backend::AUTO) {
        const size_t size = std::distance(std::begin(data), std::end(data));
        // Use CUDA for very large datasets
        if (size > 1'000'000 && is_cuda_available()) {
            execute_cuda(data, func);
        } else {
            execute_cpu(data, func);
        }
    } else if (backend == Backend::CUDA) {
        execute_cuda(data, func);
    } else {
        execute_cpu(data, func);
    }
}

template<typename T>
template<typename Container, typename Func>
void ParallelFramework<T>::parallel_for(Container& data, Func func, size_t num_threads) {
    if (num_threads > 0) {
        CPUExecutor executor(num_threads);
        executor.parallel_for(data, func);
    } else {
        cpu_executor_.parallel_for(data, func);
    }
}

template<typename T>
size_t ParallelFramework<T>::get_optimal_thread_count() const {
    return std::thread::hardware_concurrency();
}

template<typename T>
bool ParallelFramework<T>::is_cuda_available() const {
#ifdef CUDA_FOUND
    return cuda_executor_.is_available();
#else
    return false;
#endif
}

} // namespace parallel


