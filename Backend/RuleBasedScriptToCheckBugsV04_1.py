import json
import datetime

keys_applied = []
def clean_json(obj, keys_to_clean=("qualifiers", "embeddedDataSpecifications", "displayName", "statements", "description", "extensions", "supplementalSemanticIds", "shortName")):

    if isinstance(obj, dict):
        keys_to_delete = []


        # Rule 1 - Check meta model: Remove specified keys if they are empty lists
        for key in keys_to_clean:
            if key in obj and obj[key] == []:
                keys_to_delete.append(key)
                keys_applied.append(1)

        # Rule 2 - Check meta model: Remove "semanticId" if it has empty "keys"
        if "semanticId" in obj and isinstance(obj["semanticId"], dict):
            if obj["semanticId"].get("keys") == []:
                keys_to_delete.append("semanticId")
                keys_applied.append(2)


        # Rule 3 - Check meta model: Remove "valueId" if it has empty "keys"
        if "valueId" in obj and isinstance(obj["valueId"], dict):
            if obj["valueId"].get("keys") == []:
                keys_to_delete.append("valueId")
                keys_applied.append(3)

        # Rule 4 - Check meta model: Remove "idShort" if its value is an empty string
        if "idShort" in obj and obj["idShort"] == "":
            keys_to_delete.append("idShort")
            keys_applied.append(4)

        # Rule 5 - Check meta model: If modelType is "File", contentType is "image/png", and value is "", set value to "sample.png"
        if obj.get("modelType") == "File":
            if obj.get("contentType") == "image/png" and obj.get("value") == "":
                obj["value"] = "sample.png"
                keys_applied.append(5)
            elif obj.get("contentType") == "application/pdf" and obj.get("value") == "":
                obj["value"] = "sample.pdf"
                keys_applied.append(5)

                
        
        # Rule 6 - Check meta model: For AnnotatedRelationshipElement, replace null "keys" with default structure
        if obj.get("modelType") == "AnnotatedRelationshipElement":
            default_keys = [{"type": "GlobalReference", "value": "EMPTY"}]
            for ref_key in ("first", "second"):
                if isinstance(obj.get(ref_key), dict):
                     if obj[ref_key].get("keys") == []:
                        obj[ref_key]["keys"] = default_keys
                        keys_applied.append(6)

        # Rule 7 - Check meta model: Remove empty "value" in SubmodelElementCollection
        if obj.get("modelType") == "SubmodelElementCollection" and obj.get("value") == []:
            keys_to_delete.append("value")
            keys_applied.append(7)

        # Rule 8 - Check constraints : Change entityType to CoManagedEntity if globalAssetId and specificAssetId are missing
        if obj.get("entityType") == "SelfManagedEntity":
            if "globalAssetId" not in obj and "specificAssetId" not in obj:
                obj["entityType"] = "CoManagedEntity"
                keys_applied.append(8)

        
        # Rule 9 - Check constraints : Add default value for MultiLanguageProperty if missing
        if obj.get("modelType") == "MultiLanguageProperty":
            default_value = [{"language": "en", "text": "EMPTY"}]
            if "value" not in obj:
                obj["value"] = default_value
                keys_applied.append(9)

            else:
                # Fill in empty text fields in existing value
                if isinstance(obj["value"], list):
                    for v in obj["value"]:
                        if isinstance(v, dict) and v.get("text", None) == "":
                            v["text"] = "EMPTY"
                            keys_applied.append(9)


        # Rule 10  - Check constraints : Fix ConceptDescription to GlobalReference inside semanticId > keys
        if "semanticId" in obj and isinstance(obj["semanticId"], dict):
            if obj["semanticId"].get("type") == "ExternalReference":
                keys_list = obj["semanticId"].get("keys", [])
                if isinstance(keys_list, list):
                    for item in keys_list:
                        if isinstance(item, dict) and item.get("type") == "ConceptDescription":
                            item["type"] = "GlobalReference"
                            keys_applied.append(10)


         # Rule 11 - Check meta model: Remove "value" if modelType is ReferenceElement and value.keys == []
        if obj.get("modelType") == "ReferenceElement":
            if isinstance(obj.get("value"), dict) and obj["value"].get("keys") == []:
                keys_to_delete.append("value")
                keys_applied.append(11)

        # Rule 12 - Check meta model: If typeValueListElement is SubmodelElementCollection, remove idShort in value items
        if obj.get("typeValueListElement") == "SubmodelElementCollection":
            if isinstance(obj.get("value"), list):
                for item in obj["value"]:
                    if isinstance(item, dict) and "idShort" in item:
                        del item["idShort"]
                        keys_applied.append(12)

        # Rule 13 - Check constraints: If modelType is "Property", value is "" and valueType is not "xs:string", set value to "0"
        if (
            obj.get("modelType") == "Property"
            and obj.get("value") == ""
            and obj.get("valueType") != "xs:string"
        ):
            obj["value"] = "0"
            keys_applied.append(13)

        # Rule 14 - Check constraints: Clean "language": "en?" to "en" in MultiLanguageProperty"
        if obj.get("modelType") == "MultiLanguageProperty":
            if isinstance(obj.get("value"), list):
                for v in obj["value"]:
                    if (
                        isinstance(v, dict)
                        and v.get("language") == "en?"                        
                    ):
                        v["language"] = "en"
                        keys_applied.append(14)

         # Rule 15 - Check constraints: Convert boolean strings to numeric string equivalents
        if obj.get("valueType") == "xs:boolean":
            if obj.get("value") == "True":
                obj["value"] = "1"
                keys_applied.append(15)
            elif obj.get("value") == "False":
                obj["value"] = "0"
                keys_applied.append(15)

       # Rule 16 - Check meta model: If MultiLanguageProperty with empty value array, replace value and add valueId
        if obj.get("modelType") == "MultiLanguageProperty":
            if isinstance(obj.get("value"), list) and len(obj["value"]) == 0:
                obj["value"] = [{"language": "en", "text": "EMPTY"}]
                obj["valueId"] = {
                    "type": "ExternalReference",
                    "keys": [
                        {
                            "type": "GlobalReference",
                            "value": "0173-1#07-ABK870#003"
                        }
                    ]
                }
                keys_applied.append(16)

        # Rule 17 - Check constraints: If modelType is DataSpecificationIec61360 and missing definition, create it from idShort
        if obj.get("modelType") == "DataSpecificationIec61360":            
            if "definition" not in obj:
                obj["definition"] = [
                    {
                        "language": "en",
                        "text": "Check the IdShort"
                    }
                ]
                keys_applied.append(17)

        #  Apply deletions
        for key in keys_to_delete:
            del obj[key]

        # Recurse into dictionary values
        for key in list(obj):
            obj[key] = clean_json(obj[key], keys_to_clean)

    elif isinstance(obj, list):
        # Recurse into list items
        #obj = [clean_json(item, keys_to_clean) for item in obj]

        new_list = []
        for item in obj:
            # Rule 8 - Check constraints : Remove BulkCount elements with specific empty values
            if (
                isinstance(item, dict)
                and item.get("idShort") == "BulkCount"
                and item.get("valueType") == "xs:unsignedLong"
                and item.get("value") == ""
                and item.get("modelType") == "Property"
            ):
                continue  # Skip this item
            obj_item  = clean_json(item, keys_to_clean)
            new_list.append(obj_item)
        return new_list, []

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
