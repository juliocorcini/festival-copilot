/**
 * About + What's New (settings/about). The app's identity (what it is, who made it, the version) and a
 * human changelog: each release in plain language for festival-goers, with a collapsible "How to test"
 * block for the maker. Data lives in `data/changelog.ts` — this screen only renders it.
 */
import { StackHeader } from "../../app/StackHeader";
import { APP_ABOUT, APP_TAGLINE, APP_VERSION, CHANGELOG, CREATOR } from "../../data/changelog";

function formatDate(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  // Format in UTC so a "YYYY-MM-DD" date renders as the same calendar day in every timezone.
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function AboutScreen(): JSX.Element {
  return (
    <>
      <StackHeader title="About" backTo="/settings" />
      <div className="screen">
        <section className="about-hero glass">
          <div className="about-orb">
            <span className="ms">festival</span>
          </div>
          <h1 className="poster about-name">FestPilot</h1>
          <p className="about-tagline">{APP_TAGLINE}</p>
          <span className="pill about-version">v{APP_VERSION}</span>
        </section>

        <section className="glass about-card">
          <p className="about-blurb">{APP_ABOUT}</p>
          <div className="about-meta">
            <span className="ms" aria-hidden="true">person</span>
            <span>
              Created by <b>{CREATOR}</b>
            </span>
          </div>
        </section>

        <div className="about-section-label label">What's new</div>

        <section className="changelog">
          {CHANGELOG.map((rel, i) => (
            <article className="changelog-item glass" key={rel.version}>
              <div className="changelog-head">
                <div className="changelog-icon">
                  <span className="ms" aria-hidden="true">{rel.icon}</span>
                </div>
                <div className="changelog-headmain">
                  <div className="changelog-titlerow">
                    <span className="changelog-version">v{rel.version}</span>
                    {i === 0 && <span className="pill changelog-current">Current</span>}
                  </div>
                  <div className="changelog-title">{rel.title}</div>
                  <div className="changelog-date">{formatDate(rel.date)}</div>
                </div>
              </div>

              <ul className="changelog-list">
                {rel.whatsNew.map((line, j) => (
                  <li key={j}>{line}</li>
                ))}
              </ul>

              <details className="changelog-test">
                <summary>
                  <span className="ms" aria-hidden="true">science</span>
                  How to test
                </summary>
                <ul className="changelog-testlist">
                  {rel.howToTest.map((line, j) => (
                    <li key={j}>{line}</li>
                  ))}
                </ul>
              </details>
            </article>
          ))}
        </section>

        <p className="src" style={{ textAlign: "center" }}>
          FestPilot · v{APP_VERSION} · made by {CREATOR}
        </p>
      </div>
    </>
  );
}
