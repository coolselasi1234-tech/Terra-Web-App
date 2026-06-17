import pandas as pd

def error_analysis(
    myfile: str = "results_mycode.csv",
    benchfile: str = "benchmark_busnode_pu_angle.csv",
    outfile: str = "results_error.csv",
):
    # Load both files
    my = pd.read_csv(myfile)
    bench = pd.read_csv(benchfile)

    # Ensure consistent types
    my["bus"] = my["bus"].astype(str)
    bench["bus"] = bench["bus"].astype(str)
    my["phase"] = my["phase"].astype(str)
    bench["phase"] = bench["phase"].astype(str)

    # Keep only needed columns
    my = my[["bus", "phase", "V_pu", "V_ang_deg"]].copy()
    bench = bench[["bus", "phase", "V_pu", "V_ang_deg"]].copy()

    # Rename to distinguish the dataframes after merging
    my = my.rename(columns={"V_pu": "V_pu_my", "V_ang_deg": "V_ang_my"})
    bench = bench.rename(columns={"V_pu": "V_pu_bench", "V_ang_deg": "V_ang_bench"})

    # Merge on (bus, phase)
    merged = pd.merge(
        my,
        bench,
        on=["bus", "phase"],
        how="inner",
        validate="one_to_one",
    )

    if merged.empty:
        print("ERROR: No matching bus–phase pairs found between your file and the benchmark.")
        return

    # Compute absolute errors
    merged["err_V_pu"] = (merged["V_pu_my"] - merged["V_pu_bench"]).abs()
    merged["err_V_ang_deg"] = (merged["V_ang_my"] - merged["V_ang_bench"]).abs()

    # Summary statistics
    max_err_V_pu = merged["err_V_pu"].max()
    mean_err_V_pu = merged["err_V_pu"].mean()

    max_err_V_ang = merged["err_V_ang_deg"].max()
    mean_err_V_ang = merged["err_V_ang_deg"].mean()

    print("\n===== Voltage Error Analysis vs Benchmark =====")
    print(f"Matched rows: {len(merged)}")
    print(f"Max |ΔV_pu|       = {max_err_V_pu:.6f}")
    print(f"Mean |ΔV_pu|      = {mean_err_V_pu:.6f}")
    print(f"Max |Δθ_deg|      = {max_err_V_ang:.6f}")
    print(f"Mean |Δθ_deg|     = {mean_err_V_ang:.6f}")
    print("================================================")

    # Save detailed comparison file
    merged.to_csv(outfile, index=False)
    print(f"\nDetailed results saved to: {outfile}")

    # Optional: identify benchmark entries that didn't match your file
    my_keys = set(zip(my["bus"], my["phase"]))
    bench_keys = set(zip(bench["bus"], bench["phase"]))
    missing = bench_keys - my_keys

    if missing:
        print("\nBus–phase combinations found in benchmark but not in your results:")
        for b, ph in sorted(missing):
            print(f"  ({b}, {ph})")


if __name__ == "__main__":
    error_analysis()
