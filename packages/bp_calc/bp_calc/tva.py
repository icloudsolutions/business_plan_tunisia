"""TVA — weighted rate from Liasse tax regime."""


def weighted_vat_rate(tva_rates: list) -> float:
    if not tva_rates:
        return 0.19
    rates = [getattr(r, "rate", r.get("rate", 0.19)) if isinstance(r, dict) else r.rate for r in tva_rates]
    return sum(rates) / len(rates)


def vat_on_amount(amount: float, rate: float) -> float:
    return amount * rate
