import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Droplets, Flame, Save, Scale, Utensils } from "lucide-react"

import { getBoxer } from "../../api/boxers"
import {
  createFoodEntry,
  createHydrationEntry,
  createMealPlan,
  createWeightRecord,
  getFoodDatabase,
  getMealPlans,
  getNutritionSummary,
  saveNutritionProfile,
} from "../../api/nutrition"
import Layout from "../../components/Layout"
import type { Boxer, FoodEntry, HydrationEntry, MealPlan, WeightRecord } from "../../types"

const today = new Date().toISOString().slice(0, 10)

const defaultProfile = {
  age: "",
  height_cm: "",
  current_weight_kg: "",
  target_weight_kg: "",
  target_competition_weight_category: "",
  dietary_preferences: "",
  meal_timing: "",
  nutrition_goals: "",
  target_calories: "",
  target_protein_g: "",
  target_carbs_g: "",
  target_fat_g: "",
  target_fibre_g: "",
  vegetarian: false,
}

const defaultFoodForm = {
  entry_date: today,
  meal_type: "breakfast",
  food_name: "",
  quantity: "1 serving",
  serving_size: "",
  calories: "",
  protein_g: "",
  carbs_g: "",
  fat_g: "",
  fibre_g: "",
  meal_time: "08:00",
  notes: "",
}

const defaultHydrationForm = {
  entry_date: today,
  drink_name: "Water",
  amount_ml: "500",
  time_of_day: "morning",
  notes: "",
}

const defaultWeightForm = {
  entry_date: today,
  weight_kg: "",
  notes: "",
}

const defaultMealPlanForm = {
  title: "High-energy camp day",
  plan_date: today,
  meal_type: "breakfast",
  notes: "",
  adherence_status: "planned",
  assigned_nutritionist: "Coach Nutrition",
}

export default function NutritionWorkspace() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [boxer, setBoxer] = useState<Boxer | null>(null)
  const [summary, setSummary] = useState<Record<string, any> | null>(null)
  const [profileForm, setProfileForm] = useState(defaultProfile)
  const [foodForm, setFoodForm] = useState(defaultFoodForm)
  const [hydrationForm, setHydrationForm] = useState(defaultHydrationForm)
  const [weightForm, setWeightForm] = useState(defaultWeightForm)
  const [mealPlanForm, setMealPlanForm] = useState(defaultMealPlanForm)
  const [foodEntries, setFoodEntries] = useState<FoodEntry[]>([])
  const [hydrationEntries, setHydrationEntries] = useState<HydrationEntry[]>([])
  const [weightRecords, setWeightRecords] = useState<WeightRecord[]>([])
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([])
  const [foodDatabase, setFoodDatabase] = useState<Array<Record<string, any>>>([])
  const [foodSearch, setFoodSearch] = useState("")
  const [loading, setLoading] = useState(true)

  const load = async () => {
    if (!id) return
    const [nextBoxer, nextSummary, nextPlans] = await Promise.all([
      getBoxer(id),
      getNutritionSummary(id, today),
      getMealPlans(id),
    ])

    setBoxer(nextBoxer)
    setSummary(nextSummary)
    setMealPlans(nextPlans)
    setFoodEntries(nextSummary.food_entries ?? [])
    setHydrationEntries(nextSummary.hydration_entries ?? [])
    setWeightRecords(nextSummary.weight_history ?? [])

    const profile = nextSummary.profile ?? {}
    setProfileForm({
      age: profile.age ?? "",
      height_cm: profile.height_cm ?? "",
      current_weight_kg: profile.current_weight_kg ?? "",
      target_weight_kg: profile.target_weight_kg ?? "",
      target_competition_weight_category: profile.target_competition_weight_category ?? "",
      dietary_preferences: profile.dietary_preferences ?? "",
      meal_timing: profile.meal_timing ?? "",
      nutrition_goals: profile.nutrition_goals ?? "",
      target_calories: profile.target_calories ?? "",
      target_protein_g: profile.target_protein_g ?? "",
      target_carbs_g: profile.target_carbs_g ?? "",
      target_fat_g: profile.target_fat_g ?? "",
      target_fibre_g: profile.target_fibre_g ?? "",
      vegetarian: Boolean(profile.vegetarian),
    })
  }

  useEffect(() => {
    if (!id) return
    Promise.all([getBoxer(id), getNutritionSummary(id, today), getMealPlans(id)])
      .then(([nextBoxer, nextSummary, nextPlans]) => {
        setBoxer(nextBoxer)
        setSummary(nextSummary)
        setMealPlans(nextPlans)
        setFoodEntries(nextSummary.food_entries ?? [])
        setHydrationEntries(nextSummary.hydration_entries ?? [])
        setWeightRecords(nextSummary.weight_history ?? [])

        const profile = nextSummary.profile ?? {}
        setProfileForm({
          age: profile.age ?? "",
          height_cm: profile.height_cm ?? "",
          current_weight_kg: profile.current_weight_kg ?? "",
          target_weight_kg: profile.target_weight_kg ?? "",
          target_competition_weight_category: profile.target_competition_weight_category ?? "",
          dietary_preferences: profile.dietary_preferences ?? "",
          meal_timing: profile.meal_timing ?? "",
          nutrition_goals: profile.nutrition_goals ?? "",
          target_calories: profile.target_calories ?? "",
          target_protein_g: profile.target_protein_g ?? "",
          target_carbs_g: profile.target_carbs_g ?? "",
          target_fat_g: profile.target_fat_g ?? "",
          target_fibre_g: profile.target_fibre_g ?? "",
          vegetarian: Boolean(profile.vegetarian),
        })
      })
      .catch(() => navigate("/app/boxers"))
      .finally(() => setLoading(false))
  }, [id, navigate])

  useEffect(() => {
    getFoodDatabase(foodSearch || undefined)
      .then((items) => setFoodDatabase(items))
      .catch(() => setFoodDatabase([]))
  }, [foodSearch])

  const totals = useMemo(() => summary?.totals ?? {
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    fibre_g: 0,
    hydration_ml: 0,
  }, [summary])

  const handleSaveProfile = async () => {
    if (!id) return
    const payload = {
      ...profileForm,
      age: profileForm.age === "" ? null : Number(profileForm.age),
      height_cm: profileForm.height_cm === "" ? null : Number(profileForm.height_cm),
      current_weight_kg: profileForm.current_weight_kg === "" ? null : Number(profileForm.current_weight_kg),
      target_weight_kg: profileForm.target_weight_kg === "" ? null : Number(profileForm.target_weight_kg),
      target_calories: profileForm.target_calories === "" ? null : Number(profileForm.target_calories),
      target_protein_g: profileForm.target_protein_g === "" ? null : Number(profileForm.target_protein_g),
      target_carbs_g: profileForm.target_carbs_g === "" ? null : Number(profileForm.target_carbs_g),
      target_fat_g: profileForm.target_fat_g === "" ? null : Number(profileForm.target_fat_g),
      target_fibre_g: profileForm.target_fibre_g === "" ? null : Number(profileForm.target_fibre_g),
    }
    await saveNutritionProfile(id, payload)
    await load()
  }

  const handleFoodSubmit = async () => {
    if (!id) return
    await createFoodEntry(id, {
      ...foodForm,
      calories: Number(foodForm.calories || 0),
      protein_g: Number(foodForm.protein_g || 0),
      carbs_g: Number(foodForm.carbs_g || 0),
      fat_g: Number(foodForm.fat_g || 0),
      fibre_g: Number(foodForm.fibre_g || 0),
    })
    setFoodForm(defaultFoodForm)
    await load()
  }

  const handleHydrationSubmit = async () => {
    if (!id) return
    await createHydrationEntry(id, {
      ...hydrationForm,
      amount_ml: Number(hydrationForm.amount_ml || 0),
    })
    setHydrationForm(defaultHydrationForm)
    await load()
  }

  const handleWeightSubmit = async () => {
    if (!id) return
    await createWeightRecord(id, {
      ...weightForm,
      weight_kg: Number(weightForm.weight_kg || 0),
    })
    setWeightForm(defaultWeightForm)
    await load()
  }

  const handleMealPlanSubmit = async () => {
    if (!id) return
    await createMealPlan(id, {
      ...mealPlanForm,
      title: mealPlanForm.title || "High-energy camp day",
      adherence_status: mealPlanForm.adherence_status || "planned",
      foods_json: JSON.stringify([{ name: "Oats", calories: 300 }, { name: "Chicken rice bowl", calories: 540 }]),
    })
    setMealPlanForm(defaultMealPlanForm)
    await load()
  }

  if (loading) {
    return (
      <Layout>
        <div className="px-8 py-8 max-w-6xl">
          <div className="card p-8">Loading nutrition workspace…</div>
        </div>
      </Layout>
    )
  }

  if (!boxer) return null

  return (
    <Layout>
      <div className="px-8 py-8 max-w-6xl">
        <Link to={`/app/boxers/${id}`} className="flex items-center gap-2 text-sm text-slate-300 hover:text-white mb-6">
          <ArrowLeft size={14} />
          Back to athlete profile
        </Link>

        <div className="card p-6 mb-6">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-300">Nutrition and performance</p>
              <h1 className="text-2xl font-bold text-white mt-2">{boxer.full_name}</h1>
              <p className="mt-2 text-sm text-slate-300">
                Fueling, hydration, and body-composition targets designed to support training load and fight prep.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-200">Latest weight</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {weightRecords[0]?.weight_kg ? `${weightRecords[0].weight_kg} kg` : "No data"}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: "Calories", value: `${totals.calories} kcal`, tone: "orange", icon: Flame },
            { label: "Protein", value: `${totals.protein_g} g`, tone: "blue", icon: Utensils },
            { label: "Hydration", value: `${totals.hydration_ml} ml`, tone: "cyan", icon: Droplets },
            { label: "Body weight", value: weightRecords[0] ? `${weightRecords[0].weight_kg} kg` : "—", tone: "green", icon: Scale },
          ].map(({ label, value, tone, icon: Icon }) => (
            <div key={label} className="card p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">{label}</p>
                <Icon size={16} className={tone === "orange" ? "text-orange-300" : tone === "blue" ? "text-blue-300" : tone === "cyan" ? "text-cyan-300" : "text-emerald-300"} />
              </div>
              <p className="mt-4 text-xl font-semibold text-white">{value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="card p-5">
            <h3 className="text-base font-semibold text-white mb-4">Nutrition profile</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Age</label>
                <input value={profileForm.age} onChange={(e) => setProfileForm((p) => ({ ...p, age: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">Height (cm)</label>
                <input value={profileForm.height_cm} onChange={(e) => setProfileForm((p) => ({ ...p, height_cm: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">Current weight (kg)</label>
                <input value={profileForm.current_weight_kg} onChange={(e) => setProfileForm((p) => ({ ...p, current_weight_kg: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">Target weight (kg)</label>
                <input value={profileForm.target_weight_kg} onChange={(e) => setProfileForm((p) => ({ ...p, target_weight_kg: e.target.value }))} className="input" />
              </div>
              <div className="col-span-2">
                <label className="label">Competition category</label>
                <input value={profileForm.target_competition_weight_category} onChange={(e) => setProfileForm((p) => ({ ...p, target_competition_weight_category: e.target.value }))} className="input" />
              </div>
              <div className="col-span-2">
                <label className="label">Dietary preferences</label>
                <input value={profileForm.dietary_preferences} onChange={(e) => setProfileForm((p) => ({ ...p, dietary_preferences: e.target.value }))} className="input" />
              </div>
              <div className="col-span-2">
                <label className="label">Nutrition goals</label>
                <textarea value={profileForm.nutrition_goals} onChange={(e) => setProfileForm((p) => ({ ...p, nutrition_goals: e.target.value }))} className="input resize-none" rows={3} />
              </div>
              <div>
                <label className="label">Target calories</label>
                <input value={profileForm.target_calories} onChange={(e) => setProfileForm((p) => ({ ...p, target_calories: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">Target protein (g)</label>
                <input value={profileForm.target_protein_g} onChange={(e) => setProfileForm((p) => ({ ...p, target_protein_g: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">Carbs (g)</label>
                <input value={profileForm.target_carbs_g} onChange={(e) => setProfileForm((p) => ({ ...p, target_carbs_g: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">Fat (g)</label>
                <input value={profileForm.target_fat_g} onChange={(e) => setProfileForm((p) => ({ ...p, target_fat_g: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">Fibre (g)</label>
                <input value={profileForm.target_fibre_g} onChange={(e) => setProfileForm((p) => ({ ...p, target_fibre_g: e.target.value }))} className="input" />
              </div>
              <div className="flex items-center gap-2 pt-7">
                <input type="checkbox" checked={profileForm.vegetarian} onChange={(e) => setProfileForm((p) => ({ ...p, vegetarian: e.target.checked }))} />
                <span className="text-sm text-slate-300">Vegetarian</span>
              </div>
            </div>
            <button onClick={handleSaveProfile} className="btn-primary mt-5">
              <Save size={14} />
              Save profile
            </button>
          </div>

          <div className="card p-5">
            <h3 className="text-base font-semibold text-white mb-4">Add meal</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Date</label>
                <input type="date" value={foodForm.entry_date} onChange={(e) => setFoodForm((p) => ({ ...p, entry_date: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">Meal type</label>
                <select value={foodForm.meal_type} onChange={(e) => setFoodForm((p) => ({ ...p, meal_type: e.target.value }))} className="input">
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                  <option value="pre_training">Pre-training</option>
                  <option value="post_training">Post-training</option>
                  <option value="evening_snack">Evening snack</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">Food search</label>
                <input value={foodSearch} onChange={(e) => setFoodSearch(e.target.value)} className="input" placeholder="Search common foods" />
                <input value={foodForm.food_name} onChange={(e) => setFoodForm((p) => ({ ...p, food_name: e.target.value }))} className="input mt-2" placeholder="Or type a food name" />
              </div>

              {foodDatabase.length > 0 && (
                <div className="col-span-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <p className="mb-2 text-[10px] uppercase tracking-[0.12em] text-slate-400">Suggested foods</p>
                  <div className="flex flex-wrap gap-2">
                    {foodDatabase.slice(0, 6).map((item) => (
                      <button
                        key={String(item.name)}
                        type="button"
                        onClick={() => setFoodForm((p) => ({
                          ...p,
                          food_name: String(item.name ?? ""),
                          calories: String(item.calories ?? 0),
                          protein_g: String(item.protein_g ?? 0),
                          carbs_g: String(item.carbs_g ?? 0),
                          fat_g: String(item.fat_g ?? 0),
                          fibre_g: String(item.fibre_g ?? 0),
                          serving_size: String(item.serving_size ?? ""),
                        }))}
                        className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 hover:border-orange-400"
                      >
                        {String(item.name)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="label">Calories</label>
                <input value={foodForm.calories} onChange={(e) => setFoodForm((p) => ({ ...p, calories: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">Serving</label>
                <input value={foodForm.serving_size} onChange={(e) => setFoodForm((p) => ({ ...p, serving_size: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">Protein (g)</label>
                <input value={foodForm.protein_g} onChange={(e) => setFoodForm((p) => ({ ...p, protein_g: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">Carbs (g)</label>
                <input value={foodForm.carbs_g} onChange={(e) => setFoodForm((p) => ({ ...p, carbs_g: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">Fat (g)</label>
                <input value={foodForm.fat_g} onChange={(e) => setFoodForm((p) => ({ ...p, fat_g: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">Fibre (g)</label>
                <input value={foodForm.fibre_g} onChange={(e) => setFoodForm((p) => ({ ...p, fibre_g: e.target.value }))} className="input" />
              </div>
            </div>
            <button onClick={handleFoodSubmit} className="btn-primary mt-5">Add food entry</button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 mt-6">
          <div className="card p-5">
            <h3 className="text-base font-semibold text-white mb-4">Hydration</h3>
            <div className="space-y-3">
              <div>
                <label className="label">Drink</label>
                <input value={hydrationForm.drink_name} onChange={(e) => setHydrationForm((p) => ({ ...p, drink_name: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">Amount (ml)</label>
                <input value={hydrationForm.amount_ml} onChange={(e) => setHydrationForm((p) => ({ ...p, amount_ml: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">Time of day</label>
                <input value={hydrationForm.time_of_day} onChange={(e) => setHydrationForm((p) => ({ ...p, time_of_day: e.target.value }))} className="input" />
              </div>
              <button onClick={handleHydrationSubmit} className="btn-primary w-full">Log hydration</button>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-base font-semibold text-white mb-4">Weight check</h3>
            <div className="space-y-3">
              <div>
                <label className="label">Date</label>
                <input type="date" value={weightForm.entry_date} onChange={(e) => setWeightForm((p) => ({ ...p, entry_date: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">Weight (kg)</label>
                <input value={weightForm.weight_kg} onChange={(e) => setWeightForm((p) => ({ ...p, weight_kg: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea value={weightForm.notes} onChange={(e) => setWeightForm((p) => ({ ...p, notes: e.target.value }))} className="input resize-none" rows={3} />
              </div>
              <button onClick={handleWeightSubmit} className="btn-primary w-full">Save weight</button>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-base font-semibold text-white mb-4">Meal plan</h3>
            <div className="space-y-3">
              <div>
                <label className="label">Title</label>
                <input value={mealPlanForm.title} onChange={(e) => setMealPlanForm((p) => ({ ...p, title: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">Plan date</label>
                <input type="date" value={mealPlanForm.plan_date} onChange={(e) => setMealPlanForm((p) => ({ ...p, plan_date: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea value={mealPlanForm.notes} onChange={(e) => setMealPlanForm((p) => ({ ...p, notes: e.target.value }))} className="input resize-none" rows={3} />
              </div>
              <button onClick={handleMealPlanSubmit} className="btn-primary w-full">Create meal plan</button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mt-6">
          <div className="card p-5">
            <h3 className="text-base font-semibold text-white mb-4">Food log</h3>
            <div className="space-y-2">
              {foodEntries.length === 0 ? (
                <p className="text-sm text-slate-400">No food entries yet.</p>
              ) : (
                foodEntries.slice(0, 6).map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <div className="flex justify-between gap-3">
                      <p className="font-medium text-white">{entry.food_name}</p>
                      <span className="text-xs uppercase tracking-[0.12em] text-orange-300">{entry.meal_type}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{entry.calories} kcal · {entry.protein_g}g protein</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-base font-semibold text-white mb-4">Hydration log</h3>
            <div className="space-y-2">
              {hydrationEntries.length === 0 ? (
                <p className="text-sm text-slate-400">No hydration entries yet.</p>
              ) : (
                hydrationEntries.slice(0, 6).map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <div className="flex justify-between gap-3">
                      <p className="font-medium text-white">{entry.drink_name}</p>
                      <span className="text-xs uppercase tracking-[0.12em] text-cyan-300">{entry.amount_ml}ml</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{entry.time_of_day ?? "Daily"}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="card p-5 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white">Meal plans</h3>
            <span className="text-xs uppercase tracking-[0.12em] text-slate-400">{mealPlans.length} saved</span>
          </div>
          <div className="space-y-2">
            {mealPlans.length === 0 ? (
              <p className="text-sm text-slate-400">No meal plans saved.</p>
            ) : (
              mealPlans.map((plan) => (
                <div key={plan.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="flex justify-between gap-3">
                    <p className="font-medium text-white">{plan.title}</p>
                    <span className="text-[10px] uppercase tracking-[0.12em] text-emerald-300">{plan.adherence_status}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{plan.plan_date} · {plan.meal_type}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
