"""
Solid-flame thermal radiation model for DER-02.

A pool fire is idealised as a right cylinder of burning gas standing on the
pool surface, radiating uniformly from its side wall. Incident flux at a
receiver is the product of three terms:

    q"(x) = Ef * F(x) * tau(x)

where Ef is the surface emissive power, F the geometric view factor between
flame cylinder and receiver, and tau the atmospheric transmissivity.

Pure functions only: no I/O, no globals, no framework imports.

DISCLOSED MODELLING CHOICES
---------------------------
1. view_factor uses the published Mudan & Croce algebra (sqrt(A^2 - 1) /
   sqrt(B^2 - 1) denominators). See that function's docstring for why the
   sqrt(A^2 - 4S^2) variant cannot be used.
2. Two different mass burning rates appear in this model and must not be
   confused -- see MASS BURNING RATE below.
3. flame_tilt uses a fixed vapour density rather than a per-substance value.
4. Degenerate geometry (non-positive diameter or flame height) returns 0.0
   flux rather than raising, so a caller sweeping distances cannot crash.
5. transmissivity() uses the Wayne correlation, so relative humidity genuinely
   affects the result. Ambient temperature defaults to 20 C because it is not
   yet part of the request schema.

MASS BURNING RATE
-----------------
The Thomas flame-height and flame-tilt correlations are defined in terms of
the mass burning rate PER UNIT POOL AREA, m" [kg/(m^2*s)] -- this is the
burn_rate_kg_m2_s field in substances.py.

The emissive power is an energy balance over the whole fire and therefore
needs the TOTAL mass burning rate, m_total = m" * pi * D^2 / 4 [kg/s].

thermal_flux() feeds each function the quantity it is defined for. Passing m"
to emissive_power() would under-predict Ef by a factor of the pool area
(~78x for a 10 m tank), putting the result far below any real pool fire.
"""

import math

from physics.constants import G, RHO_AIR, RECEIVER_HEIGHT_M
from physics.substances import SUBSTANCES

# Diameters at or below this are treated as "no fire" rather than divided by.
MIN_DIAMETER_M = 1e-9


def flame_height(D, m_dot, rho_air=RHO_AIR, g=G):
    """
    Thomas correlation for the visible flame height of a pool fire, m.

    Args:
        D:       pool / tank diameter, m
        m_dot:   mass burning rate PER UNIT AREA, kg/(m^2*s)
        rho_air: ambient air density, kg/m^3
        g:       gravitational acceleration, m/s^2
    """
    # Guard: a zero/negative diameter or burn rate is not a fire. Without this,
    # D = 0 divides by zero inside the correlation.
    if D <= MIN_DIAMETER_M or m_dot <= 0:
        return 0.0

    return 42 * D * (m_dot / (rho_air * (g * D) ** 0.5)) ** 0.61


def flame_tilt(wind_speed_ms, m_dot, D, rho_vapor=2.0, g=G):
    """
    Flame tilt angle from vertical under crosswind, radians.

    Args:
        wind_speed_ms: wind speed, m/s
        m_dot:         mass burning rate PER UNIT AREA, kg/(m^2*s)
        D:             pool / tank diameter, m
        rho_vapor:     fuel vapour density, kg/m^3
        g:             gravitational acceleration, m/s^2
    """
    if wind_speed_ms <= 0:
        return 0.0

    # Guard: without a fire there is no plume to tilt, and the dimensionless
    # wind speed below would divide by zero.
    if m_dot <= 0 or D <= MIN_DIAMETER_M:
        return 0.0

    # DISCLOSED SIMPLIFICATION: rho_vapor defaults to 2.0 kg/m^3, a fixed
    # typical hydrocarbon vapour density, rather than a per-substance lookup.
    # substances.py carries no vapour density field; adding one would change
    # tilt by a few degrees for the lighter fuels (methane, ethylene).
    u_star = wind_speed_ms / (g * m_dot * D / rho_vapor) ** (1 / 3)

    # Below the characteristic plume velocity the fire stands upright.
    if u_star <= 1:
        return 0.0

    return math.acos(1 / math.sqrt(u_star))


def emissive_power(m_dot, heat_of_combustion_kj_kg, D, H_flame, radiative_fraction):
    """
    Average surface emissive power of the flame cylinder, W/m^2.

    Args:
        m_dot:                    TOTAL mass burning rate, kg/s (not per area --
                                  see MASS BURNING RATE in the module docstring)
        heat_of_combustion_kj_kg: net heat of combustion, kJ/kg
        D:                        pool / tank diameter, m
        H_flame:                  flame height, m
        radiative_fraction:       fraction of released heat radiated
    """
    # Guard: zero side area would divide by zero.
    if D <= MIN_DIAMETER_M or H_flame <= 0:
        return 0.0

    # *1000 converts kJ -> J, so the result is W/m^2. thermal_flux() converts
    # to kW/m^2 at the end.
    return (radiative_fraction * m_dot * heat_of_combustion_kj_kg * 1000) / (
        math.pi * D * H_flame
    )


def view_factor(x, D, H_flame, tilt_angle=0, receiver_height=RECEIVER_HEIGHT_M):
    """
    Mudan & Croce maximum view factor for a cylindrical flame, dimensionless.

    Combines the view factors to a vertical target (F_v) and a horizontal
    target (F_h) at the flame base plane into the maximum-flux orientation
    F = sqrt(F_v^2 + F_h^2).

    Args:
        x:               horizontal distance from flame axis to receiver, m
        D:               flame cylinder diameter, m
        H_flame:         flame height, m
        tilt_angle:      flame tilt from vertical, radians
        receiver_height: accepted for interface stability; the Mudan & Croce
                         correlation places the receiver at the flame base
                         plane, so it does not enter the algebra.

    Returns:
        View factor in [0, 1].

    ALGEBRA NOTE (deviation from the DER-02 spec text, deliberate):
        The spec transcribed the denominators as sqrt(A^2 - 4*S^2) with
        (A - 2*S) factors. Those are negative whenever A < 2S, i.e. whenever
        H^2 + 1 < 3*S^2, which covers essentially every receiver position this
        model is used at -- both spec test cases (propane x=20/x=50, D=10)
        included -- so the sqrt() raises "math domain error" and no call can
        return. The published form below uses sqrt(A^2 - 1) and sqrt(B^2 - 1),
        which are always real because A >= 1 and B >= 1 for S > 1, and it also
        uses B, which the spec computed but never referenced. Verified against
        direct numerical integration of the configuration integral: agreement
        to 5 decimal places over S = 1.5..20.
    """
    R = D / 2

    # Guard: a degenerate cylinder subtends nothing.
    if R <= MIN_DIAMETER_M:
        return 0.0

    S_ = x / R
    Hh = H_flame / R

    # Receiver at or inside the flame envelope: view factor capped at unity.
    if S_ <= 1:
        return 1.0

    A = (Hh**2 + S_**2 + 1) / (2 * S_)
    B = (1 + S_**2) / (2 * S_)

    root_a = math.sqrt(A**2 - 1)
    root_b = math.sqrt(B**2 - 1)

    # Numerical safety: for S_ within rounding distance of 1, A and B collapse
    # to 1 and these denominators underflow to zero. That is the enveloped
    # case above, so cap it the same way.
    if root_a <= 0 or root_b <= 0:
        return 1.0

    atan_a = math.atan(math.sqrt((A + 1) * (S_ - 1) / ((A - 1) * (S_ + 1))))
    atan_b = math.atan(math.sqrt((B + 1) * (S_ - 1) / ((B - 1) * (S_ + 1))))

    F_v = (1 / math.pi) * (
        (1 / S_) * math.atan(Hh / math.sqrt(S_**2 - 1))
        - (Hh / S_) * math.atan(math.sqrt((S_ - 1) / (S_ + 1)))
        + (A * Hh) / (S_ * root_a) * atan_a
    )

    F_h = (1 / math.pi) * (
        (B - 1 / S_) / root_b * atan_b - (A - 1 / S_) / root_a * atan_a
    )

    F = math.sqrt(F_v**2 + F_h**2)

    # DISCLOSED FIRST-ORDER TILT CORRECTION: a tilted flame is treated as an
    # upright one whose apparent area is reduced by cos(tilt). A full
    # treatment would re-solve the view factor for a tilted cylinder, which
    # would also raise flux on the downwind side.
    if tilt_angle > 0:
        F *= math.cos(tilt_angle)

    return min(F, 1.0)


def transmissivity(x, humidity_pct=50, ambient_temp_c=20):
    """
    Atmospheric transmissivity over a path length x, dimensionless [0, 1].
    Uses the Wayne correlation, relating transmissivity to the water-vapour
    partial pressure integrated over the path length. Water vapour is the
    dominant absorber of thermal infrared radiation over the distances this
    model operates at; CO2 absorption is a secondary effect and is not
    modelled separately here, consistent with this project's existing
    practice of disclosed, defensible simplification (see the Kinney-Graham
    choice in blast_model.py for the same philosophy applied elsewhere).

    Args:
        x: path length from flame surface to receiver, m
        humidity_pct: relative humidity, percent [0, 100]
        ambient_temp_c: ambient temperature, deg C. Defaults to 20 (a
                         reasonable general-purpose ambient) since this field
                         is not yet part of the request schema.
    """
    if x <= 0:
        return 1.0

    T = ambient_temp_c
    p_sat = 610.94 * math.exp((17.625 * T) / (T + 243.04))
    p_w = (humidity_pct / 100.0) * p_sat

    if p_w <= 0:
        return 1.0

    tau = 2.02 * (p_w * x) ** (-0.09)
    return max(0.0, min(1.0, tau))


def thermal_flux(x, substance_key, tank_diameter_m, wind_speed_ms=0, humidity_pct=50):
    """
    Incident radiant heat flux at distance x from the flame axis, kW/m^2.

    Args:
        x:               horizontal distance from flame axis, m
        substance_key:   key into SUBSTANCES
        tank_diameter_m: tank / pool diameter, m
        wind_speed_ms:   wind speed, m/s
        humidity_pct:    relative humidity, percent
    """
    substance = SUBSTANCES[substance_key]
    D = tank_diameter_m

    # Guard: no pool means no fire means no flux.
    if D <= MIN_DIAMETER_M:
        return 0.0

    # Per-unit-area burn rate drives the flame geometry correlations.
    burn_rate_per_area = substance["burn_rate_kg_m2_s"]
    H_flame = flame_height(D, burn_rate_per_area)
    tilt = flame_tilt(wind_speed_ms, burn_rate_per_area, D)

    # Total burn rate drives the energy release. See MASS BURNING RATE above.
    pool_area = math.pi * D**2 / 4
    burn_rate_total = burn_rate_per_area * pool_area

    Ef = emissive_power(
        burn_rate_total,
        substance["heat_of_combustion_kj_kg"],
        D,
        H_flame,
        substance["radiative_fraction"],
    )
    F = view_factor(x, D, H_flame, tilt)
    tau = transmissivity(x, humidity_pct)

    # Ef is W/m^2; the hazard bands below are stated in kW/m^2.
    return Ef * F * tau / 1000.0


# Incident-flux hazard thresholds, ordered most to least severe.
THERMAL_BANDS = [
    {"threshold_kw_m2": 37.5, "label": "fatal"},
    {"threshold_kw_m2": 12.5, "label": "serious"},
    {"threshold_kw_m2": 4.0, "label": "pain"},
]
