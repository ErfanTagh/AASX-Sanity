import json

# =============================================================================
# HELPERS
# =============================================================================

def del_key(obj, keys_to_delete):
    """Helper function to delete keys from object"""
    for key in keys_to_delete:
        obj.pop(key, None)
    return obj

# =============================================================================
# RULE FUNCTIONS (1–18, cleaned)
# =============================================================================

def rule_1_remove_empty_lists(obj, keys_to_clean):
    keys_to_delete = [k for k in keys_to_clean if k in obj and obj[k] == []]
    if keys_to_delete:
        obj = del_key(obj, keys_to_delete)
        return obj, True
    return obj, False

def rule_2_remove_empty_semantic_id(obj):
    if "semanticId" in obj and isinstance(obj["semanticId"], dict):
        if obj["semanticId"].get("keys") == []:
            del obj["semanticId"]
            return obj, True
    return obj, False

def rule_3_remove_empty_value_id(obj):
    if "valueId" in obj and isinstance(obj["valueId"], dict):
        if obj["valueId"].get("keys") == []:
            del obj["valueId"]
            return obj, True
    return obj, False

def rule_4_remove_empty_id_short(obj):
    if "idShort" in obj:
        value = obj["idShort"]
        if isinstance(value, str) and value.strip() == "":
            del obj["idShort"]
            return obj, True
    return obj, False

def rule_5_file_defaults(obj):
    if obj.get("modelType") == "File" and obj.get("value") == "":
        if obj.get("contentType") == "image/png":
            obj["value"] = "sample.png"
            return obj, True
        elif obj.get("contentType") == "application/pdf":
            obj["value"] = "sample.pdf"
            return obj, True
    return obj, False

def rule_6_annotated_relationship_default_keys(obj):
    if obj.get("modelType") == "AnnotatedRelationshipElement":
        default_keys = [{"type": "GlobalReference", "value": "EMPTY"}]
        changed = False
        for ref_key in ("first", "second"):
            if isinstance(obj.get(ref_key), dict) and obj[ref_key].get("keys") == []:
                obj[ref_key]["keys"] = default_keys
                changed = True
        return obj, changed
    return obj, False

def rule_7_remove_empty_submodel_collection_value(obj):
    if obj.get("modelType") == "SubmodelElementCollection" and obj.get("value") == []:
        del obj["value"]
        return obj, True
    return obj, False

def rule_8_change_entity_type(obj):
    if obj.get("entityType") == "SelfManagedEntity":
        if "globalAssetId" not in obj and "specificAssetId" not in obj:
            obj["entityType"] = "CoManagedEntity"
            return obj, True
    return obj, False

def rule_9_multilanguage_property_defaults(obj):
    if obj.get("modelType") == "MultiLanguageProperty":
        default_value = [{"language": "en", "text": "EMPTY"}]
        if "value" not in obj:
            obj["value"] = default_value
            return obj, True
        changed = False
        if isinstance(obj["value"], list):
            for v in obj["value"]:
                if isinstance(v, dict):
                    text_val = v.get("text")
                    if text_val is None or (isinstance(text_val, str) and text_val.strip() == ""):
                        v["text"] = "EMPTY"
                        changed = True
        return obj, changed
    return obj, False

def rule_10_fix_concept_description(obj):
    if "semanticId" in obj and isinstance(obj["semanticId"], dict):
        if obj["semanticId"].get("type") == "ExternalReference":
            keys_list = obj["semanticId"].get("keys", [])
            if isinstance(keys_list, list):
                changed = False
                for item in keys_list:
                    if isinstance(item, dict) and item.get("type") == "ConceptDescription":
                        item["type"] = "GlobalReference"
                        changed = True
                return obj, changed
    return obj, False

def rule_11_remove_empty_reference_element_value(obj):
    if obj.get("modelType") == "ReferenceElement":
        if isinstance(obj.get("value"), dict) and obj["value"].get("keys") == []:
            del obj["value"]
            return obj, True
    return obj, False

def rule_12_remove_id_short_in_submodel_collection(obj):
    if obj.get("typeValueListElement") == "SubmodelElementCollection":
        if isinstance(obj.get("value"), list):
            changed = False
            for item in obj["value"]:
                if isinstance(item, dict) and "idShort" in item:
                    del item["idShort"]
                    changed = True
            return obj, changed
    return obj, False

def rule_13_property_empty_value_default(obj):
    if obj.get("modelType") == "Property" and obj.get("value") == "" and obj.get("valueType") != "xs:string":
        obj["value"] = "0"
        return obj, True
    return obj, False

def rule_14_fix_language_en_question(obj):
    if obj.get("modelType") == "MultiLanguageProperty":
        if isinstance(obj.get("value"), list):
            changed = False
            for v in obj["value"]:
                if isinstance(v, dict) and v.get("language") == "en?":
                    v["language"] = "en"
                    changed = True
            return obj, changed
    return obj, False

def rule_15_convert_boolean_strings(obj):
    if obj.get("valueType") == "xs:boolean":
        val = obj.get("value")
        if isinstance(val, str):
            if val.lower() == "true":
                obj["value"] = "1"
                return obj, True
            if val.lower() == "false":
                obj["value"] = "0"
                return obj, True
    return obj, False

def rule_16_multilanguage_property_empty_array(obj):
    if obj.get("modelType") == "MultiLanguageProperty":
        if isinstance(obj.get("value"), list) and len(obj["value"]) == 0:
            obj["value"] = [{"language": "en", "text": "EMPTY"}]
            obj["valueId"] = {
                "type": "ExternalReference",
                "keys": [{"type": "GlobalReference", "value": "0173-1#07-ABK870#003"}]
            }
            return obj, True
    return obj, False

def rule_17_add_data_specification_definition(obj):
    if obj.get("modelType") == "DataSpecificationIec61360":
        if "definition" not in obj:
            obj["definition"] = [{"language": "en", "text": "Check the IdShort"}]
            return obj, True
    return obj, False

def rule_18_remove_bulk_count_items(obj):
    new_list = [item for item in obj if not (
        isinstance(item, dict)
        and item.get("idShort") == "BulkCount"
        and item.get("valueType") == "xs:unsignedLong"
        and item.get("value") == ""
        and item.get("modelType") == "Property"
    )]
    return new_list, len(new_list) != len(obj)

# =============================================================================
# STEPWISE CLEANER (type-aware dispatcher)
# =============================================================================

def clean_json_stepwise(obj, keys_to_clean=None, skip_rules=None, snapshot=True):
    """
    Runs the cleaning rules until the first change is found.
    Returns (before_fragment, after_fragment, rule_num, complete_after_json, complete_before_json).
    If no change is found, returns (None, None, None, None, None).
    complete_after_json is the full JSON with the change applied.
    complete_before_json is the full JSON before the change was applied.
    rule_num is the rule that was applied (needed for rejection handling).
    """
    if skip_rules is None:
        skip_rules = []
    
    if keys_to_clean is None:
        keys_to_clean = (
            "qualifiers", "embeddedDataSpecifications", "displayName",
            "statements", "description", "extensions",
            "supplementalSemanticIds", "shortName"
        )

    dict_rules = [
        (1, lambda o: rule_1_remove_empty_lists(o, keys_to_clean)),
        (2, rule_2_remove_empty_semantic_id),
        (3, rule_3_remove_empty_value_id),
        (4, rule_4_remove_empty_id_short),
        (5, rule_5_file_defaults),
        (6, rule_6_annotated_relationship_default_keys),
        (7, rule_7_remove_empty_submodel_collection_value),
        (8, rule_8_change_entity_type),
        (9, rule_9_multilanguage_property_defaults),
        (10, rule_10_fix_concept_description),
        (11, rule_11_remove_empty_reference_element_value),
        (12, rule_12_remove_id_short_in_submodel_collection),
        (13, rule_13_property_empty_value_default),
        (14, rule_14_fix_language_en_question),
        (15, rule_15_convert_boolean_strings),
        (16, rule_16_multilanguage_property_empty_array),
        (17, rule_17_add_data_specification_definition),
    ]
    list_rules = [
        (18, rule_18_remove_bulk_count_items)
    ]

    root = obj
    stack = [(None, None, obj)]  # (parent, key, current)

    while stack:
        parent, key, current = stack.pop()

        # Dict rules
        if isinstance(current, dict):
            
            for rule_num, rule_func in dict_rules:
                if rule_num in skip_rules:
                    continue
                # Take snapshot BEFORE applying the rule
                before_fragment = json.loads(json.dumps(current)) if snapshot else None
                # Also capture the complete before state
                complete_before = json.loads(json.dumps(root)) if root is not None else None
                modified, changed = rule_func(current)
                if changed:
                    
                    if parent is None:
                        root = modified
                    else:
                        parent[key] = modified
                    after_fragment = json.loads(json.dumps(modified)) if snapshot else None
                    # Return the complete updated JSON
                    complete_after = json.loads(json.dumps(root)) if root is not None else None
                    return before_fragment, after_fragment, rule_num, complete_after, complete_before

            for child_key, child_val in current.items():
                if isinstance(child_val, (dict, list)):
                    stack.append((current, child_key, child_val))

        # List rules
        elif isinstance(current, list):
            for rule_num, rule_func in list_rules:
                if rule_num in skip_rules:
                    continue
                # Take snapshot BEFORE applying the rule
                before_fragment = json.loads(json.dumps(current)) if snapshot else None
                # Also capture the complete before state
                complete_before = json.loads(json.dumps(root)) if root is not None else None
                modified, changed = rule_func(current)
                if changed:
                    if parent is None:
                        root = modified
                    else:
                        parent[key] = modified
                    after_fragment = json.loads(json.dumps(modified)) if snapshot else None
                    # Return the complete updated JSON
                    complete_after = json.loads(json.dumps(root)) if root is not None else None
                    return before_fragment, after_fragment, rule_num, complete_after, complete_before

            for idx, child_val in enumerate(current):
                if isinstance(child_val, (dict, list)):
                    stack.append((current, idx, child_val))

        # Primitives are ignored

    return None, None, None, None, None

