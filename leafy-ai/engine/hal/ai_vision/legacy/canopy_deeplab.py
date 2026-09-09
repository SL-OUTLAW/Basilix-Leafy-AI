# Legacy DeepLab canopy model - not used by the active vision pipeline.
from pathlib import Path
import sys
import cv2
import torch
import torch.nn as nn
import torchvision.transforms.functional as TF
from torchvision.models.segmentation import deeplabv3_mobilenet_v3_large


device = "cuda" if torch.cuda.is_available() else "cpu"

# Load the trained canopy model
base_dir = Path(__file__).resolve().parent.parent
model_path = base_dir / "models" / "basil_canopy_deeplabv3.pt"

model = deeplabv3_mobilenet_v3_large(
    weights=None,
    weights_backbone=None,
    aux_loss=False
)

model.classifier[4] = nn.Conv2d(256, 2, 1)
model.aux_classifier = None

checkpoint = torch.load(
    model_path,
    map_location=device,
    weights_only=True
)

model.load_state_dict(checkpoint["model_state"])
model.to(device)
model.eval()


def analyse_canopy(image_path):
    image = cv2.imread(str(image_path))

    if image is None:
        raise ValueError("Could not load image")

    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    image = torch.from_numpy(image)
    image = image.permute(2, 0, 1).float() / 255.0

    image = TF.normalize(
        image,
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )

    image = image.unsqueeze(0).to(device)

    with torch.no_grad():
        output = model(image)["out"]
        mask = output.argmax(1)[0].cpu().numpy()

    coverage = (mask == 1).mean() * 100

    return round(float(coverage), 2)


if __name__ == "__main__":
    coverage = analyse_canopy(sys.argv[1])
    print("Canopy coverage:", coverage, "%")
