from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ImageQuality(StrictModel):
    usable: bool
    issues: list[
        Literal[
            "blur",
            "low_light",
            "overexposure",
            "obstruction",
            "no_visible_basil",
            "poor_angle",
            "none",
            "other",
        ]
    ] = Field(max_length=8)
    explanation: str = Field(min_length=1, max_length=300)


class PlantSize(StrictModel):
    category: Literal["none", "small", "medium", "large", "unknown"]
    uniformity: Literal["uniform", "mixed", "unknown"]
    evidence: str = Field(min_length=1, max_length=300)


class Canopy(StrictModel):
    coverage_percent: float | None = Field(ge=0, le=100)
    density: Literal["sparse", "moderate", "dense", "unknown"]
    crowding: Literal["none", "mild", "moderate", "severe", "unknown"]
    leaf_overlap: Literal["none", "some", "extensive", "unknown"]
    evidence: str = Field(min_length=1, max_length=300)


class VisualCondition(StrictModel):
    assessment: Literal["not_observed", "possible", "uncertain"]
    severity: Literal["none", "mild", "moderate", "severe", "unknown"]
    evidence: str = Field(min_length=1, max_length=300)

    @model_validator(mode="after")
    def check_consistency(self):
        if self.assessment == "not_observed" and self.severity != "none":
            raise ValueError("Absent signs must have severity none")
        if self.assessment == "uncertain" and self.severity != "unknown":
            raise ValueError("Uncertain signs must have unknown severity")
        if self.assessment == "possible" and self.severity not in (
            "mild",
            "moderate",
            "severe",
            "unknown",
        ):
            raise ValueError("Possible signs cannot have severity none")
        return self


class Health(StrictModel):
    overall: Literal[
        "visually_healthy", "possible_stress", "unhealthy_appearance", "uncertain"
    ]
    dryness: VisualCondition
    overwatering: VisualCondition
    nutrient_deficiency: VisualCondition
    visible_symptoms: list[str] = Field(max_length=8)
    summary: str = Field(min_length=1, max_length=400)


class VisionAssessment(StrictModel):
    image_quality: ImageQuality
    plant_size: PlantSize
    canopy: Canopy
    health: Health

    @model_validator(mode="after")
    def check_unusable(self):
        if not self.image_quality.usable:
            if self.canopy.coverage_percent is not None:
                raise ValueError("Unusable image cannot have a canopy percentage")
            if self.health.overall != "uncertain":
                raise ValueError("Unusable image cannot assert plant health")
            if any(
                condition.assessment != "uncertain"
                for condition in (
                    self.health.dryness,
                    self.health.overwatering,
                    self.health.nutrient_deficiency,
                )
            ):
                raise ValueError("Unusable image cannot assert visual conditions")
        return self
