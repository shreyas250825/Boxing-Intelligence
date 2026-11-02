import apiClient from './client'
import type { NutritionProfile, HydrationEntry, FoodEntry, WeightRecord, MealPlan } from '../types'

export const getFoodDatabase = (q?: string) =>
  apiClient.get<{ data: Array<Record<string, unknown>> }>(`/api/v1/nutrition/food-database`, { params: { q } }).then((r) => r.data.data)

export const getNutritionProfile = (boxerId: string) =>
  apiClient.get<{ data: NutritionProfile | null }>(`/api/v1/nutrition/boxers/${boxerId}/profile`).then((r) => r.data.data)

export const saveNutritionProfile = (boxerId: string, payload: Partial<NutritionProfile>) =>
  apiClient.post<{ data: NutritionProfile }>(`/api/v1/nutrition/boxers/${boxerId}/profile`, payload).then((r) => r.data.data)

export const getFoodDiary = (boxerId: string, entryDate?: string) =>
  apiClient.get<{ data: FoodEntry[] }>(`/api/v1/nutrition/boxers/${boxerId}/food-diary`, { params: { entry_date: entryDate } }).then((r) => r.data.data)

export const createFoodEntry = (boxerId: string, payload: Partial<FoodEntry>) =>
  apiClient.post<{ data: FoodEntry }>(`/api/v1/nutrition/boxers/${boxerId}/food-diary`, payload).then((r) => r.data.data)

export const getMealPlans = (boxerId: string) =>
  apiClient.get<{ data: MealPlan[] }>(`/api/v1/nutrition/boxers/${boxerId}/meal-plans`).then((r) => r.data.data)

export const createMealPlan = (boxerId: string, payload: Partial<MealPlan>) =>
  apiClient.post<{ data: MealPlan }>(`/api/v1/nutrition/boxers/${boxerId}/meal-plans`, payload).then((r) => r.data.data)

export const getHydration = (boxerId: string, entryDate?: string) =>
  apiClient.get<{ data: HydrationEntry[] }>(`/api/v1/nutrition/boxers/${boxerId}/hydration`, { params: { entry_date: entryDate } }).then((r) => r.data.data)

export const createHydrationEntry = (boxerId: string, payload: Partial<HydrationEntry>) =>
  apiClient.post<{ data: HydrationEntry }>(`/api/v1/nutrition/boxers/${boxerId}/hydration`, payload).then((r) => r.data.data)

export const getWeights = (boxerId: string) =>
  apiClient.get<{ data: WeightRecord[] }>(`/api/v1/nutrition/boxers/${boxerId}/weights`).then((r) => r.data.data)

export const createWeightRecord = (boxerId: string, payload: Partial<WeightRecord>) =>
  apiClient.post<{ data: WeightRecord }>(`/api/v1/nutrition/boxers/${boxerId}/weights`, payload).then((r) => r.data.data)

export const getNutritionSummary = (boxerId: string, entryDate?: string) =>
  apiClient.get<{ data: Record<string, any> }>(`/api/v1/nutrition/boxers/${boxerId}/summary`, { params: { entry_date: entryDate } }).then((r) => r.data.data)
