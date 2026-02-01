package com.aassanity.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;

@Service
public class RuleProcessor {
    
    private static final Logger logger = LoggerFactory.getLogger(RuleProcessor.class);
    private final ObjectMapper objectMapper = new ObjectMapper();
    
    /**
     * Rule 1: Remove empty lists (empty arrays [])
     */
    public boolean removeEmptyLists(ObjectNode obj) {
        if (obj == null) return false;
        
        List<String> keysToDelete = new ArrayList<>();
        obj.fields().forEachRemaining(entry -> {
            JsonNode value = entry.getValue();
            if (value.isArray() && value.size() == 0) {
                keysToDelete.add(entry.getKey());
            }
        });
        
        if (!keysToDelete.isEmpty()) {
            keysToDelete.forEach(obj::remove);
            return true;
        }
        return false;
    }
    
    /**
     * Rule 2: Remove empty strings (empty or whitespace-only strings "")
     */
    public boolean removeEmptyStrings(ObjectNode obj) {
        if (obj == null) return false;
        
        List<String> keysToDelete = new ArrayList<>();
        obj.fields().forEachRemaining(entry -> {
            JsonNode value = entry.getValue();
            if (value.isTextual() && value.asText().trim().isEmpty()) {
                keysToDelete.add(entry.getKey());
            }
        });
        
        if (!keysToDelete.isEmpty()) {
            keysToDelete.forEach(obj::remove);
            return true;
        }
        return false;
    }
    
    /**
     * Rule 3: Remove null values
     */
    public boolean removeNullValues(ObjectNode obj) {
        if (obj == null) return false;
        
        List<String> keysToDelete = new ArrayList<>();
        obj.fields().forEachRemaining(entry -> {
            JsonNode value = entry.getValue();
            if (value.isNull()) {
                keysToDelete.add(entry.getKey());
            }
        });
        
        if (!keysToDelete.isEmpty()) {
            keysToDelete.forEach(obj::remove);
            return true;
        }
        return false;
    }
    
    /**
     * Rule 4: Remove empty objects (empty objects {})
     */
    public boolean removeEmptyObjects(ObjectNode obj) {
        if (obj == null) return false;
        
        List<String> keysToDelete = new ArrayList<>();
        obj.fields().forEachRemaining(entry -> {
            JsonNode value = entry.getValue();
            if (value.isObject() && value.size() == 0) {
                keysToDelete.add(entry.getKey());
            }
        });
        
        if (!keysToDelete.isEmpty()) {
            keysToDelete.forEach(obj::remove);
            return true;
        }
        return false;
    }
    
    /**
     * Rule 5: Remove duplicate items from arrays
     * Works on ObjectNode to find array fields, or directly on ArrayNode
     */
    public boolean removeDuplicatesFromArrays(ObjectNode obj) {
        if (obj == null) return false;
        
        boolean changed = false;
        List<Map.Entry<String, JsonNode>> entries = new ArrayList<>();
        obj.fields().forEachRemaining(entries::add);
        
        for (Map.Entry<String, JsonNode> entry : entries) {
            JsonNode value = entry.getValue();
            if (value.isArray()) {
                ArrayNode array = (ArrayNode) value;
                ArrayNode deduplicated = removeDuplicatesFromArray(array);
                if (deduplicated.size() != array.size()) {
                    obj.set(entry.getKey(), deduplicated);
                    changed = true;
                }
            }
        }
        
        return changed;
    }
    
    /**
     * Remove duplicates from an ArrayNode, preserving order (keeps first occurrence)
     */
    private ArrayNode removeDuplicatesFromArray(ArrayNode array) {
        if (array == null || array.size() == 0) {
            return array;
        }
        
        ArrayNode result = objectMapper.createArrayNode();
        Set<String> seen = new LinkedHashSet<>(); // Preserves insertion order
        
        for (JsonNode item : array) {
            String itemStr = item.toString(); // Use JSON string representation for comparison
            if (!seen.contains(itemStr)) {
                seen.add(itemStr);
                result.add(item.deepCopy());
            }
        }
        
        return result;
    }
    
    // Global setting for boolean conversion mode
    private String booleanConversionMode = "boolean"; // "boolean" or "numeric"
    
    public void setBooleanConversionMode(String mode) {
        this.booleanConversionMode = mode != null ? mode : "boolean";
    }
    
    public String getBooleanConversionMode() {
        return this.booleanConversionMode;
    }
    
    /**
     * Rule 6: Convert boolean strings to normalized boolean values
     * Converts string representations of booleans based on conversion mode:
     * - "boolean": converts to actual boolean values (true/false)
     * - "numeric": converts to numeric strings ("1"/"0")
     */
    public boolean convertBooleanStrings(ObjectNode obj) {
        if (obj == null) return false;
        
        boolean changed = false;
        List<Map.Entry<String, JsonNode>> entries = new ArrayList<>();
        obj.fields().forEachRemaining(entries::add);
        
        for (Map.Entry<String, JsonNode> entry : entries) {
            JsonNode value = entry.getValue();
            if (value.isTextual()) {
                String text = value.asText().trim();
                String lowerText = text.toLowerCase();
                
                boolean isTrue = lowerText.equals("true") || lowerText.equals("1") || 
                                lowerText.equals("yes") || lowerText.equals("y") || 
                                lowerText.equals("on");
                boolean isFalse = lowerText.equals("false") || lowerText.equals("0") || 
                                 lowerText.equals("no") || lowerText.equals("n") || 
                                 lowerText.equals("off");
                
                if (isTrue || isFalse) {
                    if ("numeric".equals(booleanConversionMode)) {
                        // Convert to numeric strings
                        obj.set(entry.getKey(), objectMapper.valueToTree(isTrue ? "1" : "0"));
                    } else {
                        // Convert to actual booleans (default)
                        obj.set(entry.getKey(), objectMapper.valueToTree(isTrue));
                    }
                    changed = true;
                }
            }
        }
        
        return changed;
    }
    
    /**
     * Rule 7: Fix language code 'en?' to 'en'
     * Generalizes to clean language codes with trailing question marks
     */
    public boolean fixLanguageCodes(ObjectNode obj) {
        if (obj == null) return false;
        
        boolean changed = false;
        
        // Check if this object has a "language" field
        if (obj.has("language") && obj.get("language").isTextual()) {
            String language = obj.get("language").asText();
            if (language.endsWith("?")) {
                String cleaned = language.substring(0, language.length() - 1);
                obj.set("language", objectMapper.valueToTree(cleaned));
                changed = true;
            }
        }
        
        // Also check nested objects in arrays (like MultiLanguageProperty value arrays)
        List<Map.Entry<String, JsonNode>> entries = new ArrayList<>();
        obj.fields().forEachRemaining(entries::add);
        
        for (Map.Entry<String, JsonNode> entry : entries) {
            JsonNode value = entry.getValue();
            if (value.isArray()) {
                ArrayNode array = (ArrayNode) value;
                for (int i = 0; i < array.size(); i++) {
                    JsonNode item = array.get(i);
                    if (item.isObject()) {
                        ObjectNode itemObj = (ObjectNode) item;
                        if (itemObj.has("language") && itemObj.get("language").isTextual()) {
                            String lang = itemObj.get("language").asText();
                            if (lang.endsWith("?")) {
                                String cleaned = lang.substring(0, lang.length() - 1);
                                itemObj.set("language", objectMapper.valueToTree(cleaned));
                                changed = true;
                            }
                        }
                    }
                }
            } else if (value.isObject()) {
                // Recursively check nested objects
                ObjectNode nestedObj = (ObjectNode) value;
                if (nestedObj.has("language") && nestedObj.get("language").isTextual()) {
                    String lang = nestedObj.get("language").asText();
                    if (lang.endsWith("?")) {
                        String cleaned = lang.substring(0, lang.length() - 1);
                        nestedObj.set("language", objectMapper.valueToTree(cleaned));
                        changed = true;
                    }
                }
            }
        }
        
        return changed;
    }
    
    /**
     * Remove duplicates from an ArrayNode directly (for array processing in traversal)
     */
    public boolean removeDuplicatesFromArrayNode(ArrayNode array) {
        if (array == null || array.size() == 0) {
            return false;
        }
        
        ArrayNode deduplicated = removeDuplicatesFromArray(array);
        if (deduplicated.size() != array.size()) {
            // Replace all elements
            array.removeAll();
            for (JsonNode item : deduplicated) {
                array.add(item);
            }
            return true;
        }
        
        return false;
    }
    
    /**
     * Process rules stepwise, finding the first applicable rule.
     * Matches Python clean_json_stepwise behavior: applies rules iteratively until node stabilizes,
     * then recurses to children. Returns the first change found.
     */
    public StepwiseResult processStepwise(JsonNode root, Set<Integer> skipRules) {
        if (root == null) {
            return new StepwiseResult(null, null, null, null, null);
        }
        
        // Deep copy root to avoid modifying original (like Python)
        JsonNode rootObj = root.deepCopy();
        Deque<NodeContext> stack = new ArrayDeque<>();
        
        // Handle root - can be Object or Array (like Python)
        if (rootObj.isObject()) {
            stack.push(new NodeContext(null, null, rootObj));
        } else if (rootObj.isArray()) {
            stack.push(new NodeContext(null, null, rootObj));
        } else {
            return new StepwiseResult(null, null, null, null, null);
        }
        
        // Rules in order: 1=empty lists, 2=empty strings, 3=null values, 4=empty objects, 5=duplicates, 6=boolean strings, 7=language codes
        List<RuleFunction> objectRules = Arrays.asList(
            new RuleFunction(1, this::removeEmptyLists),
            new RuleFunction(2, this::removeEmptyStrings),
            new RuleFunction(3, this::removeNullValues),
            new RuleFunction(4, this::removeEmptyObjects),
            new RuleFunction(5, this::removeDuplicatesFromArrays),
            new RuleFunction(6, this::convertBooleanStrings),
            new RuleFunction(7, this::fixLanguageCodes)
        );
        
        while (!stack.isEmpty()) {
            NodeContext context = stack.pop();
            
            if (context.current.isObject()) {
                ObjectNode currentObj = (ObjectNode) context.current;
                
                // Try each rule - return on FIRST change found (like Python clean_json_stepwise)
                for (RuleFunction rule : objectRules) {
                    if (skipRules != null && skipRules.contains(rule.ruleId)) {
                        continue;
                    }
                    
                    // Create snapshot BEFORE applying rule (like Python)
                    ObjectNode beforeFragment = currentObj.deepCopy();
                    JsonNode completeBefore = rootObj.deepCopy();
                    
                    // Apply rule and check if it changes
                    boolean changed = rule.apply(currentObj);
                    
                    if (changed) {
                        // Update root reference if this is the root node
                        if (context.parent == null) {
                            rootObj = currentObj;
                        } else {
                            // Update parent reference
                            if (context.parent.isObject()) {
                                ((ObjectNode) context.parent).set(context.parentKey, currentObj);
                            } else if (context.parent.isArray()) {
                                try {
                                    int index = Integer.parseInt(context.parentKey);
                                    ((ArrayNode) context.parent).set(index, currentObj);
                                } catch (NumberFormatException e) {
                                    logger.warn("Invalid array index: {}", context.parentKey);
                                }
                            }
                        }
                        
                        ObjectNode afterFragment = currentObj.deepCopy();
                        JsonNode completeAfter = rootObj.deepCopy();
                        
                        return new StepwiseResult(
                            beforeFragment,
                            afterFragment,
                            rule.ruleId,
                            completeAfter,
                            completeBefore
                        );
                    }
                }
                
                // Push children to stack AFTER node is stabilized (like Python)
                // Collect entries first to avoid concurrent modification
                List<Map.Entry<String, JsonNode>> entries = new ArrayList<>();
                currentObj.fields().forEachRemaining(entries::add);
                
                for (Map.Entry<String, JsonNode> entry : entries) {
                    JsonNode child = entry.getValue();
                    if (child != null && (child.isObject() || child.isArray())) {
                        stack.push(new NodeContext(currentObj, entry.getKey(), child));
                    }
                }
                
            } else if (context.current.isArray()) {
                ArrayNode currentArray = (ArrayNode) context.current;
                
                // Check for duplicates (Rule 5) - return on FIRST change found
                if (skipRules == null || !skipRules.contains(5)) {
                    // Create snapshot BEFORE applying rule
                    ArrayNode beforeFragment = currentArray.deepCopy();
                    JsonNode completeBefore = rootObj.deepCopy();
                    
                    boolean changed = removeDuplicatesFromArrayNode(currentArray);
                    
                    if (changed) {
                        // Update root if this is root
                        if (context.parent == null) {
                            rootObj = currentArray;
                        } else {
                            // Update parent reference
                            if (context.parent.isObject()) {
                                ((ObjectNode) context.parent).set(context.parentKey, currentArray);
                            } else if (context.parent.isArray()) {
                                try {
                                    int index = Integer.parseInt(context.parentKey);
                                    ((ArrayNode) context.parent).set(index, currentArray);
                                } catch (NumberFormatException e) {
                                    logger.warn("Invalid array index: {}", context.parentKey);
                                }
                            }
                        }
                        
                        ArrayNode afterFragment = currentArray.deepCopy();
                        JsonNode completeAfter = rootObj.deepCopy();
                        
                        return new StepwiseResult(
                            beforeFragment,
                            afterFragment,
                            5,
                            completeAfter,
                            completeBefore
                        );
                    }
                }
                
                // Push children to stack AFTER array is stabilized
                for (int i = 0; i < currentArray.size(); i++) {
                    JsonNode child = currentArray.get(i);
                    if (child != null && (child.isObject() || child.isArray())) {
                        stack.push(new NodeContext(currentArray, String.valueOf(i), child));
                    }
                }
            }
        }
        
        return new StepwiseResult(null, null, null, null, null);
    }
    
    /**
     * Clean all issues at once - applies all 4 rules iteratively until no more changes
     * Matches Python clean_json_iterative behavior: apply rules until node stabilizes, then recurse
     */
    public JsonNode cleanAll(JsonNode root) {
        if (root == null) {
            return root;
        }
        
        JsonNode result = root.deepCopy();
        int totalRemoved = 0;
        
        // Stack holds (parent, key, current)
        Deque<NodeContext> stack = new ArrayDeque<>();
        
        if (result.isObject()) {
            stack.push(new NodeContext(null, null, result));
        } else if (result.isArray()) {
            stack.push(new NodeContext(null, null, result));
        } else {
            return result;
        }
        
        while (!stack.isEmpty()) {
            NodeContext context = stack.pop();
            
            if (context.current.isObject()) {
                ObjectNode currentObj = (ObjectNode) context.current;
                
                // Apply all rules until node stabilizes (like Python version)
                boolean changedAny = true;
                int iterations = 0;
                while (changedAny && iterations < 100) { // Safety limit
                    changedAny = false;
                    iterations++;
                    
                    int beforeSize = currentObj.size();
                    
                    // Apply all 7 rules in order
                    if (removeEmptyLists(currentObj)) changedAny = true;
                    if (removeEmptyStrings(currentObj)) changedAny = true;
                    if (removeNullValues(currentObj)) changedAny = true;
                    if (removeEmptyObjects(currentObj)) changedAny = true;
                    if (removeDuplicatesFromArrays(currentObj)) changedAny = true;
                    if (convertBooleanStrings(currentObj)) changedAny = true;
                    if (fixLanguageCodes(currentObj)) changedAny = true;
                    
                    int afterSize = currentObj.size();
                    totalRemoved += (beforeSize - afterSize);
                }
                
                // Push children to stack AFTER node is stabilized
                // Collect keys first to avoid concurrent modification issues
                List<String> childKeys = new ArrayList<>();
                currentObj.fields().forEachRemaining(entry -> {
                    childKeys.add(entry.getKey());
                });
                
                for (String key : childKeys) {
                    JsonNode child = currentObj.get(key);
                    if (child != null && (child.isObject() || child.isArray())) {
                        stack.push(new NodeContext(currentObj, key, child));
                    }
                }
            } else if (context.current.isArray()) {
                ArrayNode currentArray = (ArrayNode) context.current;
                
                // Apply rule 5 (remove duplicates) on arrays
                boolean changedAny = true;
                int iterations = 0;
                while (changedAny && iterations < 100) {
                    changedAny = false;
                    iterations++;
                    
                    int beforeSize = currentArray.size();
                    if (removeDuplicatesFromArrayNode(currentArray)) {
                        changedAny = true;
                    }
                    int afterSize = currentArray.size();
                    totalRemoved += (beforeSize - afterSize);
                }
                
                // For arrays, recurse into children
                for (int i = 0; i < currentArray.size(); i++) {
                    JsonNode child = currentArray.get(i);
                    if (child != null && (child.isObject() || child.isArray())) {
                        stack.push(new NodeContext(currentArray, String.valueOf(i), child));
                    }
                }
            }
        }
        
        logger.info("cleanAll: Removed {} empty fields from JSON", totalRemoved);
        return result;
    }
    
    /**
     * Clean only a specific rule type (1=empty lists, 2=empty strings, 3=null values, 4=empty objects, 5=duplicates)
     * Applies the rule iteratively until no more changes, then recurses to children
     */
    public JsonNode cleanSpecificRule(JsonNode root, int ruleId) {
        if (root == null) {
            return root;
        }
        
        JsonNode result = root.deepCopy();
        int totalRemoved = 0;
        
        // Stack holds (parent, key, current)
        Deque<NodeContext> stack = new ArrayDeque<>();
        
        if (result.isObject()) {
            stack.push(new NodeContext(null, null, result));
        } else if (result.isArray()) {
            stack.push(new NodeContext(null, null, result));
        } else {
            return result;
        }
        
        // Select the rule function based on ruleId
        java.util.function.Function<ObjectNode, Boolean> ruleFunction = null;
        String ruleName = "";
        switch (ruleId) {
            case 1:
                ruleFunction = this::removeEmptyLists;
                ruleName = "empty lists";
                break;
            case 2:
                ruleFunction = this::removeEmptyStrings;
                ruleName = "empty strings";
                break;
            case 3:
                ruleFunction = this::removeNullValues;
                ruleName = "null values";
                break;
            case 4:
                ruleFunction = this::removeEmptyObjects;
                ruleName = "empty objects";
                break;
            case 5:
                ruleFunction = this::removeDuplicatesFromArrays;
                ruleName = "duplicates";
                break;
            case 6:
                ruleFunction = this::convertBooleanStrings;
                ruleName = "boolean strings";
                break;
            case 7:
                ruleFunction = this::fixLanguageCodes;
                ruleName = "language codes";
                break;
            default:
                logger.warn("Invalid rule ID: {}", ruleId);
                return result;
        }
        
        final java.util.function.Function<ObjectNode, Boolean> finalRuleFunction = ruleFunction;
        
        while (!stack.isEmpty()) {
            NodeContext context = stack.pop();
            
            if (context.current.isObject()) {
                ObjectNode currentObj = (ObjectNode) context.current;
                
                // Apply the specific rule until node stabilizes
                boolean changedAny = true;
                int iterations = 0;
                while (changedAny && iterations < 100) { // Safety limit
                    changedAny = false;
                    iterations++;
                    
                    int beforeSize = currentObj.size();
                    
                    // Apply only the specific rule
                    if (finalRuleFunction.apply(currentObj)) {
                        changedAny = true;
                    }
                    
                    int afterSize = currentObj.size();
                    totalRemoved += (beforeSize - afterSize);
                }
                
                // Push children to stack AFTER node is stabilized
                List<String> childKeys = new ArrayList<>();
                currentObj.fields().forEachRemaining(entry -> {
                    childKeys.add(entry.getKey());
                });
                
                for (String key : childKeys) {
                    JsonNode child = currentObj.get(key);
                    if (child != null && (child.isObject() || child.isArray())) {
                        stack.push(new NodeContext(currentObj, key, child));
                    }
                }
            } else if (context.current.isArray()) {
                ArrayNode currentArray = (ArrayNode) context.current;
                
                // If rule 5, apply it to arrays
                if (ruleId == 5) {
                    boolean changedAny = true;
                    int iterations = 0;
                    while (changedAny && iterations < 100) {
                        changedAny = false;
                        iterations++;
                        
                        int beforeSize = currentArray.size();
                        if (removeDuplicatesFromArrayNode(currentArray)) {
                            changedAny = true;
                        }
                        int afterSize = currentArray.size();
                        totalRemoved += (beforeSize - afterSize);
                    }
                }
                
                // For arrays, recurse into children
                for (int i = currentArray.size() - 1; i >= 0; i--) {
                    JsonNode child = currentArray.get(i);
                    if (child != null && (child.isObject() || child.isArray())) {
                        stack.push(new NodeContext(currentArray, String.valueOf(i), child));
                    }
                }
            }
        }
        
        logger.info("cleanSpecificRule (rule {}): Removed {} {} from JSON", ruleId, totalRemoved, ruleName);
        return result;
    }
    
    /**
     * Scan for issues without fixing them
     */
    public IssueCounts scanForIssues(JsonNode root) {
        IssueCounts counts = new IssueCounts();
        scanRecursive(root, counts);
        return counts;
    }
    
    private void scanRecursive(JsonNode node, IssueCounts counts) {
        if (node == null) return;
        
        if (node.isObject()) {
            ObjectNode obj = (ObjectNode) node;
            
            // Collect all entries first to avoid iterator consumption issues
            List<Map.Entry<String, JsonNode>> entries = new ArrayList<>();
            obj.fields().forEachRemaining(entries::add);
            
            // Count issues in this object and prepare for recursion
            for (Map.Entry<String, JsonNode> entry : entries) {
                JsonNode value = entry.getValue();
                if (value.isArray() && value.size() == 0) {
                    counts.emptyLists++;
                    counts.totalIssues++;
                } else if (value.isTextual() && value.asText().trim().isEmpty()) {
                    counts.emptyStrings++;
                    counts.totalIssues++;
                } else if (value.isNull()) {
                    counts.nullValues++;
                    counts.totalIssues++;
                } else if (value.isObject() && value.size() == 0) {
                    counts.emptyObjects++;
                    counts.totalIssues++;
                } else if (value.isArray() && value.size() > 0) {
                    // Check for duplicates in array
                    int duplicates = countDuplicatesInArray((ArrayNode) value);
                    if (duplicates > 0) {
                        counts.duplicates += duplicates;
                        counts.totalIssues += duplicates;
                    }
                }
            }
            
            // Recursively scan children
            for (Map.Entry<String, JsonNode> entry : entries) {
                JsonNode child = entry.getValue();
                if (child != null && (child.isObject() || child.isArray())) {
                    scanRecursive(child, counts);
                }
            }
        } else if (node.isArray()) {
            ArrayNode array = (ArrayNode) node;
            
            // Check for duplicates in this array
            int duplicates = countDuplicatesInArray(array);
            if (duplicates > 0) {
                counts.duplicates += duplicates;
                counts.totalIssues += duplicates;
            }
            
            // Recursively scan children
            for (JsonNode item : array) {
                if (item.isObject() || item.isArray()) {
                    scanRecursive(item, counts);
                }
            }
        }
    }
    
    /**
     * Count duplicate items in an array
     */
    private int countDuplicatesInArray(ArrayNode array) {
        if (array == null || array.size() == 0) {
            return 0;
        }
        
        Set<String> seen = new HashSet<>();
        int duplicates = 0;
        
        for (JsonNode item : array) {
            String itemStr = item.toString();
            if (seen.contains(itemStr)) {
                duplicates++;
            } else {
                seen.add(itemStr);
            }
        }
        
        return duplicates;
    }
    
    // Helper classes
    private static class NodeContext {
        JsonNode parent;
        String parentKey;
        JsonNode current;
        
        NodeContext(JsonNode parent, String parentKey, JsonNode current) {
            this.parent = parent;
            this.parentKey = parentKey;
            this.current = current;
        }
    }
    
    private static class RuleFunction {
        int ruleId;
        java.util.function.Function<ObjectNode, Boolean> function;
        
        RuleFunction(int ruleId, java.util.function.Function<ObjectNode, Boolean> function) {
            this.ruleId = ruleId;
            this.function = function;
        }
        
        boolean apply(ObjectNode obj) {
            return function.apply(obj);
        }
    }
    
    public static class StepwiseResult {
        public final JsonNode beforeFragment;
        public final JsonNode afterFragment;
        public final Integer ruleId;
        public final JsonNode completeAfter;
        public final JsonNode completeBefore;
        
        public StepwiseResult(JsonNode beforeFragment, JsonNode afterFragment, 
                            Integer ruleId, JsonNode completeAfter, JsonNode completeBefore) {
            this.beforeFragment = beforeFragment;
            this.afterFragment = afterFragment;
            this.ruleId = ruleId;
            this.completeAfter = completeAfter;
            this.completeBefore = completeBefore;
        }
    }
    
    public static class IssueCounts {
        public int emptyLists = 0;
        public int emptyStrings = 0;
        public int nullValues = 0;
        public int emptyObjects = 0;
        public int duplicates = 0;
        public int totalIssues = 0;
    }
    
    /**
     * Represents a single individual change (e.g., one null value removal)
     */
    public static class IndividualChange {
        public final String path;  // JSON path like "user.description" or "items[0].name"
        public final String fieldName;  // The field name being removed
        public final JsonNode beforeValue;  // The value before (what will be removed)
        public final JsonNode afterValue;  // null (field removed)
        public final Integer ruleId;  // Which rule applies
        public final JsonNode parentBefore;  // Parent object before change
        public final JsonNode parentAfter;  // Parent object after change
        
        public IndividualChange(String path, String fieldName, JsonNode beforeValue, 
                              JsonNode afterValue, Integer ruleId, 
                              JsonNode parentBefore, JsonNode parentAfter) {
            this.path = path;
            this.fieldName = fieldName;
            this.beforeValue = beforeValue;
            this.afterValue = afterValue;
            this.ruleId = ruleId;
            this.parentBefore = parentBefore;
            this.parentAfter = parentAfter;
        }
    }
    
    /**
     * Get all individual changes for a specific rule type.
     * Returns a list of IndividualChange objects, one for each field that would be affected.
     */
    public List<IndividualChange> getAllChangesForRule(JsonNode root, int ruleId, Set<Integer> skipRules) {
        if (root == null || (skipRules != null && skipRules.contains(ruleId))) {
            return Collections.emptyList();
        }
        
        List<IndividualChange> changes = new ArrayList<>();
        JsonNode rootCopy = root.deepCopy();
        Deque<NodeContext> stack = new ArrayDeque<>();
        
        if (rootCopy.isObject()) {
            stack.push(new NodeContext(null, null, rootCopy));
        } else if (rootCopy.isArray()) {
            stack.push(new NodeContext(null, null, rootCopy));
        } else {
            return Collections.emptyList();
        }
        
        // Select the rule function
        java.util.function.Function<ObjectNode, Boolean> ruleFunction = null;
        switch (ruleId) {
            case 1: ruleFunction = this::removeEmptyLists; break;
            case 2: ruleFunction = this::removeEmptyStrings; break;
            case 3: ruleFunction = this::removeNullValues; break;
            case 4: ruleFunction = this::removeEmptyObjects; break;
            case 5: ruleFunction = this::removeDuplicatesFromArrays; break;
            case 6: ruleFunction = this::convertBooleanStrings; break;
            case 7: ruleFunction = this::fixLanguageCodes; break;
            default: return Collections.emptyList();
        }
        
        final java.util.function.Function<ObjectNode, Boolean> finalRuleFunction = ruleFunction;
        
        while (!stack.isEmpty()) {
            NodeContext context = stack.pop();
            
            if (context.current.isObject()) {
                ObjectNode currentObj = (ObjectNode) context.current;
                
                // Find all fields that would be affected by this rule
                List<String> affectedFields = new ArrayList<>();
                ObjectNode testObj = currentObj.deepCopy();
                
                // Apply rule to test object to see what changes
                if (finalRuleFunction.apply(testObj)) {
                    if (ruleId == 6 || ruleId == 7) {
                        // Rules 6 and 7 modify values, not remove fields
                        // For Rule 7, we need to check nested language fields too
                        if (ruleId == 7) {
                            // Rule 7 modifies "language" fields (can be nested)
                            findLanguageFieldChanges(currentObj, testObj, context.parentKey, changes, ruleId);
                        } else {
                            // Rule 6 modifies top-level fields only
                            // Compare field by field to find modified values
                            Set<String> allFields = new HashSet<>();
                            currentObj.fieldNames().forEachRemaining(allFields::add);
                            testObj.fieldNames().forEachRemaining(allFields::add);
                            
                            for (String field : allFields) {
                                JsonNode beforeValue = currentObj.get(field);
                                JsonNode afterValue = testObj.get(field);
                                
                                if (beforeValue == null && afterValue != null) {
                                    // Field was added (shouldn't happen for these rules)
                                    continue;
                                } else if (beforeValue != null && afterValue == null) {
                                    // Field was removed (shouldn't happen for these rules)
                                    continue;
                                } else if (beforeValue != null && afterValue != null) {
                                    // Compare values
                                    if (!beforeValue.equals(afterValue)) {
                                        String path = (context.parentKey == null || context.parentKey.isEmpty())
                                            ? field
                                            : buildPath(context.parentKey, field);
                                        
                                        ObjectNode parentBefore = currentObj.deepCopy();
                                        ObjectNode parentAfter = testObj.deepCopy();
                                        
                                        changes.add(new IndividualChange(
                                            path,
                                            field,
                                            beforeValue,
                                            afterValue,
                                            ruleId,
                                            parentBefore,
                                            parentAfter
                                        ));
                                    }
                                }
                            }
                        }
                    } else {
                        // Rules 1-5 remove fields
                        // Compare to find which fields were removed
                        Set<String> originalFields = new HashSet<>();
                        currentObj.fieldNames().forEachRemaining(originalFields::add);
                        
                        Set<String> afterFields = new HashSet<>();
                        testObj.fieldNames().forEachRemaining(afterFields::add);
                        
                        // Fields in original but not in after = removed fields
                        for (String field : originalFields) {
                            if (!afterFields.contains(field)) {
                                affectedFields.add(field);
                            }
                        }
                        
                        // Create IndividualChange for each affected field
                        for (String field : affectedFields) {
                            String path = (context.parentKey == null || context.parentKey.isEmpty())
                                ? field
                                : buildPath(context.parentKey, field);
                            JsonNode beforeValue = currentObj.get(field);
                            
                            // Create parent snapshots
                            ObjectNode parentBefore = currentObj.deepCopy();
                            ObjectNode parentAfter = currentObj.deepCopy();
                            parentAfter.remove(field);
                            
                            changes.add(new IndividualChange(
                                path,
                                field,
                                beforeValue,
                                objectMapper.nullNode(),  // Field removed = null
                                ruleId,
                                parentBefore,
                                parentAfter
                            ));
                        }
                    }
                }
                
                // Push children to stack
                List<Map.Entry<String, JsonNode>> entries = new ArrayList<>();
                currentObj.fields().forEachRemaining(entries::add);
                
                for (Map.Entry<String, JsonNode> entry : entries) {
                    JsonNode child = entry.getValue();
                    if (child != null && (child.isObject() || child.isArray())) {
                        String childPath = (context.parentKey == null || context.parentKey.isEmpty()) 
                            ? entry.getKey() 
                            : buildPath(context.parentKey, entry.getKey());
                        stack.push(new NodeContext(currentObj, childPath, child));
                    }
                }
                
            } else if (context.current.isArray()) {
                ArrayNode currentArray = (ArrayNode) context.current;
                
                // Handle Rule 5 (duplicates) for arrays
                if (ruleId == 5) {
                    ArrayNode testArray = currentArray.deepCopy();
                    if (removeDuplicatesFromArrayNode(testArray)) {
                        // Find which items were duplicates
                        Set<String> seen = new LinkedHashSet<>();
                        List<Integer> duplicateIndices = new ArrayList<>();
                        
                        for (int i = 0; i < currentArray.size(); i++) {
                            String itemStr = currentArray.get(i).toString();
                            if (seen.contains(itemStr)) {
                                duplicateIndices.add(i);
                            } else {
                                seen.add(itemStr);
                            }
                        }
                        
                        // Create changes for duplicates
                        for (Integer idx : duplicateIndices) {
                            String path = buildPath(context.parentKey, "[" + idx + "]");
                            JsonNode beforeValue = currentArray.get(idx);
                            
                            changes.add(new IndividualChange(
                                path,
                                "[" + idx + "]",
                                beforeValue,
                                objectMapper.nullNode(),
                                ruleId,
                                currentArray.deepCopy(),
                                testArray
                            ));
                        }
                    }
                }
                
                // Push children to stack
                for (int i = 0; i < currentArray.size(); i++) {
                    JsonNode child = currentArray.get(i);
                    if (child != null && (child.isObject() || child.isArray())) {
                        String childPath = (context.parentKey == null || context.parentKey.isEmpty())
                            ? "[" + i + "]"
                            : buildPath(context.parentKey, "[" + i + "]");
                        stack.push(new NodeContext(currentArray, childPath, child));
                    }
                }
            }
        }
        
        return changes;
    }
    
    /**
     * Helper method to find language field changes for Rule 7
     * Recursively checks for "language" fields that were modified
     */
    private void findLanguageFieldChanges(ObjectNode before, ObjectNode after, String parentPath, 
                                         List<IndividualChange> changes, int ruleId) {
        if (before == null || after == null) return;
        
        // Check direct "language" field
        if (before.has("language") && after.has("language")) {
            JsonNode beforeLang = before.get("language");
            JsonNode afterLang = after.get("language");
            if (!beforeLang.equals(afterLang)) {
                String path = (parentPath == null || parentPath.isEmpty()) 
                    ? "language" 
                    : buildPath(parentPath, "language");
                
                ObjectNode parentBefore = before.deepCopy();
                ObjectNode parentAfter = after.deepCopy();
                
                changes.add(new IndividualChange(
                    path,
                    "language",
                    beforeLang,
                    afterLang,
                    ruleId,
                    parentBefore,
                    parentAfter
                ));
            }
        }
        
        // Check nested fields (arrays and objects)
        Set<String> allFields = new HashSet<>();
        before.fieldNames().forEachRemaining(allFields::add);
        after.fieldNames().forEachRemaining(allFields::add);
        
        for (String field : allFields) {
            JsonNode beforeValue = before.get(field);
            JsonNode afterValue = after.get(field);
            
            if (beforeValue != null && afterValue != null) {
                String currentPath = (parentPath == null || parentPath.isEmpty()) 
                    ? field 
                    : buildPath(parentPath, field);
                
                if (beforeValue.isArray() && afterValue.isArray()) {
                    ArrayNode beforeArray = (ArrayNode) beforeValue;
                    ArrayNode afterArray = (ArrayNode) afterValue;
                    
                    int minSize = Math.min(beforeArray.size(), afterArray.size());
                    for (int i = 0; i < minSize; i++) {
                        JsonNode beforeItem = beforeArray.get(i);
                        JsonNode afterItem = afterArray.get(i);
                        
                        if (beforeItem.isObject() && afterItem.isObject()) {
                            findLanguageFieldChanges((ObjectNode) beforeItem, (ObjectNode) afterItem, 
                                                   buildPath(currentPath, "[" + i + "]"), changes, ruleId);
                        }
                    }
                } else if (beforeValue.isObject() && afterValue.isObject()) {
                    findLanguageFieldChanges((ObjectNode) beforeValue, (ObjectNode) afterValue, 
                                           currentPath, changes, ruleId);
                }
            }
        }
    }
    
    /**
     * Build JSON path string
     */
    private String buildPath(String parentPath, String field) {
        if (parentPath == null || parentPath.isEmpty()) {
            return field;
        }
        if (field.startsWith("[")) {
            return parentPath + field;  // Array index
        }
        return parentPath + "." + field;
    }
}

