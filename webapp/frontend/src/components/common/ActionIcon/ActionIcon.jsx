import {
  Activity,
  Beaker,
  Bell,
  Bot,
  CalendarDays,
  CalendarClock,
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
  ShieldCheck,
  Sprout,
  Sun,
  TestTube2,
  Thermometer,
  Trees,
  Waves,
  Wind
} from "lucide-react";
import styles from "./ActionIcon.module.css";

export const iconOptions = [
  ["Leaf", "Leaf", Leaf, ["plant", "basil", "growth"]],
  ["Sprout", "Sprout", Sprout, ["plant", "basil", "growth"]],
  ["Flower2", "Flower", Flower2, ["plant", "growth"]],
  ["Trees", "Plants", Trees, ["plant", "farm", "growth"]],
  ["Droplets", "Droplets", Droplets, ["water", "irrigation", "humidity"]],
  ["Waves", "Water", Waves, ["water", "irrigation", "water_level"]],
  ["GlassWater", "Reservoir", GlassWater, ["water", "reservoir"]],
  ["FlaskConical", "Nutrients", FlaskConical, ["nutrient", "ec", "ph", "chemical"]],
  ["TestTube2", "Test", TestTube2, ["nutrient", "ec", "ph", "test"]],
  ["Beaker", "Beaker", Beaker, ["nutrient", "chemical"]],
  ["Thermometer", "Temperature", Thermometer, ["temperature", "heat", "environment"]],
  ["Sun", "Light", Sun, ["light", "lighting", "environment"]],
  ["Lightbulb", "Lighting", Lightbulb, ["light", "lighting"]],
  ["Wind", "Airflow", Wind, ["air", "wind", "environment"]],
  ["Fan", "Fan", Fan, ["fan", "air", "equipment"]],
  ["Camera", "Camera", Camera, ["camera", "vision", "photo"]],
  ["ScanLine", "Scan", ScanLine, ["scan", "analysis", "vision"]],
  ["Eye", "Monitor", Eye, ["monitor", "vision", "inspect"]],
  ["Gauge", "Sensor", Gauge, ["sensor", "monitor", "ec"]],
  ["Activity", "Activity", Activity, ["activity", "monitor", "sensor"]],
  ["ChartNoAxesCombined", "Analytics", ChartNoAxesCombined, ["chart", "analysis", "report"]],
  ["CalendarDays", "Schedule", CalendarDays, ["calendar", "schedule"]],
  ["Clock3", "Time", Clock3, ["clock", "time", "schedule"]],
  ["Bell", "Alert", Bell, ["alert", "notification"]],
  ["CircleAlert", "Warning", CircleAlert, ["warning", "alert"]],
  ["Settings2", "Control", Settings2, ["control", "settings", "equipment"]],
  ["Power", "Power", Power, ["power", "equipment"]]
].map(([name, label, icon, tags]) => ({ name, label, icon, tags }));

function normalize(value) {
  return String(value || "").trim().toUpperCase();
}

export function getSystemIcon({ action, sensorType, iconName, iconKey, type } = {}) {
  const explicit = String(iconName || iconKey || "").toLowerCase();
  const explicitOption = iconOptions.find(
    (option) =>
      option.name.toLowerCase() === explicit ||
      option.label.toLowerCase() === explicit
  );

  if (explicitOption) {
    return explicitOption.icon;
  }

  const value = normalize(action || type);
  const sensor = String(sensorType || "").toLowerCase();

  if (value.includes("IRRIGATION")) return Droplets;
  if (value.includes("DOSE_PH")) return TestTube2;
  if (value.includes("DOSE_EC")) return FlaskConical;
  if (value.includes("FAN")) return Fan;
  if (value.includes("LIGHT")) return Lightbulb;
  if (value.includes("SCHEDULE")) return CalendarClock;
  if (value.includes("AI") || value.includes("VISION")) return Bot;
  if (value.includes("ENABLE") || value.includes("DISABLE")) return Power;

  if (sensor === "ph" || sensor.includes("ph")) return FlaskConical;
  if (sensor === "ec" || sensor.includes("ec")) return Gauge;
  if (sensor.includes("water_level") || sensor.includes("water level")) return Waves;
  if (sensor.includes("temperature") || sensor.includes("dew_point") || sensor.includes("dew point")) return Thermometer;
  if (sensor.includes("humidity")) return Droplets;

  return value ? ShieldCheck : Leaf;
}

export function getActionTone(action, tone) {
  if (["green", "blue", "orange", "red", "neutral"].includes(tone)) {
    return tone;
  }

  const value = normalize(action);
  if (value.includes("IRRIGATION")) return "blue";
  if (value.includes("DOSE_PH") || value.includes("DOSE_EC")) return "orange";
  if (value.includes("EMERGENCY") || value.includes("CRITICAL")) return "red";
  return "green";
}

function ActionIcon({
  action,
  type,
  sensorType,
  iconName,
  iconKey,
  tone,
  size = 20,
  variant = "task",
  className = ""
}) {
  const Icon = getSystemIcon({ action, type, sensorType, iconName, iconKey });
  const selectedTone = getActionTone(action || type, tone);

  return (
    <span
      className={`${styles.icon} ${styles[selectedTone]} ${styles[variant] || styles.task} ${className}`.trim()}
      aria-hidden="true"
    >
      <Icon size={size} strokeWidth={1.8} />
    </span>
  );
}

export default ActionIcon;
