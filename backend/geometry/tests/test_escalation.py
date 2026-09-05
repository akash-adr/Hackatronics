"""Tests for multi-tank escalation detection."""

from geometry.escalation import check_escalation_risk


def test_second_facility_inside_fatal_band_flagged():
    fake_bands = [
        {"label": "pain", "threshold_kw_m2": 4.0, "radius_no_wind_m": 210, "clipped": False,
         "polygon": [(13.09, 80.28), (13.09, 80.26), (13.07, 80.26), (13.07, 80.28), (13.09, 80.28)]},
        {"label": "fatal", "threshold_kw_m2": 37.5, "radius_no_wind_m": 62, "clipped": False,
         "polygon": [(13.083, 80.272), (13.083, 80.270), (13.082, 80.270), (13.082, 80.272), (13.083, 80.272)]},
    ]
    result = check_escalation_risk(13.0825, 80.271, fake_bands)
    assert result["at_risk"] == True
    assert result["band_label"] == "fatal"  # most severe band it falls within


def test_second_facility_outside_all_bands_not_flagged():
    fake_bands = [
        {"label": "fatal", "threshold_kw_m2": 37.5, "radius_no_wind_m": 62, "clipped": False,
         "polygon": [(13.083, 80.272), (13.083, 80.270), (13.082, 80.270), (13.082, 80.272), (13.083, 80.272)]},
    ]
    result = check_escalation_risk(20.0, 90.0, fake_bands)
    assert result["at_risk"] == False


def test_clipped_band_never_used_for_escalation_claim():
    fake_bands = [
        {"label": "pain", "threshold_kw_m2": 4.0, "radius_no_wind_m": 210, "clipped": True,
         "polygon": [(13.09, 80.28), (13.09, 80.26), (13.07, 80.26), (13.07, 80.28), (13.09, 80.28)]},
    ]
    # Point is geometrically inside this polygon, but the band is clipped/untrustworthy
    result = check_escalation_risk(13.08, 80.27, fake_bands)
    assert result["at_risk"] == False  # clipped band must never trigger an escalation claim
