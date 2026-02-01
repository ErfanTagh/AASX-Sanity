package main

import (
	"encoding/json"
	"log"
	"strconv"
)

// DiffResult holds the before and after diff trees
type DiffResult struct {
	BeforeTree interface{} `json:"before"`
	AfterTree  interface{} `json:"after"`
}

// ExtractChangedParts creates a diff tree showing only changed parts
func extractChangedParts(before, after interface{}) DiffResult {
	log.Printf("=== extractChangedParts START ===")

	if before == nil && after == nil {
		log.Printf("Both are null, returning null diff")
		return DiffResult{BeforeTree: nil, AfterTree: nil}
	}

	// If both are identical, return null diff
	if before != nil && after != nil {
		beforeJSON, _ := json.Marshal(before)
		afterJSON, _ := json.Marshal(after)
		if string(beforeJSON) == string(afterJSON) {
			log.Printf("Both are identical, returning null diff")
			return DiffResult{BeforeTree: nil, AfterTree: nil}
		}
	}

	// Create diff tree
	log.Printf("Calling createDiff...")
	diff := createDiff(before, after, "")
	log.Printf("createDiff returned - beforeTree is null: %v, afterTree is null: %v",
		diff.BeforeTree == nil, diff.AfterTree == nil)

	// Match Python behavior: if diff is null but objects are different, return full objects
	if diff.BeforeTree == nil && diff.AfterTree == nil && before != nil && after != nil {
		beforeJSON, _ := json.Marshal(before)
		afterJSON, _ := json.Marshal(after)
		if string(beforeJSON) != string(afterJSON) {
			log.Printf("Diff is null but objects differ - returning FULL objects (fallback)")
			return DiffResult{BeforeTree: before, AfterTree: after}
		}
	}

	log.Printf("=== extractChangedParts END ===")
	return diff
}

// createDiff recursively creates a diff tree
func createDiff(v1, v2 interface{}, path string) DiffResult {
	log.Printf("createDiff called - path: '%s', v1 is null: %v, v2 is null: %v", path, v1 == nil, v2 == nil)

	// Handle null values (key doesn't exist in one)
	if v1 == nil || v2 == nil {
		log.Printf("createDiff: One is null - returning (v1, v2) for path: '%s'", path)
		return DiffResult{BeforeTree: v1, AfterTree: v2}
	}

	// Early exit for identical values
	v1JSON, _ := json.Marshal(v1)
	v2JSON, _ := json.Marshal(v2)
	if string(v1JSON) == string(v2JSON) {
		log.Printf("createDiff: Values are identical for path: '%s'", path)
		return DiffResult{BeforeTree: nil, AfterTree: nil}
	}

	// Handle objects
	if obj1, ok1 := v1.(map[string]interface{}); ok1 {
		if obj2, ok2 := v2.(map[string]interface{}); ok2 {
			beforeObj := make(map[string]interface{})
			afterObj := make(map[string]interface{})
			hasChanges := false

			// Get all keys from both objects
			allKeys := make(map[string]bool)
			for k := range obj1 {
				allKeys[k] = true
			}
			for k := range obj2 {
				allKeys[k] = true
			}

			for key := range allKeys {
				val1 := obj1[key]
				val2 := obj2[key]

				// Check if field was added or removed
				fieldRemoved := (val1 != nil && val2 == nil)
				fieldAdded := (val1 == nil && val2 != nil)

				log.Printf("DEBUG: Processing key='%s' path='%s' val1 null=%v val2 null=%v fieldRemoved=%v fieldAdded=%v",
					key, path, val1 == nil, val2 == nil, fieldRemoved, fieldAdded)

				// Call createDiff
				childPath := path
				if childPath == "" {
					childPath = key
				} else {
					childPath = path + "." + key
				}
				childDiff := createDiff(val1, val2, childPath)

				// Check if field changed
				fieldChanged := (childDiff.BeforeTree != nil || childDiff.AfterTree != nil)

				log.Printf("DEBUG: Key '%s' - beforeTree null=%v afterTree null=%v fieldChanged=%v",
					key, childDiff.BeforeTree == nil, childDiff.AfterTree == nil, fieldChanged)

				if fieldChanged {
					log.Printf("  Adding field '%s' to diff result", key)
					// Match Python: b_obj[k] = b_child if b_child is not None else v1_k
					if childDiff.BeforeTree != nil {
						beforeObj[key] = childDiff.BeforeTree
						log.Printf("    beforeObj['%s'] = childDiff.beforeTree", key)
					} else if val1 != nil {
						beforeObj[key] = val1
						log.Printf("    beforeObj['%s'] = val1", key)
					}

					// Match Python: a_obj[k] = a_child if a_child is not None else v2_k
					if childDiff.AfterTree != nil {
						afterObj[key] = childDiff.AfterTree
						log.Printf("    afterObj['%s'] = childDiff.afterTree", key)
					} else if val2 != nil {
						afterObj[key] = val2
						log.Printf("    afterObj['%s'] = val2", key)
					} else {
						// Field was removed: val2 is null, afterTree is null
						// Show as null to indicate removal
						afterObj[key] = nil
						log.Printf("    afterObj['%s'] = null (field removed)", key)
					}

					hasChanges = true
				} else {
					log.Printf("  Field '%s' unchanged, skipping", key)
				}
			}

			log.Printf("DEBUG: Object diff complete - hasChanges: %v beforeObj size: %d afterObj size: %d",
				hasChanges, len(beforeObj), len(afterObj))
			if hasChanges {
				return DiffResult{BeforeTree: beforeObj, AfterTree: afterObj}
			} else {
				log.Printf("DEBUG: No changes detected, returning null diff")
				return DiffResult{BeforeTree: nil, AfterTree: nil}
			}
		}
	}

	// Handle arrays
	if arr1, ok1 := v1.([]interface{}); ok1 {
		if arr2, ok2 := v2.([]interface{}); ok2 {
			// If lengths differ, return both arrays
			if len(arr1) != len(arr2) {
				return DiffResult{BeforeTree: arr1, AfterTree: arr2}
			}

			beforeArr := []interface{}{}
			afterArr := []interface{}{}
			hasChanges := false

			for i := 0; i < len(arr1); i++ {
				item1 := arr1[i]
				item2 := arr2[i]

				itemPath := path + "[" + strconv.Itoa(i) + "]"
				itemDiff := createDiff(item1, item2, itemPath)

				if itemDiff.BeforeTree != nil || itemDiff.AfterTree != nil {
					if itemDiff.BeforeTree != nil {
						beforeArr = append(beforeArr, itemDiff.BeforeTree)
					} else {
						beforeArr = append(beforeArr, item1)
					}

					if itemDiff.AfterTree != nil {
						afterArr = append(afterArr, itemDiff.AfterTree)
					} else {
						afterArr = append(afterArr, item2)
					}

					hasChanges = true
				} else {
					// No change in this item, but include it for context
					beforeArr = append(beforeArr, item1)
					afterArr = append(afterArr, item2)
				}
			}

			if hasChanges {
				return DiffResult{BeforeTree: beforeArr, AfterTree: afterArr}
			} else {
				return DiffResult{BeforeTree: nil, AfterTree: nil}
			}
		}
	}

	// Primitive values or type mismatch - return both
	return DiffResult{BeforeTree: v1, AfterTree: v2}
}

