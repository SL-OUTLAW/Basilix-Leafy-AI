import { getAIResultContent } from "../../../utils/aiResult";
import styles from "./MarkdownContent.module.css";

function InlineText({ text }) {
  const parts = String(text).split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`)/g);

  return parts.map((part, index) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    if (/^__[^_]+__$/.test(part)) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    if (/^`[^`]+`$/.test(part)) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }

    return part;
  });
}

function MarkdownContent({ value, className = "" }) {
  const content = getAIResultContent(value);

  if (!content) {
    return null;
  }

  const lines = content.split("\n");

  return (
    <div className={`${styles.content} ${className}`.trim()}>
      {lines.map((rawLine, index) => {
        const line = rawLine.trim();

        if (!line) {
          return (
            <div key={index} className={styles.spacer} aria-hidden="true" />
          );
        }

        if (/^---+$/.test(line)) {
          return <hr key={index} />;
        }

        const heading = line.match(/^(#{1,6})\s+(.+)$/);
        if (heading) {
          const level = Math.min(heading[1].length, 4);
          const Heading = `h${Math.max(2, level + 1)}`;
          return (
            <Heading key={index} className={styles.heading}>
              <InlineText text={heading[2]} />
            </Heading>
          );
        }

        const bullet = line.match(/^[-*+]\s+(.+)$/);
        if (bullet) {
          return (
            <div key={index} className={styles.listItem}>
              <span className={styles.bullet}>•</span>
              <span>
                <InlineText text={bullet[1]} />
              </span>
            </div>
          );
        }

        const numbered = line.match(/^(\d+)\.\s+(.+)$/);
        if (numbered) {
          return (
            <div key={index} className={styles.listItem}>
              <span className={styles.number}>{numbered[1]}.</span>
              <span>
                <InlineText text={numbered[2]} />
              </span>
            </div>
          );
        }

        return (
          <p key={index}>
            <InlineText text={line} />
          </p>
        );
      })}
    </div>
  );
}

export default MarkdownContent;
