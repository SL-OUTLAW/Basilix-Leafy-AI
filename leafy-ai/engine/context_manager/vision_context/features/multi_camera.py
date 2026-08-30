def build_camera_summary(results):
    cameras = {}

    for result in results:
        if result["status"] != "success":
            continue

        camera = result["camera"]

        cameras[camera] = {
            "plants": {
                "count": result["plants"]["count"]
            },
            "canopy": result["canopy"],
            "crowding": result["crowding"],
            "size": result["size"],
            "analysed_image": result["analysed_image"]
        }

    return {
        "source": "vision",
        "status": "success",
        "cameras": cameras
    }
