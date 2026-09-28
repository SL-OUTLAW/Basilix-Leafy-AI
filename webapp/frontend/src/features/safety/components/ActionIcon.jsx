import {
  Droplet,
  FlaskConical,
  Fan,
  Sun
} from "lucide-react";

import styles from "./ActionIcon.module.css";

const icons = {
  irrigation: Droplet,
  nutrient: FlaskConical,
  fan: Fan,
  light: Sun
};

function ActionIcon({
  type = "fan",
  size = "compact"
}) {
  const Icon = icons[type] || Fan;

  return (
    <span
      className={`${styles.icon} ${styles[type] || styles.fan} ${styles[size]}`}
    >
      <Icon strokeWidth={1.8} />
    </span>
  );
}

export default ActionIcon;
