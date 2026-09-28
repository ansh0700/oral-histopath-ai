from typing import Tuple, Dict, Any

class CoordinateTransformer:
    """
    Transforms coordinates accurately between Screen Space, Canvas Space, and Original Image Space.
    Formula:
      CanvasX = (ScreenX - PanX) / Zoom
      CanvasY = (ScreenY - PanY) / Zoom
      ImageX  = CanvasX * (ImageWidth / DisplayCanvasWidth)
      ImageY  = CanvasY * (ImageHeight / DisplayCanvasHeight)
    """
    @staticmethod
    def screen_to_canvas(screen_x: float, screen_y: float, pan_x: float, pan_y: float, zoom: float) -> Tuple[float, float]:
        if zoom <= 0:
            zoom = 1.0
        canvas_x = (screen_x - pan_x) / zoom
        canvas_y = (screen_y - pan_y) / zoom
        return canvas_x, canvas_y

    @staticmethod
    def canvas_to_image(
        canvas_x: float,
        canvas_y: float,
        canvas_w: float,
        canvas_h: float,
        image_w: int,
        image_h: int
    ) -> Tuple[int, int]:
        scale_x = image_w / canvas_w if canvas_w > 0 else 1.0
        scale_y = image_h / canvas_h if canvas_h > 0 else 1.0

        img_x = int(round(canvas_x * scale_x))
        img_y = int(round(canvas_y * scale_y))

        # Clamp within image bounds
        img_x = max(0, min(image_w - 1, img_x))
        img_y = max(0, min(image_h - 1, img_y))
        return img_x, img_y

    @staticmethod
    def screen_to_image(
        screen_x: float,
        screen_y: float,
        pan_x: float,
        pan_y: float,
        zoom: float,
        canvas_w: float,
        canvas_h: float,
        image_w: int,
        image_h: int
    ) -> Tuple[int, int]:
        cx, cy = CoordinateTransformer.screen_to_canvas(screen_x, screen_y, pan_x, pan_y, zoom)
        return CoordinateTransformer.canvas_to_image(cx, cy, canvas_w, canvas_h, image_w, image_h)

    @staticmethod
    def image_to_screen(
        image_x: int,
        image_y: int,
        pan_x: float,
        pan_y: float,
        zoom: float,
        canvas_w: float,
        canvas_h: float,
        image_w: int,
        image_h: int
    ) -> Tuple[float, float]:
        scale_x = canvas_w / image_w if image_w > 0 else 1.0
        scale_y = canvas_h / image_h if image_h > 0 else 1.0

        canvas_x = image_x * scale_x
        canvas_y = image_y * scale_y

        screen_x = canvas_x * zoom + pan_x
        screen_y = canvas_y * zoom + pan_y
        return screen_x, screen_y
