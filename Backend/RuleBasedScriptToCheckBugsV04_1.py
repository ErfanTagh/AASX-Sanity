import json
from copy import deepcopy
import datetime

keys_applied = []

# =============================================================================
# INDIVIDUAL RULE FUNCTIONS FOR CLEAN_JSON
# =============================================================================

def apply_rule_1_remove_empty_lists(obj, keys_to_clean):
    """Rule 1: Remove specified keys if they are empty lists"""
    if not isinstance(obj, dict):
        return obj, False
    
    keys_to_delete = []
    for key in keys_to_clean:
        if key in obj and obj[key] == []:
            keys_to_delete.append(key)
            keys_applied.append(1)
    
    if keys_to_delete:
        for key in keys_to_delete:
            del obj[key]
        return obj, True
    return obj, False

def apply_rule_2_remove_empty_semantic_id(obj):
    """Rule 2: Remove semanticId if it has empty keys"""
    if not isinstance(obj, dict):
        return obj, False
    
    if "semanticId" in obj and isinstance(obj["semanticId"], dict):
        if obj["semanticId"].get("keys") == []:
            del obj["semanticId"]
            keys_applied.append(2)
            return obj, True
    return obj, False

def apply_rule_3_remove_empty_value_id(obj):
    """Rule 3: Remove valueId if it has empty keys"""
    if not isinstance(obj, dict):
        return obj, False
    
    if "valueId" in obj and isinstance(obj["valueId"], dict):
        if obj["valueId"].get("keys") == []:
            del obj["valueId"]
            keys_applied.append(3)
            return obj, True
    return obj, False

def apply_rule_4_remove_empty_id_short(obj):
    """Rule 4: Remove idShort if its value is an empty string"""
    if not isinstance(obj, dict):
        return obj, False
    
    if "idShort" in obj:
        if obj["idShort"] == "":
            del obj["idShort"]
            keys_applied.append(4)
            return obj, True
    return obj, False

def apply_rule_5_file_defaults(obj):
    """Rule 5: Set default file names for File modelType"""
    if not isinstance(obj, dict):
        return obj, False
    
    if obj.get("modelType") == "File":
        if obj.get("contentType") == "image/png" and obj.get("value") == "":
            obj["value"] = "sample.png"
            keys_applied.append(5)
            return obj, True
        elif obj.get("contentType") == "application/pdf" and obj.get("value") == "":
            obj["value"] = "sample.pdf"
            keys_applied.append(5)
            return obj, True
    return obj, False

def apply_rule_6_annotated_relationship_default_keys(obj):
    """Rule 6: Add default keys for AnnotatedRelationshipElement"""
    if not isinstance(obj, dict):
        return obj, False
    
    if obj.get("modelType") == "AnnotatedRelationshipElement":
        default_keys = [{"type": "GlobalReference", "value": "EMPTY"}]
        changed = False
        for ref_key in ("first", "second"):
            if isinstance(obj.get(ref_key), dict) and obj[ref_key].get("keys") == []:
                obj[ref_key]["keys"] = default_keys
                keys_applied.append(6)
                changed = True
        return obj, changed
    return obj, False

def apply_rule_7_remove_empty_submodel_collection_value(obj):
    """Rule 7: Remove empty value in SubmodelElementCollection"""
    if not isinstance(obj, dict):
        return obj, False
    
    if obj.get("modelType") == "SubmodelElementCollection" and obj.get("value") == []:
        del obj["value"]
        keys_applied.append(7)
        return obj, True
    return obj, False

def apply_rule_8_change_entity_type(obj):
    """Rule 8: Change entityType to CoManagedEntity if conditions met"""
    if not isinstance(obj, dict):
        return obj, False
    
    if obj.get("entityType") == "SelfManagedEntity":
        if "globalAssetId" not in obj and "specificAssetId" not in obj:
            obj["entityType"] = "CoManagedEntity"
            keys_applied.append(8)
            return obj, True
    return obj, False

def apply_rule_9_multilanguage_property_defaults(obj):
    """Rule 9: Add default values for MultiLanguageProperty"""
    if not isinstance(obj, dict):
        return obj, False
    
    if obj.get("modelType") == "MultiLanguageProperty":
        default_value = [{"language": "en", "text": "EMPTY"}]
        if "value" not in obj:
            obj["value"] = default_value
            keys_applied.append(9)
            return obj, True
        else:
            changed = False
            if isinstance(obj["value"], list):
                for v in obj["value"]:
                    if isinstance(v, dict) and v.get("text", None) == "":
                        v["text"] = "EMPTY"
                        keys_applied.append(9)
                        changed = True
            return obj, changed
    return obj, False

def apply_rule_10_fix_concept_description(obj):
    """Rule 10: Fix ConceptDescription to GlobalReference in semanticId keys"""
    if not isinstance(obj, dict):
        return obj, False
    
    if "semanticId" in obj and isinstance(obj["semanticId"], dict):
        if obj["semanticId"].get("type") == "ExternalReference":
            keys_list = obj["semanticId"].get("keys", [])
            if isinstance(keys_list, list):
                changed = False
                for item in keys_list:
                    if isinstance(item, dict) and item.get("type") == "ConceptDescription":
                        item["type"] = "GlobalReference"
                        keys_applied.append(10)
                        changed = True
                return obj, changed
    return obj, False

def apply_rule_11_remove_empty_reference_element_value(obj):
    """Rule 11: Remove value if modelType is ReferenceElement and value.keys == []"""
    if not isinstance(obj, dict):
        return obj, False
    
    if obj.get("modelType") == "ReferenceElement":
        if isinstance(obj.get("value"), dict) and obj["value"].get("keys") == []:
            del obj["value"]
            keys_applied.append(11)
            return obj, True
    return obj, False

def apply_rule_12_remove_id_short_in_submodel_collection(obj):
    """Rule 12: Remove idShort in SubmodelElementCollection value items"""
    if not isinstance(obj, dict):
        return obj, False
    
    if obj.get("typeValueListElement") == "SubmodelElementCollection":
        if isinstance(obj.get("value"), list):
            changed = False
            for item in obj["value"]:
                if isinstance(item, dict) and "idShort" in item:
                    del item["idShort"]
                    keys_applied.append(12)
                    changed = True
            return obj, changed
    return obj, False

def apply_rule_13_property_empty_value_default(obj):
    """Rule 13: Set value to '0' for Property with empty value and non-string valueType"""
    if not isinstance(obj, dict):
        return obj, False
    
    if (obj.get("modelType") == "Property" and 
        obj.get("value") == "" and 
        obj.get("valueType") != "xs:string"):
        obj["value"] = "0"
        keys_applied.append(13)
        return obj, True
    return obj, False

def apply_rule_14_fix_language_en_question(obj):
    """Rule 14: Clean 'language': 'en?' to 'en' in MultiLanguageProperty"""
    if not isinstance(obj, dict):
        return obj, False
    
    if obj.get("modelType") == "MultiLanguageProperty":
        if isinstance(obj.get("value"), list):
            changed = False
            for v in obj["value"]:
                if isinstance(v, dict) and v.get("language") == "en?":
                    v["language"] = "en"
                    keys_applied.append(14)
                    changed = True
            return obj, changed
    return obj, False

def apply_rule_15_convert_boolean_strings(obj):
    """Rule 15: Convert boolean strings to numeric string equivalents"""
    if not isinstance(obj, dict):
        return obj, False
    
    if obj.get("valueType") == "xs:boolean":
        if obj.get("value") == "True":
            obj["value"] = "1"
            keys_applied.append(15)
            return obj, True
        elif obj.get("value") == "False":
            obj["value"] = "0"
            keys_applied.append(15)
            return obj, True
    return obj, False

def apply_rule_16_multilanguage_property_empty_array(obj):
    """Rule 16: Handle MultiLanguageProperty with empty value array"""
    if not isinstance(obj, dict):
        return obj, False
    
    if obj.get("modelType") == "MultiLanguageProperty":
        if isinstance(obj.get("value"), list) and len(obj["value"]) == 0:
            obj["value"] = [{"language": "en", "text": "EMPTY"}]
            obj["valueId"] = {
                "type": "ExternalReference",
                "keys": [{"type": "GlobalReference", "value": "0173-1#07-ABK870#003"}]
            }
            keys_applied.append(16)
            return obj, True
    return obj, False

def apply_rule_17_add_data_specification_definition(obj):
    """Rule 17: Add definition to DataSpecificationIec61360 if missing"""
    if not isinstance(obj, dict):
        return obj, False
    
    if obj.get("modelType") == "DataSpecificationIec61360":
        if "definition" not in obj:
            obj["definition"] = [{"language": "en", "text": "Check the IdShort"}]
            keys_applied.append(17)
            return obj, True
    return obj, False

def apply_rule_18_remove_bulk_count_items(obj):
    """Rule 18: Remove BulkCount elements with specific empty values (for lists)"""
    if not isinstance(obj, list):
        return obj, False
    
    new_list = []
    for item in obj:
        if (isinstance(item, dict) and 
            item.get("idShort") == "BulkCount" and 
            item.get("valueType") == "xs:unsignedLong" and 
            item.get("value") == "" and 
            item.get("modelType") == "Property"):
            continue  # Skip this item
        new_list.append(item)
    
    return new_list, len(new_list) != len(obj)

def clean_json_iterative(obj, keys_to_clean=(
    "qualifiers", "embeddedDataSpecifications", "displayName",
    "statements", "description", "extensions",
    "supplementalSemanticIds", "shortName"
)):
    """Iterative cleaner that applies isolated rule functions without recursion.

    Traverses the object graph using an explicit stack and applies all
    rule functions to each visited node until no further changes occur
    for that node. This avoids duplicating rule logic and keeps behavior
    consistent with the modular rule functions.
    """
    import copy
    # Create a deep copy to avoid modifying the original object
    obj = copy.deepcopy(obj)

    # Ordered rules as used by clean_json (apply all that match)
    rules = [
        (1,  lambda node: apply_rule_1_remove_empty_lists(node, keys_to_clean)),
        (2,  apply_rule_2_remove_empty_semantic_id),
        (3,  apply_rule_3_remove_empty_value_id),
        (4,  apply_rule_4_remove_empty_id_short),
        (5,  apply_rule_5_file_defaults),
        (6,  apply_rule_6_annotated_relationship_default_keys),
        (7,  apply_rule_7_remove_empty_submodel_collection_value),
        (8,  apply_rule_8_change_entity_type),
        (9,  apply_rule_9_multilanguage_property_defaults),
        (10, apply_rule_10_fix_concept_description),
        (11, apply_rule_11_remove_empty_reference_element_value),
        (12, apply_rule_12_remove_id_short_in_submodel_collection),
        (13, apply_rule_13_property_empty_value_default),
        (14, apply_rule_14_fix_language_en_question),
        (15, apply_rule_15_convert_boolean_strings),
        (16, apply_rule_16_multilanguage_property_empty_array),
        (17, apply_rule_17_add_data_specification_definition),
        (18, apply_rule_18_remove_bulk_count_items),
    ]

    # Stack holds tuples of (parent, key_or_index, node)
    stack = [(None, None, obj)]

    # Root may be replaced by rules, so keep reference updated
    root = obj

    while stack:
        parent, key, current = stack.pop()

        # Re-apply rules until the current node stabilizes (no change)
        changed_any = True
        while changed_any:
            changed_any = False
            for _, rule_fn in rules:
                # Rule 1 expects keys_to_clean via lambda above
                modified, changed = rule_fn(current)
                if changed:
                    # Write back into parent or root
                    if parent is None:
                        root = modified
                        current = modified
                    else:
                        if isinstance(parent, dict):
                            parent[key] = modified
                        else:
                            parent[key] = modified
                        current = modified
                    changed_any = True
                    # Continue loop to allow additional rules on updated node

        # Push children to stack after node is stabilized
        if isinstance(current, dict):
            for child_key, child_val in current.items():
                if isinstance(child_val, (dict, list)):
                    stack.append((current, child_key, child_val))
        elif isinstance(current, list):
            for idx, child_val in enumerate(current):
                if isinstance(child_val, (dict, list)):
                    stack.append((current, idx, child_val))

    return root



def clean_json(obj, keys_to_clean=("qualifiers", "embeddedDataSpecifications", "displayName", "statements", "description", "extensions", "supplementalSemanticIds", "shortName")):

    # Define rules in order of execution
    rules = [
        (1, lambda obj: apply_rule_1_remove_empty_lists(obj, keys_to_clean)),
        (2, apply_rule_2_remove_empty_semantic_id),
        (3, apply_rule_3_remove_empty_value_id),
        (4, apply_rule_4_remove_empty_id_short),
        (5, apply_rule_5_file_defaults),
        (6, apply_rule_6_annotated_relationship_default_keys),
        (7, apply_rule_7_remove_empty_submodel_collection_value),
        (8, apply_rule_8_change_entity_type),
        (9, apply_rule_9_multilanguage_property_defaults),
        (10, apply_rule_10_fix_concept_description),
        (11, apply_rule_11_remove_empty_reference_element_value),
        (12, apply_rule_12_remove_id_short_in_submodel_collection),
        (13, apply_rule_13_property_empty_value_default),
        (14, apply_rule_14_fix_language_en_question),
        (15, apply_rule_15_convert_boolean_strings),
        (16, apply_rule_16_multilanguage_property_empty_array),
        (17, apply_rule_17_add_data_specification_definition),
    ]

    # Apply rules for dictionaries
    if isinstance(obj, dict):
        for rule_num, rule_func in rules:
            obj, changed = rule_func(obj)
            # Note: We don't return early here like in clean_json_api_fast
            # because clean_json applies ALL rules, not just the first one

        # Recurse into dictionary values
        for key in list(obj):
            obj[key] = clean_json(obj[key], keys_to_clean)

    # Apply rules for lists
    elif isinstance(obj, list):
        # Apply list-specific rules
        obj, changed = apply_rule_18_remove_bulk_count_items(obj)

        # Recurse into list items
        new_list = []
        for item in obj:
            processed_item = clean_json(item, keys_to_clean)
            new_list.append(processed_item)
        obj = new_list

    return obj

 
def del_key(obj, keys_to_delete):
     for key in keys_to_delete:
            del obj[key]
     return obj


RULES_MAP = {
    1: "Check meta model: Remove specified keys if they are empty lists",
    2: "Check meta model: Remove 'semanticId' if it has empty 'keys'",
    3: "Check meta model: Remove 'valueId' if it has empty 'keys'",
    4: "Check meta model: Remove 'idShort' if its value is an empty string",
    5: "Check meta model: If modelType is 'File', contentType is 'image/png' or 'application/pdf', and value is '', set default file name",
    6: "Check meta model: For AnnotatedRelationshipElement, replace null 'keys' with default structure",
    7: "Check meta model: Remove empty 'value' in SubmodelElementCollection",
    8: "Check constraints: Change entityType to CoManagedEntity if globalAssetId and specificAssetId are missing",
    9: "Check constraints: Add default value for MultiLanguageProperty if missing or fix empty texts",
    10: "Check constraints: Fix ConceptDescription to GlobalReference inside semanticId > keys",
    11: "Check meta model: Remove 'value' if modelType is ReferenceElement and value.keys == []",
    12: "Check meta model: If typeValueListElement is SubmodelElementCollection, remove idShort in value items",
    13: "Check constraints: If modelType is 'Property', value is '' and valueType is not 'xs:string', set value to '0'",
    14: "Check constraints: Clean 'language': 'en?' to 'en' in MultiLanguageProperty",
    15: "Check constraints: Convert boolean strings to numeric string equivalents",
    16: "Check meta model: If MultiLanguageProperty with empty value array, replace value and add valueId",
    17: "Check constraints: If modelType is DataSpecificationIec61360 and missing definition, create it from idShort"
}


def keys():
    unique_keys = sorted(set(keys_applied))
    return [{"id": k, "desc": RULES_MAP.get(k, "Unknown rule")} for k in unique_keys]

def keys_applied_length():
    print("DEBUG keys_applied_length: ", len(keys_applied))
    return len(keys_applied)
def save_cleaned_json(cleaned_data, filename=None):
    """
    Save cleaned JSON data to a file with timestamp.
    If filename is not provided, generates one with current timestamp.
    """
    if filename is None:
        CurrentDateTime = datetime.datetime.now().strftime("%d-%m-%Y_%H%M%S")
        filename = f"{CurrentDateTime}_cleaned_output.json"
    
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(cleaned_data, f, indent=2, ensure_ascii=False)
    
    return filename


# # Only run the file operations if this script is run directly (not imported)
# if __name__ == "__main__":
#     # File paths
#     input_path = "30062025_Worker_untrained.json"
#     CurrentDateTime = datetime.datetime.now().strftime("%d-%m-%Y_%H%M%S")
#     output_path = CurrentDateTime + "cleaned_output.json"
#
#     # Load, clean, and save JSON
#     with open(input_path, "r", encoding="utf-8") as f:
#         data = json.load(f)
#
#     cleaned_data = clean_json(data)
#
#     with open(output_path, "w", encoding="utf-8") as f:
#         json.dump(cleaned_data, f, indent=2, ensure_ascii=False)
#
#     print(f"Cleaned JSON saved to: {output_path}")
