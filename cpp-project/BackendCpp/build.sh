#!/bin/bash

set -e

echo "Building AAS Sanity C++ Backend..."

# Create build directory
mkdir -p build
cd build

# Configure CMake
echo "Configuring CMake..."
cmake .. -DCMAKE_BUILD_TYPE=Release

# Build
echo "Building..."
make -j$(nproc)

echo ""
echo "Build complete!"
echo "Executable: build/aas-sanity-cpp"
echo ""
echo "To run: ./build/aas-sanity-cpp"
echo "Or set SERVER_PORT environment variable: SERVER_PORT=5001 ./build/aas-sanity-cpp"


