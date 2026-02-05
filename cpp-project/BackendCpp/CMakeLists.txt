cmake_minimum_required(VERSION 3.15)
project(AAS_Sanity_Cpp VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Include directories
include_directories(src)
include_directories(third_party/json/include)

# Find required packages
find_package(Threads REQUIRED)

# Try to find CUDA (optional)
find_package(CUDA QUIET)

# Source files
set(SOURCES
    src/main.cpp
    src/api/server.cpp
    src/api/handlers.cpp
    src/parallel/cpu_executor.cpp
    src/json/processor.cpp
    src/json/parser.cpp
    src/json/rules.cpp
    src/utils/logger.cpp
)

# CUDA files (if CUDA is available)
if(CUDA_FOUND)
    enable_language(CUDA)
    set(CUDA_SOURCES
        src/parallel/cuda_executor.cu
        cuda/kernels.cu
    )
    list(APPEND SOURCES ${CUDA_SOURCES})
    set(CMAKE_CUDA_STANDARD 17)
    add_definitions(-DCUDA_FOUND)
    message(STATUS "CUDA found - GPU support enabled")
else()
    message(STATUS "CUDA not found - CPU only mode")
    # Add cuda_executor.cpp for stub implementation
    list(APPEND SOURCES src/parallel/cuda_executor.cpp)
endif()

# Create executable
add_executable(aas-sanity-cpp ${SOURCES})

# Link libraries
target_link_libraries(aas-sanity-cpp 
    PRIVATE 
    Threads::Threads
    ${CMAKE_THREAD_LIBS_INIT}
)

# CUDA linking
if(CUDA_FOUND)
    target_link_libraries(aas-sanity-cpp PRIVATE ${CUDA_LIBRARIES})
    target_include_directories(aas-sanity-cpp PRIVATE ${CUDA_INCLUDE_DIRS})
endif()

# Compiler options
target_compile_options(aas-sanity-cpp PRIVATE
    -Wall -Wextra -O3
)

# Install
install(TARGETS aas-sanity-cpp DESTINATION bin)

# Testing
enable_testing()
if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/tests/CMakeLists.txt")
    add_subdirectory(tests OPTIONAL)
endif()


