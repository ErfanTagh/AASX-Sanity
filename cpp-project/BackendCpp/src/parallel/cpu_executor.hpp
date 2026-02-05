#pragma once

#include <vector>
#include <thread>
#include <future>
#include <functional>
#include <atomic>
#include <algorithm>
#include <iterator>

namespace parallel {

class CPUExecutor {
public:
    explicit CPUExecutor(size_t num_threads = 0);
    ~CPUExecutor();

    template<typename Container, typename Func>
    void parallel_for(Container& data, Func func);

    size_t get_thread_count() const { return thread_count_; }

private:
    size_t thread_count_;
};

} // namespace parallel

#include "cpu_executor_impl.hpp"


