import numpy as np
import pytest

from neurofly_data.compass_cells import (
    WEDGE_ORDER,
    back_view_angle,
    check_ring,
    circular_mean,
    glomerulus,
)


def test_glomerulus_reads_the_bridge_side_and_column() -> None:
    assert glomerulus("EPG(PB08)_R2") == "R2"
    assert glomerulus("PEN_b(PB06b)_L9") == "L9"
    assert glomerulus("EL_L") is None
    assert glomerulus("Delta7(PB15)_L4R5_R") is None


def test_wedges_alternate_between_bridge_sides() -> None:
    assert len(WEDGE_ORDER) == 16
    assert len(set(WEDGE_ORDER)) == 16
    sides = [name[0] for name in WEDGE_ORDER]
    assert all(a != b for a, b in zip(sides, sides[1:], strict=False))


def test_circular_mean_wraps_through_zero() -> None:
    assert circular_mean([350.0, 10.0]) == pytest.approx(0.0, abs=1e-9) or circular_mean(
        [350.0, 10.0]
    ) == pytest.approx(360.0, abs=1e-9)
    assert circular_mean([80.0, 100.0]) == pytest.approx(90.0)


def test_back_view_puts_the_flys_left_on_the_left() -> None:
    # MaleCNS x grows toward the fly's left, y grows ventrally.
    assert back_view_angle(np.array([0.0, -1.0, 0.0])) == pytest.approx(0.0)
    assert back_view_angle(np.array([1.0, 0.0, 0.0])) == pytest.approx(270.0)
    assert back_view_angle(np.array([-1.0, 0.0, 0.0])) == pytest.approx(90.0)


def test_ring_check_rejects_wedges_out_of_order() -> None:
    check_ring([index * 22.5 for index in range(16)])
    shuffled = [index * 22.5 for index in range(16)]
    shuffled[3], shuffled[9] = shuffled[9], shuffled[3]
    with pytest.raises(SystemExit, match="in order"):
        check_ring(shuffled)
