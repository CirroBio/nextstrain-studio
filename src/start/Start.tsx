import { useState, type KeyboardEvent, type ReactNode } from "react";
import { APP_NAME } from "../app/appInfo";
import { SUGGEST_AFTER, chooseTenant, hostOf, lastTenant, suggestTenants, tenantNamed, type Tenant } from "../tenants";

export function FatalError({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return (
    <main className="centered-page">
      <div className="card narrow">
        <h1 className="title">{title}</h1>
        <p>{message}</p>
        {action}
      </div>
    </main>
  );
}

export function SignInPage({ tenantName, onSignIn, onBack }: { tenantName: string; onSignIn: () => void; onBack: () => void }) {
  return (
    <main className="centered-page">
      <div className="card narrow">
        <h1 className="title">Log in to {tenantName}</h1>
        <p>{APP_NAME} opens the Nextstrain builds in your Cirro projects, uploads new ones and runs builds there, as you.</p>
        <div className="form-actions">
          <button className="button button-primary" onClick={onSignIn}>Log in with Cirro</button>
          <button className="button" onClick={onBack}>Back</button>
        </div>
      </div>
    </main>
  );
}

// The user names their Cirro: the box suggests listed tenants once SUGGEST_AFTER characters are
// typed, and takes any Cirro's address.
export function SignIn({ tenants, onBack }: { tenants: Tenant[]; onBack: () => void }) {
  const [text, setText] = useState(() => lastTenant(tenants)?.name ?? "");
  // The suggestion list opens on typing and closes on a pick, Escape or leaving the box.
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const choice = tenantNamed(text, tenants);
  const typed = text.trim().length >= SUGGEST_AFTER;
  // Nothing to suggest once the box already names the one tenant the list would show.
  const matches = open ? suggestTenants(text, tenants) : [];
  const suggestions = matches.length === 1 && matches[0] === choice ? [] : matches;
  const pick = (t: Tenant) => {
    setText(t.name);
    setOpen(false);
    setActive(-1);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!suggestions.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      pick(suggestions[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };
  return (
    <main className="start-hero">
      <form
        className="card start-card"
        onSubmit={(e) => {
          e.preventDefault();
          if (choice) chooseTenant(choice);
        }}
      >
        <h1 className="title">Log In (Cirro)</h1>
        <div className="popover start-tenant">
          <label className="field start-field">
            <span className="field-label">Your institution's Cirro</span>
            <input
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={suggestions.length > 0}
              aria-controls="start-tenant-options"
              aria-activedescendant={active >= 0 && suggestions[active] ? `start-tenant-${suggestions[active].id}` : undefined}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setOpen(true);
                setActive(-1);
              }}
              onKeyDown={onKey}
              onBlur={() => setOpen(false)}
              placeholder="Its name or address"
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
          </label>
          {suggestions.length > 0 && (
            <ul id="start-tenant-options" role="listbox" className="popover-panel menu start-tenant-options">
              {suggestions.map((t, i) => (
                <li
                  key={t.id}
                  id={`start-tenant-${t.id}`}
                  role="option"
                  aria-selected={i === active}
                  className="menu-item"
                  // Before the box's blur, which would close the list first.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(t);
                  }}
                  onMouseEnter={() => setActive(i)}
                >
                  <span>{t.name}</span>
                  <span className="muted">{hostOf(t)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {typed && !choice && !suggestions.length && <p className="muted">Pick a suggestion, or type the address you use for Cirro, such as cirro.example.org.</p>}
        <button className="button button-primary" disabled={!choice}>{choice ? `Log in to ${choice.name}` : "Log in"}</button>
        <button type="button" className="link-button" onClick={onBack}>Back</button>
      </form>
    </main>
  );
}
