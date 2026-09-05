"""
TNT-equivalence blast overpressure model for DER-02.

The fuel inventory is converted to an energy-equivalent mass of TNT, and the
Kinney & Graham correlation maps scaled distance to peak side-on
overpressure.

Pure functions only: no I/O, no globals, no framework imports.
"""

import math

from physics.constants import P0_KPA, PSI_TO_KPA, TNT_HEAT_OF_DETONATION
from physics.substances import SUBSTANCES


# Scaled distances beyond this produce immeasurably small overpressure; used
# to keep the correlation finite for vanishing charge masses.
Z_NEGLIGIBLE = 1e6


def tnt_equivalent_mass(fuel_mass_kg, heat_of_combustion_kj_kg, alpha):
    """
    Energy-equivalent mass of TNT for a fuel inventory, kg.

    Args:
        fuel_mass_kg:             total fuel mass in the tank, kg
        heat_of_combustion_kj_kg: net heat of combustion, kJ/kg
        alpha:                    explosion yield factor, dimensionless

    alpha accounts for the fact that only a small fraction of a fuel's
    chemical energy converts to blast overpressure in a real vapour cloud
    explosion.
    """
    return alpha * fuel_mass_kg * (heat_of_combustion_kj_kg / TNT_HEAT_OF_DETONATION)


def scaled_distance(r_m, w_tnt_kg):
    """
    Hopkinson-Cranz scaled distance Z, m/kg^(1/3).

    Args:
        r_m:      distance from the blast centre, m
        w_tnt_kg: TNT-equivalent charge mass, kg

    Returns:
        Z, or infinity when there is no charge (no charge, no blast -- the
        overpressure correlation maps large Z to zero overpressure).
    """
    if w_tnt_kg <= 0:
        return float("inf")

    return r_m / (w_tnt_kg ** (1 / 3))


def overpressure_kinney_graham(Z, P0=P0_KPA):
    """
    Kinney & Graham peak side-on overpressure, kPa.

    Args:
        Z:  scaled distance, m/kg^(1/3)
        P0: ambient pressure, kPa

    Returns:
        Overpressure in kPa, or infinity at the blast centre (Z <= 0), where
        the correlation is singular and has no physical meaning.
    """
    if Z <= 0:
        return float("inf")

    # Guard (addition to the spec formula): Z is infinite when there is no
    # charge, and can be astronomically large for a near-empty tank. The
    # correlation's limit as Z -> inf is zero overpressure, but evaluating it
    # directly gives inf/inf = NaN (or raises OverflowError on the squares),
    # and a NaN would propagate silently through the bisection solver.
    if not math.isfinite(Z) or Z > Z_NEGLIGIBLE:
        return 0.0

    numerator = 808 * (1 + (Z / 4.5) ** 2)
    denom = math.sqrt(
        (1 + (Z / 0.048) ** 2) * (1 + (Z / 0.32) ** 2) * (1 + (Z / 1.35) ** 2)
    )

    return P0 * (numerator / denom)


def blast_overpressure_at(r_m, substance_key, tank_volume_m3):
    """
    Peak side-on overpressure at distance r_m from a tank explosion.

    Args:
        r_m:            distance from the blast centre, m
        substance_key:  key into SUBSTANCES
        tank_volume_m3: tank capacity, m^3

    Returns:
        (overpressure_psi, w_tnt_kg) -- the overpressure in psi and the
        TNT-equivalent charge mass in kg, returned alongside so callers can
        report the basis of the estimate.
    """
    substance = SUBSTANCES[substance_key]

    fuel_mass_kg = tank_volume_m3 * substance["density_kg_m3"]
    w_tnt = tnt_equivalent_mass(
        fuel_mass_kg,
        substance["heat_of_combustion_kj_kg"],
        substance["tnt_equivalence_factor"],
    )
    Z = scaled_distance(r_m, w_tnt)
    p_kpa = overpressure_kinney_graham(Z)

    return (p_kpa / PSI_TO_KPA, w_tnt)


# Peak overpressure hazard thresholds, ordered most to least severe.
BLAST_BANDS = [
    {"threshold_psi": 8, "label": "fatal"},
    {"threshold_psi": 3, "label": "structural"},
    {"threshold_psi": 1, "label": "glass_breakage"},
]
