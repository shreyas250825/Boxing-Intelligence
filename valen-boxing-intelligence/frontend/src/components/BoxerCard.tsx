import { useNavigate } from "react-router-dom"
import type { BoxerListItem } from "../types"
import { User, Shield, ArrowRight } from "lucide-react"

export default function BoxerCard({ boxer }: { boxer: BoxerListItem }) {
  const nav = useNavigate()
  return (
    <div
      onClick={() => nav(`/app/boxers/${boxer.id}`)}
      className="bg-white border border-gray-200 hover:border-blue-300 hover:shadow-md rounded-xl p-5 cursor-pointer transition-all group"
    >
      <div className="flex items-start justify-between">
        <div>
          <span className="inline-block text-[10px] font-mono font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded mb-1">
            {boxer.permanent_id}
          </span>
          <h3 className="text-gray-900 font-semibold text-sm group-hover:text-blue-700 transition-colors">
            {boxer.full_name}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            boxer.status === "active"
              ? "bg-green-50 text-green-700"
              : "bg-gray-100 text-gray-500"
          }`}>
            {boxer.status}
          </span>
          <ArrowRight size={14} className="text-gray-300 group-hover:text-blue-400 transition-colors" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Shield size={11} className="text-gray-400" />
          {boxer.stance}
        </span>
        <span className="flex items-center gap-1">
          <User size={11} className="text-gray-400" />
          {boxer.experience_level}
        </span>
        {boxer.weight_class && (
          <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px]">
            {boxer.weight_class}
          </span>
        )}
      </div>
    </div>
  )
}