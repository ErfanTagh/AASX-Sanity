#include <gtest/gtest.h>
#include "../src/json/processor.hpp"
#include "../src/parallel/framework.hpp"
#include <nlohmann/json.hpp>

using json = nlohmann::json;

TEST(JsonProcessor, RemoveEmptyLists) {
    json_processor::JsonProcessor processor;
    
    json test_data = {
        {"empty_list", json::array()},
        {"non_empty_list", {1, 2, 3}},
        {"other_field", "value"}
    };
    
    json result = processor.cleanAll(test_data);
    
    ASSERT_FALSE(result.contains("empty_list"));
    ASSERT_TRUE(result.contains("non_empty_list"));
    ASSERT_TRUE(result.contains("other_field"));
}

TEST(JsonProcessor, RemoveEmptyStrings) {
    json_processor::JsonProcessor processor;
    
    json test_data = {
        {"empty_string", ""},
        {"whitespace_string", "   "},
        {"non_empty_string", "value"}
    };
    
    json result = processor.cleanAll(test_data);
    
    ASSERT_FALSE(result.contains("empty_string"));
    ASSERT_FALSE(result.contains("whitespace_string"));
    ASSERT_TRUE(result.contains("non_empty_string"));
}

TEST(JsonProcessor, RemoveNullValues) {
    json_processor::JsonProcessor processor;
    
    json test_data = {
        {"null_field", nullptr},
        {"non_null_field", "value"}
    };
    
    json result = processor.cleanAll(test_data);
    
    ASSERT_FALSE(result.contains("null_field"));
    ASSERT_TRUE(result.contains("non_null_field"));
}

TEST(ParallelFramework, CPUExecution) {
    parallel::ParallelFramework<int> framework;
    std::vector<int> data(1000, 0);
    
    framework.execute_cpu(data, [](int& x) { x = 1; });
    
    for (const auto& val : data) {
        ASSERT_EQ(val, 1);
    }
}

TEST(ParallelFramework, LargeArray) {
    parallel::ParallelFramework<int> framework;
    std::vector<int> data(10000, 0);
    
    framework.execute_cpu(data, [](int& x) { x = x + 1; });
    
    for (const auto& val : data) {
        ASSERT_EQ(val, 1);
    }
}

int main(int argc, char** argv) {
    ::testing::InitGoogleTest(&argc, argv);
    return RUN_ALL_TESTS();
}


