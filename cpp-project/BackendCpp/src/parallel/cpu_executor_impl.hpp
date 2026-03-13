#pragma once

#include "cpu_executor.hpp"
#include <future>
#include <algorithm>

namespace parallel {

template<typename Container, typename Func>
void CPUExecutor::parallel_for(Container& data, Func func) {
    const size_t size = std::distance(std::begin(data), std::end(data));
    if (size == 0) return;

    const size_t chunk_size = std::max(size_t(1), size / thread_count_);
    std::vector<std::future<void>> futures;

    for (size_t i = 0; i < thread_count_; ++i) {
        const size_t start = i * chunk_size;
        const size_t end = (i == thread_count_ - 1) ? size : (i + 1) * chunk_size;

        if (start < size) {
            futures.push_back(std::async(std::launch::async, [&, start, end, func]() {
                auto it_start = std::next(std::begin(data), start);
                auto it_end = std::next(std::begin(data), end);
                std::for_each(it_start, it_end, func);
            }));
        }
    }

    // Wait for all threads to complete
    for (auto& future : futures) {
        future.wait();
    }
}

} // namespace parallel


