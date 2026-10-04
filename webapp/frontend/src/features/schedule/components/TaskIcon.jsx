import {
  Activity,
  Beaker,
  Bell,
  CalendarDays,
  Camera,
  ChartNoAxesCombined,
  CircleAlert,
  Clock3,
  Droplets,
  Eye,
  Fan,
  FlaskConical,
  Flower2,
  Gauge,
  GlassWater,
  Leaf,
  Lightbulb,
  Power,
  ScanLine,
  Settings2,
  Sprout,
  Sun,
  TestTube2,
  Thermometer,
  Trees,
  Waves,
  Wind
} from "lucide-react";

import styles from "./TaskIcon.module.css";

export const taskIconOptions = [
  {
    name: "Leaf",
    label: "Leaf",
    icon: Leaf,
    tags: ["plant", "basil", "growth"]
  },
  {
    name: "Sprout",
    label: "Sprout",
    icon: Sprout,
    tags: ["plant", "basil", "growth"]
  },
  {
    name: "Flower2",
    label: "Flower",
    icon: Flower2,
    tags: ["plant", "growth"]
  },
  {
    name: "Trees",
    label: "Plants",
    icon: Trees,
    tags: ["plant", "farm", "growth"]
  },
  {
    name: "Droplets",
    label: "Droplets",
    icon: Droplets,
    tags: ["water", "irrigation"]
  },
  {
    name: "Waves",
    label: "Water",
    icon: Waves,
    tags: ["water", "irrigation"]
  },
  {
    name: "GlassWater",
    label: "Reservoir",
    icon: GlassWater,
    tags: ["water", "reservoir"]
  },
  {
    name: "FlaskConical",
    label: "Nutrients",
    icon: FlaskConical,
    tags: ["nutrient", "ec", "ph", "chemical"]
  },
  {
    name: "TestTube2",
    label: "Test",
    icon: TestTube2,
    tags: ["nutrient", "ec", "ph", "test"]
  },
  {
    name: "Beaker",
    label: "Beaker",
    icon: Beaker,
    tags: ["nutrient", "chemical"]
  },
  {
    name: "Thermometer",
    label: "Temperature",
    icon: Thermometer,
    tags: ["temperature", "heat", "environment"]
  },
  {
    name: "Sun",
    label: "Light",
    icon: Sun,
    tags: ["light", "lighting", "environment"]
  },
  {
    name: "Lightbulb",
    label: "Lighting",
    icon: Lightbulb,
    tags: ["light", "lighting"]
  },
  {
    name: "Wind",
    label: "Airflow",
    icon: Wind,
    tags: ["air", "wind", "environment"]
  },
  {
    name: "Fan",
    label: "Fan",
    icon: Fan,
    tags: ["fan", "air", "equipment"]
  },
  {
    name: "Camera",
    label: "Camera",
    icon: Camera,
    tags: ["camera", "vision", "photo"]
  },
  {
    name: "ScanLine",
    label: "Scan",
    icon: ScanLine,
    tags: ["scan", "analysis", "vision"]
  },
  {
    name: "Eye",
    label: "Monitor",
    icon: Eye,
    tags: ["monitor", "vision", "inspect"]
  },
  {
    name: "Gauge",
    label: "Sensor",
    icon: Gauge,
    tags: ["sensor", "monitor"]
  },
  {
    name: "Activity",
    label: "Activity",
    icon: Activity,
    tags: ["activity", "monitor", "sensor"]
  },
  {
    name: "ChartNoAxesCombined",
    label: "Analytics",
    icon: ChartNoAxesCombined,
    tags: ["chart", "analysis", "report"]
  },
  {
    name: "CalendarDays",
    label: "Schedule",
    icon: CalendarDays,
    tags: ["calendar", "schedule"]
  },
  {
    name: "Clock3",
    label: "Time",
    icon: Clock3,
    tags: ["clock", "time", "schedule"]
  },
  {
    name: "Bell",
    label: "Alert",
    icon: Bell,
    tags: ["alert", "notification"]
  },
  {
    name: "CircleAlert",
    label: "Warning",
    icon: CircleAlert,
    tags: ["warning", "alert"]
  },
  {
    name: "Settings2",
    label: "Control",
    icon: Settings2,
    tags: ["control", "settings", "equipment"]
  },
  {
    name: "Power",
    label: "Power",
    icon: Power,
    tags: ["power", "equipment"]
  }
];

function getFallbackIcon(action) {
  if (action === "RUN_IRRIGATION") {
    return "Droplets";
  }

  if (action === "DOSE_EC" || action === "DOSE_PH") {
    return "FlaskConical";
  }

  if (action === "SET_FAN") {
    return "Fan";
  }

  if (action === "RUN_AI_ANALYSIS" || action === "RUN_VISION_ANALYSIS") {
    return "ScanLine";
  }

  if (action === "SET_LIGHTING") {
    return "Lightbulb";
  }

  if (action === "CHECK_TEMPERATURE") {
    return "Thermometer";
  }

  return "Leaf";
}

function getFallbackTone(action) {
  if (action === "RUN_IRRIGATION") {
    return "blue";
  }

  if (action === "DOSE_EC" || action === "DOSE_PH") {
    return "orange";
  }

  return "green";
}

function findOption(value) {
  if (!value) {
    return null;
  }

  const search = String(value).toLowerCase();

  return (
    taskIconOptions.find(
      (option) =>
        option.name.toLowerCase() === search ||
        option.label.toLowerCase() === search
    ) || null
  );
}

function TaskIcon({
  iconName,
  iconKey,
  tone,
  action,
  size = 25
}) {
  const selected =
    findOption(iconName) ||
    findOption(iconKey) ||
    findOption(getFallbackIcon(action));

  const Icon = selected?.icon || Leaf;

  const selectedTone = [
    "green",
    "blue",
    "orange",
    "red",
    "neutral"
  ].includes(tone)
    ? tone
    : getFallbackTone(action);

  return (
    <div
      className={`${styles.icon} ${styles[selectedTone]}`}
    >
      <Icon size={size} />
    </div>
  );
}

export default TaskIcon;
