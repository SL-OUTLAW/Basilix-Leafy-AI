import cv2
import numpy as np
from ultralytics.utils import ops


def is_box_edge(point_a, point_b, box, tolerance=3):
    x1, y1, x2, y2 = box

    return (
        (abs(point_a[0] - x1) <= tolerance and abs(point_b[0] - x1) <= tolerance)
        or (abs(point_a[0] - x2) <= tolerance and abs(point_b[0] - x2) <= tolerance)
        or (abs(point_a[1] - y1) <= tolerance and abs(point_b[1] - y1) <= tolerance)
        or (abs(point_a[1] - y2) <= tolerance and abs(point_b[1] - y2) <= tolerance)
    )


def draw_analysis(image, result, plants):
    annotated = image.copy()
    height, width = image.shape[:2]

    if result.masks is not None:
        scaled_masks = (
            ops.scale_masks(
                result.masks.data[None].float(),
                (height, width)
            )[0] > 0.5
        ).byte().cpu().numpy()

        boxes = result.boxes.xyxy.cpu().tolist()

        for mask, box in zip(scaled_masks, boxes):
            contours, _ = cv2.findContours(
                mask,
                cv2.RETR_EXTERNAL,
                cv2.CHAIN_APPROX_SIMPLE
            )

            for contour in contours:
                points = contour.reshape(-1, 2)

                if len(points) < 2:
                    continue

                for point_a, point_b in zip(
                    points,
                    np.roll(points, -1, axis=0)
                ):
                    if not is_box_edge(point_a, point_b, box):
                        cv2.line(
                            annotated,
                            tuple(point_a),
                            tuple(point_b),
                            (255, 255, 255),
                            2
                        )

    for plant in plants:
        x = plant["label_center"]["x"]
        y = plant["label_center"]["y"]

        text = str(plant["id"])
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.5
        thickness = 2

        (text_width, text_height), baseline = cv2.getTextSize(
            text,
            font,
            font_scale,
            thickness
        )

        text_x = x - text_width // 2
        text_y = y + text_height // 2

        text_x = max(0, min(text_x, width - text_width))
        text_y = max(text_height, min(text_y, height - baseline))

        cv2.putText(
            annotated,
            text,
            (text_x, text_y),
            font,
            font_scale,
            (0, 0, 0),
            thickness,
            cv2.LINE_AA
        )

    cv2.putText(
        annotated,
        f"Plants: {len(plants)}",
        (15, height - 20),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (255, 255, 255),
        2,
        cv2.LINE_AA
    )

    return annotated