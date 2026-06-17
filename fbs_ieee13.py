import numpy as np
import pandas as pd

def run_fbs_ieee13(
    buses_path="buses.csv",
    lines_path="lines.csv",
    loads_path="loads.csv",
    caps_path="caps.csv",
    max_iter=200,
    tol_volt=0.1,  # volts
    alpha=0.35,
):
    print("Starting FBS power flow for IEEE-13...")

    # Load CSV files
    buses = pd.read_csv(buses_path)
    lines = pd.read_csv(lines_path)
    loads = pd.read_csv(loads_path)
    caps  = pd.read_csv(caps_path)

    phase_list = ["A", "B", "C"]
    n_phase = 3

    # Bus indexing
    bus_names = buses["bus"].astype(str).values
    n_bus = len(bus_names)
    bus_index = {name: i for i, name in enumerate(bus_names)}

    # Line connectivity
    n_line = len(lines)
    line_from = np.zeros(n_line, dtype=int)
    line_to   = np.zeros(n_line, dtype=int)
    for ell in range(n_line):
        from_name = str(lines.loc[ell, "from"])
        to_name   = str(lines.loc[ell, "to"])
        if from_name not in bus_index or to_name not in bus_index:
            raise ValueError(f"Line {ell}: from {from_name} or to {to_name} not in bus list")
        line_from[ell] = bus_index[from_name]
        line_to[ell]   = bus_index[to_name]

    # Slack bus: prefer "rg60", else is_slack==1
    slack_idx = None
    for i, name in enumerate(bus_names):
        if name.lower() == "rg60":
            slack_idx = i
            break
    if slack_idx is None:
        slack_candidates = np.where(buses["is_slack"].values == 1)[0]
        if len(slack_candidates) == 0:
            raise ValueError("No slack bus: no rg60 and no is_slack == 1.")
        slack_idx = slack_candidates[0]

    # Build radial tree: parent, children, BFS order
    parent_bus  = np.full(n_bus, -1, dtype=int)
    parent_line = np.full(n_bus, -1, dtype=int)
    children = [[] for _ in range(n_bus)]

    for ell in range(n_line):
        i = line_from[ell]
        j = line_to[ell]
        children[i].append(j)

    visited = np.zeros(n_bus, dtype=bool)
    order = []

    queue = [slack_idx]
    visited[slack_idx] = True
    parent_bus[slack_idx]  = -1
    parent_line[slack_idx] = -1

    while queue:
        i = queue.pop(0)
        order.append(i)
        for c in children[i]:
            if not visited[c]:
                mask = (line_from == i) & (line_to == c)
                indices = np.where(mask)[0]
                if len(indices) == 0:
                    raise ValueError(f"No line found from bus {bus_names[i]} to {bus_names[c]}")
                ell_ic = indices[0]
                parent_bus[c]  = i
                parent_line[c] = ell_ic
                visited[c] = True
                queue.append(c)

    if not visited.all():
        print("Warning: some buses not connected to slack bus in this tree.")

    # Initialize voltages and base voltages: 3 x n_bus arrays
    V = np.zeros((n_phase, n_bus), dtype=complex)
    Vbase = np.zeros((n_phase, n_bus), dtype=float)

    for i in range(n_bus):
        kvln = float(buses.loc[i, "kvln"])  # kV line-to-neutral
        Vmag_base = kvln * 1e3             # volts
        phases_str = str(buses.loc[i, "phases"])  # e.g. "ABC", "BC", "A"

        for ch in phases_str:
            if ch not in phase_list:
                continue
            p = phase_list.index(ch)
            if ch == "A":
                ang_deg = 0.0
            elif ch == "B":
                ang_deg = -120.0
            elif ch == "C":
                ang_deg = 120.0
            else:
                ang_deg = 0.0
            Vbase[p, i] = Vmag_base
            V[p, i] = Vmag_base * np.exp(1j * np.deg2rad(ang_deg))

    Vslack = V[:, slack_idx].copy()

    # Full 3x3 impedance matrices
    Zline_full = []
    for ell in range(n_line):
        Z = np.zeros((3, 3), dtype=complex)
        Z[0, 0] = lines.loc[ell, "zaa_re"] + 1j * lines.loc[ell, "zaa_im"]
        Z[0, 1] = lines.loc[ell, "zab_re"] + 1j * lines.loc[ell, "zab_im"]
        Z[0, 2] = lines.loc[ell, "zac_re"] + 1j * lines.loc[ell, "zac_im"]
        Z[1, 0] = lines.loc[ell, "zba_re"] + 1j * lines.loc[ell, "zba_im"]
        Z[1, 1] = lines.loc[ell, "zbb_re"] + 1j * lines.loc[ell, "zbb_im"]
        Z[1, 2] = lines.loc[ell, "zbc_re"] + 1j * lines.loc[ell, "zbc_im"]
        Z[2, 0] = lines.loc[ell, "zca_re"] + 1j * lines.loc[ell, "zca_im"]
        Z[2, 1] = lines.loc[ell, "zcb_re"] + 1j * lines.loc[ell, "zcb_im"]
        Z[2, 2] = lines.loc[ell, "zcc_re"] + 1j * lines.loc[ell, "zcc_im"]
        Zline_full.append(Z)

    # Iteration
    for k in range(1, max_iter + 1):
        V_old = V.copy()

        Ibus = np.zeros((n_phase, n_bus), dtype=complex)
        Iline = np.zeros((n_phase, n_line), dtype=complex)

        # Loads (constant power)
        for _, row in loads.iterrows():
            bus_name = str(row["bus"])
            if bus_name not in bus_index:
                continue
            b_idx = bus_index[bus_name]
            conn = str(row["conn"]).lower()  # "wye" or "delta"

            PkW = np.array([row["P_A_kW"], row["P_B_kW"], row["P_C_kW"]], dtype=float)
            QkV = np.array([row["Q_A_kvar"], row["Q_B_kvar"], row["Q_C_kvar"]], dtype=float)
            Sph = (PkW + 1j * QkV) * 1e3

            if conn == "wye":
                for p in range(n_phase):
                    S = Sph[p]
                    if abs(S) < 1e-6:
                        continue
                    Vph = V[p, b_idx]
                    if abs(Vph) < 1e-12:
                        continue
                    Iph = np.conj(S / Vph)
                    Ibus[p, b_idx] += Iph

            elif conn == "delta":
                S_AB, S_BC, S_CA = Sph
                if abs(S_AB) > 1e-6:
                    Vab = V[0, b_idx] - V[1, b_idx]
                    if abs(Vab) > 1e-12:
                        Iab = np.conj(S_AB / Vab)
                        Ibus[0, b_idx] += Iab
                        Ibus[1, b_idx] -= Iab
                if abs(S_BC) > 1e-6:
                    Vbc = V[1, b_idx] - V[2, b_idx]
                    if abs(Vbc) > 1e-12:
                        Ibc = np.conj(S_BC / Vbc)
                        Ibus[1, b_idx] += Ibc
                        Ibus[2, b_idx] -= Ibc
                if abs(S_CA) > 1e-6:
                    Vca = V[2, b_idx] - V[0, b_idx]
                    if abs(Vca) > 1e-12:
                        Ica = np.conj(S_CA / Vca)
                        Ibus[2, b_idx] += Ica
                        Ibus[0, b_idx] -= Ica

        # Capacitors (constant Q)
        for _, row in caps.iterrows():
            bus_name = str(row["bus"])
            if bus_name not in bus_index:
                continue
            b_idx = bus_index[bus_name]
            kvar = np.array([row["kvar_A"], row["kvar_B"], row["kvar_C"]], dtype=float) * 1e3

            for p in range(n_phase):
                Q = kvar[p]
                if abs(Q) < 1e-6:
                    continue
                Vph = V[p, b_idx]
                if abs(Vph) < 1e-12:
                    continue
                Scap = -1j * Q
                Icap = np.conj(Scap / Vph)
                Ibus[p, b_idx] += Icap

        # Backward sweep
        for idx in range(len(order) - 1, 0, -1):
            j = order[idx]
            p_idx = parent_bus[j]
            if p_idx < 0:
                continue

            I_down = np.zeros(n_phase, dtype=complex)
            for child in children[j]:
                ell_child = parent_line[child]
                I_down += Iline[:, ell_child]

            I_through = Ibus[:, j] + I_down

            ell = parent_line[j]
            phases_str = str(lines.loc[ell, "phases"])
            ph_mask = np.array([ch in phases_str for ch in phase_list])
            Iline[ph_mask, ell] = I_through[ph_mask]

        # Forward sweep
        V_new = V.copy()
        V_new[:, slack_idx] = Vslack

        for idx in range(1, len(order)):
            j = order[idx]
            p_idx = parent_bus[j]
            if p_idx < 0:
                continue
            ell = parent_line[j]
            Zfull = Zline_full[ell]

            phases_str = str(lines.loc[ell, "phases"])
            ph_idxs = [phase_list.index(ch) for ch in phases_str if ch in phase_list]
            if not ph_idxs:
                continue

            Zsub = Zfull[np.ix_(ph_idxs, ph_idxs)]
            Iij_sub = Iline[ph_idxs, ell]
            Vi_parent = V[ph_idxs, p_idx]

            Vj_new_sub = Vi_parent - Zsub.dot(Iij_sub)
            for local_idx, ph in enumerate(ph_idxs):
                V_new[ph, j] = Vj_new_sub[local_idx]

        # Damping
        V = V_old + alpha * (V_new - V_old)
        V[:, slack_idx] = Vslack

        dV = np.abs(V - V_old)
        max_delta = dV.max()
        print(f"Iter {k:3d}: max |ΔV| = {max_delta:.6f} V")
        if max_delta < tol_volt:
            print(f"Converged in {k} iterations.")
            break
    else:
        print("Warning: did not converge within max_iter iterations.")

    # Post-processing
    Vmag = np.abs(V)
    Vang = np.rad2deg(np.angle(V))
    Vpu = np.zeros_like(Vmag)
    for i in range(n_bus):
        for p in range(n_phase):
            if Vbase[p, i] > 0:
                Vpu[p, i] = Vmag[p, i] / Vbase[p, i]

    rows = []
    for i in range(n_bus):
        phases_str = str(buses.loc[i, "phases"])
        for ch in phases_str:
            if ch not in phase_list:
                continue
            p = phase_list.index(ch)
            rows.append(
                {
                    "bus": bus_names[i],
                    "phase": ch,
                    "V_mag_V": Vmag[p, i],
                    "V_pu": Vpu[p, i],
                    "V_ang_deg": Vang[p, i],
                }
            )
    results_df = pd.DataFrame(rows)
    results_df.to_csv("results_mycode.csv", index=False)
    print("--- First few bus-voltage results ---")
    print(results_df.head(15))

    # System losses (for later analytical question)
    P_loss_total = 0.0
    Q_loss_total = 0.0
    for ell in range(n_line):
        Zfull = Zline_full[ell]
        phases_str = str(lines.loc[ell, "phases"])
        for ch in phases_str:
            if ch not in phase_list:
                continue
            p = phase_list.index(ch)
            Iph = Iline[p, ell]
            Zph = Zfull[p, p]
            S_loss = (abs(Iph) ** 2) * Zph
            P_loss_total += S_loss.real
            Q_loss_total += S_loss.imag

    P_load_total = 0.0
    Q_load_total = 0.0

    for _, row in loads.iterrows():
        bus_name = str(row["bus"])
        if bus_name not in bus_index:
            continue
        b_idx = bus_index[bus_name]
        conn = str(row["conn"]).lower()

        PkW = np.array([row["P_A_kW"], row["P_B_kW"], row["P_C_kW"]], dtype=float)
        QkV = np.array([row["Q_A_kvar"], row["Q_B_kvar"], row["Q_C_kvar"]], dtype=float)
        Sph = (PkW + 1j * QkV) * 1e3

        if conn == "wye":
            for p in range(n_phase):
                S = Sph[p]
                if abs(S) < 1e-6:
                    continue
                Vph = V[p, b_idx]
                if abs(Vph) < 1e-12:
                    continue
                Iph = np.conj(S / Vph)
                S_bus = Vph * np.conj(Iph)
                P_load_total += S_bus.real
                Q_load_total += S_bus.imag
        elif conn == "delta":
            S_AB, S_BC, S_CA = Sph
            if abs(S_AB) > 1e-6:
                Vab = V[0, b_idx] - V[1, b_idx]
                if abs(Vab) > 1e-12:
                    Iab = np.conj(S_AB / Vab)
                    S_AB_val = Vab * np.conj(Iab)
                    P_load_total += S_AB_val.real
                    Q_load_total += S_AB_val.imag
            if abs(S_BC) > 1e-6:
                Vbc = V[1, b_idx] - V[2, b_idx]
                if abs(Vbc) > 1e-12:
                    Ibc = np.conj(S_BC / Vbc)
                    S_BC_val = Vbc * np.conj(Ibc)
                    P_load_total += S_BC_val.real
                    Q_load_total += S_BC_val.imag
            if abs(S_CA) > 1e-6:
                Vca = V[2, b_idx] - V[0, b_idx]
                if abs(Vca) > 1e-12:
                    Ica = np.conj(S_CA / Vca)
                    S_CA_val = Vca * np.conj(Ica)
                    P_load_total += S_CA_val.real
                    Q_load_total += S_CA_val.imag

    P_gen_total = P_load_total + P_loss_total
    Q_gen_total = Q_load_total + Q_loss_total

    pct_P_loss = 100.0 * P_loss_total / P_gen_total if P_gen_total != 0 else 0.0
    pct_Q_loss = 100.0 * Q_loss_total / Q_gen_total if Q_gen_total != 0 else 0.0

    print("\n===== System Losses Summary (Analytical Question 3) =====")
    print(f"Total generated real power     P_gen  = {P_gen_total/1e3:.2f} kW")
    print(f"Total generated reactive power Q_gen  = {Q_gen_total/1e3:.2f} kvar")
    print(f"Total load real power          P_load = {P_load_total/1e3:.2f} kW")
    print(f"Total load reactive power      Q_load = {Q_load_total/1e3:.2f} kvar")
    print(f"Total line real power losses   P_loss = {P_loss_total/1e3:.2f} kW "
          f"({pct_P_loss:.2f}% of P_gen)")
    print(f"Total line reactive losses     Q_loss = {Q_loss_total/1e3:.2f} kvar "
          f"({pct_Q_loss:.2f}% of Q_gen)")
    print("=========================================================")

    return results_df

if __name__ == "__main__":
    run_fbs_ieee13()
