import { useNavigate } from "react-router-dom"
import { Activity, ArrowRight, CheckCircle, Shield, BarChart2, Users, FileText, Zap, Play, Monitor } from "lucide-react"

export default function LandingPage() {
  const nav = useNavigate()
  return (
    <div style={{ minHeight:"100vh", background:"#030712", color:"white", fontFamily:"Inter,system-ui,sans-serif" }}>

      {/* Nav */}
      <nav style={{ borderBottom:"1px solid rgba(255,255,255,0.08)", padding:"14px 32px", display:"flex", alignItems:"center", justifyContent:"space-between", maxWidth:1200, margin:"0 auto" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:30, height:30, background:"#2563eb", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Activity size={15} color="white" />
          </div>
          <div>
            <span style={{ fontWeight:700, fontSize:14 }}>Valen Boxing Intelligence</span>
            <span style={{ color:"#6b7280", fontSize:11, marginLeft:8 }}>by Valen Labs</span>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <button onClick={() => nav("/app/boxers")} style={{ background:"none", border:"none", cursor:"pointer", color:"#9ca3af", fontSize:13 }}>Athletes</button>
          <button onClick={() => nav("/app/settings")} style={{ background:"none", border:"none", cursor:"pointer", color:"#9ca3af", fontSize:13 }}>Settings</button>
          <button onClick={() => nav("/app")} style={{ background:"#2563eb", border:"none", cursor:"pointer", color:"white", fontSize:13, fontWeight:600, padding:"8px 18px", borderRadius:8 }}>
            Open Platform
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth:900, margin:"0 auto", padding:"80px 32px 60px", textAlign:"center" }}>
        <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:"rgba(37,99,235,0.12)", border:"1px solid rgba(59,130,246,0.25)", color:"#93c5fd", fontSize:11, fontWeight:600, padding:"5px 12px", borderRadius:20, marginBottom:28 }}>
          <Zap size={11} />Valen Labs · Video Analysis Platform
        </div>
        <h1 style={{ fontSize:56, fontWeight:800, lineHeight:1.1, letterSpacing:"-0.02em", marginBottom:20 }}>
          See Every Round.<br />
          <span style={{ color:"#3b82f6" }}>Understand Every Move.</span>
        </h1>
        <p style={{ fontSize:18, color:"#9ca3af", maxWidth:600, margin:"0 auto 36px", lineHeight:1.7 }}>
          Video-powered boxing performance analysis for coaches and athletes.
          Live frame analysis, action tagging, athlete progress tracking — all running locally on your machine.
        </p>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:12 }}>
          <button onClick={() => nav("/app")} style={{ display:"flex", alignItems:"center", gap:8, background:"#2563eb", border:"none", cursor:"pointer", color:"white", fontSize:15, fontWeight:700, padding:"14px 28px", borderRadius:12 }}>
            Start Analysing <ArrowRight size={16} />
          </button>
          <button onClick={() => nav("/app/boxers")} style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", cursor:"pointer", color:"#d1d5db", fontSize:15, fontWeight:600, padding:"14px 28px", borderRadius:12 }}>
            <Play size={14} />Explore Platform
          </button>
        </div>
      </section>

      {/* Product preview */}
      <section style={{ maxWidth:1100, margin:"0 auto", padding:"0 32px 80px" }}>
        <div style={{ background:"#111827", border:"1px solid #1f2937", borderRadius:16, overflow:"hidden" }}>
          <div style={{ background:"#0f172a", borderBottom:"1px solid #1f2937", padding:"10px 16px", display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:10, height:10, borderRadius:"50%", background:"rgba(239,68,68,0.6)" }} />
            <div style={{ width:10, height:10, borderRadius:"50%", background:"rgba(245,158,11,0.6)" }} />
            <div style={{ width:10, height:10, borderRadius:"50%", background:"rgba(34,197,94,0.6)" }} />
            <span style={{ fontSize:11, color:"#6b7280", marginLeft:12, fontFamily:"monospace" }}>Valen Boxing Intelligence · Analysis Workspace</span>
          </div>
          <div style={{ padding:20, display:"grid", gridTemplateColumns:"130px 1fr 180px", gap:16 }}>
            {/* Left */}
            <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
              {["Jab","Cross","L.Hook","Defense","Footwork","Uppercut"].map(label => (
                <div key={label} style={{ background:"rgba(31,41,55,0.6)", border:"1px solid #374151", borderRadius:6, padding:"5px 10px", fontSize:11, color:"#9ca3af", borderLeft:`3px solid #3b82f6` }}>{label}</div>
              ))}
            </div>
            {/* Center */}
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div style={{ background:"#0f172a", border:"1px solid #1f2937", borderRadius:10, aspectRatio:"16/9", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <div style={{ textAlign:"center" }}>
                  <Monitor size={36} color="#374151" style={{ margin:"0 auto 8px" }} />
                  <p style={{ fontSize:12, color:"#6b7280" }}>Boxing Video Player</p>
                  <p style={{ fontSize:10, color:"#4b5563", marginTop:4 }}>HTML5 video with live frame analysis</p>
                </div>
              </div>
              <div style={{ background:"#0f172a", border:"1px solid #1f2937", borderRadius:10, padding:12 }}>
                <p style={{ fontSize:9, color:"#6b7280", marginBottom:8, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em" }}>Visual Activity Index · Live</p>
                <div style={{ display:"flex", alignItems:"flex-end", gap:1, height:36 }}>
                  {Array.from({ length: 80 }, (_, i) => {
                    const v = Math.sin(i * 0.25) * 25 + 45 + (i % 7) * 4
                    return <div key={i} style={{ flex:1, borderRadius:1, height:`${Math.min(100,Math.max(5,v))}%`, background:`hsl(${220-v*1.5},75%,${50+v*0.15}%)` }} />
                  })}
                </div>
              </div>
            </div>
            {/* Right */}
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {[
                { label:"Current Activity", value:"42.3", color:"#f59e0b" },
                { label:"Peak Activity",    value:"87.1", color:"#ef4444" },
                { label:"Avg Activity",     value:"38.6", color:"#3b82f6" },
                { label:"Frames",           value:"1,284", color:"#9ca3af" },
                { label:"Jabs Tagged",      value:"14",   color:"#60a5fa" },
                { label:"Round",            value:"2 / 3", color:"#22c55e" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background:"rgba(31,41,55,0.5)", border:"1px solid #1f2937", borderRadius:8, padding:"6px 10px" }}>
                  <p style={{ fontSize:9, color:"#6b7280" }}>{label}</p>
                  <p style={{ fontSize:14, fontWeight:800, marginTop:2, color }}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p style={{ textAlign:"center", fontSize:11, color:"#4b5563", marginTop:12 }}>
          Platform preview · Visual Activity Index is a pixel-difference calculation, not AI-generated data
        </p>
      </section>

      {/* How it works */}
      <section style={{ maxWidth:1000, margin:"0 auto", padding:"60px 32px", borderTop:"1px solid rgba(255,255,255,0.06)" }}>
        <h2 style={{ fontSize:36, fontWeight:800, textAlign:"center", marginBottom:12 }}>How It Works</h2>
        <p style={{ color:"#6b7280", textAlign:"center", fontSize:14, marginBottom:48, maxWidth:500, margin:"0 auto 48px" }}>
          A straightforward workflow designed for boxing coaches and performance staff.
        </p>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:20 }}>
          {[
            { n:"1", title:"Register Athlete", desc:"Create a permanent BX-XXXXXX athlete profile." },
            { n:"2", title:"Upload Video", desc:"Upload training footage. Stored on your local server." },
            { n:"3", title:"Open Workspace", desc:"Open the video analysis workspace for any session." },
            { n:"4", title:"Analyse & Tag", desc:"Play video. Live activity graph updates. Tag actions." },
            { n:"5", title:"Report", desc:"Save analysis and generate a professional PDF report." },
          ].map(({ n, title, desc }) => (
            <div key={n} style={{ textAlign:"center" }}>
              <div style={{ width:40, height:40, background:"rgba(37,99,235,0.15)", border:"1px solid rgba(59,130,246,0.3)", color:"#3b82f6", fontWeight:800, fontSize:15, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 12px" }}>{n}</div>
              <h3 style={{ fontSize:13, fontWeight:700, color:"white", marginBottom:6 }}>{title}</h3>
              <p style={{ fontSize:11, color:"#6b7280", lineHeight:1.6 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{ maxWidth:1000, margin:"0 auto", padding:"60px 32px", borderTop:"1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:20 }}>
          {[
            { icon:BarChart2, color:"#3b82f6", bg:"rgba(37,99,235,0.1)", title:"Live Visual Analysis",
              desc:"Frame-to-frame pixel analysis in the browser as the video plays. No AI models, no external APIs.",
              pts:["Browser-native Canvas processing","Configurable analysis region (ROI)","Web Worker for smooth playback","~5 fps sampling rate"] },
            { icon:Users, color:"#8b5cf6", bg:"rgba(139,92,246,0.1)", title:"Coach Annotation",
              desc:"Tag boxing actions at exact timestamps. Keyboard shortcuts for rapid tagging while watching.",
              pts:["Jab, Cross, Hook, Uppercut","Defensive movement & footwork","Per-round breakdown","Coach notes and observations"] },
            { icon:FileText, color:"#22c55e", bg:"rgba(34,197,94,0.1)", title:"Professional Reports",
              desc:"Generate PDF reports with real analysis data, tagged events and coach assessments.",
              pts:["ReportLab PDF generation","Activity metrics and chart","Tagged events timeline","Coach observations separated"] },
          ].map(({ icon:Icon, color, bg, title, desc, pts }) => (
            <div key={title} style={{ background:"#111827", border:"1px solid #1f2937", borderRadius:14, padding:24 }}>
              <div style={{ width:42, height:42, background:bg, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:14 }}>
                <Icon size={18} color={color} />
              </div>
              <h3 style={{ fontSize:16, fontWeight:700, color:"white", marginBottom:8 }}>{title}</h3>
              <p style={{ fontSize:12, color:"#6b7280", lineHeight:1.7, marginBottom:14 }}>{desc}</p>
              <ul style={{ listStyle:"none", padding:0, margin:0 }}>
                {pts.map(p => (
                  <li key={p} style={{ display:"flex", alignItems:"center", gap:7, fontSize:11, color:"#6b7280", marginBottom:5 }}>
                    <CheckCircle size={10} color={color} />{p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Privacy */}
      <section style={{ maxWidth:1000, margin:"0 auto", padding:"60px 32px", borderTop:"1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ background:"rgba(17,24,39,0.8)", border:"1px solid #1f2937", borderRadius:16, padding:32, display:"grid", gridTemplateColumns:"auto 1fr", gap:24 }}>
          <div style={{ width:52, height:52, background:"rgba(34,197,94,0.1)", border:"1px solid rgba(34,197,94,0.2)", borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <Shield size={22} color="#22c55e" />
          </div>
          <div>
            <h2 style={{ fontSize:22, fontWeight:800, marginBottom:12 }}>Video stays on your machine</h2>
            <p style={{ color:"#9ca3af", lineHeight:1.7, maxWidth:600, marginBottom:16, fontSize:13 }}>
              All video processing happens locally. Frame analysis runs in your browser using the HTML5 Canvas API.
              No video frames are sent to external servers or AI services. Athlete footage never leaves your local environment.
            </p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
              {["No external AI APIs","No cloud video processing","No model downloads","Browser-native Canvas API","Local file storage only","Coach data stays private"].map(item => (
                <div key={item} style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:"#9ca3af" }}>
                  <CheckCircle size={10} color="#22c55e" />{item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ maxWidth:700, margin:"0 auto", padding:"60px 32px 80px", textAlign:"center", borderTop:"1px solid rgba(255,255,255,0.06)" }}>
        <h2 style={{ fontSize:40, fontWeight:800, marginBottom:14 }}>Ready to analyse your first session?</h2>
        <p style={{ color:"#9ca3af", fontSize:15, marginBottom:28, lineHeight:1.7 }}>
          Register an athlete and upload a training video. The analysis workspace opens automatically.
        </p>
        <button onClick={() => nav("/app")} style={{ display:"inline-flex", alignItems:"center", gap:8, background:"#2563eb", border:"none", cursor:"pointer", color:"white", fontSize:16, fontWeight:700, padding:"16px 32px", borderRadius:14 }}>
          Open Valen Boxing Intelligence <ArrowRight size={18} />
        </button>
      </section>

      {/* Footer */}
      <footer style={{ borderTop:"1px solid rgba(255,255,255,0.06)", padding:"24px 32px" }}>
        <div style={{ maxWidth:1100, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:24, height:24, background:"#2563eb", borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Activity size={12} color="white" />
            </div>
            <div>
              <p style={{ fontSize:12, fontWeight:700 }}>Valen Boxing Intelligence</p>
              <p style={{ fontSize:10, color:"#6b7280" }}>by Valen Labs · valen.live</p>
            </div>
          </div>
          <div style={{ textAlign:"right" }}>
            <p style={{ fontSize:10, color:"#4b5563" }}>Visual Activity Index measures pixel-difference calculations only.</p>
            <p style={{ fontSize:10, color:"#4b5563" }}>Not a replacement for expert coaching assessment.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}