import "./Card.css";

export default function Card(props) {
  const { href, title, body, tag, dateAdded, slug, category } = props;

  // Use slug-based internal URL if available, otherwise fall back to external URL
  const linkUrl = slug ? `/tools/${slug}` : href;

  const isNew = () => {
    if (!dateAdded) return false;

    const addedDate = new Date(dateAdded);
    const today = new Date();
    const differenceInTime = today.getTime() - addedDate.getTime();
    const differenceInDays = differenceInTime / (1000 * 3600 * 24);

    return differenceInDays <= 30;
  };

  return (
    <li className="link-card">
      <a
        href={linkUrl}
        onClick={() => {
          try {
            // Tell the listing to save its UI state before navigation
            window.dispatchEvent(new CustomEvent('tools:save-state'));
          } catch (err) {
            // ignore
          }
        }}
      >
        <strong className="nu-c-fs-normal nu-u-mt-1 nu-u-mb-1">{title}</strong>
        <p className="nu-c-helper-text nu-u-mt-1 nu-u-mb-1">{body}</p>
        <p className="distribution">
          {isNew() && <span className="tag nu-u-me-2 tag-new" title="Recently added" aria-label="New item">🔥</span>}
          <span className="tag">{tag}</span>
        </p>
      </a>
    </li>
  );
}
