"""
Physics engine for DER-02: Threat-Zone Estimation.

Module 1 -- pure computation only. Nothing in this package imports a web
framework, touches a database, performs I/O, or mutates global state. Every
function here is deterministic: same inputs -> same outputs.

Layout:
    constants.py   physical + unit-conversion constants
    substances.py  reference property table for the modelled substances
    solver.py      generic bisection root-finder shared by the hazard models
"""
