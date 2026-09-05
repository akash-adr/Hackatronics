"""
Wind-Adaptive Geometry Engine (Module 2) for DER-02.

Module 1 answers "how far does each severity threshold reach?" as a single
symmetric, no-wind radius per band. This package answers the next question --
"which direction is actually worse?" -- by warping those radii into a
directional polygon: elongated downwind, compressed upwind, neutral crosswind.

This package performs NO physics. It never recomputes, re-derives, or adjusts
any quantity Module 1 produced; it only transforms already-correct radii
geometrically. backend/physics/ is frozen and is never modified from here.

Layout:
    wind_scaling.py     pure trigonometry -- no geography, no lat/lon
    polygon_builder.py  geography: scaled radius + bearing -> lat/lon points

The split is deliberate: a bug in the scaling curve and a bug in the
coordinate conversion produce very different symptoms and stay separately
diagnosable.
"""
