import { Facebook, Github, Globe, Instagram, Linkedin, SendHorizontal, Twitter } from "lucide-react";

const SOCIAL_LINKS = [
  { label: "Telegram", href: "https://t.me/", icon: SendHorizontal },
  { label: "Twitter / X", href: "https://twitter.com/Rabidas_Prakash", icon: Twitter },
  { label: "Facebook", href: "https://www.facebook.com/light144/", icon: Facebook },
  { label: "Instagram", href: "https://www.instagram.com/__prakash_r__/", icon: Instagram },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/prakashrabidas/", icon: Linkedin },
  { label: "GitHub", href: "https://github.com/prakash144", icon: Github },
  { label: "Portfolio", href: "https://prakashrabidas.in/", icon: Globe },
];

export function AppFooter() {
  return (
    <footer className="mt-auto w-full border-t border-border bg-surface text-text-primary">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 pb-24 pt-6 md:flex-row md:pb-6">
        <div className="flex flex-col items-center gap-3 md:items-start">
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-text-muted md:justify-start">
            <span role="img" aria-label="Padhle">🌳</span>
            <span className="font-semibold text-text-primary">Padhle</span>
            <span aria-hidden>·</span>
            <span>Plan → Focus → Practice → Review → Improve</span>
          </div>
          <div className="flex flex-wrap justify-center gap-4 md:justify-start">
            {SOCIAL_LINKS.map(({ label, href, icon: Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                title={label}
                className="text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
              >
                <Icon size={22} />
              </a>
            ))}
          </div>
        </div>
        <p className="text-center text-sm leading-relaxed text-text-muted md:text-base">
          © {new Date().getFullYear()}{" "}
          <a
            href="https://www.prakashrabidas.in"
            target="_blank"
            rel="noopener noreferrer"
            className="text-info hover:underline"
          >
            PrakashRabidas.in
          </a>{" "}
          · All Rights Reserved.
        </p>
      </div>
    </footer>
  );
}
