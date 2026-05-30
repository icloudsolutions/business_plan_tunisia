import pytest

from bp_calc.patch import PatchError, apply_patch
from bp_schema.liasse import PlanInputs


def test_apply_patch_multiplier():
    inputs = PlanInputs(operations={"rawMaterialCost": 100.0})
    patched = apply_patch(inputs, "operations/rawMaterialCost", multiplier=1.15)
    assert patched.operations.rawMaterialCost == pytest.approx(115.0)


def test_apply_patch_invalid_prefix():
    inputs = PlanInputs()
    with pytest.raises(PatchError):
        apply_patch(inputs, "secret/field", value=1)
