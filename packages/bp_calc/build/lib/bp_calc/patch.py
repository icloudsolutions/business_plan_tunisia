"""Safe JSON-pointer style patches for simulation scenarios."""

from typing import Any

from bp_schema.liasse import PlanInputs

ALLOWED_PATCH_PREFIXES = (
    "company",
    "investments",
    "operations",
    "financing",
    "workingCapital",
    "plAssumptions",
)


class PatchError(ValueError):
    pass


def apply_patch(
    inputs: PlanInputs,
    path: str,
    value: Any = None,
    multiplier: float | None = None,
) -> PlanInputs:
    parts = [p for p in path.strip("/").split("/") if p]
    if not parts:
        raise PatchError("Chemin de patch vide")
    if parts[0] not in ALLOWED_PATCH_PREFIXES:
        raise PatchError(f"Préfixe non autorisé: {parts[0]}")

    data = inputs.model_dump()
    ref: Any = data
    for key in parts[:-1]:
        if isinstance(ref, dict):
            if key not in ref:
                raise PatchError(f"Clé introuvable: {key}")
            ref = ref[key]
        elif isinstance(ref, list):
            if not key.isdigit():
                raise PatchError(f"Index attendu pour liste, reçu: {key}")
            idx = int(key)
            if idx < 0 or idx >= len(ref):
                raise PatchError(f"Index hors limites: {idx}")
            ref = ref[idx]
        else:
            raise PatchError(f"Navigation impossible sur {type(ref)}")

    last = parts[-1]
    if isinstance(ref, dict):
        if last not in ref:
            raise PatchError(f"Champ introuvable: {last}")
        current = ref[last]
        if multiplier is not None:
            if not isinstance(current, (int, float)):
                raise PatchError("Multiplicateur applicable uniquement aux nombres")
            ref[last] = current * multiplier
        elif value is not None:
            ref[last] = value
        else:
            raise PatchError("value ou multiplier requis")
    elif isinstance(ref, list) and last.isdigit():
        idx = int(last)
        if idx < 0 or idx >= len(ref):
            raise PatchError(f"Index hors limites: {idx}")
        current = ref[idx]
        if multiplier is not None:
            ref[idx] = current * multiplier
        elif value is not None:
            ref[idx] = value
        else:
            raise PatchError("value ou multiplier requis")
    else:
        raise PatchError(f"Cible de patch invalide: {last}")

    return PlanInputs.model_validate(data)
