#!/usr/bin/env python3
"""
Display benchmark results in a nicely formatted table.
"""
import json
import sys

def format_time(seconds):
    """Format time in a human-readable way."""
    if seconds is None:
        return "N/A"
    if seconds < 1:
        return f"{seconds*1000:.1f} ms"
    return f"{seconds:.3f} s"

def format_throughput(mb_per_sec):
    """Format throughput."""
    if mb_per_sec is None:
        return "N/A"
    return f"{mb_per_sec:.2f} MB/s"

def print_results():
    """Print formatted results table."""
    try:
        with open('benchmark_results.json', 'r') as f:
            results = json.load(f)
    except FileNotFoundError:
        print("Error: benchmark_results.json not found. Run benchmark_backends.py first.")
        sys.exit(1)
    
    print("\n" + "="*110)
    print(" " * 35 + "BACKEND PERFORMANCE COMPARISON")
    print("="*110)
    
    # Filter successful results
    successful = [r for r in results if r.get("avg_time") is not None]
    failed = [r for r in results if r.get("avg_time") is None]
    
    if successful:
        # Sort by average time
        successful.sort(key=lambda x: x["avg_time"])
        fastest = successful[0]
        
        print(f"\n📊 Test Configuration:")
        print(f"   • File Size: {successful[0]['file_size_mb']:.2f} MB")
        print(f"   • Test Runs: 3 per backend")
        print(f"   • Successful Backends: {len(successful)}/{len(results)}")
        
        print(f"\n🏆 Performance Results:\n")
        
        # Header
        header = f"{'Backend':<12} {'Status':<12} {'Avg Time':<15} {'Min Time':<15} {'Max Time':<15} {'Throughput':<18} {'Speedup':<15}"
        print(header)
        print("-" * 110)
        
        # Results
        for result in successful:
            backend = result["backend"]
            status = result["status"]
            avg_time = result["avg_time"]
            min_time = result["min_time"]
            max_time = result["max_time"]
            throughput = result.get("throughput")
            
            # Calculate speedup vs fastest
            if avg_time and fastest["avg_time"]:
                speedup = fastest["avg_time"] / avg_time
                if speedup >= 0.99:  # Within 1% of fastest
                    speedup_str = "🏆 Fastest"
                else:
                    speedup_str = f"{speedup:.2f}x slower"
            else:
                speedup_str = "N/A"
            
            row = f"{backend:<12} {status:<12} {format_time(avg_time):<15} {format_time(min_time):<15} {format_time(max_time):<15} {format_throughput(throughput):<18} {speedup_str:<15}"
            print(row)
        
        # Failed backends
        if failed:
            print("\n" + "-" * 110)
            print("⚠️  Backends Not Available:")
            for result in failed:
                backend = result["backend"]
                status = result["status"]
                print(f"   • {backend}: {status}")
        
        # Summary
        if len(successful) > 0:
            print("\n" + "="*110)
            print("📈 Summary:")
            print(f"   • Fastest Backend: {fastest['backend']} ({format_time(fastest['avg_time'])})")
            print(f"   • Processing Speed: {format_throughput(fastest.get('throughput'))}")
            
            if len(successful) > 1:
                slowest = max(successful, key=lambda x: x["avg_time"])
                speedup = slowest["avg_time"] / fastest["avg_time"]
                print(f"   • Performance Range: {speedup:.2f}x difference between fastest and slowest")
        
        print("="*110 + "\n")
    else:
        print("\n⚠️  No successful benchmark results found.")
        print("   Make sure at least one backend is running and accessible.\n")

if __name__ == "__main__":
    print_results()

