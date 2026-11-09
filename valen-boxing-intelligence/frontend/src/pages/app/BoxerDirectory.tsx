import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import Layout from "../../components/Layout"
import BoxerCard from "../../components/BoxerCard"
import { SkeletonCard } from "../../components/SkeletonLoader"
import { listBoxers } from "../../api/boxers"
import type { BoxerListItem, PaginatedResponse } from "../../types"
import { Search, PlusCircle, Users, ChevronLeft, ChevronRight } from "lucide-react"

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
      .then((r) => setData(r))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [debounced, page])

  useEffect(() => { load() }, [load])

  return (
    <Layout>
      <div className="px-6 py-6">
        <div className="page-header">
          <div>
            <h1>Athlete Directory</h1>
            <p>
              {data
                ? `${data.meta.total} athlete${data.meta.total !== 1 ? "s" : ""} registered`
                : "Loading…"}
            </p>
          </div>
          <button
            onClick={() => nav("/app/boxers/new")}
            className="btn-primary flex items-center gap-2"
          >
            <PlusCircle size={14} />
            Register Athlete
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--color-text-muted)' }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or ID…"
            className="input pl-9 max-w-md"
          />
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : !data || data.data.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">
                <Users size={22} />
              </div>
              <h3>{debounced ? "No results found" : "No athletes yet"}</h3>
              <p>
                {debounced
                  ? `No athletes match "${debounced}". Try a different name or ID.`
                  : "Register your first athlete to get started."}
              </p>
              {!debounced && (
                <button
                  onClick={() => nav("/app/boxers/new")}
                  className="btn-primary mt-2"
                >
                  Register Athlete
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
              {data.data.map((b) => <BoxerCard key={b.id} boxer={b} />)}
            </div>

            {/* Pagination */}
            {data.meta.total_pages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-6">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-secondary flex items-center gap-1"
                  style={{ opacity: page === 1 ? 0.4 : 1 }}
                >
                  <ChevronLeft size={13} /> Prev
                </button>
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  {page} / {data.meta.total_pages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(data.meta.total_pages, p + 1))}
                  disabled={page === data.meta.total_pages}
                  className="btn-secondary flex items-center gap-1"
                  style={{ opacity: page === data.meta.total_pages ? 0.4 : 1 }}
                >
                  Next <ChevronRight size={13} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
