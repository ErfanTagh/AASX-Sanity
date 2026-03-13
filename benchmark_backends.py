#!/usr/bin/env python3
"""
Benchmark script to compare performance of different backend implementations.
Tests C++, Python, Go, and Java backends.
"""
import json
import time
import requests
import subprocess
import os
import sys
from pathlib import Path

# Backend configurations
BACKENDS = {
    "C++": {
        "port": 5001,
        "url": "http://localhost:5001",
        "endpoint": "/upload",
        "running": False
    },
    "Python": {
        "port": 5000,
        "url": "http://localhost:5000",
        "endpoint": "/upload",
        "running": False
    },
    "Go": {
        "port": 5002,
        "url": "http://localhost:5002",
        "endpoint": "/upload",
        "running": False
    },
    "Java": {
        "port": 5003,
        "url": "http://localhost:5003",
        "endpoint": "/upload",
        "running": False
    }
}

def check_backend_health(backend_name, config):
    """Check if a backend is running."""
    try:
        health_url = f"{config['url']}/health"
        response = requests.get(health_url, timeout=2)
        if response.status_code == 200:
            config["running"] = True
            return True
    except:
        pass
    
    # Try the upload endpoint as fallback
    try:
        test_data = {"json_data": {"test": "health_check"}}
        response = requests.post(
            f"{config['url']}{config['endpoint']}",
            json=test_data,
            timeout=2
        )
        if response.status_code in [200, 400]:  # 400 is OK, means server is running
            config["running"] = True
            return True
    except:
        pass
    
    config["running"] = False
    return False

def benchmark_backend(backend_name, config, json_file_path, num_runs=3):
    """
    Benchmark a single backend.
    
    Args:
        backend_name: Name of the backend
        config: Backend configuration
        json_file_path: Path to JSON file to test
        num_runs: Number of test runs for averaging
    
    Returns:
        Dictionary with benchmark results
    """
    if not config["running"]:
        return {
            "backend": backend_name,
            "status": "Not Running",
            "avg_time": None,
            "min_time": None,
            "max_time": None,
            "throughput": None,
            "file_size_mb": None
        }
    
    # Load JSON file
    with open(json_file_path, 'r', encoding='utf-8') as f:
        json_data = json.load(f)
    
    file_size = os.path.getsize(json_file_path)
    file_size_mb = file_size / (1024 * 1024)
    
    times = []
    
    print(f"\n  Testing {backend_name} backend...")
    
    for run in range(num_runs):
        try:
            # Prepare request
            payload = {"json_data": json_data}
            
            # Measure time
            start_time = time.time()
            response = requests.post(
                f"{config['url']}{config['endpoint']}",
                json=payload,
                timeout=300  # 5 minute timeout for large files
            )
            end_time = time.time()
            
            elapsed = end_time - start_time
            
            if response.status_code == 200:
                times.append(elapsed)
                print(f"    Run {run + 1}: {elapsed:.3f}s")
            else:
                print(f"    Run {run + 1}: FAILED (Status {response.status_code})")
                return {
                    "backend": backend_name,
                    "status": f"Error {response.status_code}",
                    "avg_time": None,
                    "min_time": None,
                    "max_time": None,
                    "throughput": None,
                    "file_size_mb": file_size_mb
                }
        
        except requests.exceptions.Timeout:
            print(f"    Run {run + 1}: TIMEOUT")
            return {
                "backend": backend_name,
                "status": "Timeout",
                "avg_time": None,
                "min_time": None,
                "max_time": None,
                "throughput": None,
                "file_size_mb": file_size_mb
            }
        except Exception as e:
            print(f"    Run {run + 1}: ERROR - {str(e)}")
            return {
                "backend": backend_name,
                "status": f"Error: {str(e)[:50]}",
                "avg_time": None,
                "min_time": None,
                "max_time": None,
                "throughput": None,
                "file_size_mb": file_size_mb
            }
    
    if not times:
        return {
            "backend": backend_name,
            "status": "All runs failed",
            "avg_time": None,
            "min_time": None,
            "max_time": None,
            "throughput": None,
            "file_size_mb": file_size_mb
        }
    
    avg_time = sum(times) / len(times)
    min_time = min(times)
    max_time = max(times)
    throughput = file_size_mb / avg_time  # MB/s
    
    return {
        "backend": backend_name,
        "status": "Success",
        "avg_time": avg_time,
        "min_time": min_time,
        "max_time": max_time,
        "throughput": throughput,
        "file_size_mb": file_size_mb
    }

def print_results_table(results):
    """Print a nicely formatted results table."""
    print("\n" + "="*100)
    print("BACKEND PERFORMANCE COMPARISON")
    print("="*100)
    
    # Header
    header = f"{'Backend':<12} {'Status':<15} {'Avg Time (s)':<15} {'Min Time (s)':<15} {'Max Time (s)':<15} {'Throughput (MB/s)':<20} {'File Size (MB)':<15}"
    print(header)
    print("-" * 100)
    
    # Sort by average time (fastest first)
    sorted_results = sorted(
        [r for r in results if r["avg_time"] is not None],
        key=lambda x: x["avg_time"]
    )
    
    # Add failed/not running backends at the end
    failed_results = [r for r in results if r["avg_time"] is None]
    sorted_results.extend(failed_results)
    
    # Find fastest for comparison
    fastest_time = sorted_results[0]["avg_time"] if sorted_results and sorted_results[0]["avg_time"] else None
    
    for result in sorted_results:
        backend = result["backend"]
        status = result["status"]
        
        if result["avg_time"] is not None:
            avg_time = f"{result['avg_time']:.3f}"
            min_time = f"{result['min_time']:.3f}"
            max_time = f"{result['max_time']:.3f}"
            throughput = f"{result['throughput']:.2f}"
            file_size = f"{result['file_size_mb']:.2f}"
            
            # Calculate speedup vs fastest
            if fastest_time and result["avg_time"] > 0:
                speedup = fastest_time / result["avg_time"]
                if speedup < 1.1:  # Within 10% of fastest
                    speedup_str = " (fastest)"
                else:
                    speedup_str = f" ({speedup:.2f}x slower)"
            else:
                speedup_str = ""
            
            row = f"{backend:<12} {status:<15} {avg_time:<15} {min_time:<15} {max_time:<15} {throughput:<20} {file_size:<15}{speedup_str}"
        else:
            file_size_str = f"{result.get('file_size_mb', 0):.2f}" if result.get('file_size_mb') else 'N/A'
            row = f"{backend:<12} {status:<15} {'N/A':<15} {'N/A':<15} {'N/A':<15} {'N/A':<20} {file_size_str:<15}"
        
        print(row)
    
    print("="*100)
    
    # Summary statistics
    successful = [r for r in results if r["avg_time"] is not None]
    if len(successful) > 1:
        print("\nSUMMARY:")
        print(f"  • Fastest backend: {sorted_results[0]['backend']} ({sorted_results[0]['avg_time']:.3f}s)")
        if len(successful) > 1:
            slowest = sorted_results[-1] if sorted_results[-1]["avg_time"] else None
            if slowest and slowest["avg_time"]:
                speedup = slowest["avg_time"] / sorted_results[0]["avg_time"]
                print(f"  • Speedup over slowest: {speedup:.2f}x faster")
        
        print(f"  • Successful backends: {len(successful)}/{len(results)}")
        print(f"  • Test file size: {successful[0]['file_size_mb']:.2f} MB")

def main():
    """Main benchmark function."""
    if len(sys.argv) < 2:
        print("Usage: python3 benchmark_backends.py <json_file> [num_runs]")
        print("Example: python3 benchmark_backends.py benchmark_large.json 3")
        sys.exit(1)
    
    json_file = sys.argv[1]
    num_runs = int(sys.argv[2]) if len(sys.argv) > 2 else 3
    
    if not os.path.exists(json_file):
        print(f"Error: JSON file not found: {json_file}")
        sys.exit(1)
    
    print("="*100)
    print("BACKEND BENCHMARK SUITE")
    print("="*100)
    print(f"Test file: {json_file}")
    print(f"Number of runs per backend: {num_runs}")
    print(f"File size: {os.path.getsize(json_file) / (1024*1024):.2f} MB")
    
    # Check which backends are running
    print("\nChecking backend availability...")
    for backend_name, config in BACKENDS.items():
        if check_backend_health(backend_name, config):
            print(f"  ✓ {backend_name} backend is running on port {config['port']}")
        else:
            print(f"  ✗ {backend_name} backend is NOT running on port {config['port']}")
    
    # Run benchmarks
    print("\n" + "="*100)
    print("RUNNING BENCHMARKS")
    print("="*100)
    
    results = []
    for backend_name, config in BACKENDS.items():
        result = benchmark_backend(backend_name, config, json_file, num_runs)
        results.append(result)
    
    # Print results table
    print_results_table(results)
    
    # Save results to JSON
    output_file = "benchmark_results.json"
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2)
    print(f"\n✓ Results saved to {output_file}")

if __name__ == "__main__":
    main()

