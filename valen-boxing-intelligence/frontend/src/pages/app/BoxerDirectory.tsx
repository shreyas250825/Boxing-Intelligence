import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import Layout from "../../components/Layout"
import BoxerCard from "../../components/BoxerCard"
import { SkeletonCard } from "../../components/SkeletonLoader"
import { listBoxers } from "../../api/boxers"
import type { BoxerListItem, PaginatedResponse } from "../../types"
import { Search, PlusCircle, Users } from "lucide-react"

export default function BoxerDirectory() {
  const nav = useNavigate()
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")
  const [data, setData] = useState<PaginatedResponse<BoxerListItem> | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(() => {
    setLoading(true)
    listBoxers({ search: debounced || undefined, page, page_size: 20 })
      .then(r => setData(r)).catch(() => {}).finally(() => setLoading(false))
  }, [debounced, page])

  useEffect(() => { load() }, [load])

  return (
    <Layout>
      <div className="px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Athlete Directory</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {data ? (data.meta.total + " athlete" + (data.meta.total !== 1 ? "s" : "") + " registered") : "Loading…"}
            </p>
          </div>
          <button onClick={() => nav("/app/boxers/new")} className="btn-primary flex items-center gap-2">
            <PlusCircle size={14} />Register Athlete
          </button>
        </div>

        <div className="relative mb-6">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or ID…" className="input pl-9 max-w-md" />
        </div>

        {loading ? (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : !data || data.data.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users size={24} className="text-gray-300" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">No athletes found</h3>
            <p className="text-sm text-gray-500 mb-4">
              {debounced ? ("No results for " + debounced) : "Register your first athlete to get started."}
            </p>
            <button onClick={() => nav("/app/boxers/new")} className="btn-primary">Register Athlete</button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
              {data.data.map(b => <BoxerCard key={b.id} boxer={b} />)}
            </div>
            {data.meta.total_pages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-6">
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1} className="btn-secondary disabled:opacity-40">Prev</button>
                <span className="text-sm text-gray-500">{page} / {data.meta.total_pages}</span>
                <button onClick={() => setPage(p => Math.min(data.meta.total_pages, p+1))} disabled={page===data.meta.total_pages} className="btn-secondary disabled:opacity-40">Next</button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}