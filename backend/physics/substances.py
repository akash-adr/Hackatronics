"""
Reference property table for the substances DER-02 can model.

The numeric values are taken from published reference tables (per-entry
"source" field) and are deliberately not derived or adjusted here -- this
module is data, not computation.

Field units
-----------
heat_of_combustion_kj_kg : net heat of combustion, kJ/kg
density_kg_m3            : liquid density at storage conditions, kg/m^3
burn_rate_kg_m2_s        : mass burning rate per unit pool area, kg/(m^2*s)
tnt_equivalence_factor   : dimensionless yield factor for TNT equivalence
radiative_fraction       : fraction of released heat emitted as radiation
boiling_point_c          : atmospheric boiling point, degrees C
display_name             : human-readable label for the UI
source                   : provenance of the numeric values above
"""

SUBSTANCES = {
    "propane": {
        "heat_of_combustion_kj_kg": 46000,
        "density_kg_m3": 493,
        "burn_rate_kg_m2_s": 0.099,
        "tnt_equivalence_factor": 0.10,
        "radiative_fraction": 0.30,
        "boiling_point_c": -42,
        "display_name": "Propane (LPG)",
        "source": "NFPA 30 / CHRIS Manual reference tables",
    },
    "gasoline": {
        "heat_of_combustion_kj_kg": 43700,
        "density_kg_m3": 740,
        "burn_rate_kg_m2_s": 0.055,
        "tnt_equivalence_factor": 0.03,
        "radiative_fraction": 0.25,
        "boiling_point_c": 100,
        "display_name": "Gasoline",
        "source": "CHRIS Manual reference tables",
    },
    "lng_methane": {
        "heat_of_combustion_kj_kg": 50000,
        "density_kg_m3": 425,
        "burn_rate_kg_m2_s": 0.078,
        "tnt_equivalence_factor": 0.10,
        "radiative_fraction": 0.20,
        "boiling_point_c": -162,
        "display_name": "LNG (Methane)",
        "source": "LNGFIRE3 reference data / FERC guidance",
    },
    "crude_oil": {
        "heat_of_combustion_kj_kg": 42000,
        "density_kg_m3": 870,
        "burn_rate_kg_m2_s": 0.045,
        "tnt_equivalence_factor": 0.03,
        "radiative_fraction": 0.35,
        "boiling_point_c": 250,
        "display_name": "Crude Oil",
        "source": "API RP 521 reference tables",
    },
    "ethylene": {
        "heat_of_combustion_kj_kg": 47200,
        "density_kg_m3": 567,
        "burn_rate_kg_m2_s": 0.121,
        "tnt_equivalence_factor": 0.06,
        "radiative_fraction": 0.25,
        "boiling_point_c": -104,
        "display_name": "Ethylene",
        "source": "CHRIS Manual (ARCHIE model reference case)",
    },
}
