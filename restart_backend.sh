#!/bin/bash
# Restart the AAS Sanity backend

cd "$(dirname "$0")"

echo "Restarting AAS Sanity backend..."

# Try docker compose first (v2 syntax)
if command -v docker &> /dev/null; then
    if docker compose ps backend 2>/dev/null | grep -q "aas-backend"; then
        echo "Restarting backend container..."
        docker compose restart backend
        if [ $? -eq 0 ]; then
            echo "✅ Backend restarted successfully!"
            exit 0
        fi
    fi
    
    # Try docker-compose (v1 syntax) as fallback
    if command -v docker-compose &> /dev/null; then
        if docker-compose ps backend 2>/dev/null | grep -q "aas-backend"; then
            echo "Restarting backend container (docker-compose)..."
            docker-compose restart backend
            if [ $? -eq 0 ]; then
                echo "✅ Backend restarted successfully!"
                exit 0
            fi
        fi
    fi
fi

# If docker doesn't work, try to restart the process directly
BACKEND_PID=$(pgrep -f "aas-sanity-cpp" | head -1)
if [ -n "$BACKEND_PID" ]; then
    echo "Found backend process (PID: $BACKEND_PID)"
    echo "Attempting to restart..."
    
    # Kill the process
    kill $BACKEND_PID 2>/dev/null || sudo kill $BACKEND_PID 2>/dev/null
    
    # Wait a moment
    sleep 2
    
    # Start it again from the build directory
    if [ -f "cpp-project/BackendCpp/build/aas-sanity-cpp" ]; then
        cd cpp-project/BackendCpp/build
        nohup ./aas-sanity-cpp > /dev/null 2>&1 &
        echo "✅ Backend restarted!"
        exit 0
    fi
fi

echo "❌ Could not restart backend. Please run manually:"
echo "   sudo docker compose restart backend"
echo "   OR"
echo "   cd cpp-project/BackendCpp/build && ./aas-sanity-cpp"

