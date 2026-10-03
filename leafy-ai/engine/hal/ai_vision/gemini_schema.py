from typing import Literal

from pydantic import BaseModel, Field, model_validator


Certainty = Literal["low", "medium", "high"]
Presence = Literal["none", "possible", "clear", "uncertain"]
Severity = Literal["none", "mild", "moderate", "severe", "uncertain"]
Distribution = Literal["none", "localized", "widespread", "uncertain"]


class StressSignal(BaseModel):
    presence: Presence
    severity: Severity
    distribution: Distribution
    observations: list[str] = Field(default_factory=list, max_length=8)

    @model_validator(mode="after")
    def validate_none(self):
        if self.presence == "none":
            if self.severity != "none":
                raise ValueError("presence=none requires severity=none")
            if self.distribution != "none":
                raise ValueError("presence=none requires distribution=none")
            if self.observations:
                raise ValueError("presence=none requires an empty observations list")
        return self


class DiseaseSignal(BaseModel):
    status: Literal["none", "suspected", "uncertain"]
    suspected_type: Literal[
        "none",
        "downy_mildew_like",
        "powdery_mildew_like",
        "leaf_spot_like",
        "other",
        "uncertain",
    ]
    severity: Severity
    distribution: Distribution
    observations: list[str] = Field(default_factory=list, max_length=8)
    certainty: Certainty

    @model_validator(mode="after")
    def validate_none(self):
        if self.status == "none":
            if self.suspected_type != "none":
                raise ValueError("status=none requires suspected_type=none")
            if self.severity != "none":
                raise ValueError("status=none requires severity=none")
            if self.distribution != "none":
                raise ValueError("status=none requires distribution=none")
            if self.observations:
                raise ValueError("status=none requires an empty observations list")
        return self


class HealthAssessment(BaseModel):
    status: Literal["healthy", "stress_suspected", "uncertain"]
    certainty: Certainty
    dryness_wilt: StressSignal
    overwatering_like: StressSignal
    nutrient_deficiency_like: StressSignal
    disease_signs: DiseaseSignal
    other_visible_signs: list[str] = Field(default_factory=list, max_length=8)
    summary: str = Field(min_length=1, max_length=240)


class PlantSizeAssessment(BaseModel):
    relative_size: Literal["small", "medium", "large", "uncertain"]
    reference_match: Literal["early", "middle", "mature", "uncertain"]
    certainty: Certainty
    evidence: str = Field(min_length=1, max_length=180)


class CanopyAssessment(BaseModel):
    coverage_percent: float = Field(ge=0.0, le=100.0)
    crowding_state: Literal[
        "not_crowded",
        "moderate",
        "crowded",
        "uncertain",
    ]
    visible_gaps: Literal["many", "some", "few", "uncertain"]
    overlap: Literal["low", "moderate", "high", "uncertain"]
    certainty: Certainty
    evidence: str = Field(min_length=1, max_length=180)


class GrowthAssessment(BaseModel):
    stage: Literal["early", "middle", "mature", "uncertain"]
    reference_match: Literal["early", "middle", "mature", "uncertain"]
    trend: Literal[
        "insufficient_history",
        "increasing",
        "stable",
        "decreasing",
        "uncertain",
    ]
    history_used: bool
    certainty: Certainty
    evidence: str = Field(min_length=1, max_length=180)

    @model_validator(mode="after")
    def validate_history(self):
        if not self.history_used and self.trend != "insufficient_history":
            raise ValueError(
                "trend must be insufficient_history when no previous image is supplied"
            )
        return self


class ImageQuality(BaseModel):
    status: Literal["good", "usable", "poor"]
    issues: list[
        Literal[
            "blur",
            "obstruction",
            "colour_cast",
            "underexposed",
            "overexposed",
            "extreme_distance",
            "important_regions_hidden",
        ]
    ] = Field(default_factory=list, max_length=7)


class Review(BaseModel):
    required: bool
    reasons: list[str] = Field(default_factory=list, max_length=8)


class VisionAssessment(BaseModel):
    health: HealthAssessment
    plant_size: PlantSizeAssessment
    canopy: CanopyAssessment
    growth: GrowthAssessment
    image_quality: ImageQuality
    review: Review
