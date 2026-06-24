/**
 * Squad tab (Pillar 3). Gate 4.1 covers identity: an empty hero that routes into sign-in → profile
 * (#23.1/2/3), then a "ready" state once the guest has a profile. Create / join / members land in
 * Gate 4.2.
 */
import { useNavigate } from "react-router-dom";
import { AppHeader } from "../app/AppHeader";
import { initialsOf, useIdentity } from "../data/identity";

export function SquadScreen(): JSX.Element {
  const navigate = useNavigate();
  const { user, hasProfile } = useIdentity();

  if (!hasProfile) {
    return (
      <>
        <AppHeader eyebrow="Together" title="Squad" />
        <div className="squad-empty">
          <div className="squad-hero">
            <div className="squad-hero-orb">
              <span className="ms">diversity_3</span>
            </div>
            <h2 className="poster">
              Festivals are
              <br />
              better together
            </h2>
            <p>
              Create a squad, build a shared plan, and find each other on the map — even when the
              signal dies and the battery's at 12%.
            </p>
          </div>
          <div className="squad-actions">
            <button className="btn btn-primary" onClick={() => navigate("/squad/signin")}>
              <span className="ms">add</span>
              Create a squad
            </button>
            <button className="btn btn-ghost" onClick={() => navigate("/squad/signin")}>
              <span className="ms">link</span>
              Join with a link or QR
            </button>
            <p className="squad-note">A quick account keeps your squad in sync — 5 seconds.</p>
          </div>
        </div>
      </>
    );
  }

  const name = user?.displayName ?? "you";
  return (
    <>
      <AppHeader eyebrow="Together" title="Squad" avatarInitial={initialsOf(name)} />
      <div className="screen">
        <section className="glass squad-ready">
          <span
            className="ava"
            style={{
              background: `linear-gradient(135deg, ${user?.avatarColor ?? "#F5A623"}, ${user?.avatarColor ?? "#FFD060"}cc)`,
            }}
          >
            {initialsOf(name)}
          </span>
          <div className="squad-ready-main">
            <h3>Hey, {name} 👋</h3>
            <p>You're signed in. Building &amp; joining squads arrives in the next step.</p>
          </div>
        </section>
        <button className="btn btn-ghost" onClick={() => navigate("/squad/profile")}>
          <span className="ms">edit</span>
          Edit profile
        </button>
      </div>
    </>
  );
}
