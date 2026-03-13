CXX = g++
CXXFLAGS = -std=c++17 -Wall -Wextra -O3 -pthread
INCLUDES = -Isrc -Ithird_party/json/include
SRCDIR = src
BUILDDIR = build
TARGET = $(BUILDDIR)/aas-sanity-cpp

# Source files
SOURCES = $(SRCDIR)/main.cpp \
          $(SRCDIR)/api/server.cpp \
          $(SRCDIR)/api/handlers.cpp \
          $(SRCDIR)/parallel/cpu_executor.cpp \
          $(SRCDIR)/json/processor.cpp \
          $(SRCDIR)/json/parser.cpp \
          $(SRCDIR)/json/rules.cpp \
          $(SRCDIR)/utils/logger.cpp \
          $(SRCDIR)/parallel/cuda_executor.cpp

# Object files
OBJECTS = $(SOURCES:$(SRCDIR)/%.cpp=$(BUILDDIR)/%.o)

# Default target
all: $(TARGET)

# Create build directories
$(BUILDDIR):
	mkdir -p $(BUILDDIR)/api $(BUILDDIR)/parallel $(BUILDDIR)/json $(BUILDDIR)/utils

# Link executable
$(TARGET): $(BUILDDIR) $(OBJECTS)
	$(CXX) $(OBJECTS) -o $(TARGET) $(CXXFLAGS) -lpthread

# Compile source files
$(BUILDDIR)/%.o: $(SRCDIR)/%.cpp
	$(CXX) $(CXXFLAGS) $(INCLUDES) -c $< -o $@

# Clean build artifacts
clean:
	rm -rf $(BUILDDIR)

# Run the executable
run: $(TARGET)
	./$(TARGET)

# Test (if tests exist)
test: $(TARGET)
	@echo "Tests not yet implemented"

.PHONY: all clean run test


