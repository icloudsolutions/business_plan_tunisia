"""Matplotlib charts for Word export (saved as PNG)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

HORIZON = 7
CLR_BLUE = "#003366"
CLR_GREEN = "#336633"
CLR_ORANGE = "#CC6600"
CLR_TEAL = "#336699"
CLR_RED = "#CC3333"


def _mpl_readability() -> None:
    plt.rcParams.update(
        {
            "text.color": "#333333",
            "axes.labelcolor": "#333333",
            "axes.edgecolor": "#333333",
            "xtick.color": "#333333",
            "ytick.color": "#333333",
            "legend.labelcolor": "#333333",
            "figure.facecolor": "white",
            "axes.facecolor": "white",
        }
    )


def _style_pie_labels(ax) -> None:
    for t in ax.texts:
        t.set_color("#333333")


def _fmt_axis(n: float) -> str:
    if abs(n) >= 1_000_000:
        return f"{n / 1_000_000:.1f} M"
    if abs(n) >= 1_000:
        return f"{n / 1_000:.0f} k"
    return f"{n:.0f}"


def create_chart_png(data: dict[str, Any], chart_type: str, output_path: str) -> str:
    """
    Render a chart to PNG.

    chart_type:
      - results_evolution
      - cumulative_treasury
      - cost_structure
      - ca_by_product
    """
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    if chart_type == "results_evolution":
        _chart_results_evolution(data, path)
    elif chart_type == "cumulative_treasury":
        _chart_cumulative_treasury(data, path)
    elif chart_type == "cost_structure":
        _chart_cost_structure(data, path)
    elif chart_type == "ca_by_product":
        _chart_ca_by_product(data, path)
    else:
        raise ValueError(f"Unknown chart_type: {chart_type}")

    plt.close("all")
    return str(path.resolve())


def _chart_results_evolution(data: dict, path: Path) -> None:
    _mpl_readability()
    years = list(range(1, HORIZON + 1))
    revenue = data.get("revenue", [0] * HORIZON)[:HORIZON]
    net = data.get("net_profit", [0] * HORIZON)[:HORIZON]
    ebit = data.get("ebit", [0] * HORIZON)[:HORIZON]
    while len(revenue) < HORIZON:
        revenue.append(0)
    while len(net) < HORIZON:
        net.append(0)
    while len(ebit) < HORIZON:
        ebit.append(0)

    fig, ax = plt.subplots(figsize=(10, 5))
    ax.plot(years, revenue, marker="o", color=CLR_BLUE, linewidth=2, label="Chiffre d'affaires HT")
    ax.plot(years, ebit, marker="s", color=CLR_TEAL, linewidth=2, label="Resultat exploitation")
    ax.plot(years, net, marker="^", color=CLR_GREEN, linewidth=2, label="Resultat net")
    ax.set_xlabel("Annee")
    ax.set_ylabel("DT")
    ax.set_title("Evolution des resultats previsionnels", fontsize=12, color=CLR_BLUE, fontweight="bold")
    ax.legend(loc="best", fontsize=9)
    ax.grid(True, alpha=0.3)
    ax.set_xticks(years)
    plt.tight_layout()
    plt.savefig(path, dpi=150, bbox_inches="tight", facecolor="white")


def _chart_cumulative_treasury(data: dict, path: Path) -> None:
    _mpl_readability()
    years = list(range(1, HORIZON + 1))
    cum = data.get("cumulative_treasury", [0] * HORIZON)[:HORIZON]
    investment = float(data.get("total_investment", 0))
    drci = data.get("drci_years")
    while len(cum) < HORIZON:
        cum.append(0)

    fig, ax = plt.subplots(figsize=(10, 5))
    colors = [CLR_GREEN if v >= 0 else CLR_RED for v in cum]
    ax.bar(years, cum, color=colors, alpha=0.85, label="Tresorerie cumulee")
    ax.axhline(investment, color=CLR_ORANGE, linestyle="--", linewidth=2, label="Investissement initial")
    if drci and 1 <= float(drci) <= HORIZON:
        yi = int(round(float(drci)))
        ax.annotate(
            "DRCI",
            xy=(yi, cum[yi - 1]),
            xytext=(yi, cum[yi - 1] * 1.05 if cum[yi - 1] else investment),
            fontsize=10,
            color=CLR_ORANGE,
            fontweight="bold",
        )
    ax.set_xlabel("Annee")
    ax.set_ylabel("DT")
    ax.set_title("Cash-flows cumules et delai de recuperation", fontsize=12, color=CLR_BLUE, fontweight="bold")
    ax.legend(loc="best", fontsize=9)
    ax.grid(True, axis="y", alpha=0.3)
    plt.tight_layout()
    plt.savefig(path, dpi=150, bbox_inches="tight", facecolor="white")


def _chart_cost_structure(data: dict, path: Path) -> None:
    _mpl_readability()
    labels = data.get("labels", ["Achats", "Personnel", "DAP", "Autres"])
    values = data.get("values", [1, 1, 1, 1])
    if not any(values):
        values = [1, 1, 1, 1]
    explode = [0.05 if i == values.index(max(values)) else 0 for i in range(len(values))]

    fig, ax = plt.subplots(figsize=(8, 6))
    ax.pie(
        values,
        labels=labels,
        autopct="%1.1f%%",
        startangle=90,
        explode=explode,
        colors=[CLR_BLUE, CLR_TEAL, CLR_ORANGE, CLR_GREEN],
        textprops={"color": "#333333", "fontsize": 9},
    )
    _style_pie_labels(ax)
    ax.set_title("Structure des couts (moyenne 7 ans)", fontsize=12, color=CLR_BLUE, fontweight="bold")
    plt.tight_layout()
    plt.savefig(path, dpi=150, bbox_inches="tight", facecolor="white")


def _chart_ca_by_product(data: dict, path: Path) -> None:
    _mpl_readability()
    years = list(range(1, HORIZON + 1))
    products: dict[str, list[float]] = data.get("by_product", {})
    if not products:
        products = {"Produit": data.get("revenue", [0] * HORIZON)}

    fig, ax = plt.subplots(figsize=(10, 5))
    bottom = [0.0] * HORIZON
    palette = [CLR_BLUE, CLR_TEAL, CLR_GREEN, CLR_ORANGE, CLR_RED, "#6699CC", "#996633"]
    for i, (name, vals) in enumerate(products.items()):
        v = (list(vals) + [0] * HORIZON)[:HORIZON]
        ax.bar(years, v, bottom=bottom, label=name[:30], color=palette[i % len(palette)])
        bottom = [bottom[j] + v[j] for j in range(HORIZON)]
    ax.set_xlabel("Annee")
    ax.set_ylabel("CA HT (DT)")
    ax.set_title("Chiffre d'affaires par produit", fontsize=12, color=CLR_BLUE, fontweight="bold")
    ax.legend(loc="upper left", fontsize=8)
    ax.set_xticks(years)
    plt.tight_layout()
    plt.savefig(path, dpi=150, bbox_inches="tight", facecolor="white")


def generate_all_charts(plan_chart_data: dict[str, Any], out_dir: str | Path) -> dict[str, str]:
    """Generate all four charts; returns {chart_type: path}."""
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    mapping = {
        "results_evolution": "chart_results.png",
        "cumulative_treasury": "chart_treasury.png",
        "cost_structure": "chart_costs.png",
        "ca_by_product": "chart_ca_products.png",
    }
    paths: dict[str, str] = {}
    for ctype, fname in mapping.items():
        p = out / fname
        create_chart_png(plan_chart_data, ctype, str(p))
        paths[ctype] = str(p)
    return paths
