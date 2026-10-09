import { Bot, CalendarClock, Droplets, Fan, FlaskConical, Lightbulb, Power, ShieldCheck, TestTube2 } from "lucide-react";
import styles from "./ActionIcon.module.css";

function resolve(type) {
  const action = String(type || "").toUpperCase();
  if (action.includes("IRRIGATION")) return [Droplets, "irrigation"];
  if (action.includes("DOSE_PH")) return [TestTube2, "nutrient"];
  if (action.includes("DOSE_EC")) return [FlaskConical, "nutrient"];
  if (action.includes("FAN")) return [Fan, "fan"];
  if (action.includes("LIGHT")) return [Lightbulb, "light"];
  if (action.includes("SCHEDULE")) return [CalendarClock, "irrigation"];
  if (action.includes("AI") || action.includes("VISION")) return [Bot, "light"];
  if (action.includes("ENABLE") || action.includes("DISABLE")) return [Power, "fan"];
  return [ShieldCheck, "fan"];
}

function ActionIcon({ type = "", size = "compact" }) {
  const [Icon, tone] = resolve(type);
  return <span className={`${styles.icon} ${styles[tone]} ${styles[size]}`}><Icon strokeWidth={1.8} /></span>;
}

export default ActionIcon;
