# Multi-stage build for AAS Sanity C++ Backend
FROM ubuntu:22.04 AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy source code
WORKDIR /app
COPY . .

# Build
RUN rm -rf build && mkdir -p build && cd build && \
    cmake .. -DCMAKE_BUILD_TYPE=Release && \
    make -j$(nproc)

# Runtime stage
FROM ubuntu:22.04

# Install runtime dependencies (minimal)
RUN apt-get update && apt-get install -y \
    libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy executable from builder
COPY --from=builder /app/build/aas-sanity-cpp .

# Expose port
EXPOSE 5001

# Set default port
ENV SERVER_PORT=5001

# Run server
CMD ["./aas-sanity-cpp"]


