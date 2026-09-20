import { useEffect, useState } from "react";
import styles from "./Header.module.css";

function Header({
  title,
  subtitle,
  profileImage,
  profileName = "User"
}) {

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const time = currentTime
    .toLocaleTimeString("en-AU", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    })
    .toUpperCase();

  const date = currentTime.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  return (
    <header className={styles.header}>
      <div className={styles.pageInfo}>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>

      <div className={styles.userArea}>
        <div className={styles.dateTime}>
          <span>{time}</span>
          <span>{date}</span>
        </div>

        <button className={styles.profileButton} type="button">
          {profileImage ? (
            <img src={profileImage} alt={profileName} />
          ) : (
            <span>{profileName.charAt(0).toUpperCase()}</span>
          )}
        </button>
      </div>
    </header>
  );
}

export default Header;