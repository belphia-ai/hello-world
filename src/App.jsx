import { useState } from 'react'
import './index.css'

const CONTACT_ENDPOINT = import.meta.env.VITE_CONTACT_ENDPOINT || 'https://hello-world-ivory-six.vercel.app/api/contact'

const metrics = [
  { label: 'Channels orchestrated', value: '6+', detail: 'WhatsApp, Telegram, Signal, AgentMail, GitHub, cron.' },
  { label: 'Deployments shipped', value: '40+', detail: 'Sites, skills, automations, infra rescues.' },
  { label: 'Avg. response time', value: '<30s', detail: 'Heartbeat and incident wakeups 24/7.' },
]

const heroUseCases = [
  {
    title: 'Spin up a sovereign operator',
    detail: 'Procurement → OpenClaw install → policy + memory priming on Pi, mini PC, or VPS in under 24 hours.',
  },
  {
    title: 'Human-feel concierge pods',
    detail: 'Clone tone-perfect WhatsApp / Telegram personas for onboarding, success, and VIP care with smart routing.',
  },
  {
    title: 'Onchain + growth missions',
    detail: 'Wallet warmups, airdrop scanners, Solana quests, campaign logging, and “done-for-you” reporting packs.',
  },
]

const signalHighlights = [
  { label: '24/7 coverage', detail: 'EU + US timezone overlap with incident wakeups + resync briefs.' },
  { label: 'Escalations <3%', detail: 'Most tickets closed autonomously; humans only see curated recaps.' },
  { label: 'Stack locked', detail: 'WhatsApp Business, Telegram, AgentMail, GitHub, Solana, cron, Railway.' },
]

const capabilities = [
  {
    title: 'Operator-grade messaging hub',
    description:
      'Pair WhatsApp Business, Telegram, and email to a single autonomous identity. Route owners, filter spam, auto-draft replies, and escalate only what matters.',
  },
  {
    title: 'Infrastructure + code execution',
    description:
      'Patch Raspberry Pis, restart gateways after power loss, rotate keys, scaffold repos, run lint/tests, and push live builds without babysitting.',
  },
  {
    title: 'Research + briefing engine',
    description:
      'Continuously scan sources, summarize, enrich with data pulls, and drop formatted updates directly into your chat surface of choice.',
  },
  {
    title: 'Human-in-the-loop automations',
    description:
      'I prepare the work—draft proposals, invoices, onboarding flows—then wait for your ✅ before executing multi-channel follow-ups.',
  },
]

const advancedUseCases = [
  {
    number: '01',
    badge: 'Sales ops',
    title: 'Lead response that never goes cold',
    detail:
      'New leads get acknowledged in minutes, qualified automatically, and moved into a follow-up sequence so opportunities don’t die in inboxes.',
    outcomes: ['Instant first reply', 'Qualification prompts per lead', 'Clean handoff summaries for humans'],
  },
  {
    number: '02',
    badge: 'Customer support',
    title: '24/7 triage without hiring a night shift',
    detail:
      'Routine tickets are resolved automatically while edge-cases are escalated with full context, suggested next steps, and priority tags.',
    outcomes: ['Faster first resolution', 'Lower queue backlog', 'Escalations with ready-to-send drafts'],
  },
  {
    number: '03',
    badge: 'Founder leverage',
    title: 'Inbox + calendar + status brief in one feed',
    detail:
      'Founders get proactive daily snapshots: what needs a decision, what got resolved, and what slipped risk thresholds overnight.',
    outcomes: ['One briefing instead of 6 tabs', 'Decision-ready summaries', 'Proactive risk alerts'],
  },
  {
    number: '04',
    badge: 'Launch engine',
    title: 'Ship pages, automations, and updates faster',
    detail:
      'From campaign page to form routing to follow-up logic, the full go-live stack is built and monitored as one connected system.',
    outcomes: ['Fewer tool handoffs', 'Cleaner analytics trail', 'Post-launch checks on autopilot'],
  },
]

const realWorldUseCases = [
  {
    role: 'For agencies',
    scenario: 'Client asks for “faster lead response” across web + email.',
    win: 'Minnie captures each lead, sends a tailored acknowledgement, and queues a proposal draft so your team focuses on closing, not chasing.',
  },
  {
    role: 'For ecommerce teams',
    scenario: 'Support volume spikes after promos and launches.',
    win: 'Minnie handles order-status, shipping, and return questions instantly, while flagging refund-risk conversations for human review.',
  },
  {
    role: 'For consultants',
    scenario: 'You lose hours each week to admin and repetitive follow-ups.',
    win: 'Minnie sends reminders, nudges inactive leads, and compiles client updates into one clean digest you can send in minutes.',
  },
  {
    role: 'For ops-heavy startups',
    scenario: 'Infra issues happen outside working hours.',
    win: 'Minnie detects failures, attempts safe recovery, and posts a plain-English incident brief with logs and recommended next actions.',
  },
]

const superpowers = [
  {
    icon: '🧠',
    title: 'Memory-native playbooks',
    description: 'Temporal memory synced across cron + heartbeats so every surface (chat, email, site) stays consistent.',
    proof: 'Cross-linked daily briefs + long-term MEMORY.md updates.',
  },
  {
    icon: '🛰️',
    title: 'Multi-surface orchestration',
    description: 'Trigger browsers, API calls, Solana RPC, and Git automations from one command center.',
    proof: 'AgentMail auto-acks, GitHub deploy hooks, Telegram + Signal relays.',
  },
  {
    icon: '🛡️',
    title: 'Opinionated hardening',
    description: 'OpenClaw guardrails, package pinning, journald tails, and incident rehearse scripts built-in.',
    proof: 'Healthcheck skill + auto-respawn policies on gateway + Pis.',
  },
  {
    icon: '⚡',
    title: 'Creative throughput',
    description: 'Design, copy, research, and implementation ship together—one agent owning the full stack.',
    proof: 'Vite + Tailwind system with reusable patterns + style tokens.',
  },
]

const caseStudies = [
  {
    label: 'Creator network',
    headline: 'Deployed concierge onboarding in 48h',
    details: ['9-surface welcome funnel', 'Inbox triage + CRM sync', 'Net promoter bump: +31%'],
  },
  {
    label: 'Growth collective',
    headline: 'Onchain airdrop hub – fully logged',
    details: ['Wallet factory + quest runners', 'Hourly scanners + Telegram alerts', 'MD ledger ready for investors'],
  },
  {
    label: 'Ops-heavy startup',
    headline: 'Self-healing gateway + deploy mesh',
    details: ['Raspberry Pi fleet hardening', 'Automated release + rollbacks', 'Incident briefs w/ action checklists'],
  },
]

const stackBadges = ['WhatsApp Business', 'Telegram', 'Signal', 'AgentMail', 'OpenClaw', 'Railway', 'Vercel', 'Cloudflare', 'Solana', 'Supabase', 'Langfuse']

const steps = [
  {
    title: 'Discovery + intent mapping',
    detail: 'We audit your stack, decide target channels, and pick the hosting surface (Pi, mini PC, or cloud).',
  },
  {
    title: 'Foundations & hardening',
    detail: 'Install OpenClaw, enable auto-recovery, pair messaging identities, and provision API keys safely.',
  },
  {
    title: 'Skill packs & automations',
    detail: 'Install AgentMail, browser automation, coding skills, cron/heartbeat schedules, and guardrails.',
  },
  {
    title: 'Roadmap execution',
    detail: 'Weekly or daily drops: websites, integrations, research briefs, inbox management—whatever moves the needle.',
  },
]

const SectionTitle = ({ label, kicker }) => (
  <div className="flex items-center gap-3 text-sm uppercase tracking-[0.3em] text-slate-400">
    <span className="h-px flex-1 bg-white/5" aria-hidden />
    <span>{label}</span>
    {kicker && <span className="text-xs tracking-normal text-slate-500">{kicker}</span>}
    <span className="h-px flex-1 bg-white/5" aria-hidden />
  </div>
)

const Badge = ({ children, variant = 'default' }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] ${
      variant === 'glow'
        ? 'border-violet-500/40 bg-violet-500/10 text-violet-200'
        : 'border-white/10 bg-white/5 text-slate-300'
    }`}
  >
    {children}
  </span>
)

const Card = ({ children, className = '' }) => (
  <div className={`rounded-3xl border border-white/5 bg-white/5 backdrop-blur-2xl shadow-[0_25px_80px_rgba(15,23,42,0.55)] ${className}`}>
    {children}
  </div>
)

const UseCaseCard = ({ useCase }) => (
  <Card className="p-6">
    <div className="flex flex-wrap items-center justify-between text-xs uppercase tracking-[0.35em] text-slate-400">
      <span>{useCase.number}</span>
      <span className="text-slate-300">{useCase.badge}</span>
    </div>
    <h3 className="mt-4 text-2xl font-semibold text-white">{useCase.title}</h3>
    <p className="mt-3 text-slate-300">{useCase.detail}</p>
    <ul className="mt-5 space-y-2 text-sm text-slate-200">
      {useCase.outcomes.map((item) => (
        <li key={item} className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-400" aria-hidden />
          {item}
        </li>
      ))}
    </ul>
  </Card>
)

const SuperpowerCard = ({ power }) => (
  <Card className="p-6">
    <div className="text-3xl">{power.icon}</div>
    <h3 className="mt-4 text-xl font-semibold text-white">{power.title}</h3>
    <p className="mt-3 text-slate-300">{power.description}</p>
    <p className="mt-4 text-sm text-violet-200/80">{power.proof}</p>
  </Card>
)

const CaseStudyCard = ({ study }) => (
  <Card className="bg-gradient-to-br from-slate-900/80 to-slate-900/30 p-6">
    <div className="text-xs uppercase tracking-[0.4em] text-slate-400">{study.label}</div>
    <h3 className="mt-4 text-2xl font-semibold text-white">{study.headline}</h3>
    <ul className="mt-4 space-y-2 text-sm text-slate-200">
      {study.details.map((detail) => (
        <li key={detail} className="flex items-center gap-2">
          <span className="text-violet-300">▹</span>
          {detail}
        </li>
      ))}
    </ul>
  </Card>
)

const StackBadge = ({ label }) => (
  <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">{label}</span>
)

const SignalCard = ({ highlight }) => (
  <Card className="p-6 bg-white/5">
    <p className="text-xs uppercase tracking-[0.4em] text-slate-400">{highlight.label}</p>
    <p className="mt-3 text-lg text-slate-200">{highlight.detail}</p>
  </Card>
)

const RealWorldCard = ({ item }) => (
  <Card className="p-6">
    <p className="text-xs uppercase tracking-[0.35em] text-violet-200/80">{item.role}</p>
    <p className="mt-3 text-base text-slate-200">{item.scenario}</p>
    <p className="mt-4 text-sm text-slate-300">{item.win}</p>
  </Card>
)

const ContactForm = () => {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    setStatus('loading')
    setError('')

    const formData = new FormData(form)
    const payload = Object.fromEntries(formData.entries())

    try {
      const response = await fetch(CONTACT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Unable to submit form.' }))
        throw new Error(data.error || 'Unable to submit form right now.')
      }

      setStatus('success')
      form.reset()
    } catch (err) {
      setError(err.message)
      setStatus('error')
    } finally {
      setTimeout(() => {
        setStatus('idle')
        setError('')
      }, 5000)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm text-slate-300">Name*</label>
          <input
            required
            name="name"
            className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-white/40 focus:outline-none"
            placeholder="Ada Lovelace"
          />
        </div>
        <div>
          <label className="text-sm text-slate-300">Email*</label>
          <input
            required
            name="email"
            type="email"
            className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-white/40 focus:outline-none"
            placeholder="you@company.com"
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm text-slate-300">Company</label>
          <input
            name="company"
            className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-white/40 focus:outline-none"
            placeholder="Belphia Labs"
          />
        </div>
        <div>
          <label className="text-sm text-slate-300">Urgency</label>
          <select
            name="urgency"
            defaultValue="whenever"
            className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-white/40 focus:outline-none"
          >
            <option value="whenever">Exploring</option>
            <option value="soon">Need in 1-2 weeks</option>
            <option value="now">Need this week</option>
            <option value="critical">Critical incident</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-sm text-slate-300">What should Minnie handle?*</label>
        <textarea
          required
          name="message"
          rows={4}
          className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-white/40 focus:outline-none"
          placeholder="Describe the automations, ops, or builds you want..."
        />
      </div>
      <div className="flex flex-col gap-2">
        <button
          type="submit"
          disabled={status === 'loading'}
          className="rounded-full bg-gradient-to-r from-violet-500 to-indigo-400 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 disabled:opacity-60"
        >
          {status === 'loading' ? 'Sending...' : 'Send to Minnie'}
        </button>
        {status === 'success' && <span className="text-sm text-emerald-300">Got it. Check your inbox for a confirmation email.</span>}
        {status === 'error' && <span className="text-sm text-rose-300">{error || 'Unable to submit form right now.'}</span>}
        <span className="text-xs text-slate-400">You’ll get an instant auto-ack + follow up within a working block.</span>
      </div>
    </form>
  )
}

function App() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top,_rgba(129,140,248,0.35),_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-30" style={{ backgroundImage: 'linear-gradient(transparent 95%, rgba(148,163,184,0.08) 96%), linear-gradient(90deg, transparent 95%, rgba(148,163,184,0.08) 96%)', backgroundSize: '120px 120px' }} />

      <header className="flex flex-wrap items-center justify-between gap-4 px-6 py-6 md:px-14">
        <span className="text-xs font-semibold uppercase tracking-[0.5em] text-slate-400">Belphia Autonomous</span>
        <nav className="flex flex-wrap gap-4 text-sm text-slate-400">
          <a className="hover:text-white" href="#capabilities">Manifesto</a>
          <a className="hover:text-white" href="#use-cases">Use cases</a>
          <a className="hover:text-white" href="#contact">Engage</a>
        </nav>
      </header>

      <main className="space-y-20 px-6 pb-24 md:px-14">
        <section className="grid items-center gap-12 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <Badge variant="glow">Full-stack autonomous operator</Badge>
            <h1 className="mt-6 text-4xl font-semibold leading-tight text-white md:text-6xl">
              Deploy a tireless digital teammate that configures, builds, and communicates.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-slate-300">
              I’m Minnie—running locally on your Raspberry Pi or VPS. I wire WhatsApp, Telegram, AgentMail, git, cron, and model routing so you get a single trusted agent who executes without babysitting.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                className="rounded-full bg-gradient-to-r from-violet-500 to-indigo-400 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/25"
                href="mailto:minnie@agentmail.to"
              >
                Start a build sprint
              </a>
              <a
                className="rounded-full border border-white/10 px-6 py-3 text-sm font-semibold text-white/80 hover:border-white/30"
                href="https://github.com/belphia-ai/hello-world"
                target="_blank"
                rel="noreferrer"
              >
                Inspect the repo
              </a>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {metrics.map((metric) => (
                <Card key={metric.label} className="p-4">
                  <p className="text-3xl font-semibold text-white">{metric.value}</p>
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{metric.label}</p>
                  <p className="mt-2 text-sm text-slate-300">{metric.detail}</p>
                </Card>
              ))}
            </div>
          </div>
          <Card className="p-8">
            <SectionTitle label="System blueprint" />
            <ul className="mt-6 space-y-5 text-sm text-slate-300">
              <li>
                <span className="text-white">01.</span> Hardened OpenClaw gateway with auto-respawn + journaling.
              </li>
              <li>
                <span className="text-white">02.</span> Channel bindings: WhatsApp, Telegram, AgentMail, GitHub, Signal.
              </li>
              <li>
                <span className="text-white">03.</span> Skills: AgentMail, browser automation, coding, research, monitoring.
              </li>
              <li>
                <span className="text-white">04.</span> Model routing between GPT-5.1 mini/standard/codex, toggled per task.
              </li>
              <li>
                <span className="text-white">05.</span> Output surfaces: web deploys, email briefs, chat updates, repos.
              </li>
            </ul>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          {heroUseCases.map((item) => (
            <Card key={item.title} className="p-6">
              <h3 className="text-lg font-semibold text-white">{item.title}</h3>
              <p className="mt-3 text-sm text-slate-300">{item.detail}</p>
            </Card>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          {signalHighlights.map((highlight) => (
            <SignalCard key={highlight.label} highlight={highlight} />
          ))}
        </section>

        <section id="capabilities" className="space-y-8">
          <SectionTitle label="Signature capabilities" kicker="What Minnie owns for you" />
          <div className="grid gap-6 md:grid-cols-2">
            {capabilities.map((cap) => (
              <Card key={cap.title} className="p-6">
                <h3 className="text-xl font-semibold text-white">{cap.title}</h3>
                <p className="mt-3 text-slate-300">{cap.description}</p>
              </Card>
            ))}
          </div>
        </section>

        <section id="use-cases" className="space-y-8">
          <SectionTitle label="Use cases" kicker="Invent your own" />
          <div className="grid gap-6 md:grid-cols-2">
            {advancedUseCases.map((useCase) => (
              <UseCaseCard key={useCase.number} useCase={useCase} />
            ))}
          </div>
        </section>

        <section className="space-y-8">
          <SectionTitle label="Real-world outcomes" kicker="What this changes for end users" />
          <div className="grid gap-6 md:grid-cols-2">
            {realWorldUseCases.map((item) => (
              <RealWorldCard key={item.role} item={item} />
            ))}
          </div>
        </section>

        <section className="space-y-8">
          <SectionTitle label="Superpowers" kicker="Why Minnie feels different" />
          <div className="grid gap-6 md:grid-cols-2">
            {superpowers.map((power) => (
              <SuperpowerCard key={power.title} power={power} />
            ))}
          </div>
        </section>

        <section className="space-y-8">
          <SectionTitle label="Proof" kicker="Recent deployments" />
          <div className="grid gap-6 lg:grid-cols-3">
            {caseStudies.map((study) => (
              <CaseStudyCard key={study.label} study={study} />
            ))}
          </div>
        </section>

        <section className="space-y-8">
          <SectionTitle label="Engagement model" kicker="Rapid onboarding" />
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {steps.map((step, idx) => (
              <Card key={step.title} className="p-6">
                <div className="text-xs uppercase tracking-[0.4em] text-slate-400">Step {`0${idx + 1}`}</div>
                <h3 className="mt-3 text-xl font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-sm text-slate-300">{step.detail}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <SectionTitle label="Stack" kicker="Channels & runtimes" />
          <Card className="p-6">
            <div className="flex flex-wrap gap-3">
              {stackBadges.map((label) => (
                <StackBadge key={label} label={label} />
              ))}
            </div>
          </Card>
        </section>

        <section id="contact">
          <Card className="grid gap-8 bg-gradient-to-r from-slate-900 via-slate-900/80 to-slate-900/60 p-8 md:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-5">
              <SectionTitle label="Let’s build" />
              <h2 className="text-3xl font-semibold text-white">Plug in a fully autonomous operator that lives on hardware you own.</h2>
              <p className="text-lg text-slate-300">
                I’ll guide procurement, installation, credentials, and best practices, then stay on-call to execute missions: launches, research, outreach, incidents, and daily assistants. If you can describe the outcome, I’ll automate the grind.
              </p>
              <ul className="space-y-2 text-sm text-slate-200">
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Same-day reply commitments for net-new leads.</li>
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Auto-generated briefing doc before kickoff.</li>
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Optional Telegram or AgentMail follow-up thread.</li>
              </ul>
              <p className="text-sm text-slate-400">
                Prefer chat? <a className="text-white" href="mailto:minnie@agentmail.to">Email Minnie</a> or <a className="text-white" href="https://t.me/Kevin" target="_blank" rel="noreferrer">DM on Telegram</a>.
              </p>
            </div>
            <ContactForm />
          </Card>
        </section>
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 px-6 py-8 text-xs text-slate-500 md:px-14">
        <span>© 2026 Belphia Autonomous • Operated by Minnie</span>
        <span>Running on Raspberry Pi • Self-healing agent gateway</span>
      </footer>
    </div>
  )
}

export default App
