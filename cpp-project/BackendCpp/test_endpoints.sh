#!/bin/bash

# Test script for C++ backend endpoints
# Usage: ./test_endpoints.sh [PORT]
# Default port: 5001

PORT=${1:-5001}
BASE_URL="http://localhost:${PORT}"

echo "Testing C++ Backend on port ${PORT}"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to test endpoint
test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local expected_key=$5
    
    echo -n "Testing ${name}... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -X GET "${BASE_URL}${endpoint}")
    else
        if [ -f "$data" ]; then
            # File upload
            response=$(curl -s -X POST "${BASE_URL}${endpoint}" -F "file=@${data}")
        else
            # JSON body
            response=$(curl -s -X POST "${BASE_URL}${endpoint}" \
                -H "Content-Type: application/json" \
                -d "${data}")
        fi
    fi
    
    if echo "$response" | grep -q "$expected_key"; then
        echo -e "${GREEN}✓ PASSED${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo "  Response: $(echo $response | head -c 100)..."
    else
        echo -e "${RED}✗ FAILED${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo "  Response: $response"
    fi
    echo ""
}

# Test 1: Health check
echo "1. Health Check"
test_endpoint "GET /health" "GET" "/health" "" "status"

# Test 2: Scan Issues (with file)
echo "2. Scan Issues (file upload)"
if [ -f "../../test_simple.json" ]; then
    test_endpoint "POST /scan-issues" "POST" "/scan-issues" "../../test_simple.json" "issues"
else
    echo -e "${YELLOW}⚠ SKIPPED (test_simple.json not found)${NC}"
fi
echo ""

# Test 3: Scan Issues (JSON body)
echo "3. Scan Issues (JSON body)"
test_data='{"version":"1.0.0","description":"","emptyData":{},"optional":null}'
test_endpoint "POST /scan-issues" "POST" "/scan-issues" "$test_data" "issues"
echo ""

# Test 4: Upload JSON
echo "4. Upload JSON"
test_data='{"json_data":{"version":"1.0.0","description":"","emptyData":{},"optional":null}}'
test_endpoint "POST /upload" "POST" "/upload" "$test_data" "JSON"
echo ""

# Test 5: Get Next Change
echo "5. Get Next Change"
test_data='{"current_data":{"version":"1.0.0","description":"","emptyData":{},"optional":null},"skip_rules":[]}'
test_endpoint "POST /get-next-change" "POST" "/get-next-change" "$test_data" "CURRENT_RULE"
echo ""

# Test 6: Get All Changes for Rule
echo "6. Get All Changes for Rule"
test_data='{"current_data":{"version":"1.0.0","description":"","emptyData":{},"optional":null},"rule_id":2,"skip_rules":[]}'
test_endpoint "POST /get-all-changes-for-rule" "POST" "/get-all-changes-for-rule" "$test_data" "changes"
echo ""

# Test 7: Keys Applied Length
echo "7. Keys Applied Length"
test_endpoint "GET /keys-applied-length" "GET" "/keys-applied-length" "" "keys_applied_length"
echo ""

# Test 8: Clean Specific Rule
echo "8. Clean Specific Rule"
test_data='{"json_data":{"version":"1.0.0","description":"","emptyData":{},"optional":null},"rule_id":2}'
test_endpoint "POST /clean-specific-rule" "POST" "/clean-specific-rule" "$test_data" "cleaned_json"
echo ""

# Summary
echo "=================================="
echo "Test Summary:"
echo -e "  ${GREEN}Passed: ${TESTS_PASSED}${NC}"
echo -e "  ${RED}Failed: ${TESTS_FAILED}${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed.${NC}"
    exit 1
fi

