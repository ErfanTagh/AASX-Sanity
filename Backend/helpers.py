import json
from typing import Any, Dict, Tuple

def normalize(obj: Any) -> Any:
    """Normalize an object for comparison by converting to JSON and back."""
    return json.loads(json.dumps(obj))

def extract_changed_parts_fast(before: Any, after: Any) -> Dict[str, Any]:
    """
    Extract only the changed parts between two JSON objects.
    Returns both flat and tree representations of the changes.
    """
    flat = {"before": {}, "after": {}}

    def record(path: str, v1: Any, v2: Any):
        p = path or "$"
        flat["before"][p] = v1
        flat["after"][p] = v2

    def diff(v1: Any, v2: Any, path="") -> Tuple[Any, Any]:
        # Early exit for identical values
        if v1 is v2 or v1 == v2:
            return None, None

        # Handle None values (key doesn't exist in one dict)
        if v1 is None or v2 is None:
            record(path, v1, v2)
            return v1, v2

        # Type changed or primitive value changed
        if type(v1) != type(v2) or not isinstance(v1, (dict, list)):
            record(path, v1, v2)
            return v1, v2

        # Dicts
        if isinstance(v1, dict):
            keys = set(v1) | set(v2)
            b_obj, a_obj = {}, {}
            changed = False
            for k in keys:
                v1_k, v2_k = v1.get(k), v2.get(k)
                b_child, a_child = diff(v1_k, v2_k, f"{path}.{k}")
                if b_child is not None or a_child is not None:
                    b_obj[k] = b_child if b_child is not None else v1_k
                    a_obj[k] = a_child if a_child is not None else v2_k
                    changed = True
            return (b_obj, a_obj) if changed else (None, None)

        # Lists
        if isinstance(v1, list):
            if len(v1) != len(v2):
                record(path, v1, v2)
                return v1, v2
            b_list, a_list = [], []
            changed = False
            for i, (item1, item2) in enumerate(zip(v1, v2)):
                b_child, a_child = diff(item1, item2, f"{path}[{i}]")
                if b_child is not None or a_child is not None:
                    b_list.append(b_child if b_child is not None else item1)
                    a_list.append(a_child if a_child is not None else item2)
                    changed = True
                else:
                    b_list.append(item1)
                    a_list.append(item2)
            return (b_list, a_list) if changed else (None, None)

        return None, None

    b_tree, a_tree = diff(before, after)
    
    # If the root objects are different, return them as tree fragments
    if b_tree is None and a_tree is None and before != after:
        b_tree, a_tree = before, after

    return {"flat": flat, "tree": {"before": b_tree, "after": a_tree}}
