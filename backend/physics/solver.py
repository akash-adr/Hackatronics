"""
Generic root-finder shared by the thermal and blast hazard models.

Both models answer the same question in different units: "at what distance
does this hazard drop to a given threshold?" Both are monotonically
decreasing in distance, so one bisection routine serves both.
"""


def find_radius_for_threshold(value_func, threshold, x_min=0.5, x_max=2000, iterations=60):
    """
    Generic bisection solver. value_func must be monotonically decreasing in x.

    Args:
        value_func: callable(x: float) -> float, monotonically decreasing.
        threshold:  hazard level whose crossing distance we are solving for.
        x_min:      inner edge of the search range, m.
        x_max:      outer edge of the search range, m.
        iterations: number of bisection steps (each halves the interval).

    Returns:
        dict with:
            "radius_m": float -- distance at which value_func crosses threshold
            "clipped":  bool  -- True if no crossing exists inside the range
            "reason":   str   -- present only when clipped, explains which end

    The two clipped cases are reported rather than papered over, so callers can
    tell "the threshold is never reached" and "the threshold is still exceeded
    past the search boundary" apart from a genuine crossing.
    """
    # Case 1: hazard is already below the threshold at the closest range we
    # model, so this threshold is never reached. x_min is a floor, not a
    # crossing -- flag it rather than returning a meaningless radius.
    if value_func(x_min) < threshold:
        return {"radius_m": float(x_min), "clipped": True, "reason": "below_min_range"}

    # Case 2: hazard is still above the threshold at the outer search boundary.
    # The real crossing lies somewhere beyond x_max; report x_max as a clipped
    # lower bound rather than as if it were the crossing point.
    if value_func(x_max) > threshold:
        return {"radius_m": float(x_max), "clipped": True, "reason": "beyond_max_range"}

    # Case 3: a crossing is bracketed by [x_min, x_max]. Because value_func
    # decreases, the invariant maintained below is:
    #     value_func(low) >= threshold >= value_func(high)
    low, high = float(x_min), float(x_max)
    for _ in range(iterations):
        mid = (low + high) / 2
        if value_func(mid) > threshold:
            low = mid   # still above threshold -> crossing is farther out
        else:
            high = mid  # at or below threshold -> crossing is nearer in

    return {"radius_m": round((low + high) / 2, 1), "clipped": False}
