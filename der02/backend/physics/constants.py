"""
Physical constants and unit conversions for the DER-02 hazard models.

Single source of truth: no other module in this package should hard-code any
of these values. Every entry is a scalar with a fixed unit, documented inline.
"""

# Gravitational acceleration at sea level, m/s^2.
# Used by the flame-height and flame-tilt correlations.
G = 9.81

# Ambient air density, kg/m^3.
# Nominal value for air at roughly 20 C and 1 atm; the flame-height
# correlation is normalised against it.
RHO_AIR = 1.2

# Standard atmospheric pressure, kPa.
# Reference (ambient) pressure for the blast overpressure correlation.
P0_KPA = 101.325

# Reference energy content of TNT, kJ/kg.
# Denominator of the TNT-equivalence mass conversion.
TNT_HEAT_OF_DETONATION = 4184

# Unit conversion: 1 psi expressed in kPa.
# Blast overpressures are computed in kPa and reported to users in psi.
PSI_TO_KPA = 6.895

# Assumed height of a standing person, m.
# The radiation receiver is placed at this height when evaluating the
# solid-flame view factor.
RECEIVER_HEIGHT_M = 1.5
