import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { AlertTriangle } from "lucide-react"

interface DataPoint { session_date: string; value: number; session_type: string; source_note: string }
interface Props { data: Record<string, DataPoint[]>; warnings?: string[] }

const COLORS = ["#2563eb","#7c3aed","#059669","#d97706","#dc2626"]

export default function ProgressChart({ data, warnings = [] }: Props) {
  const keys = Object.keys(data)
  if (keys.length === 0) return (
    <div className="card p-10 text-center text-gray-400 text-sm">No metric data yet.</div>
  )

  return (
    <div className="space-y-4">
      {warnings.length > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            {warnings.map((w, i) => <p key={i} className="text-xs text-amber-800">{w}</p>)}
          </div>
        </div>
      )}
      {keys.map((key, ki) => {
        const points = (data[key] || [])
          .filter(p => p.session_date)
          .sort((a, b) => a.session_date.localeCompare(b.session_date))
          .map(p => ({ date: p.session_date, value: Number(p.value.toFixed(3)) }))
        if (points.length === 0) return null
        return (
          <div key={key} className="card p-5">
            <h4 className="text-sm font-semibold text-gray-800 mb-4 capitalize">{key.replace(/_/g, " ")}</h4>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={points} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} width={45} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)" }}
                  labelStyle={{ color: "#1e293b", fontWeight: 600, fontSize: 12 }}
                  itemStyle={{ color: COLORS[ki % COLORS.length], fontSize: 12 }}
                />
                <Line type="monotone" dataKey="value" stroke={COLORS[ki % COLORS.length]}
                  strokeWidth={2.5} dot={{ r: 4, fill: COLORS[ki % COLORS.length], strokeWidth: 0 }}
                  activeDot={{ r: 6, strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )
      })}
    </div>
  )
}