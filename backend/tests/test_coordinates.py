import pytest
from app.services.coordinate_transform import CoordinateTransformer

def test_screen_to_canvas_basic():
    # 1.0 zoom, 0 pan
    cx, cy = CoordinateTransformer.screen_to_canvas(100.0, 150.0, 0.0, 0.0, 1.0)
    assert cx == 100.0
    assert cy == 150.0

def test_screen_to_canvas_with_zoom_and_pan():
    # 2.0 zoom, (50, 50) pan
    cx, cy = CoordinateTransformer.screen_to_canvas(250.0, 350.0, 50.0, 50.0, 2.0)
    assert cx == (250.0 - 50.0) / 2.0  # 100.0
    assert cy == (350.0 - 50.0) / 2.0  # 150.0

def test_canvas_to_image_scaling():
    # Canvas is 500x500, Image is 1000x1000
    ix, iy = CoordinateTransformer.canvas_to_image(250.0, 250.0, 500.0, 500.0, 1000, 1000)
    assert ix == 500
    assert iy == 500

def test_screen_to_image_roundtrip():
    # Test round trip image -> screen -> image
    orig_ix, orig_iy = 345, 678
    pan_x, pan_y = 120.0, -80.0
    zoom = 1.85
    canvas_w, canvas_h = 600.0, 600.0
    image_w, image_h = 1200, 1200

    sx, sy = CoordinateTransformer.image_to_screen(
        orig_ix, orig_iy, pan_x, pan_y, zoom, canvas_w, canvas_h, image_w, image_h
    )

    re_ix, re_iy = CoordinateTransformer.screen_to_image(
        sx, sy, pan_x, pan_y, zoom, canvas_w, canvas_h, image_w, image_h
    )

    assert abs(re_ix - orig_ix) <= 1
    assert abs(re_iy - orig_iy) <= 1
