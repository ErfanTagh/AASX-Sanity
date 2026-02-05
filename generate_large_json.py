#!/usr/bin/env python3
"""
Generate a large JSON file for benchmarking backend implementations.
Creates a complex nested structure with various data types and issues.
"""
import json
import random
import string
import sys

def generate_random_string(length=10):
    """Generate a random string."""
    return ''.join(random.choices(string.ascii_letters + string.digits, k=length))

def generate_nested_structure(depth, seed=0):
    """Generate nested structure with decreasing depth."""
    if depth <= 0:
        return generate_random_string(20)
    
    random.seed(seed)
    structure = {}
    for i in range(3):
        key = f"level_{depth}_field_{i}"
        if depth > 1:
            structure[key] = generate_nested_structure(depth - 1, seed + i)
        else:
            structure[key] = {
                "value": generate_random_string(15),
                "type": random.choice(["string", "number", "boolean"]),
                "nullable": random.choice([True, False, None])
            }
    return structure

def generate_large_json(num_items=1000, depth=5):
    """
    Generate a large JSON structure.
    
    Args:
        num_items: Number of top-level items
        depth: Maximum nesting depth
    """
    data = {
        "assetAdministrationShells": [],
        "submodels": [],
        "conceptDescriptions": [],
        "metadata": {
            "version": "1.0",
            "generated": True,
            "description": "Large test JSON file for benchmarking"
        }
    }
    
    # Generate asset administration shells
    for i in range(num_items):
        shell = {
            "id": f"shell_{i}",
            "idShort": f"Shell{i}",
            "description": [{"text": generate_random_string(50)}],
            "displayName": [{"text": f"Shell Display {i}"}],
            "category": generate_random_string(20),
            "administration": {
                "version": "1.0",
                "revision": str(i)
            },
            "embeddedDataSpecifications": [],
            "derivedFrom": None,
            "assetInformation": {
                "assetKind": "Instance",
                "globalAssetId": generate_random_string(36),
                "specificAssetIds": []
            },
            "submodelRefs": []
        }
        
        # Add some empty arrays and nulls for testing
        if i % 10 == 0:
            shell["relatedProducts"] = []
            shell["reviews"] = []
            shell["specifications"] = []
        
        if i % 5 == 0:
            shell["optionalField"] = None
            shell["emptyString"] = ""
        
        if i % 7 == 0:
            shell["booleanString"] = random.choice(["true", "false", "1", "0"])
        
        # Add nested structures
        if depth > 0:
            shell["nested"] = generate_nested_structure(depth - 1, i)
        
        data["assetAdministrationShells"].append(shell)
    
    # Generate submodels
    for i in range(num_items // 2):
        submodel = {
            "id": f"submodel_{i}",
            "idShort": f"Submodel{i}",
            "semanticId": {
                "keys": [
                    {
                        "type": "Submodel",
                        "value": generate_random_string(30)
                    }
                ]
            },
            "submodelElements": []
        }
        
        # Add some issues
        if i % 8 == 0:
            submodel["emptyArray"] = []
            submodel["nullValue"] = None
        
        data["submodels"].append(submodel)
    
    # Generate concept descriptions
    for i in range(num_items // 3):
        concept = {
            "id": f"concept_{i}",
            "idShort": f"Concept{i}",
            "displayName": [{"text": f"Concept {i}"}],
            "description": [{"text": generate_random_string(100)}]
        }
        
        if i % 6 == 0:
            concept["emptyFields"] = []
            concept["nullField"] = None
        
        data["conceptDescriptions"].append(concept)
    
    return data

if __name__ == "__main__":
    # Default to 1000 items, but allow override via command line
    num_items = int(sys.argv[1]) if len(sys.argv) > 1 else 1000
    output_file = sys.argv[2] if len(sys.argv) > 2 else "benchmark_large.json"
    
    print(f"Generating JSON with {num_items} items...")
    data = generate_large_json(num_items=num_items, depth=5)
    
    # Write to file
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
    
    # Get file size
    import os
    file_size = os.path.getsize(output_file)
    file_size_mb = file_size / (1024 * 1024)
    
    print(f"✓ Generated {output_file}")
    print(f"  File size: {file_size_mb:.2f} MB ({file_size:,} bytes)")
    print(f"  Asset shells: {len(data['assetAdministrationShells'])}")
    print(f"  Submodels: {len(data['submodels'])}")
    print(f"  Concept descriptions: {len(data['conceptDescriptions'])}")

