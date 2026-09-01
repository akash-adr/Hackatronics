"""
Pure trigonometric core of the wind-warping model.

Deliberately contains NO geography: no latitude, no longitude, no map
projection, no Earth radius. Everything here is angles and multipliers, which
makes it verifiable on its own without any coordinate reasoning.

CALIBRATION OF k AND alpha_max (Section 9 procedure)
----------------------------------------------------
These defaults are derived, not guessed:

    1. Design-maximum wind speed for the demo range : 60 km/h
    2. Target alpha at that design maximum          : 0.45
       (visibly, obviously elongated without looking exaggerated)
    3. Solve for k : k = target_alpha / design_max = 0.45 / 60 = 0.0075
    4. alpha_max   : 0.6 hard ceiling

Resulting behaviour across the demo range:

    U =  5 km/h -> alpha = 0.0375   subtle elongation
    U = 20 km/h -> alpha = 0.15     clearly elongated
    U = 50 km/h -> alpha = 0.375    dramatically elongated
    U = 60 km/h -> alpha = 0.45     design maximum
    U = 80 km/h -> alpha = 0.6      ceiling first reached here

With k = 0.0075 the alpha_max ceiling only binds above 80 km/h, so it acts as
a genuine safety limit for absurd inputs rather than silently clamping normal
demo values.

NOTE: polygon_builder.wind_warped_polygon carries its own k default and passes
it through explicitly, so that default is kept in step with this one. Changing
k here alone would not change pipeline behaviour.

MODEL DISCLOSURE
----------------
This is a simplified, physics-motivated directional weighting -- not a CFD
simulation of atmospheric plume transport. It captures the correct
qualitative behaviour (downwind elongation, upwind compression, smooth
angular variation with no discontinuities) using a transparent, checkable
formula, in exchange for not modelling fine-grained turbulent structure.
"""

import math


def angle_diff(a, b):
    """
    Smallest signed difference from b to a, normalised into [-180, 180].

    A naive `a - b` can return 350 degrees when the true shortest path around
    the compass is -10. This wraps the result so it always represents the
    shortest signed way around the circle.

    This is the single most important function for preventing a visual glitch
    at the 0/360-degree boundary: without it the warped polygon develops a
    physically nonsensical kink exactly opposite the wind's origin.
    """
    return (a - b + 180) % 360 - 180


def wind_scaling_factor(theta_deg, wind_from_deg, wind_speed, k=0.0075, alpha_max=0.6):
    """
    Directional scaling multiplier S for one sample angle.

    Args:
        theta_deg:     sample angle around the source (bearing, clockwise
                       from north, 0-360)
        wind_from_deg: direction the wind blows FROM, meteorological
                       convention (315 = wind arriving from the north-west)
        wind_speed:    wind speed in km/h (units must match k's tuning)
        k:             how fast the stretch grows with wind speed
                       (0.0075 -> alpha 0.45 at the 60 km/h design maximum)
        alpha_max:     hard ceiling on the stretch/compression effect

    Returns:
        S -- multiply the no-wind base radius by this.
    """
    # Wind direction is reported as where the wind comes FROM, but the hazard
    # travels TOWARD the opposite bearing. Flipping this is the single most
    # likely sign error in the module: getting it backwards would stretch the
    # zone upwind, which is physically backwards and immediately visible as
    # wrong on screen.
    wind_to = (wind_from_deg + 180) % 360

    # How far this sample angle sits from the downwind direction, correctly
    # wrapped so the 0/360 boundary is seamless.
    delta = angle_diff(theta_deg, wind_to)

    # Stretch grows linearly with wind speed, capped so extreme winds cannot
    # produce an absurd shape. At alpha_max = 0.6 the tightest possible
    # compression still leaves the upwind radius at 1 - 0.6 = 40% of baseline,
    # so this formula alone can never reach zero or go negative.
    alpha = min(alpha_max, k * wind_speed)

    # Cosine is the natural choice because it already has the three required
    # behaviours built in:
    #   delta = 0    (downwind)  -> cos =  1 -> S = 1 + alpha  MAXIMUM stretch
    #   delta = +-90 (crosswind) -> cos =  0 -> S = 1          unchanged
    #   delta = 180  (upwind)    -> cos = -1 -> S = 1 - alpha  MAXIMUM compression
    # ...with a smooth, continuous transition between them and no jumps.
    return 1.0 + alpha * math.cos(math.radians(delta))
