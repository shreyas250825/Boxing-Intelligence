import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Activity,
  ArrowRight,
  BarChart3,
  Camera,
  CheckCircle2,
  CirclePlay,
  FileText,
  Menu,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Target,
  TimerReset,
  Users,
  X,
} from "lucide-react"

const navItems = [
  { label: "Product", target: "product" },
  { label: "Features", target: "features" },
  { label: "Analytics", target: "analytics" },
  { label: "For Coaches", target: "coaches" },
  { label: "For Academies", target: "academies" },
  { label: "About", target: "about" },
]

const capabilityStats = [
  { label: "session capture", value: "24/7" },
  { label: "coach feedback", value: "Live" },
  { label: "reporting", value: "PDF" },
]

const valuePillars = [
  {
    number: "01",
    title: "Capture",
    copy: "Upload and organize training footage across sparring, drills and pad sessions in one digital record.",
    image: "/images/boxing-value.jpg",
  },
  {
    number: "02",
    title: "Analyze",
    copy: "Turn frames into meaningful movement signals: position, rhythm, technique tendency and training intensity.",
    image: "/images/boxing-analysis.jpg",
  },
  {
    number: "03",
    title: "Improve",
    copy: "Translate evidence into coaching conversations, development priorities and the next session plan.",
    image: "/images/boxing-coach.jpg",
  },
]

const features = [
  {
    title: "AI video analysis",
    eyebrow: "Session intelligence",
    description:
      "Review the rounds, moments and patterns that matter. Tag movement, strikes and footwork with context-rich timeline controls.",
    bullets: ["Frame-by-frame review", "Pose and tracking overlay", "Timestamped event markers"],
    previewTitle: "Illustrative preview",
  },
  {
    title: "Performance analytics",
    eyebrow: "Data with context",
    description:
      "Follow rhythm, load and disruptive movement across rounds and training blocks without losing the coaching narrative.",
    bullets: ["Round-by-round trends", "Volume and rhythm indicators", "Session comparison"],
    previewTitle: "Illustrative preview",
  },
  {
    title: "Fighter development",
    eyebrow: "Progress, not guesswork",
    description:
      "Build an athlete timeline from training records, observations and past sessions to guide the next phase of development.",
    bullets: ["Historical sessions", "Goal tracking", "Coach notes"],
    previewTitle: "Illustrative preview",
  },
  {
    title: "Coaching intelligence",
    eyebrow: "Actionable feedback",
    description:
      "Capture observations, assign follow-up drills and keep each athlete moving with a clear technical plan.",
    bullets: ["Observation markers", "Drill recommendations", "Review-ready notes"],
    previewTitle: "Illustrative preview",
  },
  {
    title: "Professional reports",
    eyebrow: "Board-ready communication",
    description:
      "Turn analysis into polished performance summaries that coaches, fighters and academies can actually use.",
    bullets: ["Session review", "Key indicators", "PDF-ready structure"],
    previewTitle: "Illustrative preview",
  },
  {
    title: "Academy management",
    eyebrow: "Team operations",
    description:
      "Organize athletes, sessions and records within a central performance workspace built for serious training environments.",
    bullets: ["Athlete roster", "Program visibility", "Session continuity"],
    previewTitle: "Illustrative preview",
  },
]

const audiences = [
  {
    title: "For coaches",
    copy: "Analyze sessions, review technique and deliver more structured feedback with evidence from each training block.",
    image: "/images/boxing-coach.jpg",
  },
  {
    title: "For fighters",
    copy: "See patterns in your training, review coach feedback and follow a clearer path toward development.",
    image: "/images/boxing-value.jpg",
  },
  {
    title: "For boxing academies",
    copy: "Centralize athlete records, sessions and performance history inside a premium performance workspace.",
    image: "/images/boxing-academy.jpg",
  },
]

const steps = [
  { step: "01", title: "Upload training footage" },
  { step: "02", title: "Analyze available video evidence" },
  { step: "03", title: "Review performance insights" },
  { step: "04", title: "Build the next training plan" },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [demoSubmitted, setDemoSubmitted] = useState(false)

  const handleScroll = (target: string) => {
    setMobileOpen(false)
    const elm = document.getElementById(target)
    if (elm) {
      elm.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  const handleSubmitDemo = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setDemoSubmitted(true)
  }

  return (
    <div className="landing-page">
      <header className={`landing-header ${mobileOpen ? "open" : ""}`}>
        <div className="nav-shell">
          <button className="brand" onClick={() => handleScroll("top")} type="button">
            <span className="brand-mark">
              <Activity size={14} />
            </span>
            <span className="brand-copy">
              <span className="brand-name">Valen Labs</span>
              <span className="brand-sub">Boxing Intelligence</span>
            </span>
          </button>

          <nav className="desktop-nav" aria-label="Main navigation">
            {navItems.map((item) => (
              <button key={item.target} type="button" onClick={() => handleScroll(item.target)}>
                {item.label}
              </button>
            ))}
          </nav>

          <div className="nav-actions">
            <button className="text-link" type="button" onClick={() => navigate("/login")}>
              Log in
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => handleScroll("demo-request")}>
              Request a Demo
            </button>
            <button className="btn btn-primary" type="button" onClick={() => navigate("/register")}>
              Get Started
            </button>
          </div>

          <button
            className="menu-toggle"
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label="Toggle navigation"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {mobileOpen && (
          <div className="mobile-menu">
            {navItems.map((item) => (
              <button key={item.target} type="button" onClick={() => handleScroll(item.target)}>
                {item.label}
              </button>
            ))}
            <button className="btn btn-primary full" type="button" onClick={() => navigate("/login")}>
              Log in
            </button>
            <button className="btn btn-ghost full" type="button" onClick={() => navigate("/register")}>
              Get Started
            </button>
          </div>
        )}
      </header>

      <main id="top" className="landing-main">
        <section className="hero-section section-shell">
          <div className="hero-backdrop" />
          <div className="hero-grid">
            <div className="hero-copy reveal">
              <div className="eyebrow">
                <Sparkles size={12} /> Valen Labs · Boxing Intelligence
              </div>
              <h1>
                See Beyond Every Punch.
              </h1>
              <p className="hero-summary">
                Turn boxing footage into meaningful performance intelligence. Understand movement,
                technique and training patterns with computer vision, analytics and coach-led insights.
              </p>
              <div className="hero-actions">
                <button className="btn btn-primary large" type="button" onClick={() => handleScroll("product")}>
                  Explore the Platform <ArrowRight size={17} />
                </button>
                <button className="btn btn-secondary large" type="button" onClick={() => handleScroll("demo-request")}>
                  <CirclePlay size={16} /> Request a Demo
                </button>
              </div>
              <p className="microcopy">Built for boxing coaches, athletes and academies.</p>

              <div className="mini-metrics">
                {capabilityStats.map((metric) => (
                  <div className="metric-pill" key={metric.label}>
                    <span>{metric.value}</span>
                    <small>{metric.label}</small>
                  </div>
                ))}
              </div>
            </div>

            <div className="hero-visual reveal">
              <div className="preview-panel">
                <div className="panel-header">
                  <span className="dot red" />
                  <span className="dot amber" />
                  <span className="dot green" />
                  <span className="panel-label">Valen Boxing Intelligence · Session Review</span>
                </div>

                <div className="preview-body">
                  <aside className="sidebar-preview">
                    <span>Movement</span>
                    <span>Footwork</span>
                    <span>Guard</span>
                    <span>Transitions</span>
                    <span>Pressure</span>
                  </aside>

                  <div className="video-preview">
                    <div className="video-image" aria-label="Training session preview image" />
                    <div className="pose-overlay" aria-hidden="true">
                      <span className="joint j1" />
                      <span className="joint j2" />
                      <span className="joint j3" />
                      <span className="joint j4" />
                      <span className="joint j5" />
                    </div>
                  </div>

                  <div className="insight-panel">
                    <div className="insight-row">
                      <span>Current load</span>
                      <strong>72%</strong>
                    </div>
                    <div className="insight-row">
                      <span>Movement score</span>
                      <strong>86</strong>
                    </div>
                    <div className="insight-row">
                      <span>Event markers</span>
                      <strong>18</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="product" className="section-shell value-section">
          <div className="section-heading reveal">
            <div className="eyebrow small">
              <Target size={12} /> What matters most
            </div>
            <h2>Every Session Has a Story. Understand It.</h2>
          </div>

          <div className="value-grid">
            {valuePillars.map((pillar) => (
              <article className="value-card reveal" key={pillar.number}>
                <div className="value-image-wrap">
                  <img src={pillar.image} alt={pillar.title} />
                </div>
                <div className="value-content">
                  <div className="value-number">{pillar.number}</div>
                  <h3>{pillar.title}</h3>
                  <p>{pillar.copy}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="features" className="section-shell features-section">
          <div className="section-heading reveal">
            <div className="eyebrow small">
              <Camera size={12} /> Product capabilities
            </div>
            <h2>Purpose-built for the realities of boxing performance.</h2>
          </div>

          <div className="feature-grid">
            {features.map((feature, idx) => (
              <article className="feature-card reveal" key={feature.title}>
                <div className="feature-header">
                  <span className="feature-kicker">{feature.eyebrow}</span>
                  <span className="feature-index">0{idx + 1}</span>
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
                <ul>
                  {feature.bullets.map((bullet) => (
                    <li key={bullet}>
                      <CheckCircle2 size={14} /> {bullet}
                    </li>
                  ))}
                </ul>
                <div className="feature-preview">
                  <span>{feature.previewTitle}</span>
                  <div className="preview-window">
                    <div className="preview-bar short" />
                    <div className="preview-bar long" />
                    <div className="preview-chart">
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="analytics" className="section-shell showcase-section">
          <div className="showcase-copy reveal">
            <div className="eyebrow small">
              <BarChart3 size={12} /> Live performance overview
            </div>
            <h2>See the signals behind the rounds.</h2>
            <p>
              The platform builds an evidence trail from captured footage into a structured performance narrative — not vanity metrics.
            </p>
          </div>

          <div className="showcase-frame reveal">
            <div className="showcase-sidebar">
              <span>Overview</span>
              <span className="active">Athlete timeline</span>
              <span>Round summary</span>
              <span>Session notes</span>
            </div>

            <div className="showcase-surface">
              <div className="surface-top">
                <div>
                  <small>Movement load</small>
                  <strong>74.8%</strong>
                </div>
                <div>
                  <small>Efficiency</small>
                  <strong>81.2</strong>
                </div>
                <div>
                  <small>Session trend</small>
                  <strong>+12.4%</strong>
                </div>
              </div>

              <div className="surface-chart">
                <span style={{ height: "48%" }} />
                <span style={{ height: "56%" }} />
                <span style={{ height: "64%" }} />
                <span style={{ height: "76%" }} />
                <span style={{ height: "82%" }} />
                <span style={{ height: "69%" }} />
                <span style={{ height: "92%" }} />
                <span style={{ height: "87%" }} />
              </div>

              <div className="surface-grid">
                <div className="panel-block">
                  <small>Session history</small>
                  <strong>18 sessions</strong>
                </div>
                <div className="panel-block">
                  <small>Coach notes</small>
                  <strong>11 observations</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="coaches" className="section-shell audience-section">
          <div className="section-heading reveal">
            <div className="eyebrow small">
              <Users size={12} /> Built for the people in the gym
            </div>
            <h2>Who it is for.</h2>
          </div>

          <div className="audience-grid">
            {audiences.map((audience) => (
              <article className="audience-card reveal" key={audience.title}>
                <div className="audience-image">
                  <img src={audience.image} alt={audience.title} />
                </div>
                <div className="audience-copy">
                  <h3>{audience.title}</h3>
                  <p>{audience.copy}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="section-shell process-section">
          <div className="section-heading reveal">
            <div className="eyebrow small">
              <TimerReset size={12} /> Simple workflow
            </div>
            <h2>How it works.</h2>
          </div>

          <div className="steps-grid reveal">
            {steps.map((step) => (
              <div className="step-card" key={step.step}>
                <span>{step.step}</span>
                <h3>{step.title}</h3>
              </div>
            ))}
          </div>
        </section>

        <section id="academies" className="section-shell academy-section">
          <div className="academy-visual reveal">
            <img src="/images/boxing-academy.jpg" alt="Boxing academy training environment" />
          </div>
          <div className="academy-copy reveal">
            <div className="eyebrow small">
              <ShieldCheck size={12} /> Academy-ready
            </div>
            <h2>Give your team a more serious operating rhythm.</h2>
            <p>
              Organize fighters, video sessions and coach observations in one premium workspace designed for high-performance boxing environments.
            </p>
            <ul>
              <li><CheckCircle2 size={16} /> Consistent athlete tracing</li>
              <li><CheckCircle2 size={16} /> Session continuity across coaches</li>
              <li><CheckCircle2 size={16} /> Clear next-step planning from evidence</li>
            </ul>
          </div>
        </section>

        <section id="about" className="section-shell about-section">
          <div className="about-copy reveal">
            <div className="eyebrow small">
              <MessageSquareText size={12} /> About Valen Labs
            </div>
            <h2>Commercial-grade boxing intelligence for modern performance environments.</h2>
            <p>
              Valen Labs brings together video review, movement intelligence and coach-led performance analysis into a single premium platform.
            </p>
            <div className="about-badges">
              <span>Computer Vision</span>
              <span>Coaching workflow</span>
              <span>Academy operations</span>
            </div>
          </div>
          <div className="about-panel reveal">
            <div className="about-image">
              <img src="/images/boxing-hero.jpg" alt="Boxing gym training scene" />
            </div>
          </div>
        </section>

        <section id="demo-request" className="section-shell demo-section">
          <div className="demo-visual reveal">
            <div className="demo-image" />
          </div>

          <div className="demo-copy reveal">
            <div className="eyebrow small">
              <FileText size={12} /> Book a product demo
            </div>
            <h2>Make Every Round Count.</h2>
            <p>
              Bring greater clarity to every training session with Valen Boxing Intelligence.
            </p>

            <form className="demo-form" onSubmit={handleSubmitDemo}>
              <label>
                <span>Name</span>
                <input type="text" placeholder="Coach or academy lead" required />
              </label>
              <label>
                <span>Email</span>
                <input type="email" placeholder="name@academy.com" required />
              </label>
              <label>
                <span>What are you looking to improve?</span>
                <textarea rows={4} placeholder="We want better athlete tracking, coaching feedback and performance visibility across sessions." required />
              </label>

              <div className="demo-actions">
                <button className="btn btn-primary" type="submit">
                  Request a Demo
                </button>
                <button className="btn btn-secondary" type="button" onClick={() => navigate("/register")}>
                  Get Started
                </button>
              </div>

              {demoSubmitted && (
                <p className="success-message">Your demo request has been recorded. A product specialist will follow up with the next steps.</p>
              )}
            </form>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="footer-shell">
          <div className="footer-brand">
            <div className="brand-mark small">
              <Activity size={13} />
            </div>
            <div>
              <strong>Valen Labs</strong>
              <span>Boxing Intelligence</span>
            </div>
          </div>

          <div className="footer-links">
            <div>
              <h4>Product</h4>
              <a href="#product">Overview</a>
              <a href="#features">Features</a>
              <a href="#analytics">Analytics</a>
            </div>
            <div>
              <h4>Platform</h4>
              <a href="#coaches">For Coaches</a>
              <a href="#academies">For Academies</a>
              <a href="#about">About</a>
            </div>
            <div>
              <h4>Account</h4>
              <button type="button" onClick={() => navigate("/login")}>Login</button>
              <button type="button" onClick={() => navigate("/register")}>Registration</button>
              <button type="button" onClick={() => handleScroll("demo-request")}>Contact</button>
            </div>
          </div>
        </div>

        <div className="footer-meta">
          <span>Privacy Policy</span>
          <span>Terms of Service</span>
          <span>© 2026 Valen Labs</span>
        </div>
      </footer>
    </div>
  )
}
