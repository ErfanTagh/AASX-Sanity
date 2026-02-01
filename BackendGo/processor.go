package main

import (
	"encoding/json"
	"fmt"
	"log"
	"strings"
)

// Rule 1: Remove empty lists (empty arrays [])
func (rp *RuleProcessor) removeEmptyLists(obj map[string]interface{}) bool {
	if obj == nil {
		return false
	}

	changed := false
	keysToDelete := []string{}

	for key, value := range obj {
		if arr, ok := value.([]interface{}); ok && len(arr) == 0 {
			keysToDelete = append(keysToDelete, key)
		}
	}

	for _, key := range keysToDelete {
		delete(obj, key)
		changed = true
	}

	return changed
}

// Rule 2: Remove empty strings (empty or whitespace-only strings "")
func (rp *RuleProcessor) removeEmptyStrings(obj map[string]interface{}) bool {
	if obj == nil {
		return false
	}

	changed := false
	keysToDelete := []string{}

	for key, value := range obj {
		if str, ok := value.(string); ok && strings.TrimSpace(str) == "" {
			keysToDelete = append(keysToDelete, key)
		}
	}

	for _, key := range keysToDelete {
		delete(obj, key)
		changed = true
	}

	return changed
}

// Rule 3: Remove null values
func (rp *RuleProcessor) removeNullValues(obj map[string]interface{}) bool {
	if obj == nil {
		return false
	}

	changed := false
	keysToDelete := []string{}

	for key, value := range obj {
		if value == nil {
			keysToDelete = append(keysToDelete, key)
		}
	}

	for _, key := range keysToDelete {
		delete(obj, key)
		changed = true
	}

	return changed
}

// Rule 4: Remove empty objects (empty objects {})
func (rp *RuleProcessor) removeEmptyObjects(obj map[string]interface{}) bool {
	if obj == nil {
		return false
	}

	changed := false
	keysToDelete := []string{}

	for key, value := range obj {
		if nestedObj, ok := value.(map[string]interface{}); ok && len(nestedObj) == 0 {
			keysToDelete = append(keysToDelete, key)
		}
	}

	for _, key := range keysToDelete {
		delete(obj, key)
		changed = true
	}

	return changed
}

// Rule 5: Remove duplicate items from arrays
func (rp *RuleProcessor) removeDuplicatesFromArrays(obj map[string]interface{}) bool {
	if obj == nil {
		return false
	}

	changed := false

	for key, value := range obj {
		if arr, ok := value.([]interface{}); ok {
			deduplicated := rp.removeDuplicatesFromArray(arr)
			if len(deduplicated) != len(arr) {
				obj[key] = deduplicated
				changed = true
			}
		}
	}

	return changed
}

// Remove duplicates from an array, preserving order (keeps first occurrence)
func (rp *RuleProcessor) removeDuplicatesFromArray(arr []interface{}) []interface{} {
	if len(arr) == 0 {
		return arr
	}

	seen := make(map[string]bool)
	result := []interface{}{}

	for _, item := range arr {
		itemJSON, err := json.Marshal(item)
		if err != nil {
			continue
		}
		itemStr := string(itemJSON)
		if !seen[itemStr] {
			seen[itemStr] = true
			result = append(result, item)
		}
	}

	return result
}

// Rule 6: Convert boolean strings to normalized boolean values
func (rp *RuleProcessor) convertBooleanStrings(obj map[string]interface{}) bool {
	if obj == nil {
		return false
	}

	changed := false

	for key, value := range obj {
		if str, ok := value.(string); ok {
			text := strings.TrimSpace(str)
			lowerText := strings.ToLower(text)

			isTrue := lowerText == "true" || lowerText == "1" ||
				lowerText == "yes" || lowerText == "y" ||
				lowerText == "on"
			isFalse := lowerText == "false" || lowerText == "0" ||
				lowerText == "no" || lowerText == "n" ||
				lowerText == "off"

			if isTrue || isFalse {
				if rp.BooleanConversionMode == "numeric" {
					// Convert to numeric strings
					if isTrue {
						obj[key] = "1"
					} else {
						obj[key] = "0"
					}
				} else {
					// Convert to actual booleans (default)
					obj[key] = isTrue
				}
				changed = true
			}
		}
	}

	return changed
}

// Rule 7: Fix language code 'en?' to 'en'
func (rp *RuleProcessor) fixLanguageCodes(obj map[string]interface{}) bool {
	if obj == nil {
		return false
	}

	changed := false

	// Check if this object has a "language" field
	if lang, ok := obj["language"].(string); ok {
		if strings.HasSuffix(lang, "?") {
			obj["language"] = lang[:len(lang)-1]
			changed = true
		}
	}

	// Also check nested objects in arrays
	for _, value := range obj {
		if arr, ok := value.([]interface{}); ok {
			for _, item := range arr {
				if itemObj, ok := item.(map[string]interface{}); ok {
					if lang, ok := itemObj["language"].(string); ok {
						if strings.HasSuffix(lang, "?") {
							itemObj["language"] = lang[:len(lang)-1]
							changed = true
						}
					}
				}
			}
		} else if nestedObj, ok := value.(map[string]interface{}); ok {
			// Recursively check nested objects
			if lang, ok := nestedObj["language"].(string); ok {
				if strings.HasSuffix(lang, "?") {
					nestedObj["language"] = lang[:len(lang)-1]
					changed = true
				}
			}
		}
	}

	return changed
}

// Deep copy a JSON value
func deepCopy(value interface{}) interface{} {
	data, err := json.Marshal(value)
	if err != nil {
		return value
	}
	var result interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		return value
	}
	return result
}

// Clean all issues at once - applies all 7 rules iteratively until no more changes
func (rp *RuleProcessor) cleanAll(root interface{}) interface{} {
	if root == nil {
		return root
	}

	result := deepCopy(root)
	stack := []NodeContext{}

	// Handle root - can be Object or Array
	if obj, ok := result.(map[string]interface{}); ok {
		stack = append(stack, NodeContext{Parent: nil, ParentKey: "", Current: obj})
	} else if arr, ok := result.([]interface{}); ok {
		stack = append(stack, NodeContext{Parent: nil, ParentKey: "", Current: arr})
	} else {
		return result
	}

	for len(stack) > 0 {
		context := stack[len(stack)-1]
		stack = stack[:len(stack)-1]

		if obj, ok := context.Current.(map[string]interface{}); ok {
			// Apply all rules until node stabilizes
			changedAny := true
			iterations := 0
			for changedAny && iterations < 100 {
				changedAny = false
				iterations++

				if rp.removeEmptyLists(obj) {
					changedAny = true
				}
				if rp.removeEmptyStrings(obj) {
					changedAny = true
				}
				if rp.removeNullValues(obj) {
					changedAny = true
				}
				if rp.removeEmptyObjects(obj) {
					changedAny = true
				}
				if rp.removeDuplicatesFromArrays(obj) {
					changedAny = true
				}
				if rp.convertBooleanStrings(obj) {
					changedAny = true
				}
				if rp.fixLanguageCodes(obj) {
					changedAny = true
				}
			}

			// Push children to stack AFTER node is stabilized
			for key, child := range obj {
				if childObj, ok := child.(map[string]interface{}); ok {
					stack = append(stack, NodeContext{Parent: obj, ParentKey: key, Current: childObj})
				} else if childArr, ok := child.([]interface{}); ok {
					stack = append(stack, NodeContext{Parent: obj, ParentKey: key, Current: childArr})
				}
			}
		} else if arr, ok := context.Current.([]interface{}); ok {
			// Apply rule 5 (remove duplicates) on arrays
			changedAny := true
			iterations := 0
			for changedAny && iterations < 100 {
				changedAny = false
				iterations++

				deduplicated := rp.removeDuplicatesFromArray(arr)
				if len(deduplicated) != len(arr) {
					arr = deduplicated
					// Update parent reference
					if context.Parent != nil {
						if parentObj, ok := context.Parent.(map[string]interface{}); ok {
							parentObj[context.ParentKey] = arr
						} else if parentArr, ok := context.Parent.([]interface{}); ok {
							// Find index in parent array
							if idx, err := parseArrayIndex(context.ParentKey); err == nil {
								parentArr[idx] = arr
							}
						}
					}
					changedAny = true
				}
			}

			// For arrays, recurse into children
			for i, child := range arr {
				if childObj, ok := child.(map[string]interface{}); ok {
					stack = append(stack, NodeContext{Parent: arr, ParentKey: fmt.Sprintf("%d", i), Current: childObj})
				} else if childArr, ok := child.([]interface{}); ok {
					stack = append(stack, NodeContext{Parent: arr, ParentKey: fmt.Sprintf("%d", i), Current: childArr})
				}
			}
		}
	}

	log.Printf("cleanAll: Processing complete")
	return result
}

// Process rules stepwise, finding the first applicable rule
func (rp *RuleProcessor) processStepwise(root interface{}, skipRules map[int]bool) StepwiseResult {
	if root == nil {
		return StepwiseResult{}
	}

	rootCopy := deepCopy(root)
	stack := []NodeContext{}

	// Handle root - can be Object or Array
	if obj, ok := rootCopy.(map[string]interface{}); ok {
		stack = append(stack, NodeContext{Parent: nil, ParentKey: "", Current: obj})
	} else if arr, ok := rootCopy.([]interface{}); ok {
		stack = append(stack, NodeContext{Parent: nil, ParentKey: "", Current: arr})
	} else {
		return StepwiseResult{}
	}

	// Rules in order: 1=empty lists, 2=empty strings, 3=null values, 4=empty objects, 5=duplicates, 6=boolean strings, 7=language codes
	objectRules := []struct {
		ruleID int
		apply  func(map[string]interface{}) bool
	}{
		{1, rp.removeEmptyLists},
		{2, rp.removeEmptyStrings},
		{3, rp.removeNullValues},
		{4, rp.removeEmptyObjects},
		{5, rp.removeDuplicatesFromArrays},
		{6, rp.convertBooleanStrings},
		{7, rp.fixLanguageCodes},
	}

	for len(stack) > 0 {
		context := stack[len(stack)-1]
		stack = stack[:len(stack)-1]

		if obj, ok := context.Current.(map[string]interface{}); ok {
			// Try each rule - return on FIRST change found
			for _, rule := range objectRules {
				if skipRules != nil && skipRules[rule.ruleID] {
					continue
				}

				// Create snapshot BEFORE applying rule
				beforeFragment := deepCopy(obj)
				completeBefore := deepCopy(rootCopy)

				// Apply rule and check if it changes
				changed := rule.apply(obj)

				if changed {
					// Update root reference if this is the root node
					if context.Parent == nil {
						rootCopy = obj
					} else {
						// Update parent reference
						if parentObj, ok := context.Parent.(map[string]interface{}); ok {
							parentObj[context.ParentKey] = obj
						} else if parentArr, ok := context.Parent.([]interface{}); ok {
							if idx, err := parseArrayIndex(context.ParentKey); err == nil {
								parentArr[idx] = obj
							}
						}
					}

					afterFragment := deepCopy(obj)
					completeAfter := deepCopy(rootCopy)

					beforeFragmentJSON, _ := json.Marshal(beforeFragment)
					afterFragmentJSON, _ := json.Marshal(afterFragment)
					completeAfterJSON, _ := json.Marshal(completeAfter)
					completeBeforeJSON, _ := json.Marshal(completeBefore)

					return StepwiseResult{
						BeforeFragment: beforeFragmentJSON,
						AfterFragment:  afterFragmentJSON,
						RuleID:          &rule.ruleID,
						CompleteAfter:  completeAfterJSON,
						CompleteBefore: completeBeforeJSON,
					}
				}
			}

			// Push children to stack AFTER node is stabilized
			for key, child := range obj {
				if childObj, ok := child.(map[string]interface{}); ok {
					stack = append(stack, NodeContext{Parent: obj, ParentKey: key, Current: childObj})
				} else if childArr, ok := child.([]interface{}); ok {
					stack = append(stack, NodeContext{Parent: obj, ParentKey: key, Current: childArr})
				}
			}
		} else if arr, ok := context.Current.([]interface{}); ok {
			// Check for duplicates (Rule 5) - return on FIRST change found
			if skipRules == nil || !skipRules[5] {
				// Create snapshot BEFORE applying rule
				beforeFragment := deepCopy(arr)
				completeBefore := deepCopy(rootCopy)

				deduplicated := rp.removeDuplicatesFromArray(arr)
				changed := len(deduplicated) != len(arr)

				if changed {
					arr = deduplicated
					// Update root if this is root
					if context.Parent == nil {
						rootCopy = arr
					} else {
						// Update parent reference
						if parentObj, ok := context.Parent.(map[string]interface{}); ok {
							parentObj[context.ParentKey] = arr
						} else if parentArr, ok := context.Parent.([]interface{}); ok {
							if idx, err := parseArrayIndex(context.ParentKey); err == nil {
								parentArr[idx] = arr
							}
						}
					}

					afterFragment := deepCopy(arr)
					completeAfter := deepCopy(rootCopy)

					beforeFragmentJSON, _ := json.Marshal(beforeFragment)
					afterFragmentJSON, _ := json.Marshal(afterFragment)
					completeAfterJSON, _ := json.Marshal(completeAfter)
					completeBeforeJSON, _ := json.Marshal(completeBefore)

					ruleID := 5
					return StepwiseResult{
						BeforeFragment: beforeFragmentJSON,
						AfterFragment:  afterFragmentJSON,
						RuleID:          &ruleID,
						CompleteAfter:  completeAfterJSON,
						CompleteBefore: completeBeforeJSON,
					}
				}
			}

			// Push children to stack AFTER array is stabilized
			for i, child := range arr {
				if childObj, ok := child.(map[string]interface{}); ok {
					stack = append(stack, NodeContext{Parent: arr, ParentKey: fmt.Sprintf("%d", i), Current: childObj})
				} else if childArr, ok := child.([]interface{}); ok {
					stack = append(stack, NodeContext{Parent: arr, ParentKey: fmt.Sprintf("%d", i), Current: childArr})
				}
			}
		}
	}

	return StepwiseResult{}
}

// Clean only a specific rule type
func (rp *RuleProcessor) cleanSpecificRule(root interface{}, ruleID int) interface{} {
	if root == nil {
		return root
	}

	result := deepCopy(root)
	stack := []NodeContext{}

	if obj, ok := result.(map[string]interface{}); ok {
		stack = append(stack, NodeContext{Parent: nil, ParentKey: "", Current: obj})
	} else if arr, ok := result.([]interface{}); ok {
		stack = append(stack, NodeContext{Parent: nil, ParentKey: "", Current: arr})
	} else {
		return result
	}

	// Select the rule function based on ruleID
	var ruleFunction func(map[string]interface{}) bool
	switch ruleID {
	case 1:
		ruleFunction = rp.removeEmptyLists
	case 2:
		ruleFunction = rp.removeEmptyStrings
	case 3:
		ruleFunction = rp.removeNullValues
	case 4:
		ruleFunction = rp.removeEmptyObjects
	case 5:
		ruleFunction = rp.removeDuplicatesFromArrays
	case 6:
		ruleFunction = rp.convertBooleanStrings
	case 7:
		ruleFunction = rp.fixLanguageCodes
	default:
		log.Printf("Invalid rule ID: %d", ruleID)
		return result
	}

	for len(stack) > 0 {
		context := stack[len(stack)-1]
		stack = stack[:len(stack)-1]

		if obj, ok := context.Current.(map[string]interface{}); ok {
			// Apply the specific rule until node stabilizes
			changedAny := true
			iterations := 0
			for changedAny && iterations < 100 {
				changedAny = false
				iterations++

				if ruleFunction(obj) {
					changedAny = true
				}
			}

			// Push children to stack AFTER node is stabilized
			for key, child := range obj {
				if childObj, ok := child.(map[string]interface{}); ok {
					stack = append(stack, NodeContext{Parent: obj, ParentKey: key, Current: childObj})
				} else if childArr, ok := child.([]interface{}); ok {
					stack = append(stack, NodeContext{Parent: obj, ParentKey: key, Current: childArr})
				}
			}
		} else if arr, ok := context.Current.([]interface{}); ok {
			// If rule 5, apply it to arrays
			if ruleID == 5 {
				changedAny := true
				iterations := 0
				for changedAny && iterations < 100 {
					changedAny = false
					iterations++

					deduplicated := rp.removeDuplicatesFromArray(arr)
					if len(deduplicated) != len(arr) {
						arr = deduplicated
						if context.Parent != nil {
							if parentObj, ok := context.Parent.(map[string]interface{}); ok {
								parentObj[context.ParentKey] = arr
							} else if parentArr, ok := context.Parent.([]interface{}); ok {
								if idx, err := parseArrayIndex(context.ParentKey); err == nil {
									parentArr[idx] = arr
								}
							}
						}
						changedAny = true
					}
				}
			}

			// For arrays, recurse into children
			for i := len(arr) - 1; i >= 0; i-- {
				child := arr[i]
				if childObj, ok := child.(map[string]interface{}); ok {
					stack = append(stack, NodeContext{Parent: arr, ParentKey: fmt.Sprintf("%d", i), Current: childObj})
				} else if childArr, ok := child.([]interface{}); ok {
					stack = append(stack, NodeContext{Parent: arr, ParentKey: fmt.Sprintf("%d", i), Current: childArr})
				}
			}
		}
	}

	log.Printf("cleanSpecificRule (rule %d): Processing complete", ruleID)
	return result
}

// Scan for issues without fixing them
func (rp *RuleProcessor) scanForIssues(root interface{}) IssueCounts {
	counts := IssueCounts{}
	rp.scanRecursive(root, &counts)
	return counts
}

func (rp *RuleProcessor) scanRecursive(node interface{}, counts *IssueCounts) {
	if node == nil {
		return
	}

	if obj, ok := node.(map[string]interface{}); ok {
		// Count issues in this object
		for _, value := range obj {
			if arr, ok := value.([]interface{}); ok && len(arr) == 0 {
				counts.EmptyLists++
				counts.TotalIssues++
			} else if str, ok := value.(string); ok && strings.TrimSpace(str) == "" {
				counts.EmptyStrings++
				counts.TotalIssues++
			} else if value == nil {
				counts.NullValues++
				counts.TotalIssues++
			} else if nestedObj, ok := value.(map[string]interface{}); ok && len(nestedObj) == 0 {
				counts.EmptyObjects++
				counts.TotalIssues++
			} else if arr, ok := value.([]interface{}); ok && len(arr) > 0 {
				duplicates := rp.countDuplicatesInArray(arr)
				if duplicates > 0 {
					counts.Duplicates += duplicates
					counts.TotalIssues += duplicates
				}
			}
		}

		// Recursively scan children
		for _, child := range obj {
			if childObj, ok := child.(map[string]interface{}); ok {
				rp.scanRecursive(childObj, counts)
			} else if childArr, ok := child.([]interface{}); ok {
				rp.scanRecursive(childArr, counts)
			}
		}
	} else if arr, ok := node.([]interface{}); ok {
		// Check for duplicates in this array
		duplicates := rp.countDuplicatesInArray(arr)
		if duplicates > 0 {
			counts.Duplicates += duplicates
			counts.TotalIssues += duplicates
		}

		// Recursively scan children
		for _, item := range arr {
			if itemObj, ok := item.(map[string]interface{}); ok {
				rp.scanRecursive(itemObj, counts)
			} else if itemArr, ok := item.([]interface{}); ok {
				rp.scanRecursive(itemArr, counts)
			}
		}
	}
}

// Count duplicate items in an array
func (rp *RuleProcessor) countDuplicatesInArray(arr []interface{}) int {
	if len(arr) == 0 {
		return 0
	}

	seen := make(map[string]bool)
	duplicates := 0

	for _, item := range arr {
		itemJSON, err := json.Marshal(item)
		if err != nil {
			continue
		}
		itemStr := string(itemJSON)
		if seen[itemStr] {
			duplicates++
		} else {
			seen[itemStr] = true
		}
	}

	return duplicates
}

// Get all individual changes for a specific rule type
func (rp *RuleProcessor) getAllChangesForRule(root interface{}, ruleID int, skipRules map[int]bool) []IndividualChange {
	if root == nil || (skipRules != nil && skipRules[ruleID]) {
		return []IndividualChange{}
	}

	changes := []IndividualChange{}
	rootCopy := deepCopy(root)
	stack := []NodeContext{}

	if obj, ok := rootCopy.(map[string]interface{}); ok {
		stack = append(stack, NodeContext{Parent: nil, ParentKey: "", Current: obj})
	} else if arr, ok := rootCopy.([]interface{}); ok {
		stack = append(stack, NodeContext{Parent: nil, ParentKey: "", Current: arr})
	} else {
		return []IndividualChange{}
	}

	// Select the rule function
	var ruleFunction func(map[string]interface{}) bool
	switch ruleID {
	case 1:
		ruleFunction = rp.removeEmptyLists
	case 2:
		ruleFunction = rp.removeEmptyStrings
	case 3:
		ruleFunction = rp.removeNullValues
	case 4:
		ruleFunction = rp.removeEmptyObjects
	case 5:
		ruleFunction = rp.removeDuplicatesFromArrays
	case 6:
		ruleFunction = rp.convertBooleanStrings
	case 7:
		ruleFunction = rp.fixLanguageCodes
	default:
		return []IndividualChange{}
	}

	for len(stack) > 0 {
		context := stack[len(stack)-1]
		stack = stack[:len(stack)-1]

		if obj, ok := context.Current.(map[string]interface{}); ok {
			// Find all fields that would be affected by this rule
			testObj := deepCopy(obj).(map[string]interface{})

			// Apply rule to test object to see what changes
			if ruleFunction(testObj) {
				if ruleID == 6 || ruleID == 7 {
					// Rules 6 and 7 modify values, not remove fields
					if ruleID == 7 {
						// Rule 7 modifies "language" fields (can be nested)
						rp.findLanguageFieldChanges(obj, testObj, context.ParentKey, &changes, ruleID)
					} else {
						// Rule 6 modifies top-level fields only
						allFields := make(map[string]bool)
						for k := range obj {
							allFields[k] = true
						}
						for k := range testObj {
							allFields[k] = true
						}

						for field := range allFields {
							beforeValue := obj[field]
							afterValue := testObj[field]

							if beforeValue != nil && afterValue != nil {
								// Compare values
								beforeJSON, _ := json.Marshal(beforeValue)
								afterJSON, _ := json.Marshal(afterValue)
								if string(beforeJSON) != string(afterJSON) {
									path := rp.buildPath(context.ParentKey, field)

									parentBeforeJSON, _ := json.Marshal(obj)
									parentAfterJSON, _ := json.Marshal(testObj)

									changes = append(changes, IndividualChange{
										Path:        path,
										FieldName:   field,
										BeforeValue: beforeJSON,
										AfterValue:  afterJSON,
										RuleID:      ruleID,
										ParentBefore: parentBeforeJSON,
										ParentAfter:  parentAfterJSON,
									})
								}
							}
						}
					}
				} else {
					// Rules 1-5 remove fields
					originalFields := make(map[string]bool)
					for k := range obj {
						originalFields[k] = true
					}

					afterFields := make(map[string]bool)
					for k := range testObj {
						afterFields[k] = true
					}

					// Fields in original but not in after = removed fields
					for field := range originalFields {
						if !afterFields[field] {
							path := rp.buildPath(context.ParentKey, field)
							beforeValue := obj[field]

							parentBeforeJSON, _ := json.Marshal(obj)
							parentAfter := deepCopy(obj).(map[string]interface{})
							delete(parentAfter, field)
							parentAfterJSON, _ := json.Marshal(parentAfter)

							nullJSON, _ := json.Marshal(nil)

							changes = append(changes, IndividualChange{
								Path:        path,
								FieldName:   field,
								BeforeValue: func() json.RawMessage {
									b, _ := json.Marshal(beforeValue)
									return b
								}(),
								AfterValue:   nullJSON,
								RuleID:       ruleID,
								ParentBefore: parentBeforeJSON,
								ParentAfter:  parentAfterJSON,
							})
						}
					}
				}
			}

			// Push children to stack
			for key, child := range obj {
				if childObj, ok := child.(map[string]interface{}); ok {
					childPath := rp.buildPath(context.ParentKey, key)
					stack = append(stack, NodeContext{Parent: obj, ParentKey: childPath, Current: childObj})
				} else if childArr, ok := child.([]interface{}); ok {
					childPath := rp.buildPath(context.ParentKey, key)
					stack = append(stack, NodeContext{Parent: obj, ParentKey: childPath, Current: childArr})
				}
			}
		} else if arr, ok := context.Current.([]interface{}); ok {
			// Handle Rule 5 (duplicates) for arrays
			if ruleID == 5 {
				testArray := deepCopy(arr).([]interface{})
				deduplicated := rp.removeDuplicatesFromArray(testArray)
				if len(deduplicated) != len(testArray) {
					// Find which items were duplicates
					seen := make(map[string]bool)
					duplicateIndices := []int{}

					for i, item := range arr {
						itemJSON, _ := json.Marshal(item)
						itemStr := string(itemJSON)
						if seen[itemStr] {
							duplicateIndices = append(duplicateIndices, i)
						} else {
							seen[itemStr] = true
						}
					}

					// Create changes for duplicates
					for _, idx := range duplicateIndices {
						path := rp.buildPath(context.ParentKey, fmt.Sprintf("[%d]", idx))
						beforeValue := arr[idx]

						parentBeforeJSON, _ := json.Marshal(arr)
						parentAfterJSON, _ := json.Marshal(deduplicated)

						changes = append(changes, IndividualChange{
							Path:        path,
							FieldName:   fmt.Sprintf("[%d]", idx),
							BeforeValue: func() json.RawMessage {
								b, _ := json.Marshal(beforeValue)
								return b
							}(),
							AfterValue:   func() json.RawMessage {
								b, _ := json.Marshal(nil)
								return b
							}(),
							RuleID:       ruleID,
							ParentBefore: parentBeforeJSON,
							ParentAfter:  parentAfterJSON,
						})
					}
				}
			}

			// Push children to stack
			for i, child := range arr {
				if childObj, ok := child.(map[string]interface{}); ok {
					childPath := rp.buildPath(context.ParentKey, fmt.Sprintf("[%d]", i))
					stack = append(stack, NodeContext{Parent: arr, ParentKey: childPath, Current: childObj})
				} else if childArr, ok := child.([]interface{}); ok {
					childPath := rp.buildPath(context.ParentKey, fmt.Sprintf("[%d]", i))
					stack = append(stack, NodeContext{Parent: arr, ParentKey: childPath, Current: childArr})
				}
			}
		}
	}

	return changes
}

// Helper method to find language field changes for Rule 7
func (rp *RuleProcessor) findLanguageFieldChanges(before, after map[string]interface{}, parentPath string, changes *[]IndividualChange, ruleID int) {
	if before == nil || after == nil {
		return
	}

	// Check direct "language" field
	if beforeLang, ok1 := before["language"].(string); ok1 {
		if afterLang, ok2 := after["language"].(string); ok2 {
			if beforeLang != afterLang {
				path := rp.buildPath(parentPath, "language")

				parentBeforeJSON, _ := json.Marshal(before)
				parentAfterJSON, _ := json.Marshal(after)

				beforeLangJSON, _ := json.Marshal(beforeLang)
				afterLangJSON, _ := json.Marshal(afterLang)

				*changes = append(*changes, IndividualChange{
					Path:        path,
					FieldName:   "language",
					BeforeValue: beforeLangJSON,
					AfterValue:  afterLangJSON,
					RuleID:      ruleID,
					ParentBefore: parentBeforeJSON,
					ParentAfter:  parentAfterJSON,
				})
			}
		}
	}

	// Check nested fields (arrays and objects)
	allFields := make(map[string]bool)
	for k := range before {
		allFields[k] = true
	}
	for k := range after {
		allFields[k] = true
	}

	for field := range allFields {
		beforeValue := before[field]
		afterValue := after[field]

		if beforeValue != nil && afterValue != nil {
			currentPath := rp.buildPath(parentPath, field)

			if beforeArr, ok1 := beforeValue.([]interface{}); ok1 {
				if afterArr, ok2 := afterValue.([]interface{}); ok2 {
					minSize := len(beforeArr)
					if len(afterArr) < minSize {
						minSize = len(afterArr)
					}
					for i := 0; i < minSize; i++ {
						if beforeItem, ok1 := beforeArr[i].(map[string]interface{}); ok1 {
							if afterItem, ok2 := afterArr[i].(map[string]interface{}); ok2 {
								rp.findLanguageFieldChanges(beforeItem, afterItem, rp.buildPath(currentPath, fmt.Sprintf("[%d]", i)), changes, ruleID)
							}
						}
					}
				}
			} else if beforeObj, ok1 := beforeValue.(map[string]interface{}); ok1 {
				if afterObj, ok2 := afterValue.(map[string]interface{}); ok2 {
					rp.findLanguageFieldChanges(beforeObj, afterObj, currentPath, changes, ruleID)
				}
			}
		}
	}
}

// Build JSON path string
func (rp *RuleProcessor) buildPath(parentPath, field string) string {
	if parentPath == "" {
		return field
	}
	if strings.HasPrefix(field, "[") {
		return parentPath + field // Array index
	}
	return parentPath + "." + field
}

// Helper function to parse array index from string
func parseArrayIndex(s string) (int, error) {
	var idx int
	_, err := fmt.Sscanf(s, "%d", &idx)
	return idx, err
}
