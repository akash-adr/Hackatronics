"""
Validation tests for the TNT-equivalence blast model.

The Kinney & Graham correlation has a well-known reference point, so unlike
the thermal model this one can be checked against a published value.
"""

import math

import pytest

from physics.blast_model import (
    BLAST_BANDS,
    blast_overpressure_at,
    overpressure_kinney_graham,
    scaled_distance,
    tnt_equivalent_mass,
)
from physics.constants import PSI_TO_KPA, TNT_HEAT_OF_DETONATION


def test_blast_known_reference_case():
    # 10 tonnes of TNT produces roughly 5 psi at about 97.5 m.
    Z = 97.5 / (10000 ** (1 / 3))
    p = overpressure_kinney_graham(Z) / PSI_TO_KPA

    print(f"\n[reference case] 10 t TNT at 97.5 m: Z={Z:.4f}, p={p:.4f} psi (~5.0 expected)")

    assert abs(p - 5.0) / 5.0 < 0.25


def test_blast_monotonic():
    near = blast_overpressure_at(20, "propane", 500)[0]
    far = blast_overpressure_at(100, "propane", 500)[0]

    assert near > far


def test_zero_distance_no_crash():
    # At the blast centre the correlation is singular; it must saturate to
    # infinity rather than raise ZeroDivisionError.
    assert scaled_distance(0, 1000) == 0.0
    assert overpressure_kinney_graham(0) == float("inf")
    assert overpressure_kinney_graham(scaled_distance(0, 1000)) == float("inf")

    # And just off the centre it must return a real, very large number.
    p_near = overpressure_kinney_graham(scaled_distance(1e-6, 1000))
    assert math.isfinite(p_near)
    assert p_near > 0

    p_psi, w_tnt = blast_overpressure_at(1e-9, "propane", 500)
    assert w_tnt > 0
    assert p_psi > 0


def test_scaled_distance_no_charge_is_infinite():
    # No charge means no blast; infinity maps to zero overpressure downstream.
    assert scaled_distance(50, 0) == float("inf")
    assert overpressure_kinney_graham(float("inf")) == pytest.approx(0.0)


def test_tnt_equivalent_mass_matches_definition():
    # 1000 kg of fuel at exactly the TNT heat of detonation and unit yield
    # must return exactly 1000 kg of TNT.
    assert tnt_equivalent_mass(1000, TNT_HEAT_OF_DETONATION, 1.0) == pytest.approx(1000)

    # Yield factor scales the result linearly.
    assert tnt_equivalent_mass(1000, TNT_HEAT_OF_DETONATION, 0.1) == pytest.approx(100)


def test_charge_mass_independent_of_distance():
    # The reported TNT mass describes the inventory, not the receiver, so it
    # must not vary with r.
    masses = {blast_overpressure_at(r, "propane", 500)[1] for r in (10, 100, 1000)}

    assert len(masses) == 1


def test_blast_bands_shape():
    assert [b["label"] for b in BLAST_BANDS] == ["fatal", "structural", "glass_breakage"]
    assert [b["threshold_psi"] for b in BLAST_BANDS] == [8, 3, 1]
